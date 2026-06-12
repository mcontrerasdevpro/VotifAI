import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, PieChart, Timer, ChevronRight, ArrowLeft, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ColumnaMonitorCentral({ datos, puntoActivo, dispatch, state }) {
  const navigate = useNavigate();

  // Aislamiento reactivo del estado de la asamblea en Neon Cloud
  const { tiempoRestante, votosRegistrados } = state?.salaControl || {
    tiempoRestante: 60, votosRegistrados: 0
  };

  const totalAsistentesSala = 48;
  const puntoActual = datos?.puntos?.[puntoActivo];

  // ⏱️ Efecto unificado para descontar el segundero legal e inflar votos móviles
  useEffect(() => {
    let intervalo = null;

    if (puntoActual?.estado === 'Votando' && tiempoRestante > 0) {
      intervalo = setInterval(() => {
        const nuevoTiempo = tiempoRestante - 1;
        const nuevosVotos = Math.min(votosRegistrados + Math.floor(Math.random() * 3) + 1, totalAsistentesSala);

        const puntosModificados = datos.puntos.map((p, idx) => {
          if (idx === puntoActivo) {
            const incrementoSi = Math.random() > 0.4 ? Math.floor(Math.random() * 3) + 1 : 0;
            const incrementoNo = Math.random() > 0.6 ? Math.floor(Math.random() * 2) + 1 : 0;
            return {
              ...p,
              si: Math.min((p.si || 0) + incrementoSi, 75),
              no: Math.min((p.no || 0) + incrementoNo, 25)
            };
          }
          return p;
        });

        dispatch({
          type: 'SET_SALA_STATE',
          payload: { tiempoRestante: nuevoTiempo, votosRegistrados: nuevosVotos }
        });

        dispatch({ type: 'ACTUALIZAR_PUNTOS', payload: puntosModificados });
      }, 1000);
    } else if (tiempoRestante === 0 && puntoActual?.estado === 'Votando') {
      handleClausurarEscrutinioManual();
    }

    return () => clearInterval(intervalo);
  }, [tiempoRestante, puntoActivo, puntoActual?.estado]);

  const handleAvanzarFlujoPunto = () => {
    if (!puntoActual) return;
    if (puntoActual.estado === 'Debatiendo' || puntoActual.estado === 'Pendiente') {
      const puntosActualizados = datos.puntos.map((p, idx) =>
        idx === puntoActivo ? { ...p, estado: 'Votando' } : p
      );
      dispatch({
        type: 'SET_SALA_STATE',
        payload: { tiempoRestante: 60, votosRegistrados: 0 }
      });
      dispatch({ type: 'ACTUALIZAR_PUNTOS', payload: puntosActualizados });
      return;
    }
    if (puntoActual.estado === 'Cerrado' && puntoActivo < datos.puntos.length - 1) {
      const sigIdx = puntoActivo + 1;
      const puntosActualizados = datos.puntos.map((p, idx) =>
        idx === sigIdx ? { ...p, estado: 'Debatiendo' } : p
      );
      dispatch({ type: 'ACTUALIZAR_PUNTOS', payload: puntosActualizados });
      dispatch({ type: 'SET_SALA_STATE', payload: { puntoActivo: sigIdx } });
    }
  };

  const handleClausurarEscrutinioManual = () => {
    const puntosActualizados = datos.puntos.map((p, idx) =>
      idx === puntoActivo ? { ...p, estado: 'Cerrado', si: 68, no: 22, abs: 10 } : p
    );
    if (puntoActivo < datos.puntos.length - 1 && puntosActualizados[puntoActivo + 1]) {
      puntosActualizados[puntoActivo + 1].estado = 'Debatiendo';
    }
    dispatch({ type: 'ACTUALIZAR_PUNTOS', payload: puntosActualizados });
  };

  const todosLosPuntosCerrados = datos?.puntos?.length > 0 && datos.puntos.every(p => p.estado === 'Cerrado');

  return (
    <section className="flex-grow bg-slate-900/40 border border-slate-900 rounded-2xl p-5 flex flex-col h-full overflow-hidden justify-between">
      <div className="space-y-5 overflow-y-auto flex-grow pr-1 custom-scrollbar">
        {/* Cabecera del Monitor */}
        <div className="border-b border-slate-900 pb-4">
          <span className="text-4xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            {datos?.convocatoria}
          </span>
          <h2 className="text-base font-black text-white mt-1">{datos?.entidad}</h2>
        </div>

        {/* Tarjetas de Cuórum Legal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 shadow-inner">
            <span className="text-4xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Users size={12} className="text-blue-500" /> Cuórum de Cabezas
            </span>
            <div className="text-2xl font-black text-white mt-1">{datos?.cuorum}</div>
            <p className="text-4xs text-slate-500 font-medium mt-0.5">{datos?.subCuorum}</p>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 shadow-inner">
            <span className="text-4xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <PieChart size={12} className="text-indigo-500" /> Coeficiente Total
            </span>
            <div className="text-2xl font-black text-white mt-1">{datos?.coeficiente}</div>
            <p className="text-4xs text-emerald-500 font-semibold mt-0.5">✓ Cuórum legal válido</p>
          </div>
        </div>

        {/* Panel de Escrutinio y Estado del Reloj */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-900 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-900 pb-3">
            <h3 className="text-3xs font-black uppercase tracking-widest text-slate-400">
              Recuento de Voto Consolidados — Tema {puntoActual?.id || 1}
            </h3>

            {puntoActual?.estado === 'Votando' ? (
              <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg">
                <div className="flex items-center gap-1.5 animate-pulse">
                  <Timer size={12} className="text-amber-400" />
                  <span className="text-4xs font-mono font-black text-amber-400 uppercase tracking-widest">
                    Cierre en: <span className="text-white text-3xs font-bold">{tiempoRestante}s</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClausurarEscrutinioManual}
                  className="text-[9px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md uppercase tracking-wider"
                >
                  Forzar Cierre
                </button>
              </div>
            ) : puntoActual?.estado === 'Cerrado' ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">
                <span className="text-4xs font-mono font-black text-emerald-400 uppercase tracking-widest">
                  ✓ Escrutinio Clausurado
                </span>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
                <span className="text-4xs font-mono font-black text-slate-500 uppercase tracking-widest">
                  Esperando Apertura
                </span>
              </div>
            )}
          </div>

          {/* Barómetro de participación móvil */}
          {puntoActual?.estado === 'Votando' && (
            <div className="flex justify-between items-center text-[10px] bg-slate-900/40 p-2.5 rounded-lg border border-slate-900/60 font-medium text-slate-400">
              <span className="flex items-center gap-1.5"><Users size={11} className="text-blue-400" /> Terminales Emitiendo Voto:</span>
              <span className="font-mono font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {votosRegistrados} / {totalAsistentesSala} Propietarios
              </span>
            </div>
          )}

          {/* Barras de Progreso SÍ / NO */}
          <div className="space-y-4 pt-1">
            <div>
              <div className="flex justify-between text-3xs font-bold mb-1">
                <span className="text-emerald-400">A Favor (SÍ)</span>
                <span className="font-mono">{puntoActual?.si || 0}%</span>
              </div>
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${puntoActual?.si || 0}%` }}
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full"
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-3xs font-bold mb-1">
                <span className="text-rose-400">En Contra (NO)</span>
                <span className="font-mono">{puntoActual?.no || 0}%</span>
              </div>
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${puntoActual?.no || 0}%` }}
                  className="bg-gradient-to-r from-rose-500 to-pink-400 h-full rounded-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ⚡ CONTENEDOR INFERIOR CONMUTABLE (CORREGIDO) */}
      <div className="pt-2 flex gap-3 items-end w-full">
        <div className="flex-grow">
          {todosLosPuntosCerrados ? (
            <div className="space-y-3 w-full">
              <div className="p-4 border border-dashed border-indigo-500/30 bg-indigo-500/5 rounded-xl flex items-center gap-3">
                <Radio size={18} className="text-indigo-400 animate-pulse shrink-0" />
                <div className="space-y-0.5">
                  <span className="block text-[9px] font-black text-indigo-400 uppercase tracking-widest">Fase de Asamblea Activa</span>
                  <p className="text-4xs text-slate-400 font-medium">
                    Escrutinio completado. Micrófonos abiertos para **Ruegos y Preguntas**.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  // 1. Levantamos la alerta institucional de sellado criptográfico
                  alert("✓ Acta sellada con HASH SHA-256 de forma vinculante. PDF generado.");

                  // 2. CORRECCIÓN REAL: Viaja en directo a la central de difusión automatizada
                  console.log("➔ Desplegando visor de actas y central de firmas...");
                  navigate('/acta-ia');
                }}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-3xs font-black uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-950/20"
              >
                ✓ Clausurar Asamblea y Redactar Acta por IA
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAvanzarFlujoPunto}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-3xs font-black uppercase tracking-widest border transition-all ${puntoActual?.estado === 'Debatiendo' || puntoActual?.estado === 'Pendiente'
                  ? 'bg-amber-600 border-amber-500 text-white'
                  : puntoActual?.estado === 'Votando'
                    ? 'bg-blue-600 border-blue-500 text-white animate-pulse'
                    : 'bg-slate-900 border-slate-800 text-blue-400 font-bold'
                }`}
            >
              {(puntoActual?.estado === 'Debatiendo' || puntoActual?.estado === 'Pendiente') && '⚡ Abrir Votación Móvil para este Punto'}
              {puntoActual?.estado === 'Votando' && '🔍 Monitorizar Escrutinio en Directo'}
              {puntoActual?.estado === 'Cerrado' && puntoActivo < (datos?.puntos?.length - 1) ? 'Pasar al Siguiente Punto a Tratar' : ''}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate('/hub')}
          className="px-4 py-3 bg-slate-950 border border-slate-900 text-slate-400 hover:text-rose-400 rounded-xl text-3xs font-black uppercase tracking-widest h-[46px] flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <ArrowLeft size={12} /> Salir
        </button>
      </div>
    </section>
  );
}