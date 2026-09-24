const TONOS = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  info: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  brand: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
  neutral: 'bg-slate-800/60 text-slate-400 border-slate-700/60'
};

// Mismos tonos pero legibles sobre fondo blanco (tablas en modo "papel"):
// relleno sólido claro + texto en la variante 700 en vez de translúcido +
// texto claro, que sobre blanco casi no se ve.
const TONOS_LIGHT = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  danger: 'bg-rose-100 text-rose-700 border-rose-200',
  info: 'bg-purple-100 text-purple-700 border-purple-200',
  brand: 'bg-brand-100 text-brand-700 border-brand-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200'
};

/**
 * Pastilla de estado con el mismo lenguaje visual que ya se usaba a mano
 * para "estado" de puntos del orden del día, motivo de cambio de titular,
 * etc. (bg-{color}-500/10 + texto + borde a juego).
 *
 * `light`: variante para cuando la pastilla vive dentro de una tabla en
 * modo "papel" (fondo blanco) — ver Card/DataTable.
 */
export default function StatusBadge({ tone = 'neutral', light = false, children, className = '' }) {
  const tonos = light ? TONOS_LIGHT : TONOS;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded font-black uppercase tracking-wider text-5xs border ${tonos[tone] || tonos.neutral} ${className}`}>
      {children}
    </span>
  );
}
