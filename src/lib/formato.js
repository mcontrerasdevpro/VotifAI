// Formato español para pantallas: coma decimal y símbolo separado
// (150,00 €, 25,00 %). Mismo criterio que las actas y los PDF.
export const eur = (n) => `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
export const porc = (n, decimales = 2) => `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} %`;
