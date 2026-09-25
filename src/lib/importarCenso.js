// Lectura del censo desde Excel (.xlsx) o CSV en el navegador. El archivo
// no se sube: se convierte aquí en filas y el servidor valida y guarda
// (server/lib/importarCenso.js).

export const CAMPOS = [
  { id: 'propiedad', etiqueta: 'Vivienda / propiedad', obligatorio: false },
  { id: 'nombre', etiqueta: 'Nombre y apellidos', obligatorio: true },
  { id: 'email', etiqueta: 'Email', obligatorio: false },
  { id: 'telefono', etiqueta: 'Teléfono', obligatorio: false },
  { id: 'coeficiente', etiqueta: 'Coeficiente (%)', obligatorio: true }
];

// Nombres de columna habituales en los censos que exportan otros
// programas de administración o que hacen los despachos a mano.
const SINONIMOS = {
  nombre: ['nombreyapellidos', 'apellidosynombre', 'nombrecompleto', 'nombre', 'propietario', 'titular', 'razonsocial'],
  propiedad: ['vivienda', 'propiedad', 'inmueble', 'piso', 'puerta', 'planta', 'portal', 'escalera', 'departamento', 'unidad', 'local'],
  email: ['email', 'correoelectronico', 'correo', 'mail', 'e-mail'],
  telefono: ['telefono', 'movil', 'tlf', 'tfno', 'tel', 'celular'],
  coeficiente: ['coeficiente', 'coef', 'cuotadeparticipacion', 'participacion', 'porcentaje', 'cuota']
};

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9@-]/g, '');

// Qué columnas del archivo corresponden a cada campo. La vivienda puede
// venir repartida en varias columnas (Portal, Piso, Puerta): se juntan.
export function detectarColumnas(cabecera) {
  const mapa = { nombre: [], propiedad: [], email: [], telefono: [], coeficiente: [] };
  const usadas = new Set();
  const nombres = cabecera.map(normalizar);
  const coincide = (n, s) => n === s || n.startsWith(s);
  // Los sinónimos van por prioridad: "Coeficiente" gana a una columna
  // "Cuota" si están las dos.
  for (const campo of ['email', 'telefono', 'coeficiente', 'nombre']) {
    for (const s of SINONIMOS[campo]) {
      const i = nombres.findIndex((n, j) => n && !usadas.has(j) && coincide(n, s));
      if (i !== -1) { mapa[campo].push(i); usadas.add(i); break; }
    }
  }
  nombres.forEach((n, i) => {
    if (n && !usadas.has(i) && SINONIMOS.propiedad.some((s) => coincide(n, s))) mapa.propiedad.push(i);
  });
  return mapa;
}

// La fila de cabecera es la primera (de las 10 primeras) donde se reconocen
// al menos el nombre y el coeficiente: muchos Excel traen un título encima.
export function buscarCabecera(filas) {
  for (let i = 0; i < Math.min(filas.length, 10); i++) {
    const mapa = detectarColumnas(filas[i]);
    if (mapa.nombre.length && mapa.coeficiente.length) return { indice: i, mapa };
  }
  return { indice: 0, mapa: detectarColumnas(filas[0] || []) };
}

// CSV con separador ; (Excel en español), , o tabulador, y comillas.
export function parsearCSV(textoArchivo) {
  const texto = textoArchivo.replace(/^\uFEFF/, '');
  const primera = texto.split(/\r?\n/, 1)[0] || '';
  const separador = [';', '\t', ','].sort((a, b) => primera.split(b).length - primera.split(a).length)[0];
  const filas = [];
  let fila = [], campo = '', entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === separador) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

// Los CSV que guarda Excel en Windows suelen ir en Windows-1252, no en
// UTF-8: si no es UTF-8 válido se relee así para no romper las tildes.
async function leerTexto(archivo) {
  const bytes = await archivo.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

export async function leerArchivoCenso(archivo) {
  const nombre = archivo.name.toLowerCase();
  let filas;
  if (nombre.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser');
    filas = await readSheet(archivo);
  } else if (nombre.endsWith('.csv') || nombre.endsWith('.txt')) {
    filas = parsearCSV(await leerTexto(archivo));
  } else if (nombre.endsWith('.xls')) {
    throw new Error('Los archivos .xls (Excel antiguo) no se pueden leer. Ábrelo en Excel y guárdalo como .xlsx o .csv.');
  } else {
    throw new Error('Formato no admitido. Usa un Excel (.xlsx) o un CSV.');
  }
  const celdas = filas.map((f) => f.map((v) => (v === null || v === undefined ? '' : v instanceof Date ? v.toLocaleDateString('es-ES') : v)));
  return celdas.filter((f) => f.some((v) => String(v).trim() !== ''));
}

// Convierte las filas del archivo en propietarios según el mapa de
// columnas. `fila` es el número de fila tal como se ve en Excel.
export function filasAPropietarios(filas, indiceCabecera, mapa) {
  const valor = (f, cols) => cols.map((i) => String(f[i] ?? '').trim()).filter(Boolean).join(' ');
  // Vivienda repartida en columnas: un valor corto de Portal/Escalera/
  // Bloque lleva delante el nombre de la columna ("Portal 1, 1º A").
  const cabecera = filas[indiceCabecera] || [];
  const vivienda = (f) => {
    if (mapa.propiedad.length < 2) return valor(f, mapa.propiedad);
    return mapa.propiedad.map((i) => {
      const v = String(f[i] ?? '').trim();
      const titulo = String(cabecera[i] ?? '').trim();
      return v && v.length <= 3 && /^(portal|escalera|bloque|esc)/.test(normalizar(titulo)) ? `${titulo} ${v}` : v;
    }).filter(Boolean).join(', ');
  };
  const propietarios = filas.slice(indiceCabecera + 1).map((f, i) => ({
    fila: indiceCabecera + i + 2,
    propiedad: vivienda(f),
    nombre: valor(f, mapa.nombre),
    email: valor(f, mapa.email),
    telefono: valor(f, mapa.telefono),
    coeficiente: mapa.coeficiente.length ? f[mapa.coeficiente[0]] : ''
  }));

  // Coeficientes en tanto por uno (celdas de Excel con formato %: 0,0425
  // en vez de 4,25): si todos son ≤ 1 y suman ~1, se pasan a porcentaje.
  const nums = propietarios.map((p) => (typeof p.coeficiente === 'number' ? p.coeficiente : Number(String(p.coeficiente).replace('%', '').replace(',', '.'))));
  const suma = nums.reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0);
  const enTantoPorUno = nums.length > 1 && nums.every((n) => Number.isFinite(n) && n <= 1) && Math.abs(suma - 1) < 0.02;
  if (enTantoPorUno) propietarios.forEach((p, i) => { p.coeficiente = Math.round(nums[i] * 1000000) / 10000; });

  return { propietarios, enTantoPorUno };
}

export function descargarPlantilla() {
  const lineas = [
    'Vivienda;Nombre y apellidos;Email;Teléfono;Coeficiente (%)',
    '1º A;Ana Ruiz Martín;ana.ruiz@correo.es;600111222;12,50',
    '1º B;Luis Gil Sanz;;600333444;12,50',
    'Local 1;Comercial Olmo S.L.;administracion@olmo.es;;8,75'
  ];
  const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-censo-votifai.csv';
  a.click();
  URL.revokeObjectURL(url);
}
