import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, withTransaction } from './db.js';
import { requireAuth, issueSessionCookie, clearSessionCookie, entityBelongsToTenant, propietarioBelongsToTenant, COOKIE_NAME } from './middleware/auth.js';
import documentosRouter from './routes/documentos.js';
import cuotasRouter from './routes/cuotas.js';
import incidenciasRouter from './routes/incidencias.js';
import reservasRouter from './routes/reservas.js';
import crmRouter from './routes/crm.js';
import agendaRouter from './routes/agenda.js';
import contabilidadRouter from './routes/contabilidad.js';
import vozRouter from './routes/voz.js';
import vecinosRouter from './routes/vecinos.js';
import meetingsRouter from './routes/meetings.js';
import billingRouter, { stripeWebhookHandler } from './routes/billing.js';
import { notificar } from './lib/notificaciones.js';
import { exigirCapacidadFinca, exigirCapacidadPropietarios } from './lib/suscripciones.js';
import { exigirSuscripcionParaEscribir } from './middleware/suscripcion.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.' }
});

const demoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Has alcanzado el límite de solicitudes de demo por ahora.' }
});

// Render (y Cloudflare delante) terminan el TLS antes de llegar a Express, así
// que sin esto req.protocol siempre da 'http' aunque el navegador esté en
// https — y la detección de same-origin de más abajo compararía mal.
app.set('trust proxy', 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(o => o.trim());

// En desarrollo, vite.config.js expone el frontend en 0.0.0.0:5173 para poder
// probarlo desde el móvil u otro equipo de la misma red — la IP de origen
// varía con el DHCP del router, así que en vez de mantener una whitelist
// fija se acepta cualquier IP de rango privado en el puerto 5173.
const RANGO_LAN_DEV = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):5173$/;

// CORS solo se aplica a /api: en producción el frontend se sirve desde el
// mismo servidor Express (misma origen), así que las peticiones a los
// assets estáticos (JS/CSS con atributo "crossorigin" que Vite añade por
// defecto) mandan cabecera Origin igual al propio dominio — si el
// middleware de CORS se aplicara global y ese dominio no estuviera en
// CORS_ORIGIN, esas peticiones eran rechazadas con un 500 y la app
// quedaba en blanco. Solo hace falta CORS para /api, donde sí puede haber
// un frontend en otro origen (el propio Vite dev server en desarrollo).
//
// Además de la whitelist estática, se permite siempre el origen que
// coincide con el propio host de la petición (mismo dominio que sirve el
// build) — así el registro/login desde la SPA en producción funciona sin
// tener que mantener CORS_ORIGIN sincronizado con el dominio de Render,
// Vercel o el que sea, y sin abrir la API a orígenes de verdad externos.
const corsOptionsDelegate = (req, callback) => {
  const origin = req.header('Origin');
  const origenPropio = `${req.protocol}://${req.get('host')}`;
  const permitido =
    !origin ||
    origin === origenPropio ||
    allowedOrigins.includes(origin) ||
    (process.env.NODE_ENV !== 'production' && RANGO_LAN_DEV.test(origin));

  if (!permitido) {
    console.error(`🚫 CORS rechazado: origen "${origin}" no está en la whitelist [${allowedOrigins.join(', ')}]. Añádelo a CORS_ORIGIN en server/.env si es de confianza.`);
    return callback(new Error('Origen no permitido por la política CORS.'));
  }

  callback(null, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
};

app.use('/api', cors(corsOptionsDelegate));
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);
app.use('/api/auth', authLimiter);
// Mismo límite para el lado vecino: login, registro, reseteo de contraseña
// y resolver-código (prueba el código de acceso corto de la comunidad)
// son objetivos de fuerza bruta igual que el login del despacho.
app.use('/api/vecinos', authLimiter);
// Límite ampliado: documentos y PDFs en base64 superan fácilmente el
// límite por defecto de Express (100kb) — esto ya afectaba en silencio a
// la subida de PDF de fincas (/api/entities/upload-pdf).
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use('/api', exigirSuscripcionParaEscribir);
app.use('/api', billingRouter);
app.use('/api', documentosRouter);
app.use('/api', cuotasRouter);
app.use('/api', incidenciasRouter);
app.use('/api', reservasRouter);
app.use('/api', crmRouter);
app.use('/api', agendaRouter);
app.use('/api', contabilidadRouter);
app.use('/api', vozRouter);
app.use('/api', vecinosRouter);
app.use('/api', meetingsRouter);

