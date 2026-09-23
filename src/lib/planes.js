// Los planes se definen una sola vez, en server/lib/planes.js, y se leen de
// /api/billing/planes tanto en la web pública como en "Mi plan" — antes la
// landing tenía su propia copia a mano (3 planes, "Desde" y módulos que en
// realidad no dependían del plan) y la app mostraba 4.

// Solo para pintar la web mientras llega la respuesta (o si falla): mismos
// valores que server/lib/planes.js.
export const PLANES_RESPALDO = [
  { id: 'starter', nombre: 'Starter', precioDesde: 49, maxFincas: 5, maxPropietariosPorFinca: 250, transcripcionVoz: false },
  { id: 'profesional', nombre: 'Profesional', precioDesde: 99, maxFincas: 25, maxPropietariosPorFinca: 500, transcripcionVoz: true },
  { id: 'premium', nombre: 'Premium', precioDesde: 199, maxFincas: 100, maxPropietariosPorFinca: 1000, transcripcionVoz: true },
  { id: 'enterprise', nombre: 'Enterprise', precioDesde: null, maxFincas: null, maxPropietariosPorFinca: null, transcripcionVoz: true }
];

// Planes que se pueden probar 15 días al registrarse (mismo criterio que
// PLANES_CON_PRUEBA en server/lib/planes.js).
export const PLANES_CON_PRUEBA = ['starter', 'profesional', 'premium'];

export const LEMA_PLAN = {
  starter: 'Para empezar',
  profesional: 'Para crecer',
  premium: 'Para carteras grandes',
  enterprise: 'A medida'
};

// Lo que de verdad cambia entre planes: capacidad y transcripción de voz.
// Todos los módulos de gestión están incluidos en todos los planes.
// `incluido: false` se pinta con ✗ en vez de ✓ (p. ej. la voz en Starter).
export function caracteristicasPlan(plan) {
  if (plan.id === 'enterprise') {
    return [
      { texto: 'Fincas y propietarios sin límite', incluido: true },
      { texto: 'Transcripción de voz en juntas', incluido: true },
      { texto: 'Condiciones y acompañamiento a medida', incluido: true }
    ];
  }
  return [
    { texto: `Hasta ${plan.maxFincas} fincas`, incluido: true },
    { texto: `Hasta ${plan.maxPropietariosPorFinca} propietarios por finca`, incluido: true },
    { texto: 'Transcripción de voz en juntas', incluido: plan.transcripcionVoz },
    { texto: 'Todos los módulos de gestión', incluido: true }
  ];
}
