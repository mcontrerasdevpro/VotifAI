import { Router } from 'express';
import Stripe from 'stripe';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { PLANES } from '../lib/planes.js';
import { obtenerEstadoSuscripcion } from '../lib/suscripciones.js';

const router = Router();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const PRICE_ENV_BY_PLAN = {
  starter: 'STRIPE_PRICE_STARTER',
  profesional: 'STRIPE_PRICE_PROFESIONAL',
  premium: 'STRIPE_PRICE_PREMIUM'
};

router.get('/billing/planes', (req, res) => {
  res.json({
    planes: Object.entries(PLANES).map(([id, plan]) => ({
      id,
      nombre: plan.nombre,
      precioDesde: plan.precioDesde,
      maxFincas: plan.maxFincas,
      maxPropietariosPorFinca: plan.maxPropietariosPorFinca,
      transcripcionVoz: plan.transcripcionVoz,
      disponibleParaCheckout: Boolean(PRICE_ENV_BY_PLAN[id] && process.env[PRICE_ENV_BY_PLAN[id]] && process.env.STRIPE_TAX_RATE_IVA)
    }))
  });
});

router.get('/billing/estado', requireAuth, async (req, res) => {
  try {
    const estado = await obtenerEstadoSuscripcion(req.tenantId, { conPrueba: true });
    if (!estado) return res.status(404).json({ error: 'Despacho no encontrado.' });
    res.json({ estado });
  } catch (error) {
    console.error('Error al consultar estado de billing:', error.message);
    res.status(500).json({ error: 'No se pudo consultar el estado de la suscripción.' });
  }
});

const ESTADOS_CON_SUSCRIPCION_VIVA = new Set(['active', 'past_due', 'trialing']);
const urlBase = (req) => `${req.protocol}://${req.get('host')}`;

// Un despacho con suscripción ya en marcha NO pasa por un checkout nuevo:
// eso crearía una segunda suscripción y Stripe le cobraría los dos planes
// cada mes. Se cambia el precio de la suscripción existente y, si no tiene
// ninguna viva, se abre un checkout normal.
router.post('/billing/checkout', requireAuth, async (req, res) => {
  const plan = String(req.body.plan || '').trim().toLowerCase();
  const priceEnv = PRICE_ENV_BY_PLAN[plan];
  const priceId = priceEnv && process.env[priceEnv];
  // Precios publicados sin IVA: el 21 % se añade como tax rate de Stripe
  // (exclusivo). Sin él no se cobra, para no emitir facturas sin IVA.
  const taxRateIva = process.env.STRIPE_TAX_RATE_IVA;

  if (!priceId || !stripe || !taxRateIva) {
    return res.status(503).json({ error: 'El checkout todavía no está configurado para este plan.' });
  }

  try {
    const tenantResult = await query(
      `SELECT id, nombre_entidad, email_maestro, proveedor_cliente_id, proveedor_suscripcion_id, plan_suscripcion, suscripcion_estado
       FROM tenants WHERE id = $1`,
      [req.tenantId]
    );
    const tenant = tenantResult.rows[0];
    if (!tenant) return res.status(404).json({ error: 'Despacho no encontrado.' });

    // Vale tanto para cambiar de plan como para contratar el primero: la
    // prueba puede ser de un plan mayor (p. ej. Premium) y el despacho haber
    // dado de alta más fincas de las que admite el que ahora quiere pagar.
    const fincas = await query('SELECT COUNT(*)::int AS total FROM entities WHERE tenant_id = $1', [tenant.id]);
    const limite = PLANES[plan].maxFincas;
    if (limite !== null && fincas.rows[0].total > limite) {
      return res.status(409).json({
        error: `Tienes ${fincas.rows[0].total} fincas y el plan ${PLANES[plan].nombre} admite ${limite}. Elige un plan mayor o da de baja fincas antes de contratar este.`
      });
    }

    if (tenant.proveedor_suscripcion_id) {
      const suscripcion = await stripe.subscriptions.retrieve(tenant.proveedor_suscripcion_id).catch(() => null);
      if (suscripcion && ESTADOS_CON_SUSCRIPCION_VIVA.has(suscripcion.status)) {
        if (tenant.plan_suscripcion === plan) {
          return res.status(409).json({ error: 'Ya tienes contratado este plan.' });
        }

        await stripe.subscriptions.update(suscripcion.id, {
          items: [{ id: suscripcion.items.data[0].id, price: priceId }],
          // La diferencia se factura y cobra en el acto (en una bajada queda
          // como saldo a favor). Con 'create_prorations' se dejaba para la
          // siguiente factura: el despacho disfrutaba el plan superior un
          // mes sin pagarlo y, si cancelaba antes de renovar, Stripe no
          // llegaba a cobrar esa diferencia nunca.
          proration_behavior: 'always_invoice',
          metadata: { tenantId: tenant.id, plan }
        });
        // El webhook customer.subscription.updated lo confirmará igualmente;
        // se actualiza ya para que el cambio se vea al volver a la pantalla.
        await query('UPDATE tenants SET plan_suscripcion = $1 WHERE id = $2', [plan, tenant.id]);
        return res.json({ cambiado: true, plan });
      }
    }

    let customerId = tenant.proveedor_cliente_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.email_maestro,
        name: tenant.nombre_entidad,
        metadata: { tenantId: tenant.id }
      });
      customerId = customer.id;
      await query('UPDATE tenants SET proveedor_cliente_id = $1 WHERE id = $2', [customerId, tenant.id]);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Datos fiscales del despacho para que la factura sea válida: razón
      // social, dirección y NIF/CIF quedan guardados en el customer.
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { name: 'auto', address: 'auto' },
      success_url: process.env.BILLING_SUCCESS_URL || `${urlBase(req)}/hub?billing=success`,
      cancel_url: process.env.BILLING_CANCEL_URL || `${urlBase(req)}/hub?billing=cancelled`,
      subscription_data: { metadata: { tenantId: tenant.id, plan }, default_tax_rates: [taxRateIva] },
      // La cuenta de Stripe (compartida por todos los proyectos de NexuraIA)
      // trae Managed Payments activado por defecto: Stripe haría de
      // vendedor y calcularía él el IVA, lo que rechaza default_tax_rates.
      // VotifAI factura como NexuraIA con el 21 % fijo, así que se desactiva
      // aquí, por petición, sin depender del ajuste de la cuenta.
      managed_payments: { enabled: false },
      metadata: { tenantId: tenant.id, plan }
    });

    res.status(201).json({ url: session.url });
  } catch (error) {
    console.error('Error al crear checkout de Stripe:', error.message);
    // 500 y no 502: el proxy de EasyPanel sustituye cualquier 502 por su
    // propia página HTML y el frontend perdería el mensaje de error.
    res.status(500).json({ error: 'No se pudo iniciar el checkout.', detalle: error.message });
  }
});

