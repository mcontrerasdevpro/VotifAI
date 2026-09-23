import { useEffect, useState } from 'react';
import { Receipt, FileDown } from 'lucide-react';

const eur = (n) => Number(n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const ESTADO = {
  pendiente: { texto: 'Pendiente', clase: 'text-slate-300' },
  parcial: { texto: 'Pago parcial', clase: 'text-amber-300' },
  pagada: { texto: 'Pagada', clase: 'text-emerald-300' },
  impagada: { texto: 'Vencida sin pagar', clase: 'text-rose-300' }
};

/**
 * "Mis cuotas y recibos" en la app del vecino: sus cuotas con lo que le
 * queda por pagar, y el recibo en PDF de cada cobro para descargarlo.
 */
export default function MisCuotas() {
  const [cuotas, setCuotas] = useState(null);

  useEffect(() => {
    let activo = true;
    fetch('/api/cuotas/vecino/mis-cuotas', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (activo) setCuotas(data?.cuotas || []); })
      .catch(() => { if (activo) setCuotas([]); });
    return () => { activo = false; };
  }, []);

  if (!cuotas || cuotas.length === 0) return null;

  const pendienteDe = (c) => Math.max(0, Number(c.importe) - c.pagos.reduce((t, p) => t + Number(p.importe), 0));
  const deudaVencida = cuotas.filter((c) => c.estado === 'impagada').reduce((t, c) => t + pendienteDe(c), 0);

  return (
    <details className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
      <summary className="flex cursor-pointer items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-widest text-slate-300">
          <Receipt size={13} className="text-blue-400" /> Mis cuotas y recibos
        </span>
        <span className={`text-4xs font-bold ${deudaVencida > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
          {deudaVencida > 0 ? `Vencido: ${eur(deudaVencida)}` : 'Al corriente'}
        </span>
      </summary>

      <ul className="mt-3 space-y-2">
        {cuotas.map((c) => (
          <li key={c.id} className="rounded-xl border border-slate-800 p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-3xs font-bold text-slate-200">{c.concepto}{c.periodo ? ` · ${c.periodo}` : ''}</p>
                <p className="text-4xs text-slate-500">Vence el {new Date(c.fecha_vencimiento).toLocaleDateString('es-ES')} · {eur(c.importe)}</p>
              </div>
              <span className={`shrink-0 text-4xs font-bold ${ESTADO[c.estado]?.clase || 'text-slate-300'}`}>{ESTADO[c.estado]?.texto || c.estado}</span>
            </div>
            {c.estado !== 'pagada' && pendienteDe(c) > 0 && <p className="text-4xs text-slate-400">Te queda por pagar: <strong className="text-slate-200">{eur(pendienteDe(c))}</strong></p>}
            {c.pagos.map((p) => (
              <a
                key={p.id}
                href={`/api/cuotas/vecino/pagos/${p.id}/recibo`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-4xs font-bold text-blue-400 hover:text-blue-300"
              >
                <FileDown size={12} /> Recibo del pago de {eur(p.importe)} ({new Date(p.fecha_pago).toLocaleDateString('es-ES')})
              </a>
            ))}
          </li>
        ))}
      </ul>
    </details>
  );
}
