// Tipos de mayoría de la LPH (art. 17) para los puntos con votación. El
// cálculo del resultado se hace en el servidor (server/lib/mayorias.js);
// aquí solo están los textos para elegirla y mostrarla.
export const OPCIONES_MAYORIA = [
  { id: 'simple', etiqueta: 'Mayoría simple', ayuda: 'Acuerdos ordinarios: presupuesto, cuentas, obras de conservación… (art. 17.7)' },
  { id: 'un_tercio', etiqueta: 'Un tercio', ayuda: 'Telecomunicaciones, energías renovables, puntos de recarga comunes… (art. 17.4)' },
  { id: 'tres_quintos', etiqueta: 'Tres quintos', ayuda: 'Servicios comunes (portería, vigilancia), arrendar elementos comunes… (art. 17.3)' },
  { id: 'unanimidad', etiqueta: 'Unanimidad', ayuda: 'Cambios en el título constitutivo o en los estatutos (art. 17.6)' }
];

export const ETIQUETA_MAYORIA = Object.fromEntries(OPCIONES_MAYORIA.map((o) => [o.id, o.etiqueta]));

export const ESTADO_RESULTADO = {
  aprobado: { texto: 'APROBADO', clase: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  rechazado: { texto: 'NO APROBADO', clase: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  pendiente_ausentes: { texto: 'PENDIENTE DE AUSENTES (art. 17.8)', clase: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
};