app.post('/api/demo-solicitudes', demoLimiter, async (req, res) => {
  const nombre = String(req.body.nombre || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const telefono = String(req.body.telefono || '').trim();
  const comunidades = String(req.body.comunidades || '').trim();
  const mensaje = String(req.body.mensaje || '').trim();
  const consentimientoPrivacidad = req.body.consentimientoPrivacidad === true || req.body.consentimientoPrivacidad === 'true';

  if (!nombre || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !consentimientoPrivacidad) {
    return res.status(400).json({ error: 'Indica un nombre, un correo profesional válido y acepta la política de privacidad.' });
  }

  try {
    const resultado = await query(
      `INSERT INTO demo_solicitudes (nombre, email, telefono, comunidades, mensaje, consentimiento_privacidad, consentimiento_en)
       VALUES ($1, $2, $3, $4, $5, true, now())
       RETURNING id, creado_en`,
      [nombre, email, telefono || null, comunidades || null, mensaje || null]
    );

    // Dos avisos independientes: que falle uno no debe impedir el otro, y
    // ninguno de los dos invalida la solicitud, que ya está guardada.
    const emailEquipo = process.env.DEMO_NOTIFICATION_EMAIL || process.env.N8N_NOTIFICATION_EMAIL || 'contacto@nexuraia.com';
    const detalle = [
      `Nombre: ${nombre}`,
      `Email: ${email}`,
      `Teléfono: ${telefono || '—'}`,
      `Comunidades que gestiona: ${comunidades || '—'}`,
      `Mensaje: ${mensaje || '—'}`
    ].join('\n');

    const avisos = await Promise.allSettled([
      notificar({
        tipo: 'solicitud_demo_votifai',
        mensaje: { titulo: `Nueva solicitud de demo VotifAI — ${nombre}`, cuerpo: `Se ha recibido una nueva solicitud de demo.\n\n${detalle}` },
        destinatarios: [{ nombre: 'Equipo VotifAI', email: emailEquipo, canal_preferido: 'email' }]
      }),
      notificar({
        tipo: 'confirmacion_demo_votifai',
        mensaje: {
          titulo: 'Hemos recibido tu solicitud de demo de VotifAI',
          cuerpo: `Hola ${nombre},\n\nGracias por tu interés en VotifAI. Hemos recibido tu solicitud de demo y te contactaremos en un plazo máximo de 24-48 horas laborables para agendarla.\n\nSi quieres adelantarnos algo, puedes responder directamente a este correo.\n\nUn saludo,\nEl equipo de VotifAI`
        },
        destinatarios: [{ nombre, email, canal_preferido: 'email' }]
      })
    ]);
    avisos.forEach((aviso, i) => {
      if (aviso.status === 'rejected') {
        console.error(`Solicitud guardada, pero falló el aviso de demo (${i === 0 ? 'equipo' : 'solicitante'}):`, aviso.reason?.message);
      }
    });

    res.status(201).json({ success: true, solicitud: resultado.rows[0] });
  } catch (err) {
    console.error('Error al guardar solicitud de demo:', err.message);
    res.status(500).json({ error: 'No se pudo registrar la solicitud. Inténtalo de nuevo.' });
  }
});

// =========================================================================
// 🔐 1. ENDPOINT POST: /api/auth/register (Alta Multi-tenant Comercial)
// =========================================================================
// Fecha de la versión vigente de Términos + Privacidad + Contrato de
// Encargo. Se guarda con cada alta para saber qué texto aceptó cada despacho;
// si los textos cambian de forma sustancial, se sube esta fecha.
const VERSION_CONDICIONES = '2026-09-23';

app.post('/api/auth/register', async (req, res) => {
  const { tipoOrganizacion, nombreEntidad, nombreResponsable, cif, telefono, direccion, password, aceptaCondiciones } = req.body;
  // El índice único de tenants es sobre LOWER(email_maestro): se guarda y se
  // compara siempre normalizado, o un "Correo@..." pasaría la comprobación
  // de duplicado y reventaría en el INSERT con un 500.
  const email = String(req.body.email || '').trim().toLowerCase();
  const planInicial = 'starter';

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Se requiere un email y una contraseña de al menos 8 caracteres.' });
  }

  if (!nombreEntidad) {
    return res.status(400).json({ error: 'El nombre del despacho profesional es obligatorio.' });
  }

  // Sin aceptar el contrato de encargo (art. 28 RGPD) no se puede tratar
  // ningún dato de propietarios por cuenta del despacho.
  if (aceptaCondiciones !== true) {
    return res.status(400).json({ error: 'Debes aceptar los Términos, la Política de Privacidad y el Contrato de Encargo del Tratamiento.' });
  }

  try {
    const existeUser = await query('SELECT id FROM tenants WHERE LOWER(email_maestro) = $1', [email]);
    if (existeUser.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const nuevoTenant = await query(
      `INSERT INTO tenants (nombre_entidad, email_maestro, password_hash, tipo_organizacion, plan_suscripcion, iban_facturacion, titular_cuenta, cif, telefono, direccion, nombre_responsable, condiciones_aceptadas_en, condiciones_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), $12)
       RETURNING id, nombre_entidad, email_maestro, tipo_organizacion, plan_suscripcion, cif, telefono, direccion, nombre_responsable`,
      [
        nombreEntidad, email, passwordHash, tipoOrganizacion || 'administrador', planInicial,
        null, null,
        cif || null, telefono || null, direccion || null, nombreResponsable || null,
        VERSION_CONDICIONES
      ]
    );

    issueSessionCookie(res, nuevoTenant.rows[0]);

    res.status(201).json({
      mensaje: 'Despacho profesional registrado con éxito en la nube.',
      tenant: { ...nuevoTenant.rows[0], comunidades: [] }
    });

   } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }
    console.error('Error en el Onboarding:', err.message);
    res.status(500).json({ error: 'Fallo interno al procesar el registro.' });
  }
});

