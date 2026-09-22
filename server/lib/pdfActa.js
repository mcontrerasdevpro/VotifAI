import PDFDocument from 'pdfkit';

// PDF del acta con membrete del despacho — pdfkit en vez de un motor HTML
// (puppeteer, etc.) porque genera el documento en JS puro, sin necesitar
// Chromium en el contenedor. Se construye en memoria y se devuelve como
// Buffer; quien llama decide si lo guarda, lo adjunta a un email o ambos.
export function generarActaPdf({ despacho, finca, meeting, actaTexto }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Membrete: datos del despacho administrador, no de VotifAI.
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#111111')
      .text(despacho?.nombre || 'Despacho de Administración de Fincas');

    const datosDespacho = [
      despacho?.cif ? `CIF: ${despacho.cif}` : null,
      despacho?.direccion || null,
      despacho?.telefono ? `Tel: ${despacho.telefono}` : null,
      despacho?.email || null
    ].filter(Boolean).join('  ·  ');
    if (datosDespacho) {
      doc.fontSize(9).font('Helvetica').fillColor('#555555').text(datosDespacho);
    }

    doc.moveDown(0.8);
    doc.strokeColor('#cccccc').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    // Título del acta
    const tipoLabel = meeting?.tipo === 'extraordinaria' ? 'Extraordinaria' : 'Ordinaria';
    doc.fillColor('#111111').fontSize(14).font('Helvetica-Bold')
      .text(`Acta de Junta ${tipoLabel} de Propietarios`);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#333333').text(finca?.nombre || '');
    doc.fontSize(10).font('Helvetica').fillColor('#555555').text(meeting?.titulo || '');
    if (meeting?.cerrada_en) {
      doc.text(`Fecha de clausura: ${new Date(meeting.cerrada_en).toLocaleString('es-ES')}`);
    }

    doc.moveDown(1.5);

    // Cuerpo del acta (el texto que el despacho ha redactado/corregido)
    doc.fillColor('#111111').fontSize(10).font('Helvetica')
      .text(actaTexto || '', { align: 'left', lineGap: 4 });

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#999999')
      .text('Documento generado a través de VotifAI — la validez legal y custodia del acta corresponde al despacho de administración de fincas conforme al art. 15 de la LPH.', { align: 'left' });

    doc.end();
  });
}
