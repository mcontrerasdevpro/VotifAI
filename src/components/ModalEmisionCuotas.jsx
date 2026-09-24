import { useState } from 'react';
import { Users, LoaderCircle, AlertTriangle } from 'lucide-react';
import Modal from './ui/Modal.jsx';
import Field from './ui/Field.jsx';
import { porc } from '../lib/formato.js';

const eur = (n) => Number(n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const FORM_INICIAL = {
  concepto: '',
  tipo: 'ordinaria',
  reparto: 'coeficiente',
  importe_por_periodo: '',
  frecuencia: 'unica',
  numero_periodos: 12,
  primer_vencimiento: '',
  periodo: ''
};

/**
 * Emisión masiva de cuotas: el importe total del periodo (la cuota
 * ordinaria que sale del presupuesto, o la derrama aprobada en junta) se
 * reparte entre todos los propietarios por coeficiente o a partes iguales.
 * Primero se calcula la vista previa (no guarda nada) y luego se emite.
 */
export default function ModalEmisionCuotas({ open, onClose, entityId, propietarios, onEmitida }) {
  const [form, setForm] = useState(FORM_INICIAL);
  const [excluidos, setExcluidos] = useState([]);
  const [vista, setVista] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');

  const cambiar = (campo) => (e) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
    setVista(null); // cualquier cambio invalida la vista previa
  };
  const alternarExcluido = (id) => {
    setExcluidos((actual) => (actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id]));
    setVista(null);
  };

  const cuerpo = () => ({ ...form, entity_id: entityId, excluidos, importe_por_periodo: Number(form.importe_por_periodo), numero_periodos: Number(form.numero_periodos) });

  const llamar = async (url) => {
    setTrabajando(true);
    setError('');
    try {
      const res = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo()) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo completar la operación.');
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setTrabajando(false);
    }
  };

  const calcular = async (e) => {
    e.preventDefault();
    const data = await llamar('/api/cuotas/emision/previsualizar');
    if (data) setVista(data);
  };

  const emitir = async () => {
    const data = await llamar('/api/cuotas/emision');
    if (!data) return;
    setForm(FORM_INICIAL);
    setExcluidos([]);
    setVista(null);
    onEmitida(data.mensaje);
  };

  const cerrar = () => {
    setVista(null);
    setError('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={cerrar}
      icon={Users}
      size="xl"
      title="Emitir cuotas a toda la comunidad"
      subtitle="Cuota ordinaria o derrama repartida entre todos los propietarios"
      footer={
        <>
          <button type="button" onClick={cerrar} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
          {vista ? (
            <button type="button" onClick={emitir} disabled={trabajando} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {trabajando && <LoaderCircle size={14} className="animate-spin" />} Emitir {vista.cuotasAEmitir} cuotas ({eur(vista.totalEmision)})
            </button>
          ) : (
            <button type="submit" form="form-emision" disabled={trabajando} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {trabajando && <LoaderCircle size={14} className="animate-spin" />} Calcular reparto
            </button>
          )}
        </>
      }
    >
      <form id="form-emision" onSubmit={calcular} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field className="sm:col-span-2" label="Concepto" required value={form.concepto} onChange={cambiar('concepto')} placeholder="Ej: Cuota ordinaria 2027 / Derrama ascensor" />
          <Field label="Tipo" as="select" value={form.tipo} onChange={cambiar('tipo')}>
            <option value="ordinaria">Cuota ordinaria</option>
            <option value="derrama">Derrama</option>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Importe total a repartir por periodo (€)" type="number" step="0.01" min="0.01" required value={form.importe_por_periodo} onChange={cambiar('importe_por_periodo')} placeholder="Ej: 1000.00" />
          <Field label="Reparto" as="select" value={form.reparto} onChange={cambiar('reparto')}>
            <option value="coeficiente">Por coeficiente</option>
            <option value="partes_iguales">A partes iguales</option>
          </Field>
          <Field label="Periodicidad" as="select" value={form.frecuencia} onChange={cambiar('frecuencia')}>
            <option value="unica">Un solo cobro</option>
            <option value="mensual">Mensual</option>
            <option value="trimestral">Trimestral</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label={form.frecuencia === 'unica' ? 'Fecha de vencimiento' : 'Vencimiento del primer periodo'} type="date" required value={form.primer_vencimiento} onChange={cambiar('primer_vencimiento')} />
          {form.frecuencia === 'unica' ? (
            <Field label="Periodo (opcional)" value={form.periodo} onChange={cambiar('periodo')} placeholder="Ej: 2027" />
          ) : (
            <Field label="Número de periodos" type="number" min="1" max="24" required value={form.numero_periodos} onChange={cambiar('numero_periodos')} />
          )}
        </div>

        <details className="rounded-xl border border-slate-800 p-3">
          <summary className="cursor-pointer text-3xs font-bold text-slate-300">Excluir propietarios de esta emisión ({excluidos.length})</summary>
          <p className="mt-2 text-4xs text-slate-500">Por ejemplo, locales exentos de ciertos gastos según los estatutos. Su parte se reparte entre el resto.</p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto custom-scrollbar">
            {propietarios.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-3xs text-slate-300">
                <input type="checkbox" checked={excluidos.includes(p.id)} onChange={() => alternarExcluido(p.id)} className="accent-blue-600" />
                {p.propiedad_detalle} — {p.nombre_completo} ({porc(p.coeficiente)})
              </label>
            ))}
          </div>
        </details>
      </form>

      {error && <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-3xs font-bold text-rose-300">{error}</p>}

      {vista && (
        <div className="mt-4 space-y-3">
          {vista.avisos.map((a) => (
            <p key={a} className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-4xs text-amber-200">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {a}
            </p>
          ))}
          <p className="text-3xs text-slate-300">
            {vista.periodos.length > 1
              ? <>Se emitirán <strong>{vista.periodos.length} periodos</strong> ({vista.periodos[0].periodo} → {vista.periodos[vista.periodos.length - 1].periodo}) de {eur(vista.totalPorPeriodo)} cada uno: <strong>{vista.cuotasAEmitir} cuotas</strong>, {eur(vista.totalEmision)} en total.</>
              : <>Se emitirán <strong>{vista.cuotasAEmitir} cuotas</strong> por un total de <strong>{eur(vista.totalEmision)}</strong>, con vencimiento el {new Date(vista.periodos[0].fecha_vencimiento).toLocaleDateString('es-ES')}.</>}
          </p>
          <div className="max-h-64 overflow-y-auto custom-scrollbar rounded-xl border border-slate-800">
            <table className="w-full text-3xs">
              <thead className="sticky top-0 bg-slate-900 text-slate-400">
                <tr><th className="px-3 py-2 text-left">Vivienda</th><th className="px-3 py-2 text-left">Propietario</th><th className="px-3 py-2 text-right">Coeficiente</th><th className="px-3 py-2 text-right">Cuota por periodo</th></tr>
              </thead>
              <tbody>
                {vista.repartos.map((r) => (
                  <tr key={r.propietario_id} className="border-t border-slate-900 text-slate-200">
                    <td className="px-3 py-1.5">{r.propiedad_detalle}</td>
                    <td className="px-3 py-1.5">{r.nombre_completo}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{porc(r.coeficiente, 4)}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold">{eur(r.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