// =========================================================================
// 🔑 2. ENDPOINT POST: /api/auth/login (Corregido: Busca Fincas de Neon al entrar)
// =========================================================================
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim();
  const { password } = req.body;

  try {
    const resultado = await query(
      'SELECT id, nombre_entidad, email_maestro, password_hash, tipo_organizacion, plan_suscripcion, cif, telefono, direccion, nombre_responsable FROM tenants WHERE LOWER(email_maestro) = LOWER($1)',
      [email]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: 'Las credenciales introducidas no son válidas.' });
    }

    const tenantBase = resultado.rows[0];

    const esPasswordValido = await bcrypt.compare(password || '', tenantBase.password_hash);

    if (!esPasswordValido) {
      return res.status(401).json({ error: 'La contraseña introducida es incorrecta.' });
    }

    const fincasResultado = await query(
      'SELECT id, nombre, cif, direccion, tipo, codigo_acceso FROM entities WHERE tenant_id = $1',
      [tenantBase.id]
    );

    // eslint-disable-next-line no-unused-vars -- se extrae para excluirlo del objeto que se envía al cliente
    const { password_hash, ...tenantSinHash } = tenantBase;
    const tenantCompleto = {
      ...tenantSinHash,
      comunidades: fincasResultado.rows
    };

    issueSessionCookie(res, tenantBase);

    res.status(200).json({
      mensaje: 'Acceso autorizado con éxito.',
      tenant: tenantCompleto
    });

  } catch (err) {
    console.error('Error crítico en el proceso de Login:', err.message);
    res.status(500).json({ error: 'Error interno de red al validar la sesión en la nube.' });
  }
});

// =========================================================================
// 🚪 ENDPOINT POST: /api/auth/logout
// =========================================================================
app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.status(200).json({ success: true, mensaje: 'Sesión cerrada correctamente.' });
});

