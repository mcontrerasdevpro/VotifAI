import { query } from '../db.js';

// Datos del despacho (membrete) y de la finca para los PDF (recibo,
// certificado de deuda, liquidación).
export async function datosDocumento(entityId) {
  const r = await query(
    `SELECT e.nombre, e.cif, e.direccion, e.metadatos_legales,
            t.nombre_entidad, t.cif AS t_cif, t.direccion AS t_direccion, t.telefono, t.email_maestro
     FROM entities e JOIN tenants t ON t.id = e.tenant_id WHERE e.id = $1::uuid`,
    [entityId]
  );
  const f = r.rows[0] || {};
  const metadatos = typeof f.metadatos_legales === 'string' ? JSON.parse(f.metadatos_legales || '{}') : (f.metadatos_legales || {});
  return {
    despacho: { nombre: f.nombre_entidad, cif: f.t_cif, direccion: f.t_direccion, telefono: f.telefono, email: f.email_maestro },
    finca: { nombre: f.nombre, cif: f.cif, direccion: f.direccion },
    presidente: metadatos.presidente || null
  };
}

export function enviarPdf(res, buffer, archivo) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${archivo.replace(/[/\\?%*:|"<>]/g, '-')}"`);
  res.send(buffer);
}
