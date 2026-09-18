import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Users, ShieldCheck, ArrowRight, Sparkles, AudioLines, FileJson, Scale, Send } from 'lucide-react';

const DIAPOSITIVAS = [
  {
    icon: AudioLines,
    color: 'bg-blue-600/10 text-blue-400 border-blue-500/10',
    eyebrow: 'Diarización por IA',
    titulo: 'Cada Intervención, Identificada',
    descripcion: 'El sistema graba el audio de la sala en vivo, aísla cada intervención y la asocia automáticamente al propietario que habla — sin transcripción manual.'
  },
  {
    icon: FileJson,
    color: 'bg-purple-600/10 text-purple-400 border-purple-500/10',
    eyebrow: 'Redacción Automática',
    titulo: 'Actas en 2 Minutos',
    descripcion: 'Un motor entrenado en la Ley de Propiedad Horizontal redacta el borrador oficial del acta nada más cerrar la junta, listo para firmar.'
  },
  {
    icon: Scale,
    color: 'bg-emerald-600/10 text-emerald-400 border-emerald-500/10',
    eyebrow: 'Escrutinio en Tiempo Real',
    titulo: 'Cuórum y Mayorías sin Errores',
    descripcion: 'Control cruzado de cuórum por cabezas y por cuotas de participación, con doble mayoría calculada al instante durante la votación.'
  },
  {
    icon: Send,
    color: 'bg-amber-600/10 text-amber-400 border-amber-500/10',
    eyebrow: 'Notificación Multicanal',
    titulo: 'Convocatorias al Instante',
    descripcion: 'Convocatorias y actas certificadas enviadas automáticamente a cada propietario por email y WhatsApp, con acuse de recibo.'
  }
];

export default function Welcome() {
  const navigate = useNavigate();
  const [slideActiva, setSlideActiva] = useState(0);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setSlideActiva((actual) => (actual + 1) % DIAPOSITIVAS.length);
    }, 4500);
    return () => clearInterval(intervalo);
  }, []);

  const diapositiva = DIAPOSITIVAS[slideActiva];

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

        </div>

      </header>

      {/* 2. CONTENEDOR PRINCIPAL PANORÁMICO */}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-5xl mx-auto items-stretch">

          {/* IZQUIERDA: CARRUSEL DE CARACTERÍSTICAS */}
          <div className="relative bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl h-64 overflow-hidden">
            <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />

            <AnimatePresence mode="wait">
              <motion.div
                key={slideActiva}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
                className="relative z-10 h-full flex flex-col justify-between"
              >
                <div className={`p-4 rounded-2xl w-fit border shadow-inner ${diapositiva.color}`}>
                  <diapositiva.icon size={28} />
                </div>

                <div className="space-y-1.5">
                  <span className="text-3xs font-bold uppercase tracking-widest text-blue-400 flex items-center gap-1.5">
                    <Sparkles size={11} /> {diapositiva.eyebrow}
                  </span>
                  <h3 className="text-lg font-black text-white">{diapositiva.titulo}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{diapositiva.descripcion}</p>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="absolute bottom-6 right-8 flex gap-1.5 z-10">
              {DIAPOSITIVAS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlideActiva(i)}
                  aria-label={`Ver punto ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === slideActiva ? 'w-5 bg-blue-500' : 'w-1.5 bg-slate-700 hover:bg-slate-600'}`}
                />
              ))}
            </div>
          </div>

          {/* DERECHA: TARJETA ÚNICA — VECINOS */}
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

        </div>

        {/* BANNER DE REGISTRO INTEGRADO */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-slate-950 to-slate-900/80 p-6 rounded-2xl border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4 text-left w-full max-w-5xl mx-auto shadow-xl"
        >
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">¿Gestionas varias comunidades de vecinos?</h4>
            <p className="text-2xs text-slate-400">Date de alta de forma autónoma en nuestro ecosistema SaaS para dar cobertura centralizada a toda tu cartera de clientes profesionales.</p>
          </div>
          <button
            onClick={() => navigate('/register')}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold text-2xs px-5 py-3 rounded-xl transition-all whitespace-nowrap active:scale-98 shadow-md shadow-blue-600/10"
          >
            Registrar mi Despacho Profesional
          </button>
        </motion.div>

        <div className="w-full text-center pb-6 shrink-0 z-10">
          <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full text-[16px] font-black uppercase tracking-widest text-amber-400 shadow-md animate-pulse">
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping"></span>
            ACTAS AUTOMATIZADAS CON IA Y ENVIO AL INSTANTE
          </span>
        </div>

      </main>

      {/* 3. PIE DE PÁGINA */}
      <footer className="w-full max-w-7xl mx-auto border-t border-slate-900 pt-4 flex flex-col sm:flex-row justify-between items-center text-4xs text-slate-500 font-bold tracking-widest uppercase gap-3 shrink-0">
        <div>© {new Date().getFullYear()} VotifAI Inc. Todos los derechos reservados.</div>
        <div className="flex items-center gap-4">
          <Link to="/legal/aviso-legal" className="hover:text-slate-300 transition-colors">Aviso Legal</Link>
          <Link to="/legal/privacidad" className="hover:text-slate-300 transition-colors">Privacidad</Link>
          <Link to="/legal/terminos" className="hover:text-slate-300 transition-colors">Términos</Link>
          <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-slate-600" /> Protocolo Criptográfico de Seguridad Activo</span>
        </div>
      </footer>

    </div>
  );
}
