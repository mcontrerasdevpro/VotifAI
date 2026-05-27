import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Vote, Plus, ChevronUp, ChevronDown } from 'lucide-react';

export default function ColumnaOrdenDia({ 
  cargandoFincas, datosAdmin, tenantGlobal, fincasReales, fincaSeleccionada, setFincaSeleccionada, datos, puntoActivo, dispatch, state 
}) {
  const [nuevoPuntoTexto, setNuevoPuntoTexto] = useState('');
  const [mostrarFormularioPunto, setMostrarFormularioPunto] = useState(false);
  const { puntosExpandidos, mercado } = state.salaControl;

  const handleAñadirPunto = (e) => {
    e.preventDefault();
    if (!nuevoPuntoTexto.trim()) return;
    const nuevosPuntos = [...datos.puntos, { id: datos.puntos.length + 1, t: nuevoPuntoTexto, si: 0, no: 0, abs: 0, estado: "Pendiente" }];
    
    dispatch({ type: 'ACTUALIZAR_PUNTOS', payload: nuevosPuntos });
    dispatch({ type: 'SET_SALA_STATE', payload: { puntoActivo: nuevosPuntos.length - 1 } });
    setNuevoPuntoTexto('');
    setMostrarFormularioPunto(false);
  };

  const toggleExpandirTarjeta = (index) => {
    const nuevosExpandidos = { ...puntosExpandidos, [index]: !puntosExpandidos[index] };
    dispatch({ type: 'SET_SALA_STATE', payload: { puntosExpandidos: nuevosExpandidos } });
  };

  return (
    <aside className="w-full lg:w-96 bg-slate-900/40 border border-slate-900 rounded-2xl p-4 flex flex-col h-full overflow-hidden shrink-0">
      <div className="p-3 mb-4 border border-slate-800 bg-slate-950 rounded-xl shadow-inner shrink-0">
        <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-400 uppercase tracking-widest">
          <Shield size={11} className="text-blue-500" /> Entorno de Gestión Activo
        </div>
        <h3 className="text-xs font-black text-white mt-1 truncate">
          {cargandoFincas ? "Verificando Despacho..." : datosAdmin ? datosAdmin.nombre_entidad : tenantGlobal?.nombreEntidad || "Administrador General"}
        </h3>
        <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
          {datosAdmin ? datosAdmin.email_maestro : tenantGlobal?.email || "Conectando con Neon Cloud..."}
        </p>
      </div>

      <div className="mb-4 shrink-0">
        <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Fincas en Cartera</h4>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
          {cargandoFincas ? (
            <span className="text-5xs text-slate-600">Cargando catálogo...</span>
          ) : fincasReales.length === 0 ? (
            <span className="text-5xs text-rose-400">Sin fincas en Neon.</span>
          ) : (
            fincasReales.map((finca) => (
              <button
                key={finca.id}
                onClick={() => setFincaSeleccionada(finca)}
                className={`px-2.5 py-1 rounded-lg text-4xs font-bold transition-all border ${fincaSeleccionada?.id === finca.id
                  ? 'bg-blue-600/20 border-blue-500 text-blue-400 font-black'
                  : 'bg-slate-950 border-slate-900 text-slate-400 hover:border-slate-800'
                }`}
              >
                {finca.nombre}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex justify-between items-center mb-3 shrink-0 border-t border-slate-900 pt-3">
        <h2 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Vote size={14} className="text-blue-500" /> Puntos a Tratar ({datos.puntos.length})
        </h2>
        <button
          onClick={() => setMostrarFormularioPunto(!mostrarFormularioPunto)}
          className={`p-1 rounded-md border transition-colors ${mostrarFormularioPunto ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
        >
          <Plus size={12} />
        </button>
      </div>

      <AnimatePresence>
        {mostrarFormularioPunto && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAñadirPunto}
            className="bg-slate-950 border border-slate-800 p-3 rounded-xl mb-3 space-y-2 overflow-hidden shrink-0"
          >
            <textarea
              required
              placeholder="Ej: Renovación del servicio de conserjería..."
              value={nuevoPuntoTexto}
              onChange={(e) => setNuevoPuntoTexto(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-4xs text-slate-200 focus:outline-none resize-none h-12"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setMostrarFormularioPunto(false)} className="text-5xs font-bold text-slate-500">Cancelar</button>
              <button type="submit" className="bg-blue-600 text-white text-5xs font-black px-3 py-1 rounded-md">Incluir</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-2.5 overflow-y-auto flex-grow pr-1 custom-scrollbar">
        {datos.puntos.map((punto, index) => {
          const estaExpandido = !!puntosExpandidos[index];
          const esElActivo = index === puntoActivo;

          return (
            <div key={punto.id} className={`w-full rounded-xl border transition-all flex flex-col overflow-hidden ${esElActivo ? 'bg-blue-600/10 border-blue-500 shadow-lg' : 'bg-slate-950 border-slate-900'}`}>
              <div onClick={() => dispatch({ type: 'SET_SALA_STATE', payload: { puntoActivo: index } })} className="p-3 flex justify-between items-start gap-2 cursor-pointer select-none">
                <div className="text-3xs font-bold text-slate-200 line-clamp-1 flex-grow">{punto.id}. {punto.t}</div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleExpandirTarjeta(index); }}
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
    </aside>
  );
}