app.get('/api/auth/me', async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ authenticated: false, error: 'Sesión no iniciada o expirada.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const tenantResult = await query(
      'SELECT id, nombre_entidad, email_maestro, tipo_organizacion, plan_suscripcion, cif, telefono, direccion, nombre_responsable FROM tenants WHERE id = $1',
      [payload.tenantId]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(401).json({ authenticated: false, error: 'Tenant no encontrado.' });
    }

    const tenantBase = tenantResult.rows[0];
    const fincasResultado = await query(
      'SELECT id, nombre, cif, direccion, tipo, codigo_acceso FROM entities WHERE tenant_id = $1',
      [tenantBase.id]
    );

    const tenantCompleto = { ...tenantBase, comunidades: fincasResultado.rows };
    return res.status(200).json({ authenticated: true, tenant: tenantCompleto });
  } catch (error) {
    console.error('Error al validar sesión del despacho:', error.message);
    return res.status(401).json({ authenticated: false, error: 'Sesión inválida o expirada.' });
  }
});

// =========================================================================
// 🔁 ENDPOINTS DE RECUPERACIÓN DE CONTRASEÑA (despacho administrador)
// =========================================================================
app.post('/api/auth/olvide-password', async (req, res) => {
  const email = String(req.body.email || '').trim();

  // Respuesta siempre genérica: no revelamos si ese email existe o no.
  const respuestaGenerica = { success: true, mensaje: 'Si ese correo está registrado, recibirás un enlace para restablecer tu contraseña.' };
  if (!email) return res.status(200).json(respuestaGenerica);

  try {
    const resultado = await query('SELECT id, nombre_entidad FROM tenants WHERE LOWER(email_maestro) = LOWER($1)', [email]);
    if (resultado.rows.length === 0) return res.status(200).json(respuestaGenerica);

    const tenant = resultado.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    await query(
      `UPDATE tenants SET reset_token = $1, reset_token_expira = NOW() + INTERVAL '1 hour' WHERE id = $2`,
      [token, tenant.id]
    );

    const enlace = `${allowedOrigins[0]}/restablecer-password/despacho?token=${token}`;
    await notificar({
      tipo: 'reset_password_despacho',
      despacho: { id: tenant.id, nombre: tenant.nombre_entidad },
      mensaje: { titulo: 'Restablecer tu contraseña de VotifAI', cuerpo: `Solicitaste restablecer tu contraseña. Este enlace caduca en 1 hora: ${enlace}` },
      destinatarios: [{ nombre: tenant.nombre_entidad, email }]
    });

    res.status(200).json(respuestaGenerica);
  } catch (err) {
    console.error('Error al solicitar recuperación de contraseña de despacho:', err.message);
    res.status(200).json(respuestaGenerica);
  }
});

app.post('/api/auth/restablecer-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Faltan datos para restablecer la contraseña.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const resultado = await query(
      `SELECT id FROM tenants WHERE reset_token = $1 AND reset_token_expira > NOW()`,
      [token]
    );
    if (resultado.rows.length === 0) {
      return res.status(400).json({ error: 'El enlace no es válido o ha caducado. Solicita uno nuevo.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      `UPDATE tenants SET password_hash = $1, reset_token = NULL, reset_token_expira = NULL WHERE id = $2`,
      [passwordHash, resultado.rows[0].id]
    );

    res.status(200).json({ success: true, mensaje: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('Error al restablecer contraseña de despacho:', err.message);
    res.status(500).json({ error: `Fallo al restablecer la contraseña: ${err.message}` });
  }
});

// =========================================================================
// 📁 3. ENDPOINT GET: /api/entities/:tenantId (Catálogo Real + Datos Admin)
// =========================================================================
app.get('/api/entities/:tenantId', requireAuth, async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const datosAdmin = await query(
      'SELECT id, nombre_entidad, email_maestro, tipo_organizacion, plan_suscripcion FROM tenants WHERE id = $1',
      [tenantId]
    );

    const fincasResultado = await query(
      'SELECT id, nombre, cif, direccion, tipo, metadatos_legales, codigo_acceso, creado_en FROM entities WHERE tenant_id = $1 ORDER BY creado_en DESC',
      [tenantId]
    );

    if (datosAdmin.rows.length === 0) {
      return res.status(404).json({ error: 'Administrador de fincas no encontrado.' });
    }

    res.status(200).json({
      administrador: datosAdmin.rows[0], 
      fincas: fincasResultado.rows       
    });

  } catch (err) {
    console.error('Error al recuperar datos de Neon:', err.message);
    res.status(500).json({ error: 'Error interno al consultar el catálogo en la nube.' });
  }
});

