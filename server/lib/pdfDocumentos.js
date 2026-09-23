import { crearDocumento, membrete, pie, tabla, eur, fecha, MARGEN, ANCHO } from './pdfComun.js';

// Recibo de un cobro y certificado de deuda (art. 9.1.e LPH), con el
// membrete del despacho, igual que el acta.

function datosFincaYPropietario(doc, finca, propietario) {
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#111111').text('Comunidad de propietarios');
  doc.font('Helvetica').fillColor('#333333').text([finca?.nombre, finca?.cif && finca.cif !== '00000000X' ? `CIF ${finca.cif}` : null, finca?.direccion].filter(Boolean).join(' · '));
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fillColor('#111111').text('Propietario');
  doc.font('Helvetica').fillColor('#333333').text(`${propietario?.nombre_completo || ''}${propietario?.propiedad_detalle ? ` — ${propietario.propiedad_detalle}` : ''}`);
  if (propietario?.coeficiente !== undefined && propietario?.coeficiente !== null) {
    doc.text(`Coeficiente de participación: ${Number(propietario.coeficiente).toFixed(4)} %`);
  }
  doc.moveDown(1);
}

export function generarReciboPdf({ despacho, finca, propietario, cuota, pago, referencia }) {
  const { doc, buffer } = crearDocumento();
  membrete(doc, despacho);

  doc.fillColor('#111111').fontSize(14).font('Helvetica-Bold').text('Recibo de pago');
  doc.fontSize(9).font('Helvetica').fillColor('#555555').text(`Nº ${referencia} · Emitido el ${fecha(new Date())}`);
  doc.moveDown(1);

  datosFincaYPropietario(doc, finca, propietario);

  const pendiente = Math.max(0, Number(cuota.importe) - Number(cuota.pagado_total));
  tabla(doc, [
    { titulo: 'Concepto', ancho: 4 },
    { titulo: 'Periodo', ancho: 2 },
    { titulo: 'Importe de la cuota', ancho: 2, derecha: true },
    { titulo: 'Importe cobrado', ancho: 2, derecha: true }
  ], [[cuota.concepto, cuota.periodo || '—', eur(cuota.importe), eur(pago.importe)]]);

  doc.moveDown(0.8);
  doc.fontSize(10).font('Helvetica').fillColor('#111111');
  doc.text(`Fecha del cobro: ${fecha(pago.fecha_pago)}`);
  doc.text(`Forma de pago: ${pago.metodo_pago || '—'}${pago.referencia ? ` (ref. ${pago.referencia})` : ''}`);
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').text(pendiente > 0 ? `Queda pendiente de esta cuota: ${eur(pendiente)}` : 'Esta cuota queda totalmente pagada.');

  doc.moveDown(1.5);
  doc.font('Helvetica').fontSize(10).fillColor('#333333')
    .text(`La comunidad de propietarios ${finca?.nombre || ''}, a través de su administración, declara haber recibido de ${propietario?.nombre_completo || ''} la cantidad indicada en concepto de ${cuota.concepto}${cuota.periodo ? ` (${cuota.periodo})` : ''}.`, { width: ANCHO });

  pie(doc, 'Justificante generado a través de VotifAI por la administración de la comunidad.');
  doc.end();
  return buffer;
}

/**
 * Certificado del estado de deudas con la comunidad (art. 9.1.e LPH), el
 * que se exige en las transmisiones de pisos y locales. Lo expide el
 * secretario (función que suele ejercer el administrador) con el visto
 * bueno del presidente.
 * @param {{concepto, periodo, fecha_vencimiento, importe, pagado}[]} vencidas     cuotas vencidas no pagadas
 * @param {{concepto, periodo, fecha_vencimiento, importe, pagado}[]} porVencer    emitidas aún no vencidas
 */
