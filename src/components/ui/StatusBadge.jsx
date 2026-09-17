const TONOS = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  brand: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
  neutral: 'bg-slate-800/60 text-slate-400 border-slate-700/60'
};

/**
 * Pastilla de estado con el mismo lenguaje visual que ya se usaba a mano
 * para "estado" de puntos del orden del día, motivo de cambio de titular,
 * etc. (bg-{color}-500/10 + texto + borde a juego).
 */
export default function StatusBadge({ tone = 'neutral', children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded font-black uppercase tracking-wider text-[8px] border ${TONOS[tone] || TONOS.neutral} ${className}`}>
      {children}
    </span>
  );
}
