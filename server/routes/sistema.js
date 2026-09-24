import { Router } from 'express';
import crypto from 'crypto';
import { estadoSistema } from '../lib/configuracion.js';
import { enviarRecordatoriosPrueba } from '../lib/avisosNegocio.js';

// =========================================================================
// 🔧 SISTEMA — página de estado y tareas programadas, solo para NexuraIA.
// Protegidas con ADMIN_TOKEN (variable de entorno), que se pasa como
// ?token=… o en la cabecera x-admin-token. Sin ADMIN_TOKEN configurado,
// estas rutas no existen (404).
// =========================================================================

const router = Router();

function tokenValido(req) {
  const esperado = process.env.ADMIN_TOKEN;
  const recibido = String(req.get('x-admin-token') || req.query.token || '');
  if (!esperado || !recibido) return false;
  const a = Buffer.from(esperado);
  const b = Buffer.from(recibido);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function exigirAdmin(req, res, next) {
  if (!process.env.ADMIN_TOKEN) return res.status(404).json({ error: 'No encontrado.' });
  if (!tokenValido(req)) return res.status(401).json({ error: 'No autorizado.' });
  next();
}

const escapar = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

router.get('/estado-sistema', exigirAdmin, async (req, res) => {
  const estado = await estadoSistema();
  if (req.query.formato === 'json') return res.json(estado);

  const fila = (ok, titulo, detalle) =>
    `<tr><td>${ok ? '✅' : '❌'}</td><td><strong>${escapar(titulo)}</strong></td><td>${escapar(detalle)}</td></tr>`;
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Estado de VotifAI</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:32px auto;padding:0 16px;color:#111}h1{font-size:22px}
.resumen{padding:12px 16px;border-radius:10px;font-weight:700;margin:16px 0}.ok{background:#dcfce7;color:#166534}.ko{background:#fee2e2;color:#991b1b}
table{border-collapse:collapse;width:100%;margin:12px 0 28px}td,th{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;vertical-align:top;font-size:14px}th{font-size:12px;color:#6b7280;text-transform:uppercase}</style></head><body>
<h1>Estado de VotifAI</h1>
<div class="resumen ${estado.ok ? 'ok' : 'ko'}">${estado.ok ? 'Todo configurado y funcionando.' : `Hay problemas: ${escapar(estado.faltan.length ? `faltan ${estado.faltan.join(', ')}` : 'revisa las comprobaciones en rojo')}.`}</div>
<h2>Comprobaciones</h2><table><tr><th></th><th>Servicio</th><th>Resultado</th></tr>
${estado.comprobaciones.map((c) => fila(c.ok, c.nombre, c.detalle)).join('')}</table>
<h2>Variables de entorno</h2><p>Solo se indica si están definidas, nunca su valor.</p><table><tr><th></th><th>Variable</th><th>Para qué</th></tr>
${estado.variables.map((v) => fila(v.definida || !v.imprescindible, v.nombre + (v.imprescindible ? '' : ' (opcional)'), v.definida ? v.para : `NO DEFINIDA — ${v.para}`)).join('')}</table>
<p style="color:#6b7280;font-size:12px">Generado el ${new Date(estado.generado_en).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p></body></html>`);
});

// Tarea diaria (n8n → Schedule Trigger → HTTP Request POST con cabecera
// x-admin-token): recordatorio a los despachos cuya prueba acaba pronto.
router.post('/tareas/recordatorios-prueba', exigirAdmin, async (req, res) => {
  try {
    const enviados = await enviarRecordatoriosPrueba();
    res.json({ success: true, enviados });
  } catch (err) {
    console.error('Error en la tarea de recordatorios de prueba:', err.message);
    res.status(500).json({ error: 'Falló la tarea de recordatorios.' });
  }
});

export default router;
