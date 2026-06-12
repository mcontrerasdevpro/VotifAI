import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Users, Building2, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 md:p-12 antialiased selection:bg-blue-500">

      {/* 1. CABECERA EXPANDIDA */}
      <header className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-900 pb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-600/20">
            <ShieldCheck size={24} />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-white">Votif<span className="text-blue-500">AI</span></span>
            <p className="text-4xs uppercase tracking-widest text-slate-500 font-bold mt-0.5">Plataforma de Gobernanza Inteligente</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* 🔒 BOTÓN DE ACCESO DIRECTO PARA DESPACHOS REGISTRADOS */}
          <button
            onClick={() => navigate('/login/corporativo')}
            className="text-4xs uppercase tracking-widest text-slate-400 hover:text-white font-bold bg-slate-900 border border-slate-800 hover:border-slate-700 px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            Acceso Administradores
          </button>

          <div className="text-4xs bg-blue-500/10 text-blue-400 px-3 py-2 rounded-xl border border-blue-500/20 font-bold tracking-wider">
            # Certificación Legal Automatizada
          </div>
        </div>

      </header>

      {/* 2. CONTENEDOR PRINCIPAL PANORÁMICO (Aumentado de max-w-xl a max-w-7xl) */}
      <main className="w-full max-w-7xl mx-auto flex-grow flex flex-col justify-center my-8 space-y-8">

        {/* TEXTO DE BIENVENIDA */}
        <div className="text-center space-y-2 max-w-2xl mx-auto mb-4">
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white leading-tight">
            Accede a tu Espacio de Decisiones
          </h1>
          <p className="text-xs md:text-sm text-slate-400 font-medium leading-relaxed">
            Gestión integral de votaciones en tiempo real y redacción automática de actas oficiales mediante Inteligencia Artificial.
          </p>
        </div>

        {/* REJILLA EXPANDIDA A TODA PANTALLA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">

          {/* TARJETA 1: VECINOS */}
          <motion.button
            whileHover={{ scale: 1.01, y: -2 }}
            whileActive={{ scale: 0.99 }}
            onClick={() => navigate('/login/comunidad')}
            className="group relative bg-slate-900/50 border border-slate-800 hover:border-blue-500/40 p-8 rounded-3xl text-left shadow-2xl transition-all flex flex-col justify-between h-64 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all" />

            <div className="bg-blue-600/10 text-blue-400 p-4 rounded-2xl w-fit border border-blue-500/10 shadow-inner">
              <Users size={28} />
            </div>

            <div className="space-y-2 relative z-10">
              <h3 className="text-xl font-black text-white group-hover:text-blue-400 transition-colors">
                Comunidad de Vecinos
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                Accede de forma rápida e intuitiva a tu junta de propietarios asignada. Consulta los puntos del orden del día, delega tu representación y emite tu voto seguro ponderado por coeficientes.
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-2xs text-blue-500 font-bold uppercase tracking-wider mt-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0">
              Entrar a mi junta <ArrowRight size={14} />
            </div>
          </motion.button>

          {/* TARJETA 2: CORPORATIVO */}
          <motion.button
            whileHover={{ scale: 1.01, y: -2 }}
            whileActive={{ scale: 0.99 }}
            onClick={() => navigate('/login/empresa')}
            className="group relative bg-slate-900/50 border border-slate-800 hover:border-indigo-500/40 p-8 rounded-3xl text-left shadow-2xl transition-all flex flex-col justify-between h-64 overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-all" />

            <div className="bg-indigo-600/10 text-indigo-400 p-4 rounded-2xl w-fit border border-indigo-500/10 shadow-inner">
              <Building2 size={28} />
            </div>

            <div className="space-y-2 relative z-10">
              <h3 className="text-xl font-black text-white group-hover:text-indigo-400 transition-colors">
                Empresas
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                Entorno profesional blindado para juntas de accionistas, consejos de administración y asambleas sectoriales. Soporte completo para voto confidencial y ponderación exacta por títulos y acciones legales.
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-2xs text-indigo-500 font-bold uppercase tracking-wider mt-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0">
              Acceso para socios <ArrowRight size={14} />
            </div>
          </motion.button>

        </div>

        {/* BANNER DE REGISTRO INTEGRADO */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-slate-950 to-slate-900/80 p-6 rounded-2xl border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4 text-left w-full shadow-xl"
        >
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">¿Gestionas múltiples comunidades o sociedades mercantiles?</h4>
            <p className="text-2xs text-slate-400">Date de alta de forma autónoma en nuestro ecosistema SaaS para dar cobertura centralizada a toda tu cartera de clientes profesionales.</p>
          </div>
          <button
            onClick={() => navigate('/register')}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold text-2xs px-5 py-3 rounded-xl transition-all whitespace-nowrap active:scale-98 shadow-md shadow-blue-600/10"
          >
            Registrar mi Despacho Profesional
          </button>
        </motion.div>

      </main>

      {/* 3. PIE DE PÁGINA */}
      <footer className="w-full max-w-7xl mx-auto border-t border-slate-900 pt-4 flex flex-col sm:flex-row justify-between items-center text-4xs text-slate-500 font-bold tracking-widest uppercase gap-2 shrink-0">
        <div>© {new Date().getFullYear()} VotifAI Inc. Todos los derechos reservados.</div>
        <div className="flex items-center gap-1"><ShieldCheck size={12} className="text-slate-600" /> Protocolo Criptográfico de Seguridad Activo</div>
      </footer>

    </div>
  );
}