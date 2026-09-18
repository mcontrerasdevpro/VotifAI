import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export default function LegalLayout({ titulo, children }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-4 sm:p-8 antialiased">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white font-bold transition-colors bg-slate-900 px-4 py-2 rounded-xl border border-slate-800"
          >
            <ArrowLeft size={14} /> Volver
          </button>
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck size={16} className="text-blue-500" />
            <span className="text-xs font-black text-white">Votif<span className="text-blue-500">AI</span></span>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 sm:p-10">
          <h1 className="text-lg font-black text-white mb-6">{titulo}</h1>
          <div className="space-y-5 text-xs leading-relaxed text-slate-400 [&_h2]:text-xs [&_h2]:font-black [&_h2]:text-slate-200 [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:pt-2 [&_strong]:text-slate-300">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
