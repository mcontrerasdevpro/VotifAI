export const PLANES = Object.freeze({
  starter: Object.freeze({
    nombre: 'Starter',
    maxFincas: 5,
    maxPropietariosPorFinca: 250,
    transcripcionVoz: false
  }),
  profesional: Object.freeze({
    nombre: 'Profesional',
    maxFincas: 25,
    maxPropietariosPorFinca: 500,
    transcripcionVoz: true
  }),
  premium: Object.freeze({
    nombre: 'Premium',
    maxFincas: 100,
    maxPropietariosPorFinca: 1000,
    transcripcionVoz: true
  }),
  enterprise: Object.freeze({
    nombre: 'Enterprise',
    maxFincas: null,
    maxPropietariosPorFinca: null,
    transcripcionVoz: true
  })
});

export function obtenerPlan(plan) {
  return PLANES[plan] || PLANES.starter;
}