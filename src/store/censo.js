export function getParticipantesActivos(censo = []) {
  if (!Array.isArray(censo)) return 0;
  return censo.filter(Boolean).length;
}

export function getCoeficienteTotal(censo = []) {
  if (!Array.isArray(censo)) return 0;
  return censo.reduce((total, propietario) => {
    const valor = Number(propietario?.coeficiente ?? 0);
    return total + (Number.isFinite(valor) ? valor : 0);
  }, 0);
}
