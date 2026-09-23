import { crearDocumento, membrete, markdownSencillo, pie } from './pdfComun.js';

// PDF del acta con membrete del despacho — pdfkit en vez de un motor HTML
// (puppeteer, etc.) porque genera el documento en JS puro, sin necesitar
// Chromium en el contenedor. Se construye en memoria y se devuelve como
// Buffer; quien llama decide si lo guarda, lo adjunta a un email o ambos.
export function generarActaPdf({ despacho, finca, meeting, actaTexto }) {
  const { doc, buffer } = crearDocumento();

  membrete(doc, despacho);

  const tipoLabel = meeting?.tipo === 'extraordinaria' ? 'Extraordinaria' : 'Ordinaria';
  doc.fillColor('#111111').fontSize(14).font('Helvetica-Bold')
    .text(`Acta de Junta ${tipoLabel} de Propietarios`);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#333333').text(finca?.nombre || '');
  doc.fontSize(10).font('Helvetica').fillColor('#555555').text(meeting?.titulo || '');
  if (meeting?.cerrada_en) {
    doc.text(`Fecha de clausura: ${new Date(meeting.cerrada_en).toLocaleString('es-ES')}`);
  }
  doc.moveDown(1.5);

  // Cuerpo del acta (el texto que el despacho ha redactado/corregido), con
  // su formato: títulos, viñetas y negritas en vez de los símbolos.
  markdownSencillo(doc, actaTexto);

  pie(doc, 'Documento generado a través de VotifAI — la validez legal y custodia del acta corresponde al despacho de administración de fincas conforme al art. 19 de la LPH.');
  doc.end();
  return buffer;
}
