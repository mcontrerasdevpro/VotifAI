import React from 'react';
import { motion } from 'framer-motion';
import { Users, PieChart, Radio, ArrowLeft, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from './ui/Card.jsx';

/**
 * Monitor real: los recuentos vienen del poll de detalle de la junta
 * (Dashboard.jsx, cada 4s contra /api/meetings/detalle/:meetingId) — nada
 * se genera aquí, este componente solo dispara las acciones del despacho
 * (iniciar junta, abrir/cerrar votación de un punto, clausurar asamblea).
 */
export default function ColumnaMonitorCentral({ meeting, puntos, puntoActivoId, coeficienteTotal, onIniciarJunta, onAbrirVotacion, onCerrarVotacion, onClausurarAsamblea }) {
  const navigate = useNavigate();
  const puntoActual = puntos.find((p) => p.id === puntoActivoId);

  const censoTotalCoef = Number(meeting?.censo_total_coeficiente) || 0;
  const censoTotalProp = Number(meeting?.censo_total_propietarios) || 0;

  const coefSi = Number(puntoActual?.coeficiente_si) || 0;
  const coefNo = Number(puntoActual?.coeficiente_no) || 0;
  const coefAbs = Number(puntoActual?.coeficiente_abstencion) || 0;
  const totalVotantes = Number(puntoActual?.total_votantes) || 0;

  // Cuórum = coeficiente de quienes han votado el punto actualmente
  // abierto, sobre el coeficiente total del censo de esta junta.
  const pctSi = censoTotalCoef > 0 ? (coefSi / censoTotalCoef) * 100 : 0;
  const pctNo = censoTotalCoef > 0 ? (coefNo / censoTotalCoef) * 100 : 0;
  const pctAbs = censoTotalCoef > 0 ? (coefAbs / censoTotalCoef) * 100 : 0;
  const cuorumPct = pctSi + pctNo + pctAbs;

  const todosCerrados = puntos.length > 0 && puntos.every((p) => p.estado === 'cerrado');

  return (
    <Card as="section" className="flex-grow flex flex-col h-full overflow-hidden justify-between" padding="p-5">
      <div className="space-y-5 overflow-y-auto flex-grow pr-1 custom-scrollbar">
        <div className="border-b border-slate-900 pb-4">
          <span className="text-4xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            Junta {meeting?.tipo}
          </span>
          <h2 className="text-base font-black text-white mt-1">{meeting?.titulo}</h2>
          <p className="text-4xs text-slate-500 font-mono mt-0.5">{meeting?.finca_nombre}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 shadow-inner">
            <span className="text-4xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Users size={12} className="text-blue-500" /> Cuórum del Punto Actual
            </span>
            <div className="text-2xl font-black text-white mt-1">{cuorumPct.toFixed(2)}%</div>
            <p className="text-4xs text-slate-500 font-medium mt-0.5">{totalVotantes} de {censoTotalProp} propietarios han votado</p>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 shadow-inner">
            <span className="text-4xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <PieChart size={12} className="text-indigo-500" /> Coeficiente Censado
            </span>
            <div className="text-2xl font-black text-white mt-1">{coeficienteTotal.toFixed(2)}%</div>
            <p className="text-4xs text-emerald-500 font-semibold mt-0.5">{coeficienteTotal >= 50 ? '✓ Cuórum legal válido' : '⚠️ Cuórum aún insuficiente'}</p>
          </div>
        </div>

        {meeting?.estado === 'en_curso' && puntoActual && (
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-900 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-900 pb-3">
              <h3 className="text-3xs font-black uppercase tracking-widest text-slate-400">
                Recuento — Punto {puntoActual.orden}
              </h3>

              {puntoActual.estado === 'votando' ? (
                <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg">
                  <span className="text-4xs font-mono font-black text-amber-400 uppercase tracking-widest animate-pulse">● Abierto</span>
                  <button type="button" onClick={() => onCerrarVotacion(puntoActual.id)} className="text-[9px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {puntoActual.tipo === 'votacion' ? 'Cerrar Votación' : 'Cerrar Turno'}
                  </button>
                </div>
              ) : puntoActual.estado === 'cerrado' ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">
                  <span className="text-4xs font-mono font-black text-emerald-400 uppercase tracking-widest">✓ Cerrado</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onAbrirVotacion(puntoActual.id)}
                  className={`text-[9px] font-black text-white px-3 py-1 rounded-md uppercase tracking-wider ${puntoActual.tipo === 'votacion' ? 'bg-blue-600' : 'bg-indigo-600'}`}
                >
                  {puntoActual.tipo === 'votacion' ? 'Abrir Votación' : 'Abrir Turno'}
                </button>
              )}
            </div>

            {puntoActual.tipo === 'votacion' ? (
              <div className="space-y-4 pt-1">
                <BarraVoto label="A Favor (SÍ)" color="emerald" pct={pctSi} />
                <BarraVoto label="En Contra (NO)" color="rose" pct={pctNo} />
                <BarraVoto label="Abstención" color="slate" pct={pctAbs} />
              </div>
            ) : (
              <p className="text-4xs text-slate-500 font-medium italic">Punto informativo, sin votación — úsalo para recoger ruegos y preguntas.</p>
            )}
          </div>
        )}
      </div>

      <div className="pt-2 flex gap-3 items-end w-full">
        <div className="flex-grow">
          {meeting?.estado === 'programada' ? (
            <button
              type="button" onClick={onIniciarJunta}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-3xs font-black uppercase tracking-widest bg-blue-600 border border-blue-500 text-white"
            >
              <Play size={14} /> Iniciar Junta en Vivo
            </button>
          ) : todosCerrados ? (
            <div className="space-y-3 w-full">
              <div className="p-4 border border-dashed border-indigo-500/30 bg-indigo-500/5 rounded-xl flex items-center gap-3">
                <Radio size={18} className="text-indigo-400 animate-pulse shrink-0" />
                <p className="text-4xs text-slate-400 font-medium">Todos los puntos están cerrados. Ya puedes clausurar la asamblea y redactar el acta.</p>
              </div>
              <button
                type="button" onClick={onClausurarAsamblea}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-3xs font-black uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-950/20"
              >
                ✓ Clausurar Asamblea y Redactar Acta
              </button>
            </div>
          ) : (
            <div className="text-4xs text-slate-500 font-bold uppercase tracking-widest text-center py-3">
              {puntos.filter((p) => p.estado === 'cerrado').length} de {puntos.length} puntos cerrados
            </div>
          )}
        </div>

        <button
          type="button" onClick={() => navigate('/hub')}
          className="px-4 py-3 bg-slate-950 border border-slate-900 text-slate-400 hover:text-rose-400 rounded-xl text-3xs font-black uppercase tracking-widest h-[46px] flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <ArrowLeft size={12} /> Salir
        </button>
      </div>
    </Card>
  );
}

function BarraVoto({ label, color, pct }) {
  const colores = {
    emerald: { text: 'text-emerald-400', bar: 'from-emerald-500 to-teal-400' },
    rose: { text: 'text-rose-400', bar: 'from-rose-500 to-pink-400' },
    slate: { text: 'text-slate-400', bar: 'from-slate-500 to-slate-400' }
  };
  const c = colores[color];
  return (
    <div>
      <div className="flex justify-between text-3xs font-bold mb-1">
        <span className={c.text}>{label}</span>
        <span className="font-mono">{pct.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`bg-gradient-to-r ${c.bar} h-full rounded-full`} />
      </div>
    </div>
  );
}
