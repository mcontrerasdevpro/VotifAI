// =========================================================================
// ⚖️ MAYORÍAS DE LA LEY DE PROPIEDAD HORIZONTAL (art. 17 LPH)
//
// Un acuerdo exige DOBLE mayoría: de propietarios (cabezas) y de cuotas
// (coeficiente). Antes el resultado se decidía solo comparando coeficiente
// a favor contra coeficiente en contra, lo que podía dar por "aprobado" un
// punto que legalmente no lo está.
//
// Reglas aplicadas (texto de la LPH; conviene validarlas con un
// administrador colegiado o un abogado antes de cambiarlas):
//   - simple (17.7): 1ª convocatoria, más de la mitad del TOTAL de
//     propietarios y de cuotas. 2ª convocatoria, más de la mitad de los
//     ASISTENTES, que además represente más de la mitad de las cuotas de
//     los presentes.
//   - un_tercio (17.4) y tres_quintos (17.3): esa fracción del TOTAL de
//     propietarios y de cuotas, en cualquier convocatoria.
//   - unanimidad (17.6): el total de propietarios y de cuotas.
//   - Privados de voto por deudas (15.2): no se computan ni en cabezas ni
//     en cuotas "a efectos de alcanzar las mayorías".
//   - Ausentes (17.8): en las mayorías sobre el total, los ausentes
//     debidamente citados que no se opongan en 30 días naturales cuentan a
//     favor. Si el acuerdo solo sale contando a los ausentes, el resultado
//     es 'pendiente_ausentes', no 'aprobado'.
//
// Limitación conocida: cada fila del censo es una vivienda/local; un mismo
// propietario con varias fincas cuenta una vez por cada una en "cabezas".
// =========================================================================

export const MAYORIAS = Object.freeze({
  simple: { etiqueta: 'Mayoría simple', articulo: 'art. 17.7 LPH' },
  un_tercio: { etiqueta: 'Un tercio', articulo: 'art. 17.4 LPH' },
  tres_quintos: { etiqueta: 'Tres quintos', articulo: 'art. 17.3 LPH' },
  unanimidad: { etiqueta: 'Unanimidad', articulo: 'art. 17.6 LPH' }
});

export const TIPOS_MAYORIA = Object.freeze(Object.keys(MAYORIAS));

// Margen para comparar coeficientes decimales (NUMERIC llega como texto y
// las sumas en coma flotante no son exactas).
const EPS = 1e-6;
const num = (v) => Number(v) || 0;

function alcanza(valor, base, fraccion, estricta) {
  if (base <= 0) return false;
  return estricta ? valor > base * fraccion + EPS : valor >= base * fraccion - EPS;
}

/**
 * @param {object} p
 * @param {string} p.mayoria        simple | un_tercio | tres_quintos | unanimidad
 * @param {string} p.convocatoria   primera | segunda
 * @param {{propietarios:number, coeficiente:number}} p.censo     censo de la junta
 * @param {{propietarios:number, coeficiente:number}} p.privados  privados de voto (15.2)
 * @param {{si:number, no:number, abstencion:number, coefSi:number, coefNo:number, coefAbs:number}} p.votos
 */
export function calcularResultado({ mayoria = 'simple', convocatoria = 'primera', censo, privados, votos }) {
  const tipo = MAYORIAS[mayoria] ? mayoria : 'simple';
  const N = Math.max(0, num(censo?.propietarios) - num(privados?.propietarios));
  const C = Math.max(0, num(censo?.coeficiente) - num(privados?.coeficiente));

  const si = num(votos?.si);
  const no = num(votos?.no);
  const abs = num(votos?.abstencion);
  const coefSi = num(votos?.coefSi);
  const coefNo = num(votos?.coefNo);
  const coefAbs = num(votos?.coefAbs);

  const presentes = si + no + abs;
  const coefPresentes = coefSi + coefNo + coefAbs;
  const ausentes = Math.max(0, N - presentes);
  const coefAusentes = Math.max(0, C - coefPresentes);

  const base = { mayoria: tipo, ...MAYORIAS[tipo], convocatoria, baseComputo: { propietarios: N, coeficiente: C }, presentes, coefPresentes, ausentes, coefAusentes };

  // 2ª convocatoria, mayoría simple: se computa sobre los presentes, así
  // que los ausentes no pueden cambiar nada.
  if (tipo === 'simple' && convocatoria === 'segunda') {
    const aprobado = alcanza(si, presentes, 1 / 2, true) && alcanza(coefSi, coefPresentes, 1 / 2, true);
    return {
      ...base,
      estado: aprobado ? 'aprobado' : 'rechazado',
      requisito: 'Más de la mitad de los asistentes, que representen más de la mitad de las cuotas presentes (2ª convocatoria).'
    };
  }

  if (tipo === 'unanimidad') {
    const requisito = 'Todos los propietarios con derecho a voto y la totalidad de las cuotas.';
    if (no > 0 || abs > 0) return { ...base, estado: 'rechazado', requisito };
    if (N > 0 && si >= N && coefSi >= C - EPS) return { ...base, estado: 'aprobado', requisito };
    // Sin votos en contra ni abstenciones: solo faltan ausentes (17.8).
    return { ...base, estado: ausentes > 0 && si > 0 ? 'pendiente_ausentes' : 'rechazado', requisito };
  }

  const reglas = {
    simple: { fraccion: 1 / 2, estricta: true, requisito: 'Más de la mitad del total de propietarios, que representen más de la mitad del total de cuotas (1ª convocatoria).' },
    un_tercio: { fraccion: 1 / 3, estricta: false, requisito: 'Un tercio del total de propietarios, que representen un tercio del total de cuotas.' },
    tres_quintos: { fraccion: 3 / 5, estricta: false, requisito: 'Tres quintos del total de propietarios, que representen tres quintos del total de cuotas.' }
  };
  const { fraccion, estricta, requisito } = reglas[tipo];

  if (alcanza(si, N, fraccion, estricta) && alcanza(coefSi, C, fraccion, estricta)) {
    return { ...base, estado: 'aprobado', requisito };
  }
  // Art. 17.8: contando a favor a todos los ausentes, ¿se alcanzaría?
  if (ausentes > 0 && alcanza(si + ausentes, N, fraccion, estricta) && alcanza(coefSi + coefAusentes, C, fraccion, estricta)) {
    return { ...base, estado: 'pendiente_ausentes', requisito };
  }
  return { ...base, estado: 'rechazado', requisito };
}
