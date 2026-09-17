import React, { useEffect } from 'react';
import { Shield, FileText, Building2, Landmark } from 'lucide-react';

export default function SubNavContexto({ setMostrarModalConvocatoria, dispatch, mercado, esEmpresa }) {
  
  useEffect(() => {
    if (esEmpresa && mercado !== 'empresa') {
      dispatch({ type: 'SET_SALA_STATE', payload: { mercado: 'empresa', puntoActivo: 0 } });
    } else if (!esEmpresa && mercado !== 'comunidad') {
      dispatch({ type: 'SET_SALA_STATE', payload: { mercado: 'comunidad', puntoActivo: 0 } });
    }
  }, [esEmpresa, mercado, dispatch]);

  return (
    <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-3 flex justify-between items-center shrink-0">
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-lg text-white transition-colors ${esEmpresa ? 'bg-violet-600' : 'bg-blue-600'}`}>
          <Shield size={18} />
        </div>
        <div>
          <span className="text-base font-black text-white">
            Votif<span className={esEmpresa ? 'text-violet-500' : 'text-blue-500'}>AI</span>
          </span>
          <span className="text-4xs bg-slate-900 text-slate-400 font-bold px-2 py-0.5 rounded-full border border-slate-800 ml-2 uppercase">
            Sala de Control
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button" 
          onClick={() => setMostrarModalConvocatoria(true)}
          className={`bg-slate-900 hover:bg-slate-800 border border-slate-800 text-5xs font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow ${esEmpresa ? 'text-violet-400' : 'text-blue-400'}`}
        >
          <FileText size={12} /> Ver Convocatoria Oficial
        </button>

        <div className="bg-slate-950 p-1 rounded-xl flex border border-slate-900 gap-1.5 font-mono">
          <div 
            className={`px-3 py-1.5 rounded-lg text-3xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              !esEmpresa 
                ? 'bg-blue-600/10 border border-blue-500 text-blue-400 shadow-lg shadow-blue-500/5' 
                : 'text-slate-600 border border-transparent opacity-40 select-none'
            }`}
          >
            <Building2 size={12} /> Fincas LPH
          </div>
          <div 
            className={`px-3 py-1.5 rounded-lg text-3xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              esEmpresa 
                ? 'bg-violet-600/10 border border-violet-500 text-violet-400 shadow-lg shadow-violet-500/5' 
                : 'text-slate-600 border border-transparent opacity-40 select-none'
            }`}
          >
            <Landmark size={12} /> Empresas LSC
          </div>
        </div>
      </div>
    </nav>
  );
}