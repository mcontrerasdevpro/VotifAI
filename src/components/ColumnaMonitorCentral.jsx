import React from 'react';
import { motion } from 'framer-motion';
import { Users, PieChart, Radio, ArrowLeft, Play, Scale, UserX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from './ui/Card.jsx';
import { ETIQUETA_MAYORIA, ESTADO_RESULTADO } from '../lib/mayorias.js';

/**
 * Monitor real: los recuentos vienen del poll de detalle de la junta
 * (Dashboard.jsx, cada 4s contra /api/meetings/detalle/:meetingId) — nada
 * se genera aquí, este componente solo dispara las acciones del despacho
 * (iniciar junta, abrir/cerrar votación de un punto, clausurar asamblea).
 */
export default function ColumnaMonitorCentral({ meeting, puntos, puntoActivoId, privadosVoto = [], onIniciarJunta, onHabilitarPrivado, onAbrirVotacion, onCerrarVotacion, onClausurarAsamblea, children }) {
  const navigate = useNavigate();
  const puntoActual = puntos.find((p) => p.id === puntoActivoId);

  const censoTotalCoef = Number(meeting?.censo_total_coeficiente) || 0;
  const censoTotalProp = Number(meeting?.censo_total_propietarios) || 0;

  const coefSi = Number(puntoActual?.coeficiente_si) || 0;
  const coefNo = Number(puntoActual?.coeficiente_no) || 0;
  const coefAbs = Number(puntoActual?.coeficiente_abstencion) || 0;
  const totalVotantes = Number(puntoActual?.total_votantes) || 0;

  // Participación = coeficiente de quienes han votado el punto actualmente
  // abierto, sobre el coeficiente total del censo de esta junta. El
  // resultado legal (doble mayoría, art. 17 LPH) lo calcula el servidor.
  const resultado = puntoActual?.resultado;
  const sinVoto = privadosVoto.filter((p) => !p.habilitado);
  const coefSinVoto = sinVoto.reduce((t, p) => t + Number(p.coeficiente || 0), 0);

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
              <Users size={12} className="text-blue-500" /> Participación del punto actual
            </span>
            <div className="text-2xl font-black text-white mt-1">{cuorumPct.toFixed(2)}%</div>
            <p className="text-4xs text-slate-500 font-medium mt-0.5">{totalVotantes} de {censoTotalProp} propietarios han votado</p>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 shadow-inner">
            <span className="text-4xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <PieChart size={12} className="text-indigo-500" /> Base para las mayorías
            </span>
            <div className="text-2xl font-black text-white mt-1">{Math.max(0, censoTotalProp - sinVoto.length)} <span className="text-xs text-slate-500">propietarios</span></div>
            <p className="text-4xs text-slate-500 font-medium mt-0.5">
              {Math.max(0, censoTotalCoef - coefSinVoto).toFixed(2)}% de cuotas
              {sinVoto.length > 0 && ` · ${sinVoto.length} privado(s) de voto no computan (art. 15.2)`}
              {meeting?.convocatoria && ` · ${meeting.convocatoria === 'segunda' ? '2ª' : '1ª'} convocatoria`}
            </p>
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
                <BarraVoto label={`A Favor (SÍ) · ${puntoActual.votos_si || 0}`} color="emerald" pct={pctSi} />
                <BarraVoto label={`En Contra (NO) · ${puntoActual.votos_no || 0}`} color="rose" pct={pctNo} />
                <BarraVoto label={`Abstención · ${puntoActual.votos_abstencion || 0}`} color="slate" pct={pctAbs} />
                {resultado && (
                  <div className="rounded-lg border border-slate-800 p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-4xs font-black uppercase tracking-widest text-slate-400">
                        <Scale size={12} className="text-indigo-400" /> {ETIQUETA_MAYORIA[resultado.mayoria]} · {resultado.articulo}
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${ESTADO_RESULTADO[resultado.estado].clase}`}>
                        {puntoActual.estado === 'cerrado' ? '' : 'Ahora mismo: '}{ESTADO_RESULTADO[resultado.estado].texto}
                      </span>
                    </div>
                    <p className="text-4xs text-slate-500">{resultado.requisito}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-4xs text-slate-500 font-medium italic">Punto informativo, sin votación — úsalo para recoger ruegos y preguntas.</p>
            )}
          </div>
        )}

        {/* Panel de sala (asistencia, representaciones y votos presenciales) */}
        {children}

        {meeting?.estado === 'en_curso' && privadosVoto.length > 0 && (
          <div className="bg-slate-950 p-4 rounded-xl border border-rose-500/20 space-y-3">
            <h3 className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-widest text-rose-300">
              <UserX size={13} /> Privados de voto por deudas (art. 15.2 LPH)
            </h3>
            <p className="text-4xs text-slate-500">Pueden participar en las deliberaciones pero no votan ni computan para las mayorías. Habilítalos si pagan en la junta o acreditan impugnación o consignación de la deuda.</p>
            <ul className="space-y-2">
              {privadosVoto.map((p) => (
                <li key={p.propietario_id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-900 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-3xs font-bold text-white">{p.nombre_completo}{p.propiedad_detalle ? ` · ${p.propiedad_detalle}` : ''}</p>
                    <p className="text-4xs text-slate-500">
                      Debe {Number(p.deuda).toFixed(2)} € · {Number(p.coeficiente).toFixed(2)}%
                      {p.habilitado && ` · Habilitado: ${p.habilitado_motivo}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onHabilitarPrivado?.(p)}
                    className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md border ${p.habilitado ? 'border-slate-700 text-slate-400' : 'border-emerald-500/30 text-emerald-300'}`}
                  >
                    {p.habilitado ? 'Retirar voto' : 'Habilitar voto'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="pt-2 flex gap-3 items-end w-full">
        <div className="flex-grow">
          {meeting?.estado === 'programada' ? (
            // La convocatoria cambia la mayoría simple (art. 17.7 LPH): 2ª
            // convocatoria cuando en la 1ª no hubo la concurrencia necesaria.
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button" onClick={() => onIniciarJunta('primera')}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-3xs font-black uppercase tracking-widest bg-blue-600 border border-blue-500 text-white"
                >
                  <Play size={14} /> Iniciar en 1ª convocatoria
                </button>
                <button
                  type="button" onClick={() => onIniciarJunta('segunda')}
                  className="flex items-center justify-center gap-2 py-3.5 rounded-xl text-3xs font-black uppercase tracking-widest bg-slate-900 border border-blue-500/40 text-blue-200"
                >
                  <Play size={14} /> Iniciar en 2ª convocatoria
                </button>
              </div>
              <p className="text-4xs text-slate-500 text-center">Segunda convocatoria si en la primera no concurrieron la mayoría de propietarios que representen la mayoría de las cuotas.</p>
            </div>
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
