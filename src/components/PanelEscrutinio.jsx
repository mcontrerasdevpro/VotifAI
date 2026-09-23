import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Radio, Link2, Check } from 'lucide-react';
import Card from './ui/Card.jsx';
import StatusBadge from './ui/StatusBadge.jsx';

/**
 * Transcripción real de intervenciones: cada vecino graba desde su propio
 * móvil en /asistencia/:entityId (ver Asistencia.jsx), ya identificado
 * porque eligió su nombre del censo — no hay micrófono de sala ni
 * diarización por IA, la atribución es exacta por diseño. Este panel solo
 * hace polling de lo que ya se ha transcrito y guardado en el servidor,
 * solo de ESTA junta (`meetingId`); `entidadId` es para el enlace de acceso.
 */
export default function PanelEscrutinio({ entidadId, meetingId }) {
  const [transcripciones, setTranscripciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);
  const contenedorRef = useRef(null);

  useEffect(() => {
    if (!meetingId) { setCargando(false); return; }

    let activo = true;

    const refrescar = async () => {
      try {
        const respuesta = await fetch(`/api/transcripciones/junta/${meetingId}`, { credentials: 'include' });
        const resultado = await respuesta.json();
        if (activo && respuesta.ok) setTranscripciones(resultado.transcripciones || []);
      } catch (err) {
        console.error('Fallo al cargar transcripciones:', err);
      } finally {
        if (activo) setCargando(false);
      }
    };

    refrescar();
    const intervalo = setInterval(refrescar, 4000);
    return () => { activo = false; clearInterval(intervalo); };
  }, [meetingId]);

  useEffect(() => {
    if (contenedorRef.current) {
      contenedorRef.current.scrollTop = contenedorRef.current.scrollHeight;
    }
  }, [transcripciones]);

  const enlaceAsistencia = entidadId ? `${window.location.origin}/asistencia/${entidadId}` : '';

  const copiarEnlace = async () => {
    if (!enlaceAsistencia) return;
    try {
      await navigator.clipboard.writeText(enlaceAsistencia);
      setEnlaceCopiado(true);
      setTimeout(() => setEnlaceCopiado(false), 2000);
    } catch (err) {
      console.error('No se pudo copiar el enlace:', err);
    }
  };

  return (
    <Card as="section" className="w-full lg:w-80 flex flex-col h-full overflow-hidden justify-between shrink-0" padding="p-4">
      <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Radio size={15} className="text-emerald-500" />
          <h3 className="text-3xs font-black uppercase tracking-widest text-slate-400">Transcripción en Vivo</h3>
        </div>
        <StatusBadge tone="success" className="font-mono">
          ● ESCUCHANDO
        </StatusBadge>
      </div>

      <div ref={contenedorRef} className="flex-grow overflow-y-auto pr-1 custom-scrollbar space-y-3 mb-4 min-h-[250px]">
        {cargando ? (
          <div className="h-full flex flex-col justify-center items-center text-center p-4 text-4xs text-slate-500 font-bold uppercase tracking-widest">
            Cargando intervenciones...
          </div>
        ) : transcripciones.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center p-4 border border-dashed border-slate-800/60 rounded-xl bg-slate-950/20">
            <Radio size={28} className="mb-2 text-slate-700" />
            <p className="text-4xs text-slate-400 font-medium">Sin intervenciones todavía</p>
            <p className="text-[9px] text-slate-600 mt-1 max-w-[150px]">Comparte el enlace de asistencia para que los vecinos puedan hablar desde su móvil.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {transcripciones.map((t) => (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                key={t.id}
                className="p-2.5 bg-slate-950 border border-slate-900 rounded-xl space-y-1 shadow-sm"
              >
                <div className="flex justify-between items-center text-[9px] font-black text-indigo-400 font-mono tracking-wide uppercase gap-2">
                  <span className="truncate">🎙️ {t.propietario_nombre || 'Propietario'} {t.propiedad_detalle ? `— ${t.propiedad_detalle}` : ''}</span>
                  <span className="text-slate-600 font-normal shrink-0">{new Date(t.creado_en).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-4xs text-slate-300 leading-relaxed font-medium">
                  "{t.texto}"
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-900 pt-3">
        <button
          onClick={copiarEnlace}
          className="w-full py-3 rounded-xl text-5xs font-black uppercase tracking-widest transition-all border bg-slate-900 border-slate-800 text-slate-300 hover:text-white flex items-center justify-center gap-1.5"
        >
          {enlaceCopiado ? <><Check size={12} className="text-emerald-400" /> Enlace copiado</> : <><Link2 size={12} /> Copiar enlace de asistencia</>}
        </button>
      </div>
    </Card>
  );
}