export function generarCertificadoDeudaPdf({ despacho, finca, propietario, vencidas, porVencer, presidente, referencia, finalidad }) {
  const { doc, buffer } = crearDocumento();
  membrete(doc, despacho);

  doc.fillColor('#111111').fontSize(14).font('Helvetica-Bold').text('Certificado de deudas con la comunidad');
  doc.fontSize(9).font('Helvetica').fillColor('#555555').text(`Art. 9.1.e) de la Ley de Propiedad Horizontal · Nº ${referencia} · ${fecha(new Date())}`);
  doc.moveDown(1);

  datosFincaYPropietario(doc, finca, propietario);

  const pendienteDe = (c) => Math.max(0, Number(c.importe) - Number(c.pagado || 0));
  const totalVencido = vencidas.reduce((t, c) => t + pendienteDe(c), 0);

  doc.fontSize(10).font('Helvetica').fillColor('#111111');
  doc.text(`${despacho?.nombre || 'La administración'}, en calidad de secretario-administrador de la comunidad, CERTIFICA que, según los registros de la comunidad a fecha ${fecha(new Date())}:`, { width: ANCHO });
  doc.moveDown(0.8);

  if (totalVencido <= 0.004) {
    doc.font('Helvetica-Bold').fontSize(11).text('El propietario se encuentra AL CORRIENTE en el pago de las deudas vencidas con la comunidad.', { width: ANCHO });
  } else {
    doc.font('Helvetica-Bold').fontSize(11).text(`El propietario tiene deudas vencidas con la comunidad por un importe total de ${eur(totalVencido)}, con el siguiente detalle:`, { width: ANCHO });
    doc.moveDown(0.6);
    tabla(doc, [
      { titulo: 'Concepto', ancho: 4 },
      { titulo: 'Periodo', ancho: 2 },
      { titulo: 'Vencimiento', ancho: 2 },
      { titulo: 'Pendiente', ancho: 2, derecha: true }
    ], vencidas.map((c) => [c.concepto, c.periodo || '—', fecha(c.fecha_vencimiento), eur(pendienteDe(c))]));
  }

  if (porVencer.length) {
    doc.moveDown(1);
    doc.font('Helvetica').fontSize(10).fillColor('#333333').text('A título informativo, constan además estas cuotas ya emitidas que todavía no han vencido:', { width: ANCHO });
    doc.moveDown(0.4);
    tabla(doc, [
      { titulo: 'Concepto', ancho: 4 },
      { titulo: 'Periodo', ancho: 2 },
      { titulo: 'Vencimiento', ancho: 2 },
      { titulo: 'Pendiente', ancho: 2, derecha: true }
    ], porVencer.map((c) => [c.concepto, c.periodo || '—', fecha(c.fecha_vencimiento), eur(pendienteDe(c))]));
  }

  doc.moveDown(1);
  doc.font('Helvetica').fontSize(10).fillColor('#111111')
    .text(`Y para que conste${finalidad ? ` a efectos de ${finalidad}` : ''}, se expide el presente certificado.`, { width: ANCHO });

  // Firmas: secretario-administrador y visto bueno del presidente.
  doc.moveDown(3);
  if (doc.y > 700) doc.addPage();
  const y = doc.y;
  const mitad = ANCHO / 2;
  doc.fontSize(9).fillColor('#333333');
  doc.text('El secretario-administrador', MARGEN, y, { width: mitad - 20 });
  doc.text(despacho?.nombre || '', MARGEN, y + 45, { width: mitad - 20 });
  doc.text('Vº Bº El/la presidente/a', MARGEN + mitad, y, { width: mitad - 20 });
  doc.text(presidente || '', MARGEN + mitad, y + 45, { width: mitad - 20 });
  doc.y = y + 70;
  doc.x = MARGEN;

  pie(doc, 'Certificado generado a través de VotifAI a partir de los registros de cuotas de la comunidad. Refleja las cuotas registradas en la plataforma; la administración responde de su exactitud.');
  doc.end();
  return buffer;
}

/**
 * Liquidación de un periodo para presentar en junta: resumen congelado,
 * gastos e ingresos por categoría, reparto por propietario (su parte de
 * los gastos según coeficiente frente a lo emitido y cobrado en el
 * periodo) y el fondo de reserva al cierre.
 */
