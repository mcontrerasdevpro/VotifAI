import { useEffect, useMemo, useState } from 'react';
import { Landmark, Plus, AlertTriangle, History, UserMinus, CalendarClock } from 'lucide-react';
import Card from './ui/Card.jsx';
import Modal from './ui/Modal.jsx';
import Field from './ui/Field.jsx';
import { NOMBRES_CARGO } from '../lib/cargos.js';

// Junta de gobierno de la comunidad (art. 13 LPH), bien a la vista en el
// resumen de la finca: presidente, vicepresidentes, secretario, tesorero y
// vocales, elegidos entre los propietarios del censo, con su mandato.

const PLURAL = { vicepresidente: 'Vicepresidentes', vocal: 'Vocales' };
const hoy = () => new Date().toISOString().slice(0, 10);
const masUnAnio = (fecha) => { const d = new Date(`${fecha}T12:00:00`); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };
const fechaES = (f) => (f ? new Date(`${f}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

async function llamar(url, metodo = 'GET', datos) {
  const r = await fetch(url, { method: metodo, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: datos ? JSON.stringify(datos) : undefined });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(res.error || 'No se pudo completar la operación.');
  return res;
}

// `peticion` ({ propietarioId, n }) abre el alta ya con ese propietario
// elegido: la usa el botón "Cargo" de cada fila del censo.
export default function JuntaGobierno({ fincaId, peticion, onCambio }) {
  const [vigentes, setVigentes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [censo, setCenso] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);
  const [cesando, setCesando] = useState(null);

  const cargar = () => Promise.all([llamar(`/api/entities/${fincaId}/cargos`), llamar(`/api/propietarios/lista/${fincaId}`)])
    .then(([cargos, lista]) => {
      setVigentes(cargos.vigentes);
      setHistorial(cargos.historial);
      setCenso(lista.propietarios || []);
    })
    .catch((err) => setError(err.message))
    .finally(() => setCargando(false));

  useEffect(() => {
    if (fincaId) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaId]);

  const abrir = (cargo = 'presidente', propietarioId = '') => { setError(''); setForm({ cargo, propietario_id: propietarioId, desde: hoy(), hasta: masUnAnio(hoy()) }); };

  // Cada petición nueva del censo (n distinto) abre el alta una sola vez.
  const [peticionAtendida, setPeticionAtendida] = useState(null);
  if (peticion?.propietarioId && peticion.n !== peticionAtendida) {
    setPeticionAtendida(peticion.n);
    abrir(vigentes.some((c) => c.cargo === 'presidente') ? 'vocal' : 'presidente', peticion.propietarioId);
  }

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await llamar(`/api/entities/${fincaId}/cargos`, 'POST', form);
      setForm(null);
      await cargar();
      onCambio?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const cesar = async (e) => {
    e.preventDefault();
    try {
      await llamar(`/api/cargos/${cesando.id}/cesar`, 'POST', { fecha: cesando.fecha, motivo: cesando.motivo });
      setCesando(null);
      await cargar();
      onCambio?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const presidente = vigentes.find((c) => c.cargo === 'presidente');
  const vencidos = vigentes.filter((c) => c.hasta && c.hasta < hoy());
  const grupos = useMemo(() => Object.keys(NOMBRES_CARGO).map((cargo) => ({ cargo, cargos: vigentes.filter((c) => c.cargo === cargo) })), [vigentes]);
  const actual = form && vigentes.find((c) => c.cargo === form.cargo && ['presidente', 'secretario', 'tesorero'].includes(form.cargo));

  return (
    <Card padding="p-5" className="shrink-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white"><Landmark size={16} className="text-blue-500" /> Junta de gobierno</h2>
        <div className="flex gap-2">
          {historial.length > 0 && (
            <button type="button" onClick={() => setVerHistorial(true)} className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-4xs font-black uppercase tracking-wider text-slate-400 hover:text-white"><History size={12} /> Historial</button>
          )}
          <button type="button" onClick={() => abrir(presidente ? 'vocal' : 'presidente')} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-4xs font-black uppercase tracking-wider text-white hover:bg-blue-500"><Plus size={12} /> Nombrar cargo</button>
        </div>
      </div>

      {!cargando && !presidente && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-3xs font-bold text-amber-200"><AlertTriangle size={14} className="shrink-0" /> La comunidad no tiene presidente. Es obligatorio (art. 13 LPH) y firma el visto bueno de actas y certificados.</p>
          <button type="button" onClick={() => abrir('presidente')} className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-4xs font-black uppercase tracking-wider text-slate-950 hover:bg-amber-400">Nombrar presidente</button>
        </div>
      )}
      {vencidos.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-3xs font-bold text-amber-200"><CalendarClock size={14} className="shrink-0" /> Mandato vencido: {vencidos.map((c) => `${NOMBRES_CARGO[c.cargo].toLowerCase()} (${c.nombre})`).join(', ')}. Renueva los cargos en la próxima junta.</p>
      )}

      {cargando ? (
        <p className="mt-4 text-3xs text-slate-500">Cargando cargos...</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {grupos.map(({ cargo, cargos }) => (
            <div key={cargo} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-5xs font-black uppercase tracking-widest text-slate-500">{cargos.length > 1 ? PLURAL[cargo] : NOMBRES_CARGO[cargo]}</p>
              {cargos.length === 0 ? (
                cargo === 'secretario'
                  ? <p className="mt-1.5 text-3xs text-slate-500">Lo ejerce el administrador</p>
                  : <button type="button" onClick={() => abrir(cargo)} className="mt-1.5 text-3xs font-bold text-blue-400 hover:underline">+ Nombrar</button>
              ) : (
                <ul className="mt-1.5 space-y-2">
                  {cargos.map((c) => (
                    <li key={c.id} className="group">
                      <p className="text-xs font-bold text-white">{c.nombre}</p>
                      <p className="text-4xs text-slate-500">{c.propiedad} · hasta {fechaES(c.hasta)}</p>
                      <button type="button" onClick={() => setCesando({ ...c, fecha: hoy(), motivo: '' })} className="mt-0.5 flex items-center gap-1 text-5xs font-bold uppercase tracking-wider text-slate-600 hover:text-rose-300"><UserMinus size={10} /> Cesar</button>
                    </li>
                  ))}
                  {PLURAL[cargo] && <li><button type="button" onClick={() => abrir(cargo)} className="text-4xs font-bold text-blue-400 hover:underline">+ Añadir</button></li>}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {error && !form && !cesando && <p className="mt-3 text-3xs font-bold text-rose-300">{error}</p>}

      <Modal open={Boolean(form)} onClose={() => setForm(null)} icon={Landmark} eyebrow="Junta de gobierno" title="Nombrar cargo"
        footer={<>
          <button type="button" onClick={() => setForm(null)} className="flex-1 rounded-xl border border-slate-900 bg-slate-950 py-2.5 text-xs font-bold text-slate-400 hover:text-white">Cancelar</button>
          <button type="submit" form="form-cargo" disabled={guardando} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50">{guardando ? 'Guardando...' : 'Nombrar'}</button>
        </>}
      >
        {form && (
          <form id="form-cargo" onSubmit={guardar} className="space-y-3">
            <Field as="select" label="Cargo" value={form.cargo} onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}>
              {Object.entries(NOMBRES_CARGO).map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
            </Field>
            <Field as="select" label="Propietario" required value={form.propietario_id} onChange={(e) => setForm((f) => ({ ...f, propietario_id: e.target.value }))}>
              <option value="">Elige un propietario del censo…</option>
              {censo.map((p) => <option key={p.id} value={p.id}>{p.propiedad_detalle} · {p.nombre_completo}</option>)}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombrado el" type="date" required value={form.desde} onChange={(e) => setForm((f) => ({ ...f, desde: e.target.value, hasta: masUnAnio(e.target.value) }))} />
              <Field label="Fin del mandato" type="date" required value={form.hasta} onChange={(e) => setForm((f) => ({ ...f, hasta: e.target.value }))} hint="Un año, salvo que los estatutos digan otra cosa" />
            </div>
            {actual && <p className="rounded-xl bg-slate-950 p-3 text-3xs text-slate-400">{actual.nombre} dejará de ser {NOMBRES_CARGO[form.cargo].toLowerCase()} y quedará en el historial.</p>}
            {censo.length === 0 && <p className="text-3xs text-amber-300">Primero da de alta a los propietarios en el censo.</p>}
            {error && <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-3xs font-bold text-rose-300">{error}</p>}
          </form>
        )}
      </Modal>

      <Modal open={Boolean(cesando)} onClose={() => setCesando(null)} icon={UserMinus} eyebrow="Junta de gobierno" title={cesando ? `Cesar a ${cesando.nombre} como ${NOMBRES_CARGO[cesando.cargo].toLowerCase()}` : ''}
        footer={<>
          <button type="button" onClick={() => setCesando(null)} className="flex-1 rounded-xl border border-slate-900 bg-slate-950 py-2.5 text-xs font-bold text-slate-400 hover:text-white">Cancelar</button>
          <button type="submit" form="form-cese" className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-500">Cesar</button>
        </>}
      >
        {cesando && (
          <form id="form-cese" onSubmit={cesar} className="space-y-3">
            <Field label="Fecha del cese" type="date" required value={cesando.fecha} onChange={(e) => setCesando((c) => ({ ...c, fecha: e.target.value }))} />
            <Field label="Motivo (opcional)" type="text" value={cesando.motivo} onChange={(e) => setCesando((c) => ({ ...c, motivo: e.target.value }))} placeholder="Fin del mandato, dimisión, acuerdo de la junta..." />
            {error && <p className="text-3xs font-bold text-rose-300">{error}</p>}
          </form>
        )}
      </Modal>

      <Modal open={verHistorial} onClose={() => setVerHistorial(false)} icon={History} eyebrow="Junta de gobierno" title="Historial de cargos" size="lg">
        <ul className="divide-y divide-slate-800">
          {historial.map((c) => (
            <li key={c.id} className="py-2.5 text-3xs">
              <p className="font-bold text-white">{NOMBRES_CARGO[c.cargo]} · {c.nombre} <span className="font-normal text-slate-500">({c.propiedad})</span></p>
              <p className="text-slate-500">Del {fechaES(c.desde)} al {fechaES(c.cesado_en)}{c.motivo_cese ? ` · ${c.motivo_cese}` : ''}</p>
            </li>
          ))}
        </ul>
      </Modal>
    </Card>
  );
}
