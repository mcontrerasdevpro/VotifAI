import React from 'react';

export default function HeaderDashboard({ admin }) {
  return (
    <header className="w-full bg-[#0d1117] text-white h-16 px-6 flex justify-between items-center border-b border-slate-800 shrink-0">
      {/* Lado Izquierdo: Logotipo y Contexto */}
      <div className="flex items-center gap-3">
        <span className="text-xl font-black tracking-wider text-indigo-400">Votif<span className="text-white">AI</span></span>
        <div className="h-4 w-[1px] bg-slate-700"></div>
        <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
          Consola Maestro de Gestión de Carteras
        </span>
      </div>

      {/* Lado Derecho: Datos del Administrador de Fincas */}
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-200">
            {admin?.nombre || 'Cargando Administrador...'}
          </p>
          <p className="text-xs text-indigo-400 font-mono">
            {admin?.despacho || 'Despacho Profesional'}
          </p>
        </div>

        {/* Avatar dinámico con las iniciales */}
        <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center font-bold text-indigo-400">
          {admin?.nombre ? admin.nombre.substring(0, 2).toUpperCase() : 'AF'}
        </div>
      </div>
    </header>
  );
}