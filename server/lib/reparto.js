// =========================================================================
// 💶 REPARTO DE CUOTAS Y PERIODOS
//
// El reparto se hace en céntimos y cuadra al céntimo con el total: cada
// propietario recibe la parte entera que le toca y los céntimos que sobran
// del redondeo van, uno a uno, a quienes tenían la mayor parte decimal
// (método del resto mayor). Así la suma de las cuotas emitidas es siempre
// exactamente el importe que aprobó la junta.
// =========================================================================

/**
 * @param {number} total             importe a repartir (euros)
 * @param {{id:string, coeficiente:number|string}[]} propietarios
 * @param {'coeficiente'|'partes_iguales'} modo
 * @returns {{propietario_id:string, importe:number}[]}
 */
export function repartirImporte(total, propietarios, modo = 'coeficiente') {
  const centimos = Math.round(Number(total) * 100);
  if (!(centimos > 0) || propietarios.length === 0) return [];

  const pesos = propietarios.map((p) => (modo === 'partes_iguales' ? 1 : Math.max(0, Number(p.coeficiente) || 0)));
  const sumaPesos = pesos.reduce((t, w) => t + w, 0);
  if (sumaPesos <= 0) return [];

  const exactos = pesos.map((w) => (centimos * w) / sumaPesos);
  const base = exactos.map((x) => Math.floor(x));
  let sobrantes = centimos - base.reduce((t, c) => t + c, 0);

  // Resto mayor; a igualdad de resto, en el orden del censo.
  const orden = exactos
    .map((x, i) => ({ i, resto: x - Math.floor(x) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (let k = 0; sobrantes > 0; k = (k + 1) % orden.length, sobrantes--) {
    base[orden[k].i] += 1;
  }

  return propietarios.map((p, i) => ({ propietario_id: p.id, importe: base[i] / 100 }));
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_POR_FRECUENCIA = Object.freeze({ mensual: 1, trimestral: 3, semestral: 6, anual: 12 });

function sumarMeses(fechaISO, meses) {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  const destino = new Date(Date.UTC(anio, mes - 1 + meses, 1));
  // Si el día no existe en el mes destino (31 de febrero), el último del mes.
  const ultimoDia = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
  destino.setUTCDate(Math.min(dia, ultimoDia));
  return destino.toISOString().slice(0, 10);
}

function etiquetaPeriodo(fechaISO, frecuencia) {
  const [anio, mes] = fechaISO.split('-').map(Number);
  if (frecuencia === 'mensual') return `${MESES[mes - 1]} ${anio}`;
  if (frecuencia === 'trimestral') return `T${Math.floor((mes - 1) / 3) + 1} ${anio}`;
  if (frecuencia === 'semestral') return `S${mes <= 6 ? 1 : 2} ${anio}`;
  return String(anio);
}

/**
 * Vencimientos y nombres de periodo de una emisión periódica.
 * @param {{frecuencia:string, numero:number, primerVencimiento:string}} p  fecha 'YYYY-MM-DD'
 */
export function generarPeriodos({ frecuencia = 'mensual', numero = 1, primerVencimiento }) {
  const salto = MESES_POR_FRECUENCIA[frecuencia] || 1;
  return Array.from({ length: Math.max(1, Number(numero) || 1) }, (_, i) => {
    const fecha = sumarMeses(primerVencimiento, i * salto);
    return { fecha_vencimiento: fecha, periodo: etiquetaPeriodo(fecha, frecuencia) };
  });
}
