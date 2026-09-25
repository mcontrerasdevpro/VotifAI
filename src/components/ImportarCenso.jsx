import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Upload, Download, AlertTriangle, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import Modal from './ui/Modal.jsx';
import { porc } from '../lib/formato.js';
import { CAMPOS, buscarCabecera, leerArchivoCenso, filasAPropietarios, descargarPlantilla } from '../lib/importarCenso.js';

// Alta masiva del censo desde Excel o CSV: el despacho elige el archivo,
// revisa qué columna es cada dato y ve fila a fila lo que falla antes de
// importar. El servidor valida en modo "simular" en cada cambio y solo
// importa si no hay ningún error (todo o nada).
export default function ImportarCenso({ open, onClose, fincaId, nombreFinca, onImportado }) {
  const [archivo, setArchivo] = useState(null);
  const [filas, setFilas] = useState([]);
  const [cabecera, setCabecera] = useState(0);
  const [mapa, setMapa] = useState(null);
  const [errorLectura, setErrorLectura] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  // Resultado de la revisión del servidor, con la clave de las filas que
  // revisó: si el mapeo cambia, la revisión anterior deja de valer.
  const [revision, setRevision] = useState(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const inputRef = useRef(null);

  const reiniciar = () => {
    setArchivo(null); setFilas([]); setCabecera(0); setMapa(null);
    setErrorLectura(''); setRevision(null); setResultado(null);
    if (inputRef.current) inputRef.current.value = '';
  };
  const cerrar = () => { reiniciar(); onClose(); };

  const elegirArchivo = async (file) => {
    if (!file) return;
    reiniciar();
    setArchivo(file);
    setLeyendo(true);
    try {
      const leidas = await leerArchivoCenso(file);
      if (leidas.length < 2) throw new Error('El archivo no tiene filas de propietarios debajo de la cabecera.');
      const { indice, mapa: detectado } = buscarCabecera(leidas);
      setFilas(leidas);
      setCabecera(indice);
      setMapa(detectado);
    } catch (err) {
      setErrorLectura(err.message || 'No se pudo leer el archivo.');
    } finally {
      setLeyendo(false);
    }
  };

  const { propietarios, enTantoPorUno } = useMemo(
    () => (mapa ? filasAPropietarios(filas, cabecera, mapa) : { propietarios: [], enTantoPorUno: false }),
    [filas, cabecera, mapa]
  );
  const faltanColumnas = mapa ? CAMPOS.filter((c) => c.obligatorio && !mapa[c.id].length) : [];

  const listoParaRevisar = Boolean(mapa && propietarios.length && !faltanColumnas.length);
  const clave = useMemo(() => JSON.stringify(propietarios), [propietarios]);

  // Vista previa validada por el servidor cada vez que cambia el mapeo.
  useEffect(() => {
    if (!listoParaRevisar) return;
    let vigente = true;
    const guardar = (datos) => { if (vigente) setRevision({ ...datos, clave }); };
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/propietarios/importar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ entity_id: fincaId, propietarios, simular: true })
        });
        const data = await res.json();
        guardar(res.ok ? data : { errores: [{ fila: null, mensaje: data.error || 'No se pudo revisar el archivo.' }] });
      } catch {
        guardar({ errores: [{ fila: null, mensaje: 'Sin conexión con el servidor.' }] });
      }
    }, 300);
    return () => { vigente = false; clearTimeout(t); };
  }, [listoParaRevisar, clave, propietarios, fincaId]);

  const revisionActual = listoParaRevisar && revision?.clave === clave ? revision : null;
  const revisando = listoParaRevisar && !revisionActual;

  const erroresPorFila = useMemo(() => {
    const m = new Map();
    (revisionActual?.errores || []).forEach((e) => { if (e.fila !== null) m.set(e.fila, [...(m.get(e.fila) || []), e.mensaje]); });
    return m;
  }, [revisionActual]);
  const erroresGenerales = (revisionActual?.errores || []).filter((e) => e.fila === null);
  const totalErrores = revisionActual?.errores?.length || 0;
  const puedeImportar = revisionActual && totalErrores === 0 && !revisando && !importando;

  const importar = async () => {
    setImportando(true);
    try {
      const res = await fetch('/api/propietarios/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entity_id: fincaId, propietarios })
      });
      const data = await res.json();
      if (res.ok) {
        setResultado(data);
        onImportado?.();
      } else {
        setRevision({ ...(data.errores ? data : { errores: [{ fila: null, mensaje: data.error || 'No se pudo importar.' }] }), clave });
      }
    } catch {
      setRevision({ errores: [{ fila: null, mensaje: 'Sin conexión con el servidor.' }], clave });
    } finally {
      setImportando(false);
    }
  };

  const columnas = (filas[cabecera] || []).map((c, i) => String(c || '').trim() || `Columna ${i + 1}`);
  const cambiarColumna = (campo, valor) => setMapa((m) => ({ ...m, [campo]: valor === '' ? [] : valor.split(',').map(Number) }));

  const botonSecundario = 'flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900 transition-colors hover:text-white';
  const footer = resultado ? (
    <button type="button" onClick={cerrar} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold">Cerrar</button>
  ) : (
    <>
      <button type="button" onClick={mapa ? reiniciar : cerrar} className={botonSecundario}>{mapa ? 'Elegir otro archivo' : 'Cancelar'}</button>
      {mapa && (
        <button type="button" onClick={importar} disabled={!puedeImportar} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40">
          {importando ? 'Importando...' : revisando ? 'Revisando...' : totalErrores ? `Corrige ${totalErrores} ${totalErrores === 1 ? 'error' : 'errores'} para importar` : `Importar ${propietarios.length} propietarios`}
        </button>
      )}
    </>
  );

  return (
    <Modal open={open} onClose={cerrar} icon={FileSpreadsheet} size="xl" eyebrow="Censo desde Excel o CSV" title={`Importar censo${nombreFinca ? ` · ${nombreFinca}` : ''}`} footer={footer}>
      {resultado ? (
        <div className="py-8 text-center space-y-3">
          <CheckCircle2 size={36} className="mx-auto text-emerald-400" />
          <p className="text-sm font-black text-white">{resultado.importados} propietarios importados</p>
          <p className="text-xs text-slate-400">Los coeficientes de la comunidad suman {porc(resultado.suma_coeficientes)}.</p>
          {resultado.avisos?.map((a) => <p key={a} className="text-xs text-amber-300">{a}</p>)}
          <p className="text-4xs text-slate-500 max-w-md mx-auto leading-relaxed">Los propietarios con email ya pueden activar su cuenta desde "Soy propietario" → "Primera vez", con ese mismo correo.</p>
        </div>
      ) : !mapa ? (
        <div className="space-y-4">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); elegirArchivo(e.dataTransfer.files?.[0]); }}
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-10 cursor-pointer transition-colors text-center"
          >
            {leyendo ? <RefreshCw size={28} className="text-blue-400 animate-spin" /> : <Upload size={28} className="text-blue-400" />}
            <span className="text-xs font-bold text-white">{leyendo ? `Leyendo ${archivo?.name}...` : 'Arrastra aquí el archivo o haz clic para elegirlo'}</span>
            <span className="text-4xs text-slate-500">Excel (.xlsx) o CSV · hasta 2.000 propietarios</span>
            <input ref={inputRef} type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={(e) => elegirArchivo(e.target.files?.[0])} />
          </label>
          {errorLectura && (
            <p className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-3xs text-rose-300"><AlertTriangle size={14} className="shrink-0" /> {errorLectura}</p>
          )}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 text-3xs text-slate-400 leading-relaxed">
            <p className="font-bold text-slate-200">Qué debe tener el archivo</p>
            <p>Una fila por propietario, con una cabecera que diga qué es cada columna: <strong className="text-slate-300">vivienda, nombre, email, teléfono y coeficiente</strong>. Nombre y coeficiente son obligatorios, y cada propietario necesita un email o un teléfono. Las columnas se reconocen solas y podrás corregirlas antes de importar.</p>
            <button type="button" onClick={descargarPlantilla} className="inline-flex items-center gap-1.5 font-bold text-blue-400 hover:underline"><Download size={12} /> Descargar plantilla de ejemplo</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-4xs font-bold uppercase tracking-wider text-slate-500 mb-2">Columnas de {archivo?.name}</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {CAMPOS.map((c) => {
                const valor = mapa[c.id].join(',');
                const combinada = mapa[c.id].length > 1;
                return (
                  <label key={c.id} className="block">
                    <span className={`block text-5xs font-bold uppercase tracking-wider mb-1 ${c.obligatorio && !mapa[c.id].length ? 'text-rose-400' : 'text-slate-400'}`}>{c.etiqueta}{c.obligatorio ? ' *' : ''}</span>
                    <select value={valor} onChange={(e) => cambiarColumna(c.id, e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-3xs text-slate-200 focus:outline-none focus:border-blue-500">
                      <option value="">— Ninguna —</option>
                      {combinada && <option value={valor}>{mapa[c.id].map((i) => columnas[i]).join(' + ')}</option>}
                      {columnas.map((nombre, i) => <option key={i} value={String(i)}>{nombre}</option>)}
                    </select>
                  </label>
                );
              })}
            </div>
          </div>

          {faltanColumnas.length > 0 && (
            <p className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-3xs text-rose-300"><AlertTriangle size={14} className="shrink-0" /> Indica qué columna es {faltanColumnas.map((c) => c.etiqueta.toLowerCase()).join(' y ')}.</p>
          )}
          {enTantoPorUno && (
            <p className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-3xs text-blue-300"><Info size={14} className="shrink-0" /> Los coeficientes venían en tanto por uno (0,125) y se han pasado a porcentaje (12,5 %).</p>
          )}
          {erroresGenerales.map((e) => (
            <p key={e.mensaje} className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-3xs text-rose-300"><AlertTriangle size={14} className="shrink-0" /> {e.mensaje}</p>
          ))}
          {revisionActual?.avisos?.map((a) => (
            <p key={a} className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-3xs text-amber-300"><Info size={14} className="shrink-0" /> {a}</p>
          ))}

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-3xs text-slate-400">
            <span><strong className="text-white">{propietarios.length}</strong> propietarios en el archivo</span>
            {revisionActual && <span>Coeficientes de la comunidad tras importar: <strong className="text-white">{porc(revisionActual.suma_coeficientes ?? 0)}</strong></span>}
            {revisionActual?.ya_en_censo > 0 && <span><strong className="text-white">{revisionActual.ya_en_censo}</strong> ya en el censo (se mantienen)</span>}
            {revisando ? <span className="text-slate-500">Revisando…</span> : revisionActual && (totalErrores ? <span className="font-bold text-rose-400">{erroresPorFila.size} filas con errores</span> : <span className="font-bold text-emerald-400">Todo correcto</span>)}
          </div>

          <div className="max-h-80 overflow-auto rounded-xl border border-slate-800">
            <table className="w-full text-3xs">
              <thead className="sticky top-0 bg-slate-950 text-slate-500 uppercase tracking-wider text-5xs">
                <tr>
                  <th className="px-3 py-2 text-left">Fila</th>
                  <th className="px-3 py-2 text-left">Vivienda</th>
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Teléfono</th>
                  <th className="px-3 py-2 text-right">Coef.</th>
                </tr>
              </thead>
              <tbody>
                {propietarios.map((p) => {
                  const errs = erroresPorFila.get(p.fila);
                  return (
                    <React.Fragment key={p.fila}>
                      <tr className={`border-t border-slate-800/70 ${errs ? 'bg-rose-500/[0.07]' : ''}`}>
                        <td className="px-3 py-2 font-mono text-slate-500">{p.fila}</td>
                        <td className="px-3 py-2 text-slate-300">{p.propiedad || <span className="text-slate-600">Vivienda</span>}</td>
                        <td className="px-3 py-2 font-bold text-white">{p.nombre}</td>
                        <td className="px-3 py-2 text-slate-300">{p.email}</td>
                        <td className="px-3 py-2 text-slate-300">{p.telefono}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-200">{String(p.coeficiente).replace('.', ',')}</td>
                      </tr>
                      {errs && (
                        <tr className="bg-rose-500/[0.07]">
                          <td />
                          <td colSpan={5} className="px-3 pb-2 text-rose-300">{errs.join(' ')}</td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-4xs text-slate-500">Se importa todo o nada: si alguna fila tiene un error, corrígelo en el archivo (o cambia la columna) y vuelve a cargarlo. Los propietarios que ya están en el censo no se tocan.</p>
        </div>
      )}
    </Modal>
  );
}
