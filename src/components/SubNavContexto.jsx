import React from 'react';
import { FileText, Building2 } from 'lucide-react';
import Brand from './Brand.jsx';

export default function SubNavContexto({ setMostrarModalConvocatoria }) {
  return (
    <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-3 flex justify-between items-center shrink-0">
      <div className="flex items-center gap-3">
        <Brand className="h-6" />
        <span className="text-4xs bg-slate-900 text-slate-400 font-bold px-2 py-0.5 rounded-full border border-slate-800 uppercase">
          Sala de Control
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setMostrarModalConvocatoria(true)}
          className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-5xs font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow text-blue-400"
        >
          <FileText size={12} /> Ver Convocatoria Oficial
        </button>

        <div className="bg-slate-950 p-1 rounded-xl flex border border-slate-900 gap-1.5 font-mono">
          <div className="px-3 py-1.5 rounded-lg text-3xs font-black uppercase tracking-wider flex items-center gap-1.5 bg-blue-600/10 border border-blue-500 text-blue-400 shadow-lg shadow-blue-500/5">
            <Building2 size={12} /> Fincas LPH
          </div>
        </div>
      </div>
    </nav>
  );
}
