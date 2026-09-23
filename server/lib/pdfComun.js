import PDFDocument from 'pdfkit';

// Piezas comunes de los PDF del despacho (acta, recibo, certificado de
// deuda): documento A4 en memoria, membrete con los datos del despacho (no
// de VotifAI), pie y un intérprete mínimo del formato del acta (títulos
// '#'/'##', viñetas '* ' y negritas '**…**'), que antes se imprimía con los
// símbolos tal cual.

export const MARGEN = 50;
export const ANCHO = 595.28 - MARGEN * 2; // A4 menos márgenes

export function crearDocumento() {
  const doc = new PDFDocument({ margin: MARGEN, size: 'A4' });
  const chunks = [];
  const buffer = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  return { doc, buffer };
}

export function membrete(doc, despacho) {
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#111111')
    .text(despacho?.nombre || 'Despacho de Administración de Fincas');

  const datos = [
    despacho?.cif ? `CIF: ${despacho.cif}` : null,
    despacho?.direccion || null,
    despacho?.telefono ? `Tel: ${despacho.telefono}` : null,
    despacho?.email || null
  ].filter(Boolean).join('  ·  ');
  if (datos) doc.fontSize(9).font('Helvetica').fillColor('#555555').text(datos);

  doc.moveDown(0.8);
  linea(doc);
  doc.moveDown(1);
}

export function linea(doc, color = '#cccccc') {
  doc.strokeColor(color).lineWidth(1).moveTo(MARGEN, doc.y).lineTo(MARGEN + ANCHO, doc.y).stroke();
}

export function pie(doc, texto) {
  doc.moveDown(2);
  doc.fontSize(8).font('Helvetica').fillColor('#999999').text(texto, MARGEN, doc.y, { width: ANCHO });
}

// Una línea con tramos en negrita ('**así**'), respetando el ajuste de línea.
function textoConNegritas(doc, texto, opciones = {}) {
  const tramos = texto.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  tramos.forEach((tramo, i) => {
    const negrita = tramo.startsWith('**') && tramo.endsWith('**');
    doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica')
      .text(negrita ? tramo.slice(2, -2) : tramo, { ...opciones, continued: i < tramos.length - 1 });
  });
}

export function markdownSencillo(doc, texto) {
  for (const cruda of String(texto || '').split('\n')) {
    const lineaTexto = cruda.replace(/\s+$/, '');
    if (!lineaTexto.trim()) { doc.moveDown(0.5); continue; }

    if (lineaTexto.startsWith('# ')) {
      doc.moveDown(0.3).fontSize(13).fillColor('#111111').font('Helvetica-Bold').text(lineaTexto.slice(2).replace(/\*\*/g, ''), { lineGap: 2 });
      doc.moveDown(0.3);
    } else if (lineaTexto.startsWith('## ')) {
      doc.moveDown(0.5).fontSize(11).fillColor('#1f2937').font('Helvetica-Bold').text(lineaTexto.slice(3).replace(/\*\*/g, ''), { lineGap: 2 });
      doc.moveDown(0.2);
    } else if (/^\s*\* /.test(lineaTexto)) {
      const sangria = lineaTexto.match(/^\s*/)[0].length;
      doc.fontSize(10).fillColor('#111111');
      textoConNegritas(doc, `•  ${lineaTexto.trim().slice(2)}`, { indent: 10 + sangria * 4, lineGap: 3 });
    } else {
      // Líneas de continuación de una viñeta (empiezan con espacios).
      const sangria = lineaTexto.match(/^\s*/)[0].length;
      doc.fontSize(10).fillColor('#111111');
      textoConNegritas(doc, lineaTexto.trim(), { indent: sangria > 0 ? 22 : 0, lineGap: 3 });
    }
  }
}

export const eur = (n) => `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
export const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

// Tabla simple: cabecera y filas con anchos relativos; salta de página si
// no cabe la fila.
export function tabla(doc, columnas, filas) {
  const anchos = columnas.map((c) => (c.ancho / columnas.reduce((t, x) => t + x.ancho, 0)) * ANCHO);
  const fila = (valores, negrita) => {
    if (doc.y > 760) doc.addPage();
    const y = doc.y;
    let x = MARGEN;
    let alto = 0;
    valores.forEach((v, i) => {
      doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#111111');
      const opciones = { width: anchos[i] - 6, align: columnas[i].derecha ? 'right' : 'left' };
      alto = Math.max(alto, doc.heightOfString(String(v), opciones));
      doc.text(String(v), x + 3, y, opciones);
      x += anchos[i];
    });
    doc.y = y + alto + 5;
    doc.strokeColor('#e5e7eb').lineWidth(0.5).moveTo(MARGEN, doc.y - 2).lineTo(MARGEN + ANCHO, doc.y - 2).stroke();
  };
  fila(columnas.map((c) => c.titulo), true);
  filas.forEach((f) => fila(f, false));
  doc.x = MARGEN;
}
