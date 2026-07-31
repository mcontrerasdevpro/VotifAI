import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio } from 'lucide-react';

export default function PanelEscrutinio({ puntoActivo, dispatch, state }) {
  const { escuchandoIA, transcripcionesIA, juntasData, mercado } = state?.salaControl || {
    escuchandoIA: false, transcripcionesIA: [], juntasData: {}, mercado: 'comunidad'
  };

  useEffect(() => {
    let intervaloIA = null;

    const bibliotecaFrases = {
      0: [
        { ponente: "Presidente (Manuel C.)", texto: "La fachada norte tiene filtraciones graves y si no impermeabilizamos ya, la LPH nos puede hacer responsables subsidiarios por daños estructurales." },
        { ponente: "Vecino 1ºB (Carmen O.)", texto: "Yo estoy de acuerdo con el Presidente, en mi salón ya hay humedades por culpa de las bajantes de la letra C. Hay que arreglarlo con urgencia." },
        { ponente: "Vecino 2ºA (Carlos R.)", texto: "¿Pero se han pedido al menos tres presupuestos diferentes? No podemos aprobar la primera derrama que nos pongan sobre la mesa." }
      ],
      1: [
        { ponente: "Presidente (Manuel C.)", texto: "Pasamos al tema de las cámaras de seguridad para el garaje. Últimamente ha habido robos y con sensores perimetrales 4K estaríamos blindados." },
        { ponente: "Vecino 3ºA (Antonio L.)", texto: "A mí me preocupa la ley de protección de datos. ¿Quién va a custodiar esas grabaciones continuas? Necesitamos garantías jurídicas." },
        { ponente: "Vecino 1ºC (Juan P.)", texto: "Con que se guarden de forma encriptada 30 días y solo tenga acceso el administrador bajo denuncia es totalmente legal, yo voto que sí." }
      ],
      99: [
        { ponente: "Vecino 4ºB (Laura S.)", texto: "Me gustaría solicitar formalmente que en la próxima junta ordinaria se trate el tema de pintar los descansillos de las plantas impares, que están muy deteriorados." },
        { ponente: "Vecino 1ºA (Manuel P.)", texto: "Yo quiero dejar constancia de quejas por ruidos en el patio interior los fines de semana a deshoras. Ruego se envíe un comunicado circular de recordatorio normativo." },
        { ponente: "Presidente (Manuel C.)", texto: "Tomamos nota de ambos ruegos en el borrador del acta. Si no hay más intervenciones de los vecinos censados, levantamos la sesión." }
      ]
    };

    if (escuchandoIA) {
      let indiceFrase = 0;
      const puntos = juntasData?.[mercado || 'comunidad']?.puntos || [];
      const todosLosPuntosCerrados = puntos.length > 0 && puntos.every(p => p.estado === 'Cerrado');

      const frasesDisponibles = todosLosPuntosCerrados
        ? bibliotecaFrases[99]
        : (bibliotecaFrases[puntoActivo] || [{ ponente: "Presidente", texto: "Se abre el turno de intervenciones libres para debatir el punto." }]);

      dispatch({ type: 'SET_SALA_STATE', payload: { transcripcionesIA: [] } });

      intervaloIA = setInterval(() => {
        if (indiceFrase < frasesDisponibles.length) {
          const fraseValida = frasesDisponibles[indiceFrase];
          dispatch({
            type: 'SET_SALA_STATE',
            payload: { 
              transcripcionesIA: [...(state?.salaControl?.transcripcionesIA || []), fraseValida] 
            }
          });
          indiceFrase++;
        } else {
          clearInterval(intervaloIA);
        }
      }, 3500);
    } else {
      dispatch({ type: 'SET_SALA_STATE', payload: { transcripcionesIA: [] } });
    }

    return () => { if (intervaloIA) clearInterval(intervaloIA); };
  }, [escuchandoIA, puntoActivo]);

  return (
    <section className="w-full lg:w-80 bg-slate-900/40 border border-slate-900 rounded-2xl p-4 flex flex-col h-full overflow-hidden justify-between shrink-0">
      <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Radio size={15} className={escuchandoIA ? 'text-rose-500 animate-pulse' : 'text-slate-500'} />
          <h3 className="text-3xs font-black uppercase tracking-widest text-slate-400">Transcripción e IA</h3>
        </div>
        {escuchandoIA && (
          <span className="text-[8px] font-mono bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold px-2 py-0.5 rounded animate-pulse uppercase tracking-wider">
            ● LIVE REC
          </span>
        )}
      </div>

      <div className="flex-grow overflow-y-auto pr-1 custom-scrollbar space-y-3 mb-4 min-h-[250px]">
        {transcripcionesIA.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center p-4 border border-dashed border-slate-800/60 rounded-xl bg-slate-950/20">
            <Radio size={28} className={`mb-2 ${escuchandoIA ? 'text-rose-500 animate-bounce' : 'text-slate-700'}`} />
            <p className="text-4xs text-slate-400 font-medium">Asistente Conversacional Listo</p>
            <p className="text-[9px] text-slate-600 mt-1 max-w-[150px]">Pulsa el capturador inferior para aislar las intervenciones de la sala.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {transcripcionesIA.map((dialogo, idx) => (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                key={idx}
                className="p-2.5 bg-slate-950 border border-slate-900 rounded-xl space-y-1 shadow-sm"
              >
                <div className="flex justify-between items-center text-[9px] font-black text-indigo-400 font-mono tracking-wide uppercase">
                  <span>🎙️ {dialogo.ponente}</span>
                  <span className="text-slate-600 font-normal">Sincronizado</span>
                </div>
                <p className="text-4xs text-slate-300 leading-relaxed font-medium">
                  "{dialogo.texto}"
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-900 pt-3">
        <button
          onClick={() => dispatch({ type: 'SET_SALA_STATE', payload: { escuchandoIA: !escuchandoIA } })}
          className={`w-full py-3 rounded-xl text-5xs font-black uppercase tracking-widest transition-all border ${
            escuchandoIA
              ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-600/10'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          {escuchandoIA ? 'Detener Captura de Sala' : 'Iniciar Captura de Sala'}
        </button>
      </div>
    </section>
  );
}