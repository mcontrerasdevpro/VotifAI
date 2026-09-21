import React from 'react';
import { Shield } from 'lucide-react';

export default function FincasSelector({ cargando, admin, tenantGlobal, fincas, seleccionada, alSeleccionar }) {
  return (
    <div className="space-y-4 shrink-0">
      {/* Cabecera Institucional */}
      <div className="p-3 border border-slate-800 bg-slate-950 rounded-xl shadow-inner">
        <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-400 uppercase tracking-widest">
          <Shield size={11} className="text-blue-500" /> Entorno de Gestión Activo
        </div>
        <h3 className="text-xs font-black text-white mt-1 truncate">
          {cargando ? "Verificando Despacho..." : admin ? admin.nombre_entidad : tenantGlobal?.nombreEntidad || "Administrador General"}
        </h3>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-[10px] text-slate-500 font-medium truncate">
            {admin ? admin.email_maestro : tenantGlobal?.email || "Conectando con Neon Cloud..."}
          </p>
          <span className="text-[9px] font-black text-slate-300 font-mono uppercase truncate">
            {admin?.cif || tenantGlobal?.cif || 'SIN CIF'}
          </span>
        </div>
      </div>

      {/* Selector de Fincas */}
      <div>
        <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Fincas en Cartera</h4>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
          {cargando ? (
            <span className="text-5xs text-slate-600">Cargando catálogo...</span>
          ) : fincas.length === 0 ? (
            <span className="text-5xs text-rose-400">Sin fincas en Neon.</span>
          ) : (
            fincas.map((finca) => (
              <button
                key={finca.id}
                onClick={() => alSeleccionar(finca)}
                className={`px-2.5 py-1 rounded-lg text-4xs font-bold transition-all border ${
                  seleccionada?.id === finca.id
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
    </div>
  );
}
