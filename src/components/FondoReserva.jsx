import { useCallback, useEffect, useState } from 'react';
import { PiggyBank, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Card from './ui/Card.jsx';
import Field from './ui/Field.jsx';

const eur = (n) => Number(n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

/**
 * Fondo de reserva (art. 9.1.f LPH): saldo, aportaciones y disposiciones,
 * y aviso si queda por debajo del 10 % del último presupuesto ordinario.
 */
export default function FondoReserva({ entidadId }) {
  const [estado, setEstado] = useState(null);
  const [form, setForm] = useState({ tipo: 'aportacion', concepto: '', importe: '', fecha: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Cambiar `version` vuelve a cargar el fondo (tras registrar o borrar).
  const [version, setVersion] = useState(0);
  const cargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let activo = true;
    fetch(`/api/fondo-reserva/${entidadId}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (activo && data) setEstado(data); })
      .catch((err) => console.error('Fallo al cargar el fondo de reserva:', err));
    return () => { activo = false; };
  }, [entidadId, version]);

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const registrar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const res = await fetch('/api/fondo-reserva/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entidadId, ...form, importe: Number(form.importe) })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar el movimiento.');
      setForm({ tipo: 'aportacion', concepto: '', importe: '', fecha: '' });
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (m) => {
    if (!window.confirm(`¿Eliminar "${m.concepto}" (${eur(m.importe)})?`)) return;
    const res = await fetch(`/api/fondo-reserva/delete/${m.id}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) alert(data.error || 'No se pudo eliminar.');
    await cargar();
  };

  if (!estado) return <p className="text-3xs text-slate-500">Cargando fondo de reserva...</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><PiggyBank size={12} className="text-blue-500" /> Saldo del fondo</span>
          <p className="text-sm font-black text-blue-400 mt-1 font-mono">{eur(estado.saldo)}</p>
        </Card>
        <Card>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Mínimo legal (10 %)</span>
          <p className="text-sm font-black text-slate-200 mt-1 font-mono">{estado.minimo === null ? '—' : eur(estado.minimo)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {estado.presupuestoReferencia ? `Del presupuesto ordinario «${estado.presupuestoReferencia.nombre}» (${eur(estado.presupuestoReferencia.importe)})` : 'Crea un presupuesto ordinario para calcularlo'}
          </p>
        </Card>
        <Card>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Art. 9.1.f LPH</span>
          {estado.cumple === null ? (
            <p className="text-3xs text-slate-400 mt-1">Sin presupuesto ordinario de referencia.</p>
          ) : estado.cumple ? (
            <p className="flex items-center gap-1.5 text-3xs font-bold text-emerald-400 mt-1"><CheckCircle2 size={14} /> Cumple el mínimo</p>
          ) : (
            <p className="flex items-center gap-1.5 text-3xs font-bold text-rose-400 mt-1"><AlertTriangle size={14} /> Por debajo: faltan {eur(estado.falta)}</p>
          )}
        </Card>
      </div>

      <Card padding="p-4">
        <form onSubmit={registrar} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <Field label="Tipo" as="select" value={form.tipo} onChange={cambiar('tipo')}>
            <option value="aportacion">Aportación</option>
            <option value="disposicion">Disposición (uso)</option>
          </Field>
          <Field className="sm:col-span-2" label="Concepto" required value={form.concepto} onChange={cambiar('concepto')} placeholder={form.tipo === 'aportacion' ? 'Ej: Dotación anual 2027' : 'Ej: Reparación de cubierta'} />
          <Field label="Importe (€)" type="number" step="0.01" min="0.01" required value={form.importe} onChange={cambiar('importe')} />
          <Field label="Fecha" type="date" required value={form.fecha} onChange={cambiar('fecha')} />
          <button type="submit" disabled={guardando} className="sm:col-span-5 bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Plus size={12} /> Registrar {form.tipo === 'aportacion' ? 'aportación' : 'disposición'}
          </button>
        </form>
        {error && <p className="mt-3 text-3xs font-bold text-rose-400">{error}</p>}
      </Card>

      <Card padding="p-0" light>
        <table className="w-full text-3xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr><th className="px-4 py-2 text-left">Fecha</th><th className="px-4 py-2 text-left">Concepto</th><th className="px-4 py-2 text-left">Tipo</th><th className="px-4 py-2 text-right">Importe</th><th className="px-4 py-2" /></tr>
          </thead>
          <tbody>
            {estado.movimientos.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No hay movimientos del fondo de reserva.</td></tr>
            )}
            {estado.movimientos.map((m) => (
              <tr key={m.id} className="border-t border-slate-100 text-slate-800">
                <td className="px-4 py-2">{new Date(m.fecha).toLocaleDateString('es-ES')}</td>
                <td className="px-4 py-2 font-bold">{m.concepto}</td>
                <td className="px-4 py-2">{m.tipo === 'aportacion' ? 'Aportación' : 'Disposición'}</td>
                <td className={`px-4 py-2 text-right font-mono font-black ${m.tipo === 'aportacion' ? 'text-emerald-600' : 'text-rose-600'}`}>{m.tipo === 'aportacion' ? '+' : '-'}{eur(m.importe)}</td>
                <td className="px-4 py-2 text-center">
                  <button type="button" onClick={() => eliminar(m)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300" title="Eliminar"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
