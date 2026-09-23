import { Eye, EyeOff } from 'lucide-react';

/**
 * Botón del "ojo" para mostrar/ocultar una contraseña. Va dentro del
 * contenedor `relative` del input, alineado a la derecha (el input necesita
 * `pr-10` para que el texto no quede debajo del botón).
 */
export default function VerPassword({ visible, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      aria-pressed={visible}
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition-colors hover:text-slate-200 focus:outline-none focus-visible:text-slate-200"
    >
      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
}
