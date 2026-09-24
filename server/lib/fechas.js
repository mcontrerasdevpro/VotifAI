// Fechas legibles SIEMPRE en hora de España. El servidor corre en UTC, así
// que sin zona horaria una junta convocada a las 19:00 salía como 17:00
// en el email (horario de verano).
export const ZONA_HORARIA = 'Europe/Madrid';

export const fechaHoraES = (d) =>
  new Date(d).toLocaleString('es-ES', { timeZone: ZONA_HORARIA, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const fechaES = (d) =>
  new Date(d).toLocaleDateString('es-ES', { timeZone: ZONA_HORARIA, day: '2-digit', month: '2-digit', year: 'numeric' });