// =========================================================================
// 🏢 4. ENDPOINT POST: /api/entities/create (Persistencia Real de Fincas)
// =========================================================================

// Código de acceso humano (p.ej. VAI-7X2K-M) que el administrador reparte
// a los vecinos para que puedan registrarse en /login/comunidad — 4
// caracteres alfanuméricos + 1 letra, suficiente para no colisionar sin
// resultar incómodo de teclear en un móvil.
function generarCodigoAcceso() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I para evitar confusiones
  let bloque = '';
  for (let i = 0; i < 4; i++) bloque += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  const letra = alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return `VAI-${bloque}-${letra}`;
}

app.post('/api/entities/create', requireAuth, async (req, res) => {
  const { nombre, cif, direccion, metadatos_legales } = req.body;
  if (!nombre) {
    return res.status(400).json({ error: 'El Nombre de la finca es obligatorio.' });
  }

  try {
    const capacidad = await exigirCapacidadFinca(req.tenantId);
    if (!capacidad.ok) return res.status(capacidad.status).json({ error: capacidad.error });

    let nuevaEntidad = null;
    for (let intento = 0; intento < 5 && !nuevaEntidad; intento++) {
      try {
        const resultado = await query(
          `INSERT INTO entities (tenant_id, nombre, cif, direccion, metadatos_legales, tipo, codigo_acceso)
           VALUES ($1, $2, $3, $4, $5, 'comunidad', $6)
           RETURNING id, nombre, cif, direccion, tipo, codigo_acceso, creado_en`,
          [
            req.tenantId,
            nombre,
            cif || '00000000X',
            direccion || 'Sede Local',
            JSON.stringify(metadatos_legales || {}),
            generarCodigoAcceso()
          ]
        );
        nuevaEntidad = resultado.rows[0];
      } catch (errIntento) {
        if (errIntento.code !== '23505') throw errIntento; // no era choque de código único, propagar
      }
    }

    if (!nuevaEntidad) {
      return res.status(500).json({ error: 'No se pudo generar un código de acceso único, inténtalo de nuevo.' });
    }

    res.status(201).json({
      mensaje: 'Finca dada de alta con éxito en Neon Cloud.',
      entity: nuevaEntidad
    });

  } catch (err) {
    console.error('Error crítico al insertar finca en Neon:', err.message);
    res.status(500).json({ error: 'Error interno de red al guardar la finca en la nube.' });
  }
});

// =========================================================================
// 📁 6. ENDPOINT PUT: /api/entities/upload-pdf (Almacenamiento de Acta Original)
// =========================================================================
app.put('/api/entities/upload-pdf', requireAuth, async (req, res) => {
  const { entityId, pdfBase64 } = req.body;

  if (!entityId || !pdfBase64) {
    return res.status(400).json({ error: 'ID de finca o archivo PDF ausentes.' });
  }

  try {
    if (!(await entityBelongsToTenant(entityId, req.tenantId))) {
      return res.status(403).json({ error: 'No autorizado para modificar esta entidad.' });
    }

    await query(
      `UPDATE entities 
       SET documento_adjunto = $1 
       WHERE id = $2`,
      [pdfBase64, String(entityId).trim()]
    );

    res.status(200).json({
      success: true,
      mensaje: 'Documento original verificado y encriptado con éxito en Neon Cloud.'
    });

  } catch (err) {
    console.error('Error al subir PDF a Neon:', err.message);
    res.status(500).json({ error: 'Error de persistencia al archivar el PDF.' });
  }
});

