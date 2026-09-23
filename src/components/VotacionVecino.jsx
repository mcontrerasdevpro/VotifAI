import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Vote, CheckCircle2, Info, Radio } from 'lucide-react';

const ETIQUETA_VOTO = { si: 'SÍ', no: 'NO', abstencion: 'ABSTENCIÓN' };

/**
 * Votación real del vecino: sondea la junta en curso de su finca y, si hay
 * un punto abierto a votación, deja emitir/cambiar el voto. Nunca se
 * muestra el recuento en vivo aquí (solo la propia confirmación) — el
 * resultado se revela cuando el despacho cierra el punto, para evitar el
 * efecto arrastre de ver cómo van votando los demás.
 */
// `onJuntaEnCurso(bool)`: avisa al padre de si hay junta en curso, para que
// Asistencia muestre el micrófono solo entonces (la voz se guarda ligada a
// esa junta y el servidor la rechaza sin junta).
export default function VotacionVecino({ entityId, onJuntaEnCurso }) {
  const [meeting, setMeeting] = useState(null);
  const [puntos, setPuntos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [votando, setVotando] = useState(false);

  useEffect(() => {
    if (!entityId) { setCargando(false); return; }
    let activo = true;

    const refrescar = async () => {
      try {
        const respuesta = await fetch(`/api/meetings/vecino/${entityId}/actual`, { credentials: 'include' });
        const resultado = await respuesta.json();
        if (activo && respuesta.ok) {
          setMeeting(resultado.meeting);
          setPuntos(resultado.puntos || []);
          onJuntaEnCurso?.(Boolean(resultado.meeting));
        }
      } catch (err) {
        console.error('Fallo al consultar la junta en curso:', err);
      } finally {
        if (activo) setCargando(false);
      }
    };

    refrescar();
    const intervalo = setInterval(refrescar, 4000);
    return () => { activo = false; clearInterval(intervalo); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el callback del padre no debe reiniciar el sondeo
  }, [entityId]);

  const emitirVoto = async (puntoId, voto) => {
    setVotando(true);
    try {
      const respuesta = await fetch(`/api/meetings/vecino/puntos/${puntoId}/votar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ voto })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setPuntos((actual) => actual.map((p) => (p.id === puntoId ? { ...p, mi_voto: voto } : p)));
      } else {
        alert(resultado.error || 'No se pudo registrar tu voto.');
      }
    } catch (err) {
      console.error('Fallo al votar:', err);
      alert('Fallo de red al registrar tu voto.');
    } finally {
      setVotando(false);
    }
  };

  if (cargando) {
    return <div className="text-4xs text-slate-500 font-bold uppercase tracking-widest text-center py-6">Comprobando si hay junta en curso...</div>;
  }

  if (!meeting) {
    return (
      <div className="p-4 border border-dashed border-slate-800/60 rounded-xl bg-slate-950/20 text-center">
        <Vote size={22} className="mx-auto mb-2 text-slate-700" />
        <p className="text-4xs text-slate-400 font-medium">No hay ninguna junta en curso ahora mismo.</p>
      </div>
    );
  }

  const puntoAbierto = puntos.find((p) => p.estado === 'votando');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div>
          <span className="block text-[8px] font-mono text-blue-400 font-bold uppercase tracking-wider">Junta en curso</span>
          <h3 className="text-xs font-black text-white">{meeting.titulo}</h3>
        </div>
        <Radio size={16} className="text-emerald-500 animate-pulse shrink-0" />
      </div>

      {!puntoAbierto ? (
        <p className="text-4xs text-slate-500 font-medium text-center py-3">Ningún punto abierto a votación por ahora.</p>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/60 border border-blue-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            {puntoAbierto.tipo === 'informativo' && <Info size={13} className="text-indigo-400 shrink-0 mt-0.5" />}
            <p className="text-3xs text-slate-200 font-bold leading-relaxed">{puntoAbierto.orden}. {puntoAbierto.texto}</p>
          </div>

          {puntoAbierto.tipo !== 'votacion' ? (
            <p className="text-4xs text-slate-500 italic">Punto informativo — no requiere voto.</p>
          ) : puntoAbierto.mi_voto ? (
            <div className="flex items-center gap-2 text-emerald-400 text-4xs font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
              <CheckCircle2 size={14} /> Has votado {ETIQUETA_VOTO[puntoAbierto.mi_voto]} — puedes cambiarlo mientras siga abierto
            </div>
          ) : null}

          {puntoAbierto.tipo === 'votacion' && (
            <div className="grid grid-cols-3 gap-2">
              {['si', 'no', 'abstencion'].map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  disabled={votando}
                  onClick={() => emitirVoto(puntoAbierto.id, opcion)}
                  className={`py-2.5 rounded-lg text-4xs font-black uppercase tracking-wider border transition-all disabled:opacity-50 ${
                    puntoAbierto.mi_voto === opcion
                      ? opcion === 'si' ? 'bg-emerald-600 border-emerald-500 text-white' : opcion === 'no' ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-600 border-slate-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {ETIQUETA_VOTO[opcion]}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
