const BASE = 'w-full bg-slate-900 border rounded-xl text-xs text-slate-200 focus:outline-none transition-colors placeholder:text-slate-600';

/**
 * Label + input/select/textarea + error, con icono opcional a la
 * izquierda. Extraído del patrón que se repetía a mano en Login.jsx,
 * Register.jsx, AltaFinca.jsx, ClientSelector.jsx, CensoPropietarios.jsx...
 */
export default function Field({
  label,
  icon: Icon,
  as = 'input',
  error,
  hint,
  className = '',
  children,
  ...rest
}) {
  const borde = error ? 'border-rose-500/60 focus:border-rose-500' : 'border-slate-800 focus:border-blue-500';
  const padding = Icon ? 'py-3 pl-10 pr-4' : 'py-3 px-4';
  const Componente = as === 'select' ? 'select' : as === 'textarea' ? 'textarea' : 'input';

  return (
    <div className={className}>
      {label && (
        <label className="block text-3xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && <Icon className="absolute left-3.5 top-3.5 text-slate-600 pointer-events-none" size={16} />}
        <Componente
          className={`${BASE} ${borde} ${padding} ${as === 'textarea' ? 'resize-none' : ''}`}
          {...rest}
        >
          {children}
        </Componente>
      </div>
      {error ? (
        <p className="text-4xs text-rose-400 font-bold mt-1">{error}</p>
      ) : hint ? (
        <p className="text-4xs text-slate-600 mt-1">{hint}</p>
      ) : null}
    </div>
  );
}