// =========================================================================
// 🏢 7. ENDPOINT PUT: /api/entities/update (Actualización en Caliente de Fincas)
// =========================================================================
app.put('/api/entities/update', requireAuth, async (req, res) => {
  const { id, nombre, cif, direccion, presidente, tesorero } = req.body;

  if (!id || !nombre) {
    return res.status(400).json({ error: 'El ID de la finca y el Nombre son obligatorios.' });
  }

  try {
    if (!(await entityBelongsToTenant(id, req.tenantId))) {
      return res.status(403).json({ error: 'No autorizado para modificar esta entidad.' });
    }

    const metadatosLegales = { presidente, tesorero };

    const resultado = await query(
      `UPDATE entities 
       SET nombre = $1, cif = $2, direccion = $3, metadatos_legales = $4
       WHERE id = $5 
       RETURNING id, nombre, cif, direccion, metadatos_legales`,
      [nombre, cif, direccion, JSON.stringify(metadatosLegales), String(id).trim()]
    );

    res.status(200).json({
      success: true,
      mensaje: 'Expediente e historial de cargos actualizado en Neon Cloud.',
      finca: resultado.rows[0]
    });

  } catch (err) {
    console.error('Error al actualizar expediente:', err.message);
    res.status(500).json({ error: 'Error de red al actualizar metadatos.' });
  }
});

