import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import Modal from './ui/Modal.jsx';

const eur = (n) => Number(n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

/**
 * Previsto frente a gastado de un presupuesto, partida por partida (los
 * gastos se asignan por su categoría). Los gastos del año que no encajan en
 * ninguna partida se listan aparte.
 */
export default function EjecucionPresupuesto({ presupuesto, onClose }) {
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    if (!presupuesto) return;
    let activo = true;
    fetch(`/api/presupuestos/${presupuesto.id}/ejecucion`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (activo) setDatos(data); })
      .catch(() => { if (activo) setDatos(null); });
    return () => { activo = false; setDatos(null); };
  }, [presupuesto]);

  const colorDesviacion = (d) => (d > 0 ? 'text-rose-400' : 'text-emerald-400');

  return (
    <Modal
      open={Boolean(presupuesto)}
      onClose={onClose}
      icon={Target}
      size="lg"
      title={presupuesto ? `Ejecución — ${presupuesto.nombre}` : ''}
      subtitle="Previsto frente a gastado en el año, por partida"
    >
      {!datos ? (
        <p className="text-3xs text-slate-500">Calculando...</p>
      ) : (
        <div className="space-y-4">
          <table className="w-full text-3xs">
            <thead className="text-slate-400">
              <tr><th className="py-1.5 text-left">Partida</th><th className="py-1.5 text-right">Previsto</th><th className="py-1.5 text-right">Gastado</th><th className="py-1.5 text-right">Desviación</th><th className="py-1.5 text-right">%</th></tr>
            </thead>
            <tbody>
              {(datos.conPartidas ? datos.partidas : [{ ...datos.partidas[0], nombre: 'Presupuesto total (sin partidas)' }]).map((p) => (
                <tr key={p.nombre} className="border-t border-slate-900 text-slate-200">
                  <td className="py-1.5 font-bold">{p.nombre}</td>
                  <td className="py-1.5 text-right font-mono">{eur(p.previsto)}</td>
                  <td className="py-1.5 text-right font-mono">{eur(p.gastado)}</td>
                  <td className={`py-1.5 text-right font-mono font-bold ${colorDesviacion(p.desviacion)}`}>{p.desviacion > 0 ? '+' : ''}{eur(p.desviacion)}</td>
                  <td className="py-1.5 text-right font-mono">{p.porcentaje === null ? '—' : `${p.porcentaje}%`}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-700 text-white font-black">
                <td className="py-2">Total</td>
                <td className="py-2 text-right font-mono">{eur(datos.totales.previsto)}</td>
                <td className="py-2 text-right font-mono">{eur(datos.totales.gastado)}</td>
                <td className={`py-2 text-right font-mono ${colorDesviacion(datos.totales.desviacion)}`}>{datos.totales.desviacion > 0 ? '+' : ''}{eur(datos.totales.desviacion)}</td>
                <td className="py-2 text-right font-mono">{datos.totales.porcentaje === null ? '—' : `${datos.totales.porcentaje}%`}</td>
              </tr>
            </tbody>
          </table>

          {datos.conPartidas && datos.sinPartida.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-4xs font-bold uppercase tracking-wider text-amber-300">Gastos del año fuera de las partidas</p>
              <p className="mt-1 text-4xs text-slate-400">Su categoría no coincide con ninguna partida. Revisa si deberían estar en una.</p>
              <ul className="mt-2 space-y-1">
                {datos.sinPartida.map((s) => (
                  <li key={s.categoria} className="flex justify-between text-3xs text-slate-200"><span>{s.categoria}</span><span className="font-mono">{eur(s.gastado)}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
