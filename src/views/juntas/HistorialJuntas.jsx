import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Vote, Plus, Calendar, Radio, CheckCircle2, Clock } from 'lucide-react';
import { useVotifaiStore } from '../../store.jsx';
import Card from '../../components/ui/Card.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import FincasSelector from '../../components/FincasSelector.jsx';
import ModalConvocarJunta from '../../components/ModalConvocarJunta.jsx';

const BADGE_ESTADO = {
  programada: { tone: 'info', label: 'Programada', icon: Clock },
  en_curso: { tone: 'warning', label: 'En curso', icon: Radio },
  cerrada: { tone: 'success', label: 'Cerrada', icon: CheckCircle2 },
  cancelada: { tone: 'danger', label: 'Cancelada', icon: Clock }
};

/**
 * Punto de entrada de "Junta en Vivo": historial de juntas de la finca
 * (antes solo existía "la junta actual" implícita) y punto de partida
 * para convocar una nueva. Entrar a una junta concreta navega a
 * junta/:meetingId (Dashboard.jsx), que es la sala en vivo real.
 */
export default function HistorialJuntas() {
  const { fincaId } = useParams();
  const navigate = useNavigate();
  const { state } = useVotifaiStore() || { state: { tenant: null } };
  const tenantId = state?.tenant?.tenantId || state?.tenant?.id;

  const [datosAdmin, setDatosAdmin] = useState(null);
  const [fincasReales, setFincasReales] = useState([]);
  const [entidadSeleccionada, setEntidadSeleccionada] = useState(null);
  const [cargandoFincas, setCargandoFincas] = useState(true);
  const [meetings, setMeetings] = useState([]);
  const [cargandoJuntas, setCargandoJuntas] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);

  useEffect(() => {
    if (!tenantId) { setCargandoFincas(false); return; }
    (async () => {
      try {
        const res = await fetch(`/api/entities/${tenantId}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok) {
          setDatosAdmin(data.administrador || null);
          setFincasReales(data.fincas || []);
          setEntidadSeleccionada((data.fincas || []).find((f) => f.id === fincaId) || null);
        }
      } catch (err) {
        console.error('Fallo al cargar fincas:', err);
      } finally {
        setCargandoFincas(false);
      }
    })();
  }, [tenantId, fincaId]);

  const cargarJuntas = async () => {
    if (!fincaId) return;
    try {
      const res = await fetch(`/api/meetings/lista/${fincaId}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setMeetings(data.meetings || []);
    } catch (err) {
      console.error('Fallo al cargar el historial de juntas:', err);
    } finally {
      setCargandoJuntas(false);
    }
  };

  useEffect(() => { cargarJuntas(); }, [fincaId]);

  const formatoFecha = (iso) => iso
    ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Sin fecha fijada';

  return (
    <div className="h-full bg-slate-950 text-slate-100 overflow-y-auto custom-scrollbar">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <FincasSelector
          cargando={cargandoFincas}
          admin={datosAdmin}
          tenantGlobal={state?.tenant}
          fincas={fincasReales}
          seleccionada={entidadSeleccionada}
          alSeleccionar={(finca) => navigate(`/admin/${finca.id}/junta`)}
        />

        <div className="flex justify-between items-center">
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <Vote size={16} className="text-blue-500" /> Juntas de {entidadSeleccionada?.nombre || 'la finca'}
          </h2>
          <button
            type="button"
            onClick={() => setMostrarModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-3xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/10 flex items-center gap-1.5"
          >
            <Plus size={14} /> Convocar Junta
          </button>
        </div>

        {cargandoJuntas ? (
          <div className="text-center py-12 text-4xs text-slate-500 font-bold uppercase tracking-widest">Cargando historial...</div>
        ) : meetings.length === 0 ? (
          <Card className="text-center py-12">
            <Calendar size={28} className="mx-auto mb-3 text-slate-700" />
            <p className="text-3xs text-slate-400 font-bold">Todavía no se ha convocado ninguna junta en esta finca.</p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {meetings.map((m) => {
              const badge = BADGE_ESTADO[m.estado] || BADGE_ESTADO.programada;
              const Icon = badge.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => navigate(`/admin/${fincaId}/junta/${m.id}`)}
                  className="w-full text-left flex items-center justify-between gap-4 bg-slate-900/30 border border-slate-900 hover:border-slate-700 transition-colors rounded-2xl p-4"
                >
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-black text-white truncate">{m.titulo}</h3>
                      <StatusBadge tone={badge.tone} className={m.estado === 'en_curso' ? 'animate-pulse' : ''}>
                        <Icon size={9} className="inline mr-1 -mt-0.5" />{badge.label}
                      </StatusBadge>
                    </div>
                    <p className="text-4xs text-slate-500 font-mono uppercase tracking-wider mt-1">
                      {m.tipo} · {formatoFecha(m.fecha_hora_prevista)} · {m.total_puntos} punto{m.total_puntos === '1' ? '' : 's'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ModalConvocarJunta
        open={mostrarModal}
        onClose={() => setMostrarModal(false)}
        entityId={fincaId}
        onConvocada={(meeting) => {
          setMostrarModal(false);
          navigate(`/admin/${fincaId}/junta/${meeting.id}`);
        }}
      />
    </div>
  );
}