// Portal de cliente alojado por Stripe: cambiar tarjeta, descargar
// facturas y cancelar. Requiere haber guardado una configuración del portal
// en el dashboard de Stripe (una vez por modo, test y live).
router.post('/billing/portal', requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'La facturación todavía no está configurada.' });

  try {
    const tenantResult = await query('SELECT proveedor_cliente_id FROM tenants WHERE id = $1', [req.tenantId]);
    const customerId = tenantResult.rows[0]?.proveedor_cliente_id;
    if (!customerId) return res.status(409).json({ error: 'Todavía no tienes ninguna suscripción que gestionar.' });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${urlBase(req)}/billing`
    });
    res.status(201).json({ url: session.url });
  } catch (error) {
    console.error('Error al abrir el portal de Stripe:', error.message);
    res.status(500).json({ error: 'No se pudo abrir la gestión de la suscripción.', detalle: error.message });
  }
});

// Traduce el estado de Stripe a los estados propios de tenants
// (trialing/active/past_due/canceled/incomplete). Cualquier estado de
// Stripe sin acceso (unpaid, paused, incomplete_expired) cuenta como
// cancelado para que el despacho pase a solo lectura.
const ESTADO_POR_STATUS_STRIPE = {
  active: 'active',
  trialing: 'active',
  past_due: 'past_due',
  incomplete: 'incomplete',
  unpaid: 'canceled',
  paused: 'canceled',
  incomplete_expired: 'canceled',
  canceled: 'canceled'
};

export function cambioDesdeEventoStripe(tipo, object) {
  if (tipo === 'checkout.session.completed') {
    if (object.payment_status !== 'paid' && object.payment_status !== 'no_payment_required') return null;
    return { estado: 'active', periodoFin: null, suscripcionId: object.subscription || null, plan: true };
  }
  if (tipo.startsWith('customer.subscription.')) {
    const estado = tipo === 'customer.subscription.deleted' ? 'canceled' : ESTADO_POR_STATUS_STRIPE[object.status];
    if (!estado) return null;
    // Desde la API 2025-03 el fin de periodo vive en cada item, no en la
    // suscripción; se aceptan ambos sitios.
    const finPeriodo = object.current_period_end || object.items?.data?.[0]?.current_period_end;
    return { estado, periodoFin: finPeriodo ? new Date(finPeriodo * 1000) : null, suscripcionId: object.id, plan: true };
  }
  // invoice.payment_failed se registra en suscripciones_eventos pero no
  // cambia el estado: el customer.subscription.updated que lo acompaña ya
  // trae el status correcto, y un past_due puesto a ciegas aquí podría
  // pisar un canceled posterior (Stripe no garantiza el orden) o dar acceso
  // a un primer pago que nunca llegó a completarse.
  return null;
}

export async function stripeWebhookHandler(req, res) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).send('Stripe webhook no configurado.');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.header('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).send(`Webhook inválido: ${error.message}`);
  }

  const object = event.data.object;
  // En las facturas (invoice.*) Stripe no copia los metadata de la
  // suscripción al propio objeto, van en parent.subscription_details.
  const metadata = object.metadata?.tenantId ? object.metadata : object.parent?.subscription_details?.metadata || {};
  const tenantId = metadata.tenantId;
  if (!tenantId) return res.json({ received: true });

  try {
    const alreadyProcessed = await query(
      'SELECT 1 FROM suscripciones_eventos WHERE proveedor = $1 AND evento_id = $2',
      ['stripe', event.id]
    );
    if (alreadyProcessed.rowCount > 0) return res.json({ received: true, duplicate: true });

    const cambio = cambioDesdeEventoStripe(event.type, object);
    if (cambio) {
      await query(
        `UPDATE tenants
         SET suscripcion_estado = $1,
             suscripcion_periodo_fin = COALESCE($2, suscripcion_periodo_fin),
             proveedor_suscripcion_id = COALESCE($3, proveedor_suscripcion_id),
             plan_suscripcion = COALESCE($4, plan_suscripcion)
         WHERE id = $5`,
        [cambio.estado, cambio.periodoFin, cambio.suscripcionId, cambio.plan ? metadata.plan || null : null, tenantId]
      );
    }

    await query(
      `INSERT INTO suscripciones_eventos (tenant_id, proveedor, evento_id, tipo, datos)
       VALUES ($1, 'stripe', $2, $3, $4)`,
      [tenantId, event.id, event.type, JSON.stringify(event)]
    );
    res.json({ received: true });
  } catch (error) {
    console.error('Error al procesar webhook de Stripe:', error.message);
    res.status(500).send('Error procesando webhook.');
  }
}

export default router;