// =========================================================================
// 📥 IMPORTACIÓN DEL CENSO (Excel / CSV)
// El navegador lee el archivo y manda las filas ya separadas por campos;
// aquí se normalizan y validan con las mismas reglas que el alta manual
// (nombre y coeficiente obligatorios, teléfono o email de contacto). Es
// una función pura para poder probarla sin base de datos.
// =========================================================================

export const MAX_FILAS_IMPORTACION = 2000;
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());

// "4,25", "4.25", "4,25 %" o 4.25 → 4.25. Con punto de miles y coma
// decimal ("1.234,5") se quita el punto. Devuelve NaN si no es un número.
export function parsearCoeficiente(valor) {
  if (typeof valor === 'number') return valor;
  let s = texto(valor).replace(/%/g, '').replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '');
  s = s.replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

// filas: [{ fila, nombre, propiedad, telefono, email, coeficiente }], donde
// `fila` es el número de fila en el archivo, para que los errores digan
// dónde corregir. Devuelve las filas normalizadas y la lista de errores.
export function validarFilasCenso(filas) {
  const errores = [];
  const validas = [];
  const emailsVistos = new Map();

  if (!Array.isArray(filas) || filas.length === 0) {
    return { validas, errores: [{ fila: null, mensaje: 'El archivo no tiene ningún propietario.' }] };
  }
  if (filas.length > MAX_FILAS_IMPORTACION) {
    return { validas, errores: [{ fila: null, mensaje: `Se pueden importar como máximo ${MAX_FILAS_IMPORTACION} propietarios de una vez.` }] };
  }

  filas.forEach((f, i) => {
    const fila = Number.isInteger(f?.fila) ? f.fila : i + 1;
    const nombre = texto(f?.nombre);
    const propiedad = texto(f?.propiedad) || 'Vivienda';
    const telefono = texto(f?.telefono);
    const email = texto(f?.email).toLowerCase();
    const coeficiente = parsearCoeficiente(f?.coeficiente);
    const error = (mensaje) => errores.push({ fila, mensaje });
    const antes = errores.length;

    if (!nombre) error('Falta el nombre del propietario.');
    else if (nombre.length > 255) error('El nombre es demasiado largo (máximo 255 caracteres).');
    if (propiedad.length > 255) error('La vivienda es demasiado larga (máximo 255 caracteres).');
    if (Number.isNaN(coeficiente)) error(texto(f?.coeficiente) ? `El coeficiente "${texto(f.coeficiente)}" no es un número.` : 'Falta el coeficiente.');
    else if (coeficiente <= 0 || coeficiente > 100) error('El coeficiente debe ser mayor que 0 y como máximo 100.');
    if (!telefono && !email) error('Hace falta un teléfono o un email de contacto.');
    if (telefono.length > 40) error('El teléfono es demasiado largo.');
    if (email && !EMAIL_VALIDO.test(email)) error(`El email "${email}" no es válido.`);
    if (email && emailsVistos.has(email)) error(`El email ${email} ya aparece en la fila ${emailsVistos.get(email)}. Cada propietario necesita un email distinto.`);
    if (email && !emailsVistos.has(email)) emailsVistos.set(email, fila);

    if (errores.length === antes) {
      validas.push({ fila, nombre, propiedad, telefono: telefono || null, email: email || null, coeficiente: Math.round(coeficiente * 10000) / 10000 });
    }
  });

  return { validas, errores };
}

export const sumaCoeficientes = (filas) => Math.round(filas.reduce((s, f) => s + Number(f.coeficiente || 0), 0) * 10000) / 10000;