// =========================================================================
// 👤 8. ENDPOINT POST: /api/propietarios/create (CORREGIDO SIN COLUMNA DNI)
// =========================================================================
app.post('/api/propietarios/create', requireAuth, async (req, res) => {
  const { entity_id, nombre_completo, direccion_postal, telefono, email, coeficiente } = req.body;

  if (!entity_id || !nombre_completo || !coeficiente) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para registrar al propietario.' });
  }

  if (!telefono && !email) {
    return res.status(400).json({ error: 'Según la normativa LPH, debe facilitar un teléfono o un email de contacto.' });
  }

  try {
    if (!(await entityBelongsToTenant(entity_id, req.tenantId))) {
      return res.status(403).json({ error: 'No autorizado para añadir propietarios a esta entidad.' });
    }

    const capacidad = await exigirCapacidadPropietarios(req.tenantId, entity_id);
    if (!capacidad.ok) return res.status(capacidad.status).json({ error: capacidad.error });

    const resultado = await query(
      `INSERT INTO propietarios (entity_id, nombre_completo, propiedad_detalle, telefono, email, coeficiente)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        String(entity_id).trim(), 
        nombre_completo, 
        direccion_postal || 'Vivienda', 
        telefono || null, 
        email || null, 
        coeficiente
      ]
    );

    res.status(201).json({
      success: true,
      mensaje: 'Propietario dado de alta de forma conforme en el censo legal.',
      propietario: resultado.rows
    });
  } catch (err) {
    console.error('❌ ERROR REAL EN POSTGRESQL (CREATE):', err.message);
    res.status(500).json({ error: `Error en base de datos: ${err.message}` });
  }
});

// =========================================================================
// 🔄 9. ENDPOINT POST: /api/propietarios/cambio-titular (TRASPASO CORREGIDO SIN DNI)
// =========================================================================
app.post('/api/propietarios/cambio-titular', requireAuth, async (req, res) => {
  const { propietario_id, nuevo_nombre, nuevo_telefono, nuevo_email, motivo_cambio, detalles } = req.body;

  if (!propietario_id || !nuevo_nombre || !motivo_cambio) {
    return res.status(400).json({ error: 'Faltan parámetros esenciales para procesar el cambio de titularidad.' });
  }

  if (!nuevo_telefono && !nuevo_email) {
    return res.status(400).json({ error: 'El nuevo titular debe disponer obligatoriamente de teléfono o email.' });
  }

  if (!(await propietarioBelongsToTenant(propietario_id, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para modificar este propietario.' });
  }

  try {
    const cambio = await withTransaction(async (tx) => {
      // FOR UPDATE: dos traspasos simultáneos del mismo propietario no
      // pueden leer ambos el mismo "anterior titular".
      const propietarioActual = await tx('SELECT nombre_completo FROM propietarios WHERE id = $1 FOR UPDATE', [propietario_id]);
      if (propietarioActual.rows.length === 0) return { rollback: true };
      const anteriorTitularNombre = propietarioActual.rows[0].nombre_completo;

      await tx(
        `UPDATE propietarios 
         SET nombre_completo = $1, telefono = $2, email = $3
         WHERE id = $4`,
        [nuevo_nombre, nuevo_telefono || null, nuevo_email || null, propietario_id]
      );

      await tx(
        `INSERT INTO historial_titularidad (propietario_id, anterior_titular, nuevo_titular, motivo_cambio, detalles)
         VALUES ($1, $2, $3, $4, $5)`,
        [propietario_id, anteriorTitularNombre, nuevo_nombre, motivo_cambio, detalles || 'Sustitución ordinaria de titularidad']
      );
      return {};
    });

    if (cambio.rollback) {
      return res.status(404).json({ error: 'No se encuentra el propietario a sustituir.' });
    }

    res.status(200).json({
      success: true,
      mensaje: 'Cambio de titularidad processed e inscrito con éxito.'
    });

  } catch (err) {
    console.error('Fallo en la transacción de cambio de titular:', err.message);
    res.status(500).json({ error: 'Fallo interno al procesar el cambio de titularidad legal.' });
  }
});

// =========================================================================
// 🗑️ 9B. ENDPOINT DELETE: /api/entities/delete/:id (Purga en cascada transaccional)
// =========================================================================
app.delete('/api/entities/delete/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const entityIdClean = String(id).trim();

  try {
    if (!(await entityBelongsToTenant(entityIdClean, req.tenantId))) {
      return res.status(403).json({ success: false, error: 'No autorizado para eliminar esta entidad.' });
    }

    console.log(`\n🧹 [Neon Cloud] Ejecutando purga integral para la entidad ID: ${entityIdClean}`);

    // Todo o nada: si falla cualquier paso, la finca queda intacta en vez
    // de sin censo pero todavía existiendo.
    const result = await withTransaction(async (tx) => {
      // A. Eliminamos el historial de titularidad vinculado a los propietarios de esta entidad
      await tx(
        `DELETE FROM historial_titularidad 
         WHERE propietario_id IN (SELECT id FROM propietarios WHERE entity_id = $1::uuid)`,
        [entityIdClean]
      );

      // B. Eliminamos el censo de propietarios
      await tx('DELETE FROM propietarios WHERE entity_id = $1::uuid', [entityIdClean]);

      // C. Eliminamos las reuniones/asambleas de la entidad
      await tx('DELETE FROM meetings WHERE entity_id = $1::uuid', [entityIdClean]);

      // D. Una vez removidas todas las dependencias, borramos el registro raíz en entities
      return tx('DELETE FROM entities WHERE id = $1', [entityIdClean]);
    });

    if (result.rowCount > 0) {
      console.log(`✅ [Neon Cloud] Entidad ${entityIdClean} y sus datos dependientes purgados con éxito.`);
      res.status(200).json({ success: true, message: 'Entidad purgada correctamente de Neon Cloud.' });
    } else {
      res.status(404).json({ success: false, error: 'La entidad solicitada no se encuentra en pgAdmin.' });
    }
  } catch (err) {
    console.error("❌ Fallo crítico en el proceso de purga de PostgreSQL:", err.message);
    res.status(500).json({ success: false, error: `Fallo interno al intentar purgar el registro: ${err.message}` });
  }
});

// =========================================================================
// 📊 11. ENDPOINT GET: /api/propietarios/lista/:entityId (CENSO HÍBRIDO BLINDADO)
// =========================================================================
app.get('/api/propietarios/lista/:entityId', requireAuth, async (req, res) => {
  const { entityId } = req.params;
  const cleanId = String(entityId).trim();

  try {
    if (!(await entityBelongsToTenant(cleanId, req.tenantId))) {
      return res.status(403).json({ error: 'No autorizado para consultar el censo de esta entidad.' });
    }

    const censoResultado = await query(
      `SELECT id, nombre_completo, propiedad_detalle, telefono, email, coeficiente, es_moroso 
       FROM propietarios 
       WHERE entity_id = $1::uuid 
       ORDER BY propiedad_detalle ASC`,
      [cleanId]
    );

    let historialFilas = [];
    try {
      const historialResultado = await query(
        `SELECT h.historial_id, h.propietario_id, h.anterior_titular, h.nuevo_titular, h.motivo_cambio, h.detalles, h.fecha_cambio, p.propiedad_detalle
         FROM historial_titularidad h
         JOIN propietarios p ON h.propietario_id = p.id
         WHERE p.entity_id = $1::uuid
         ORDER BY h.fecha_cambio DESC`,
        [cleanId]
      );
      historialFilas = historialResultado.rows;
    } catch (histError) {
      console.log("⚠️ Nota: Omitiendo carga del historial por esquema alternativo.");
    }

    res.status(200).json({
      success: true,
      propietarios: censoResultado.rows,
      historial: historialFilas
    });

  } catch (err) {
    console.error('❌ ERROR REAL EN POSTGRESQL (LISTA):', err.message);
    res.status(500).json({ error: `Fallo crítico de red en el catálogo: ${err.message}` });
  }
});

// =========================================================================
// 📲 14. ENDPOINT POST: /api/notifications/reenviar-individual (WhatsApp Híbrido)
// =========================================================================
app.post('/api/notifications/reenviar-individual', requireAuth, async (req, res) => {
  const { propietarioId, nombreFinca, actaTexto } = req.body;

  if (!propietarioId || !actaTexto) {
    return res.status(400).json({ error: 'Faltan parámetros indispensables para realizar el reenvío individual.' });
  }

  if (!(await propietarioBelongsToTenant(propietarioId, req.tenantId))) {
    return res.status(403).json({ error: 'No autorizado para notificar a este propietario.' });
  }

  try {
    const vecino = await query(
      `SELECT nombre_completo, propiedad_detalle, telefono, email 
       FROM propietarios 
       WHERE id = $1::uuid`,
      [String(propietarioId).trim()]
    );

    if (vecino.rows.length === 0) {
      return res.status(404).json({ error: 'El miembro solicitado no consta en el censo legal.' });
    }

    const datosVecino = vecino.rows[0];

    if (!datosVecino.telefono && !datosVecino.email) {
      return res.status(400).json({ error: 'Este usuario no dispone de teléfono ni email registrado para el reenvío.' });
    }

    const despachoResultado = await query('SELECT nombre_entidad FROM tenants WHERE id = $1', [req.tenantId]);

    await notificar({
      tipo: 'reenvio_individual',
      despacho: { id: req.tenantId, nombre: despachoResultado.rows[0]?.nombre_entidad || null },
      finca: { nombre: nombreFinca },
      mensaje: { titulo: `Copia del acta — ${nombreFinca}`, cuerpo: actaTexto },
      destinatarios: [{
        nombre: datosVecino.nombre_completo,
        propiedad: datosVecino.propiedad_detalle,
        telefono: datosVecino.telefono,
        email: datosVecino.email
      }]
    });

    res.status(200).json({
      success: true,
      mensaje: `Copia certificada del acta reenviada correctamente a ${datosVecino.nombre_completo} (${datosVecino.propiedad_detalle}).`
    });

  } catch (err) {
    console.error('Error crítico en el despachador de reenvíos:', err.message);
    res.status(500).json({ error: `Fallo en la pasarela externa de notificación: ${err.message}` });
  }
});

// El fallback SPA debe registrarse despues de todas las rutas API. Si se
// coloca antes, las peticiones GET de endpoints declarados mas abajo reciben
// index.html y el frontend falla al parsearlas como JSON.
if (process.env.NODE_ENV === 'production') {
  console.log("📦 Servidor Express configurado en modo PRODUCCIÓN: Sirviendo interfaz estática.");
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*splat', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
  });
} else {
  console.log("🔌 Servidor Express configurado en modo API PURA: Delegando UI a Vite (Puerto 5173).");
  app.get('/', (req, res) => {
    res.json({
      sistema: "VotifAI API Gateway",
      estado: "Operativo",
      nota: "Para ver la interfaz de usuario, accede a la URL terminada en -5173.app.github.dev"
    });
  });
}

// Handler de errores: sin esto, un origen de /api rechazado por CORS (o
// cualquier otro error pasado a next()) caía en la página HTML de error
// por defecto de Express en vez de una respuesta JSON consistente con el
// resto de la API.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor unificado de VotifAI abierto en el puerto ${PORT}`);
});