import React from 'react';
import { Shield, FileText } from 'lucide-react';

export default function SubNavContexto({ setMostrarModalConvocatoria, dispatch, mercado }) {
  return (
    <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-3 flex justify-between items-center shrink-0">
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 p-1.5 rounded-lg text-white"><Shield size={18} /></div>
        <div>
          <span className="text-base font-black text-white">Votif<span className="text-blue-500">AI</span></span>
          <span className="text-4xs bg-slate-900 text-slate-400 font-bold px-2 py-0.5 rounded-full border border-slate-800 ml-2 uppercase">Sala de Control</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button" 
          onClick={() => setMostrarModalConvocatoria(true)}
          className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-blue-400 text-5xs font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow"
        >
          <FileText size={12} /> Ver Convocatoria Oficial
        </button>

        <div className="bg-slate-900 p-0.5 rounded-lg flex border border-slate-800">
          <button 
            onClick={() => dispatch({ type: 'SET_SALA_STATE', payload: { mercado: 'comunidad', puntoActivo: 0 } })} 
            className={`px-3 py-1 rounded-md text-3xs font-black uppercase tracking-wider transition-all ${mercado === 'comunidad' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
          >
            Fincas
          </button>
          <button 
            onClick={() => dispatch({ type: 'SET_SALA_STATE', payload: { mercado: 'empresa', puntoActivo: 0 } })} 
            className={`px-3 py-1 rounded-md text-3xs font-black uppercase tracking-wider transition-all ${mercado === 'empresa' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
          >
            Empresas
          </button>
        </div>
      </div>
    </nav>
  );
}