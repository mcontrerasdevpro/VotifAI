// =========================================================================
// 📊 EJECUCIÓN DEL PRESUPUESTO Y FONDO DE RESERVA
// =========================================================================

const clave = (texto) => String(texto || '').trim().toLowerCase();
const r2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Previsto frente a gastado por partida. Un gasto se asigna a la partida
 * cuya denominación coincide con su categoría (sin distinguir mayúsculas);
 * los que no encajan en ninguna quedan en `sinPartida`, para que no se
 * pierda gasto real fuera del presupuesto.
 * @param {{nombre:string, importe_previsto:number|string}[]} partidas
 * @param {{categoria:string|null, total:number|string}[]} gastosPorCategoria  suma de gastos del año por categoría
 */
export function calcularEjecucion(partidas, gastosPorCategoria) {
  const gastado = new Map();
  for (const g of gastosPorCategoria) {
    const k = clave(g.categoria);
    gastado.set(k, (gastado.get(k) || 0) + Number(g.total || 0));
  }

  const usadas = new Set();
  const filas = partidas.map((p) => {
    const k = clave(p.nombre);
    usadas.add(k);
    const previsto = r2(p.importe_previsto);
    const real = r2(gastado.get(k) || 0);
    return {
      nombre: p.nombre,
      previsto,
      gastado: real,
      desviacion: r2(real - previsto),
      porcentaje: previsto > 0 ? Math.round((real / previsto) * 1000) / 10 : null
    };
  });

  const sinPartida = [...gastado.entries()]
    .filter(([k]) => !usadas.has(k))
    .map(([k, total]) => ({ categoria: gastosPorCategoria.find((g) => clave(g.categoria) === k)?.categoria || 'Sin categoría', gastado: r2(total) }));

  const totalPrevisto = r2(filas.reduce((t, f) => t + f.previsto, 0));
  const totalGastado = r2(filas.reduce((t, f) => t + f.gastado, 0) + sinPartida.reduce((t, s) => t + s.gastado, 0));
  return {
    partidas: filas,
    sinPartida,
    totales: {
      previsto: totalPrevisto,
      gastado: totalGastado,
      desviacion: r2(totalGastado - totalPrevisto),
      porcentaje: totalPrevisto > 0 ? Math.round((totalGastado / totalPrevisto) * 1000) / 10 : null
    }
  };
}

// Art. 9.1.f LPH: el fondo de reserva no puede ser inferior al 10 % del
// último presupuesto ordinario.
export const PORCENTAJE_MINIMO_FONDO = 10;

export function estadoFondo(saldo, presupuestoOrdinario) {
  const s = r2(saldo);
  if (!presupuestoOrdinario) {
    return { saldo: s, minimo: null, cumple: null, falta: null, presupuestoReferencia: null };
  }
  const minimo = r2((Number(presupuestoOrdinario.importe_previsto) * PORCENTAJE_MINIMO_FONDO) / 100);
  return {
    saldo: s,
    minimo,
    cumple: s >= minimo,
    falta: s >= minimo ? 0 : r2(minimo - s),
    presupuestoReferencia: { id: presupuestoOrdinario.id, nombre: presupuestoOrdinario.nombre, anio: presupuestoOrdinario.anio, importe: r2(presupuestoOrdinario.importe_previsto) }
  };
}
