import { useState } from 'react';
import { Bell, Check } from 'lucide-react';

const OPCIONES = [
  { valor: 'email', etiqueta: 'Email', requiere: 'email' },
  { valor: 'whatsapp', etiqueta: 'WhatsApp', requiere: 'telefono' },
  { valor: 'ambos', etiqueta: 'Ambos', requiere: ['email', 'telefono'] }
];

/**
 * Deja al vecino elegir por qué canal quiere recibir convocatorias y
 * actas. Solo se ofrecen las opciones para las que tiene dato de
 * contacto — no tiene sentido dejar elegir WhatsApp a quien no dio
 * teléfono, por ejemplo.
 */
export default function PreferenciaNotificacion({ sesion, onActualizado }) {
  const [canal, setCanal] = useState(sesion?.canal_notificacion || 'ambos');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  // "Ambos" solo tiene sentido con email Y teléfono.
  const opcionesDisponibles = OPCIONES.filter((o) => [].concat(o.requiere).every((campo) => sesion?.[campo]));
  if (opcionesDisponibles.length <= 1) return null;

  const elegir = async (valor) => {
    if (valor === canal || guardando) return;
    setCanal(valor);
    setGuardando(true);
    setGuardado(false);
    try {
      const respuesta = await fetch('/api/vecinos/preferencia-notificacion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ canal_notificacion: valor })
      });
      if (respuesta.ok) {
        setGuardado(true);
        onActualizado?.(valor);
        setTimeout(() => setGuardado(false), 2000);
      }
    } catch (err) {
      console.error('Fallo al guardar la preferencia de notificación:', err);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-3.5 space-y-2.5">
      <span className="flex items-center gap-1.5 text-4xs font-black text-slate-500 uppercase tracking-widest">
        <Bell size={12} /> Avisarme por
        {guardado && <span className="text-emerald-400 normal-case font-bold flex items-center gap-0.5 ml-1"><Check size={10} /> Guardado</span>}
      </span>
      <div className="flex gap-2">
        {opcionesDisponibles.map((o) => (
          <button
            key={o.valor}
            type="button"
            disabled={guardando}
            onClick={() => elegir(o.valor)}
            className={`flex-1 py-2 rounded-lg text-4xs font-black uppercase tracking-wider border transition-all disabled:opacity-50 ${
              canal === o.valor ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}
