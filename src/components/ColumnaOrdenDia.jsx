import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Vote, ChevronUp, ChevronDown, Info } from 'lucide-react';
import StatusBadge from './ui/StatusBadge.jsx';
import Card from './ui/Card.jsx';
import { ETIQUETA_MAYORIA, ESTADO_RESULTADO } from '../lib/mayorias.js';

const TONO_ESTADO = { votando: 'warning', cerrado: 'success', pendiente: 'neutral' };
const LABEL_ESTADO = { votando: 'Votando', cerrado: 'Cerrado', pendiente: 'Pendiente' };

// El orden del día queda fijo al convocar la junta (ver
// ModalConvocarJunta) — esta columna solo permite navegar/expandir los
// puntos ya persistidos, no añadir nuevos en directo.
export default function ColumnaOrdenDia({ puntos, puntoActivoId, setPuntoActivoId, puntosExpandidos, dispatch }) {
  const toggleExpandirTarjeta = (id) => {
    const nuevosExpandidos = { ...puntosExpandidos, [id]: !puntosExpandidos[id] };
    dispatch({ type: 'SET_SALA_STATE', payload: { puntosExpandidos: nuevosExpandidos } });
  };

  return (
    <Card as="aside" className="w-full lg:w-96 flex flex-col h-full overflow-hidden shrink-0" padding="p-4">
      <div className="flex justify-between items-center mb-3 shrink-0">
        <h2 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Vote size={14} className="text-blue-500" /> Puntos a Tratar ({puntos.length})
        </h2>
      </div>

      <div className="space-y-2.5 overflow-y-auto flex-grow pr-1 custom-scrollbar">
        {puntos.map((punto) => {
          const estaExpandido = !!puntosExpandidos[punto.id];
          const esElActivo = punto.id === puntoActivoId;

          return (
            <div key={punto.id} className={`w-full rounded-xl border transition-all flex flex-col overflow-hidden ${esElActivo ? 'bg-blue-600/10 border-blue-500 shadow-lg' : 'bg-slate-950 border-slate-900'}`}>
              <div onClick={() => setPuntoActivoId(punto.id)} className="p-3 flex justify-between items-start gap-2 cursor-pointer select-none">
                <div className="text-3xs font-bold text-slate-200 line-clamp-1 flex-grow flex items-center gap-1.5">
                  {punto.tipo === 'informativo' && <Info size={11} className="text-indigo-400 shrink-0" />}
                  {punto.orden}. {punto.texto}
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleExpandirTarjeta(punto.id); }}
                  className="text-slate-500 hover:text-white p-0.5 rounded transition-colors bg-slate-900 border border-slate-850 shrink-0"
                >
                  {estaExpandido ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>

              <AnimatePresence initial={false}>
                {estaExpandido && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-3 pb-3 pt-1 border-t border-slate-900/60 bg-slate-950/40 text-4xs leading-relaxed text-slate-400 font-medium whitespace-pre-line"
                  >
                    {punto.texto}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="px-3 pb-2.5 pt-1.5 flex justify-between items-center text-5xs font-black uppercase tracking-wider bg-slate-950/20 border-t border-slate-900/20 shrink-0">
                {/* La mayoría exigida se ve antes de abrir la votación; al cerrar
                    el punto, su resultado según la LPH. */}
                <span className={esElActivo ? 'text-blue-400' : 'text-slate-600'}>
                  EXP-{String(punto.orden).padStart(3, '0')} · {punto.tipo === 'votacion' ? ETIQUETA_MAYORIA[punto.mayoria] || 'Mayoría simple' : 'Informativo'}
                </span>
                {punto.estado === 'cerrado' && punto.resultado ? (
                  <span className={`px-2 py-0.5 rounded border ${ESTADO_RESULTADO[punto.resultado.estado].clase}`}>
                    {ESTADO_RESULTADO[punto.resultado.estado].texto}
                  </span>
                ) : (
                  <StatusBadge tone={TONO_ESTADO[punto.estado] || 'neutral'} className={punto.estado === 'votando' ? 'animate-pulse' : ''}>
                    {LABEL_ESTADO[punto.estado] || punto.estado}
                  </StatusBadge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
