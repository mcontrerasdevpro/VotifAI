import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Vote, Plus, ChevronUp, ChevronDown } from 'lucide-react';

export default function PuntosOrdenDia({ 
  puntos, puntoActivo, alCambiarPunto, mostrarForm, alToggleForm, 
  nuevoTexto, alCambiarTexto, alAñadir, expandidos, alToggleExpandir 
}) {
  return (
    <div className="flex flex-col flex-grow overflow-hidden">
      <div className="flex justify-between items-center mb-3 shrink-0 border-t border-slate-900 pt-3">
        <h2 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Vote size={14} className="text-blue-500" /> Puntos a Tratar ({puntos.length})
        </h2>
        <button
          onClick={alToggleForm}
          className={`p-1 rounded-md border transition-colors ${mostrarForm ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
        >
          <Plus size={12} />
        </button>
      </div>

      <AnimatePresence>
        {mostrarForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={alAñadir}
            className="bg-slate-950 border border-slate-800 p-3 rounded-xl mb-3 space-y-2 overflow-hidden shrink-0"
          >
            <textarea
              required
              placeholder="Ej: Renovación del servicio de conserjería..."
              value={nuevoTexto}
              onChange={(e) => alCambiarTexto(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-4xs text-slate-200 focus:outline-none resize-none h-12"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={alToggleForm} className="text-5xs font-bold text-slate-500">Cancelar</button>
              <button type="submit" className="bg-blue-600 text-white text-5xs font-black px-3 py-1 rounded-md">Incluir</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-2.5 overflow-y-auto flex-grow pr-1 custom-scrollbar">
        {puntos.map((punto, index) => {
          const estaExpandido = !!expandidos[index];
          const esElActivo = index === puntoActivo;

          return (
            <div key={punto.id} className={`w-full rounded-xl border transition-all flex flex-col overflow-hidden ${esElActivo ? 'bg-blue-600/10 border-blue-500 shadow-lg' : 'bg-slate-950 border-slate-900'}`}>
              <div onClick={() => alCambiarPunto(index)} className="p-3 flex justify-between items-start gap-2 cursor-pointer select-none">
                <div className="text-3xs font-bold text-slate-200 line-clamp-1 flex-grow">{punto.id}. {punto.t}</div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); alToggleExpandir(index); }}
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
                    {punto.t}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="px-3 pb-2.5 pt-1.5 flex justify-between items-center text-5xs font-black uppercase tracking-wider bg-slate-950/20 border-t border-slate-900/20 shrink-0">
                <span className={esElActivo ? 'text-blue-400' : 'text-slate-600'}>EXP-00{punto.id}</span>
                <span className={`px-2 py-0.5 rounded font-black ${punto.estado === 'Votando' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse' : punto.estado === 'Debatiendo' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : punto.estado === 'Cerrado' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900 text-slate-500'}`}>
                  {punto.estado}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}