import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, FileDown } from 'lucide-react';
import { useVotifaiStore } from '../../store.jsx';
import { getParticipantesActivos, getCoeficienteTotal } from '../../store/censo.js';
import SubNavContexto from '../../components/SubNavContexto.jsx';
import ColumnaOrdenDia from '../../components/ColumnaOrdenDia.jsx';
import ColumnaMonitorCentral from '../../components/ColumnaMonitorCentral.jsx';
import PanelEscrutinio from '../../components/PanelEscrutinio.jsx';
import ModalConvocatoria from '../../components/ModalConvocatoria.jsx';
import Card from '../../components/ui/Card.jsx';

export default function Dashboard() {
  const { fincaId, meetingId } = useParams();
  const navigate = useNavigate();

  const { state, dispatch } = useVotifaiStore() || { state: { tenant: null, salaControl: {} } };
  const tenantGlobal = state?.tenant;

  const [mostrarModalConvocatoria, setMostrarModalConvocatoria] = useState(false);
  const [entidadFinca, setEntidadFinca] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [puntos, setPuntos] = useState([]);
  const [puntoActivoId, setPuntoActivoId] = useState(null);
  const [censoPersonas, setCensoPersonas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [personaDestinataria, setPersonaDestinataria] = useState('');
  const [reenviandoPush, setReenviandoPush] = useState(false);

  const participantesActivos = getParticipantesActivos(censoPersonas);
  const coeficienteTotal = getCoeficienteTotal(censoPersonas);

  const cargarDetalle = useCallback(async () => {
    if (!meetingId) return;
    try {
      const res = await fetch(`/api/meetings/detalle/${meetingId}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setMeeting(data.meeting);
        setPuntos(data.puntos || []);
        setPuntoActivoId((actual) =>
          actual && data.puntos.some((p) => p.id === actual) ? actual : (data.puntos[0]?.id ?? null)
        );
      }
    } catch (err) {
      console.error('Fallo al cargar la junta:', err);
    } finally {
      setCargando(false);
    }
  }, [meetingId]);

  useEffect(() => {
    cargarDetalle();
    const intervalo = setInterval(cargarDetalle, 4000);
    return () => clearInterval(intervalo);
  }, [cargarDetalle]);

  useEffect(() => {
    if (!fincaId) return;
    (async () => {
      try {
        const res = await fetch(`/api/propietarios/lista/${fincaId}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok) {
          const propietarios = data.propietarios || [];
          setCensoPersonas(propietarios);
          dispatch({
            type: 'SET_SALA_STATE',
            payload: {
              totalAsistentesSala: getParticipantesActivos(propietarios),
              coeficienteTotal: getCoeficienteTotal(propietarios)
            }
          });
        }
      } catch (err) {
        console.error('Fallo al cargar el censo:', err);
      }
    })();
  }, [fincaId, dispatch]);

  useEffect(() => {
    const tenantId = tenantGlobal?.tenantId || tenantGlobal?.id;
    if (!tenantId || !fincaId) return;
    (async () => {
      try {
        const res = await fetch(`/api/entities/${tenantId}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok) setEntidadFinca((data.fincas || []).find((f) => f.id === fincaId) || null);
      } catch (err) {
        console.error('Fallo al cargar la finca:', err);
      }
    })();
  }, [tenantGlobal, fincaId]);

  const accionJunta = async (ruta, opciones) => {
    const res = await fetch(`/api/meetings/${ruta}`, {
      method: 'POST',
      credentials: 'include',
      ...opciones
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'No se pudo completar la acción.');
      return null;
    }
    await cargarDetalle();
    return data;
  };

  const handleIniciarJunta = () => accionJunta(`${meetingId}/iniciar`);
  const handleAbrirVotacion = (puntoId) => accionJunta(`${meetingId}/puntos/${puntoId}/abrir-votacion`);
  const handleCerrarVotacion = (puntoId) => accionJunta(`${meetingId}/puntos/${puntoId}/cerrar-votacion`);
  const handleClausurarAsamblea = () => navigate('/acta-ia', { state: { meetingId, fincaId } });

  const handleReenviarCopiaActa = async (e) => {
    e.preventDefault();
    if (!personaDestinataria || !meeting?.acta_texto_final) return;

    setReenviandoPush(true);
    try {
      const respuesta = await fetch('/api/notifications/reenviar-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          propietarioId: personaDestinataria,
          nombreFinca: meeting?.finca_nombre || 'Comunidad',
          actaTexto: meeting.acta_texto_final
        })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        alert(`✓ ${resultado.mensaje}`);
        setPersonaDestinataria('');
      } else {
        alert(`❌ ${resultado.error || 'No se pudo reenviar la copia.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al reenviar la copia.');
    } finally {
      setReenviandoPush(false);
    }
  };

  if (cargando) {
    return (
      <div className="h-full bg-slate-950 flex items-center justify-center text-4xs text-slate-500 font-bold uppercase tracking-widest">
        Cargando junta...
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="h-full bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-500">
        <p className="text-3xs font-bold uppercase tracking-widest">Junta no encontrada.</p>
        <button onClick={() => navigate(`/admin/${fincaId}/junta`)} className="text-4xs font-black text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
          <ArrowLeft size={12} /> Volver al historial
        </button>
      </div>
    );
  }

  if (meeting.estado === 'cerrada') {
    return (
      <div className="h-full bg-slate-950 text-slate-100 overflow-y-auto custom-scrollbar">
        <div className="max-w-2xl mx-auto p-6 space-y-5">
          <button onClick={() => navigate(`/admin/${fincaId}/junta`)} className="text-4xs font-black text-slate-500 hover:text-white uppercase tracking-wider flex items-center gap-1.5">
            <ArrowLeft size={12} /> Volver al historial
          </button>

          <Card padding="p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-4xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                Junta cerrada
              </span>
              <a
                href={`/api/meetings/${meetingId}/acta-pdf`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-4xs font-black text-blue-400 hover:text-blue-300 uppercase tracking-wider shrink-0"
              >
                <FileDown size={12} /> Descargar PDF
              </a>
            </div>
            <h2 className="text-base font-black text-white mt-2">{meeting.titulo}</h2>
            <p className="text-4xs text-slate-500 font-mono mt-1">{meeting.finca_nombre}</p>
            <div className="mt-4 bg-slate-950 border border-slate-900 rounded-xl p-4 text-3xs text-slate-300 whitespace-pre-line leading-relaxed max-h-[45vh] overflow-y-auto custom-scrollbar">
              {meeting.acta_texto_final || 'Sin texto de acta.'}
            </div>
          </Card>

          <Card padding="p-5">
            <h3 className="text-3xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <Send size={13} className="text-blue-500" /> Reenviar copia del acta
            </h3>
            <form onSubmit={handleReenviarCopiaActa} className="flex gap-2">
              <select
                required value={personaDestinataria} onChange={(e) => setPersonaDestinataria(e.target.value)}
                className="flex-grow bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-3xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">Selecciona un propietario...</option>
                {censoPersonas.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre_completo} — {p.propiedad_detalle}</option>
                ))}
              </select>
              <button
                type="submit" disabled={reenviandoPush}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-3xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all shrink-0"
              >
                {reenviandoPush ? 'Enviando...' : 'Reenviar'}
              </button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden relative font-sans antialiased">
      <SubNavContexto setMostrarModalConvocatoria={setMostrarModalConvocatoria} />

      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
        <ColumnaOrdenDia
          puntos={puntos}
          puntoActivoId={puntoActivoId}
          setPuntoActivoId={setPuntoActivoId}
          puntosExpandidos={state?.salaControl?.puntosExpandidos || {}}
          dispatch={dispatch}
        />

        <ColumnaMonitorCentral
          meeting={meeting}
          puntos={puntos}
          puntoActivoId={puntoActivoId}
          coeficienteTotal={coeficienteTotal}
          onIniciarJunta={handleIniciarJunta}
          onAbrirVotacion={handleAbrirVotacion}
          onCerrarVotacion={handleCerrarVotacion}
          onClausurarAsamblea={handleClausurarAsamblea}
        />

        <PanelEscrutinio entidadId={fincaId} />
      </div>

      <ModalConvocatoria
        mostrarModalConvocatoria={mostrarModalConvocatoria}
        setMostrarModalConvocatoria={setMostrarModalConvocatoria}
        fincaSeleccionada={entidadFinca}
        meeting={meeting}
        puntos={puntos}
      />
    </div>
  );
}
