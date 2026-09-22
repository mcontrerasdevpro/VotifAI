import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, ChevronDown, ChevronUp, FileDown, FileText } from 'lucide-react';

const ETIQUETA_TIPO = { ordinaria: 'Ordinaria', extraordinaria: 'Extraordinaria' };

/**
 * Historial de juntas cerradas para el vecino: existe para que un
 * propietario pueda recuperar el acta entrando en la app aunque la
 * notificación por email/WhatsApp le haya fallado o no tenga ninguno de
 * los dos canales configurado — sin esto, esa información se perdía
 * para siempre en cuanto se cerraba la junta.
 */
export default function HistorialVecino({ entityId }) {
  const [juntas, setJuntas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [abiertaId, setAbiertaId] = useState(null);
  const [detalles, setDetalles] = useState({});
  const [cargandoDetalle, setCargandoDetalle] = useState(null);

  useEffect(() => {
    if (!entityId) { setCargando(false); return; }
    let activo = true;
    (async () => {
      try {
        const respuesta = await fetch(`/api/meetings/vecino/${entityId}/historial`, { credentials: 'include' });
        const resultado = await respuesta.json();
        if (activo && respuesta.ok) setJuntas(resultado.meetings || []);
      } catch (err) {
        console.error('Fallo al cargar el historial de juntas:', err);
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => { activo = false; };
  }, [entityId]);

  const toggleJunta = async (meetingId) => {
    if (abiertaId === meetingId) { setAbiertaId(null); return; }
    setAbiertaId(meetingId);
    if (detalles[meetingId]) return;

    setCargandoDetalle(meetingId);
    try {
      const respuesta = await fetch(`/api/meetings/vecino/detalle/${meetingId}`, { credentials: 'include' });
      const resultado = await respuesta.json();
      if (respuesta.ok) {
        setDetalles((actual) => ({ ...actual, [meetingId]: resultado.meeting }));
      }
    } catch (err) {
      console.error('Fallo al cargar el detalle del acta:', err);
    } finally {
      setCargandoDetalle(null);
    }
  };

  if (cargando || juntas.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className="flex items-center gap-1.5 text-4xs font-black text-slate-500 uppercase tracking-widest">
        <History size={12} /> Juntas anteriores
      </span>

      <div className="space-y-2">
        {juntas.map((junta) => {
          const abierta = abiertaId === junta.id;
          const detalle = detalles[junta.id];
          return (
            <div key={junta.id} className="bg-slate-900/40 border border-slate-900 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleJunta(junta.id)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <div>
                  <p className="text-3xs font-bold text-white">{junta.titulo}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    {ETIQUETA_TIPO[junta.tipo] || junta.tipo} — {new Date(junta.cerrada_en).toLocaleDateString('es-ES')}
                  </p>
                </div>
                {abierta ? <ChevronUp size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
              </button>

              <AnimatePresence initial={false}>
                {abierta && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 pb-4 border-t border-slate-900/60"
                  >
                    {cargandoDetalle === junta.id ? (
                      <p className="text-4xs text-slate-500 uppercase tracking-widest py-4 text-center">Cargando acta...</p>
                    ) : detalle ? (
                      <div className="pt-3 space-y-3">
                        <p className="text-3xs text-slate-300 whitespace-pre-line leading-relaxed max-h-52 overflow-y-auto custom-scrollbar">
                          {detalle.acta_texto_final || 'Sin texto de acta.'}
                        </p>
                        {junta.tiene_pdf && (
                          <a
                            href={`/api/meetings/vecino/${junta.id}/acta-pdf`}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 text-4xs font-black text-blue-400 hover:text-blue-300 uppercase tracking-wider w-fit"
                          >
                            <FileDown size={12} /> Descargar PDF
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="text-4xs text-rose-400 uppercase tracking-widest py-4 text-center flex items-center justify-center gap-1.5">
                        <FileText size={12} /> No se pudo cargar el acta.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
