import Stripe from 'stripe';
import { query } from '../db.js';

// =========================================================================
// 🩺 COMPROBACIÓN DE CONFIGURACIÓN
//
// Motivo: al cambiar las claves de Stripe en EasyPanel se borró sin querer
// N8N_WEBHOOK_URL y durante un rato no salió ningún email, sin ningún error
// visible (sin esa variable, las notificaciones solo se anotan en el log).
// Aquí se listan las variables que la app necesita, se avisa al arrancar si
// falta alguna y se ofrece un estado detallado para la página de estado.
// =========================================================================

export const VARIABLES = [
  { nombre: 'DATABASE_URL', para: 'Base de datos', imprescindible: true },
  { nombre: 'JWT_SECRET', para: 'Sesiones de despachos y vecinos', imprescindible: true },
  { nombre: 'CORS_ORIGIN', para: 'Dominio de la app (enlaces de los emails)', imprescindible: true },
  { nombre: 'N8N_WEBHOOK_URL', para: 'Envío de emails (convocatorias, actas, contraseñas…)', imprescindible: true },
  { nombre: 'STRIPE_SECRET_KEY', para: 'Cobros', imprescindible: true },
  { nombre: 'STRIPE_WEBHOOK_SECRET', para: 'Activar suscripciones tras el pago', imprescindible: true },
  { nombre: 'STRIPE_PRICE_STARTER', para: 'Precio del plan Starter', imprescindible: true },
  { nombre: 'STRIPE_PRICE_PROFESIONAL', para: 'Precio del plan Profesional', imprescindible: true },
  { nombre: 'STRIPE_PRICE_PREMIUM', para: 'Precio del plan Premium', imprescindible: true },
  { nombre: 'STRIPE_TAX_RATE_IVA', para: 'IVA 21 % en los cobros', imprescindible: true },
  { nombre: 'OPENAI_API_KEY', para: 'Transcripción de voz (planes Profesional y Premium)', imprescindible: true },
  { nombre: 'CORREOS_CLAVE_CIFRADO', para: 'Cifrar las contraseñas de los buzones de correo de los despachos', imprescindible: true },
  { nombre: 'ADMIN_TOKEN', para: 'Página de estado y tareas programadas (recordatorios)', imprescindible: true },
  { nombre: 'ALERTAS_EMAIL', para: 'Email que recibe los avisos de negocio (por defecto contacto@nexuraia.com)', imprescindible: false },
  { nombre: 'DEMO_NOTIFICATION_EMAIL', para: 'Email que recibe las solicitudes de demo', imprescindible: false }
];

export function variablesQueFaltan() {
  return VARIABLES.filter((v) => v.imprescindible && !process.env[v.nombre]).map((v) => v.nombre);
}

export function avisarSiFaltaConfiguracion() {
  const faltan = variablesQueFaltan();
  if (faltan.length) {
    console.warn(`⚠️  CONFIGURACIÓN INCOMPLETA — faltan variables de entorno: ${faltan.join(', ')}. Revisa el entorno del servicio (EasyPanel → votifai-api → Entorno).`);
  } else {
    console.log('✅ Configuración completa: todas las variables imprescindibles están definidas.');
  }
  return faltan;
}

const modoStripe = (id) => (!id ? null : /_live_/.test(id) ? 'live' : /_test_/.test(id) ? 'test' : 'desconocido');

async function comprobar(nombre, fn) {
  try {
    const detalle = await fn();
    return { nombre, ok: true, detalle };
  } catch (err) {
    return { nombre, ok: false, detalle: err.message };
  }
}

// Estado detallado para la página de estado. Nunca devuelve el valor de
// ninguna variable, solo si está puesta.
export async function estadoSistema() {
  const variables = VARIABLES.map((v) => ({ nombre: v.nombre, para: v.para, imprescindible: v.imprescindible, definida: Boolean(process.env[v.nombre]) }));

  const comprobaciones = await Promise.all([
    comprobar('Base de datos', async () => {
      const r = await query('SELECT COUNT(*)::int AS despachos FROM tenants');
      return `Responde (${r.rows[0].despachos} despachos registrados)`;
    }),
    comprobar('Stripe: clave, precios e IVA', async () => {
      if (!process.env.STRIPE_SECRET_KEY) throw new Error('Falta STRIPE_SECRET_KEY');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const modo = modoStripe(process.env.STRIPE_SECRET_KEY);
      // Recuperar los precios y el IVA con la clave comprueba a la vez que la
      // clave es válida, que tiene permisos y que todo es del mismo modo
      // (un price de test no existe para una clave live, y al revés).
      const ids = ['STRIPE_PRICE_STARTER', 'STRIPE_PRICE_PROFESIONAL', 'STRIPE_PRICE_PREMIUM'];
      const precios = [];
      for (const v of ids) {
        const p = await stripe.prices.retrieve(process.env[v]).catch((e) => { throw new Error(`${v}: ${e.message}`); });
        precios.push(`${(p.unit_amount / 100).toFixed(2)} €/${p.recurring?.interval === 'month' ? 'mes' : p.recurring?.interval || 'pago único'}`);
      }
      const iva = await stripe.taxRates.retrieve(process.env.STRIPE_TAX_RATE_IVA).catch((e) => { throw new Error(`STRIPE_TAX_RATE_IVA: ${e.message}`); });
      if (iva.inclusive) throw new Error('El tipo de IVA está marcado como incluido en el precio; debe ser exclusivo');
      return `Modo ${modo}. Precios: ${precios.join(' · ')}. IVA ${iva.percentage} % (${iva.active ? 'activo' : 'INACTIVO'}).`;
    }),
    comprobar('Stripe: webhook', async () => {
      if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('Falta STRIPE_WEBHOOK_SECRET');
      return 'Clave de firma configurada (su validez se confirma al llegar el primer evento)';
    }),
    comprobar('OpenAI (transcripción de voz)', async () => {
      if (!process.env.OPENAI_API_KEY) throw new Error('Falta OPENAI_API_KEY');
      const r = await fetch('https://api.openai.com/v1/models/gpt-4o-transcribe', { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
      if (r.status === 401) throw new Error('La clave no es válida');
      if (!r.ok) throw new Error(`OpenAI respondió ${r.status}`);
      return 'Clave válida y modelo de transcripción disponible (el saldo de la cuenta se revisa en platform.openai.com)';
    }),
    comprobar('n8n (envío de emails)', async () => {
      if (!process.env.N8N_WEBHOOK_URL) throw new Error('Falta N8N_WEBHOOK_URL: no se envía ningún email');
      return `Configurado: ${new URL(process.env.N8N_WEBHOOK_URL).host}`;
    })
  ]);

  const faltan = variablesQueFaltan();
  return {
    ok: faltan.length === 0 && comprobaciones.every((c) => c.ok),
    faltan,
    variables,
    comprobaciones,
    generado_en: new Date().toISOString()
  };
}