export function generarLiquidacionPdf({ despacho, finca, liquidacion, gastosPorCategoria, ingresosPorCategoria, reparto, fondo }) {
  const { doc, buffer } = crearDocumento();
  membrete(doc, despacho);

  doc.fillColor('#111111').fontSize(14).font('Helvetica-Bold').text('Liquidación de ingresos y gastos');
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333').text(finca?.nombre || '');
  doc.fontSize(9).font('Helvetica').fillColor('#555555')
    .text(`Periodo: ${fecha(liquidacion.periodo_inicio)} – ${fecha(liquidacion.periodo_fin)} · Cerrada el ${fecha(liquidacion.creado_en)}`);
  if (liquidacion.anulada_en) {
    doc.moveDown(0.3).font('Helvetica-Bold').fillColor('#b45309')
      .text(`LIQUIDACIÓN ANULADA el ${fecha(liquidacion.anulada_en)}: ${liquidacion.motivo_anulacion || ''}`);
  }
  doc.moveDown(1);

  tabla(doc, [
    { titulo: 'Total ingresos', ancho: 1, derecha: true },
    { titulo: 'Total gastos', ancho: 1, derecha: true },
    { titulo: 'Saldo del periodo', ancho: 1, derecha: true }
  ], [[eur(liquidacion.total_ingresos), eur(liquidacion.total_gastos), eur(liquidacion.saldo)]]);

  const seccion = (titulo) => { doc.moveDown(1); doc.fontSize(11).font('Helvetica-Bold').fillColor('#1f2937').text(titulo); doc.moveDown(0.3); };

  seccion('Gastos por partida / categoría');
  if (gastosPorCategoria.length) {
    tabla(doc, [{ titulo: 'Categoría', ancho: 3 }, { titulo: 'Importe', ancho: 1, derecha: true }],
      gastosPorCategoria.map((g) => [g.categoria || 'Sin categoría', eur(g.total)]));
  } else {
    doc.fontSize(9).font('Helvetica').fillColor('#555555').text('Sin gastos en el periodo.');
  }

  seccion('Ingresos por categoría');
  if (ingresosPorCategoria.length) {
    tabla(doc, [{ titulo: 'Categoría', ancho: 3 }, { titulo: 'Importe', ancho: 1, derecha: true }],
      ingresosPorCategoria.map((g) => [g.categoria || 'Sin categoría', eur(g.total)]));
  } else {
    doc.fontSize(9).font('Helvetica').fillColor('#555555').text('Sin ingresos en el periodo.');
  }

  seccion('Reparto por propietario');
  doc.fontSize(8).font('Helvetica').fillColor('#555555')
    .text('Parte de los gastos del periodo según el coeficiente de cada propietario, frente a las cuotas emitidas con vencimiento en el periodo, lo cobrado de ellas y lo que queda pendiente.', { width: ANCHO });
  doc.moveDown(0.4);
  tabla(doc, [
    { titulo: 'Vivienda', ancho: 1.3 },
    { titulo: 'Propietario', ancho: 2.6 },
    { titulo: 'Coef.', ancho: 1, derecha: true },
    { titulo: 'Parte gastos', ancho: 1.4, derecha: true },
    { titulo: 'Emitido', ancho: 1.3, derecha: true },
    { titulo: 'Cobrado', ancho: 1.3, derecha: true },
    { titulo: 'Pendiente', ancho: 1.3, derecha: true }
  ], reparto.map((r) => [r.propiedad_detalle || '—', r.nombre_completo, `${Number(r.coeficiente).toFixed(2)}%`, eur(r.parte_gastos), eur(r.emitido), eur(r.cobrado), eur(r.pendiente)]));

  seccion('Fondo de reserva (art. 9.1.f LPH)');
  doc.fontSize(10).font('Helvetica').fillColor('#111111').text(`Saldo al cierre del periodo: ${eur(fondo.saldo)}`);
  if (fondo.minimo !== null) {
    doc.text(`Mínimo legal (10 % del presupuesto ordinario «${fondo.presupuestoReferencia.nombre}»): ${eur(fondo.minimo)}`);
    doc.font('Helvetica-Bold').fillColor(fondo.cumple ? '#047857' : '#b91c1c')
      .text(fondo.cumple ? 'El fondo de reserva cumple el mínimo legal.' : `El fondo de reserva está por debajo del mínimo legal: faltan ${eur(fondo.falta)}.`);
  } else {
    doc.fillColor('#555555').text('No hay presupuesto ordinario registrado para calcular el mínimo legal.');
  }

  if (liquidacion.notas) {
    seccion('Observaciones');
    doc.fontSize(10).font('Helvetica').fillColor('#111111').text(liquidacion.notas, { width: ANCHO });
  }

  pie(doc, 'Liquidación generada a través de VotifAI a partir de la contabilidad de la comunidad. Los totales del resumen quedaron congelados al cerrar el periodo.');
  doc.end();
  return buffer;
}

