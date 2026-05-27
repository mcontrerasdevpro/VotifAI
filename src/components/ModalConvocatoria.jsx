import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield } from 'lucide-react';

export default function ModalConvocatoria({ 
  mostrarModalConvocatoria, setMostrarModalConvocatoria, fincaSeleccionada, datos 
}) {
  return (
    <AnimatePresence>
      {mostrarModalConvocatoria && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            className="bg-slate-900 border border-slate-800 w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col my-4 transition-all"
          >
            {/* Cabecera del Contenedor Unificado */}
            <div className="p-5 border-b border-slate-800/80 bg-slate-950/40 flex justify-between items-center gap-6 shrink-0">
              <div>
                <span className="text-[9px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold px-2.5 py-1 rounded uppercase tracking-wider">
                  {fincaSeleccionada?.documento_adjunto ? "Visor de Documento Original Escaneado" : "Desglose Automatizado del Orden del Día"}
                </span>
                <h2 className="text-sm font-black text-white mt-1 tracking-tight">
                  Convocatoria Oficial: {datos.convocatoria}
                </h2>
                <p className="text-4xs text-slate-500 font-mono mt-0.5 uppercase tracking-wider">
                  Entorno Activo: <span className="text-slate-300 font-bold">{datos.entidad}</span>
                </p>
              </div>

              <div className="bg-slate-950 p-2.5 border border-slate-800 rounded-2xl text-center min-w-[85px] shrink-0 shadow-inner">
                <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest">Horario</span>
                <span className="block text-3xs font-mono font-black text-white mt-0.5">HOY 18:00h</span>
              </div>
            </div>

            {/* Cuerpo central inteligente conmutable */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-slate-950/10 flex flex-col">
              {fincaSeleccionada?.documento_adjunto ? (
                /* MODO A: CON PDF ORIGINAL EN IFRAME */
                <div className="w-full h-full border border-slate-800 rounded-xl overflow-hidden bg-slate-950 flex-grow shadow-inner">
                  <iframe
                    src={`${fincaSeleccionada.documento_adjunto}#toolbar=0&navpanes=0`}
                    className="w-full h-full rounded-xl border-none"
                    title="PDF Convocatoria Original"
                  />
                </div>
              ) : (
                /* MODO B: DESGLOSE DIGITAL POR PUNTOS (LPH / LSC) */
                <div className="space-y-4 flex-grow">
                  <div className="bg-slate-950/40 p-4 border border-slate-850 rounded-2xl space-y-1.5 shrink-0">
                    <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">Notificación Informativa Estándar</h4>
                    <p className="text-4xs text-slate-400 leading-relaxed font-medium">
                      A falta de documento físico escaneado por el despacho administrador, el motor digital de VotifAI expone los puntos legislativos fijados para el escrutinio cruzado ordinario:
                    </p>
                  </div>

                  {/* Recorrido de las tarjetas de los puntos */}
                  <div className="space-y-2.5">
                    {datos?.puntos?.map((punto) => (
                      <div
                        key={punto.id}
                        className="p-4 bg-slate-950 border border-slate-900 rounded-2xl flex items-start gap-4 hover:border-slate-800 transition-colors"
                      >
                        <span className="text-3xs font-mono font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 w-6 h-6 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                          {punto.id}
                        </span>
                        <div className="space-y-1 flex-grow">
                          <p className="text-3xs text-slate-200 leading-relaxed font-bold">
                            {punto.t}
                          </p>
                          <div className="flex gap-3 text-[9px] font-mono uppercase tracking-widest text-slate-500 font-medium">
                            <span>EXPEDIENTE: EXP-00{punto.id}</span>
                            <span>•</span>
                            <span className={punto.estado === 'Cerrado' ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                              FLUJO: {punto.estado}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Sello criptográfico legal de respaldo */}
                  <div className="border border-slate-850 bg-slate-900/40 p-4 rounded-2xl flex items-center gap-4 mt-2 shrink-0">
                    <Shield size={18} className="text-emerald-500 shrink-0" />
                    <div className="space-y-0.5">
                      <span className="block text-[8px] font-black text-emerald-400 uppercase tracking-widest">Sello Digital de Respaldo HASH-SHA256</span>
                      <p className="text-[10px] font-mono text-slate-500 tracking-tight break-all leading-none">
                        b4e789a1cdcefd2100874e1db8c8a14b3a1a5b8e9c7d6e5f4a3b2c1d0f9e8d7c
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Barra de acciones inferior */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setMostrarModalConvocatoria(false)}
                className="bg-blue-600 hover:bg-blue-500 border border-blue-500 hover:border-blue-400 text-white text-3xs font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/10 active:scale-98"
              >
                Cerrar Convocatoria
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}