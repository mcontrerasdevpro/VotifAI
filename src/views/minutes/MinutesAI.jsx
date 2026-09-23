import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Chart from 'react-apexcharts';
import { FileText, ListChecks, ArrowLeft, CheckCircle, Lock, Send, AlertTriangle } from 'lucide-react';
import Card from '../../components/ui/Card.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { ETIQUETA_MAYORIA } from '../../lib/mayorias.js';

const LABEL_ESTADO = { votando: 'Votando', cerrado: 'Cerrado', pendiente: 'Pendiente' };

const fechaHora = (fecha) => (fecha ? new Date(fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—');

const hora = (fecha) => new Date(fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

// Intervenciones de voz de los vecinos, agrupadas por el punto del orden
// del día que estaba abierto al grabarlas. El administrador las revisa y
// edita en el borrador antes de cerrar, igual que el resto del acta.
function seccionIntervenciones(puntos, intervenciones) {
  if (!intervenciones.length) return '';
  const linea = (i) => `* **${i.propietario_nombre || 'Propietario'}${i.propiedad_detalle ? ` (${i.propiedad_detalle})` : ''}**, ${hora(i.creado_en)}: ${i.texto}`;

  const bloques = puntos
    .map((p) => {
      const suyas = intervenciones.filter((i) => i.punto_id === p.id);
      return suyas.length ? `**Punto ${p.orden}: ${p.texto}**\n${suyas.map(linea).join('\n')}` : null;
    })
    .filter(Boolean);

  const sinPunto = intervenciones.filter((i) => !puntos.some((p) => p.id === i.punto_id));
  if (sinPunto.length) bloques.push(`**Intervenciones generales**\n${sinPunto.map(linea).join('\n')}`);

  return `\n\n## 4. INTERVENCIONES DE LOS PROPIETARIOS\n${bloques.join('\n\n')}`;
}

const TEXTO_RESULTADO = {
  aprobado: 'APROBADO',
  rechazado: 'NO APROBADO',
  pendiente_ausentes: 'PENDIENTE DEL CÓMPUTO DE AUSENTES (art. 17.8 LPH)'
};

const pct = (valor, base) => (base > 0 ? ((valor / base) * 100).toFixed(2) : '0.00');

// Art. 15.2 LPH: "El acta de la Junta reflejará los propietarios privados
// del derecho de voto". También los que se habilitaron y por qué.
function seccionPrivados(privados) {
  if (!privados.length) return 'Ningún propietario estaba privado del derecho de voto al inicio de la junta.';
  const sinVoto = privados.filter((p) => !p.habilitado);
  const habilitados = privados.filter((p) => p.habilitado);
  const nombre = (p) => `${p.nombre_completo}${p.propiedad_detalle ? ` (${p.propiedad_detalle})` : ''}`;
  let texto = '';
  if (sinVoto.length) {
    texto += `Al iniciarse la junta no se encontraban al corriente en el pago de las deudas vencidas con la comunidad, por lo que participaron sin derecho de voto y su persona y cuota no se computan para las mayorías:\n${sinVoto.map((p) => `* ${nombre(p)} — coeficiente ${Number(p.coeficiente).toFixed(2)}%, deuda ${Number(p.deuda).toFixed(2)} €`).join('\n')}`;
  }
  if (habilitados.length) {
    texto += `${texto ? '\n\n' : ''}Recuperaron el derecho de voto durante la junta:\n${habilitados.map((p) => `* ${nombre(p)} — ${p.habilitado_motivo}`).join('\n')}`;
  }
  return texto;
}

// Art. 19 LPH: el acta relaciona los asistentes y los representados con
// sus cuotas. Asistentes = presentes en sala + quienes participan por la
// app (han votado algún punto desde su móvil).
function seccionAsistencia(asistencia, votos) {
  const nombre = (p) => `${p.nombre_completo}${p.propiedad_detalle ? ` (${p.propiedad_detalle})` : ''}`;
  const cuota = (p) => `${Number(p.coeficiente || 0).toFixed(2)}%`;
  const enSala = new Set(asistencia.map((a) => a.propietario_id));
  const porApp = [...new Map(votos.filter((v) => v.origen === 'app' && !enSala.has(v.propietario_id)).map((v) => [v.propietario_id, v])).values()];
  const presentes = asistencia.filter((a) => a.modo === 'presencial');
  const representados = asistencia.filter((a) => a.modo === 'representado');

  const bloques = [];
  if (presentes.length) bloques.push(`Presentes en la sala:\n${presentes.map((p) => `* ${nombre(p)} — ${cuota(p)}`).join('\n')}`);
  if (porApp.length) bloques.push(`Participan a distancia a través de VotifAI:\n${porApp.map((p) => `* ${nombre(p)} — ${cuota(p)}`).join('\n')}`);
  if (representados.length) {
    bloques.push(`Representados (art. 15.1 LPH):\n${representados.map((p) => `* ${nombre(p)} — ${cuota(p)}, representado por ${p.representante_nombre}${p.delegacion_id ? ` (delegación electrónica en VotifAI, solicitada por el propietario el ${fechaHora(p.delegacion_solicitada_en)} y aceptada por el representante el ${fechaHora(p.delegacion_aceptada_en)})` : p.representacion_escrita ? ' (representación acreditada por escrito)' : ' (sin escrito de representación)'}`).join('\n')}`);
  }
  const total = presentes.length + porApp.length + representados.length;
  const coefTotal = [...presentes, ...porApp, ...representados].reduce((t, p) => t + Number(p.coeficiente || 0), 0);
  return bloques.length
    ? `${bloques.join('\n\n')}\n\nTotal: ${total} propietarios, que representan el ${coefTotal.toFixed(2)}% de las cuotas.`
    : 'No consta ningún asistente registrado.';
}

function lineaPunto(p) {
  if (p.tipo !== 'votacion') return `* **PUNTO ${p.orden}:** ${p.texto} (informativo, sin votación)`;
  const r = p.resultado;
  if (!r) return `* **PUNTO ${p.orden}:** ${p.texto}`;

  const estado = p.estado === 'cerrado' ? TEXTO_RESULTADO[r.estado] : 'VOTACIÓN SIN CERRAR';
  const baseC = Number(r.baseComputo.coeficiente) || 0;
  let linea =
    `* **PUNTO ${p.orden}:** ${p.texto}\n` +
    `  Mayoría exigida: ${ETIQUETA_MAYORIA[r.mayoria]} (${r.articulo}). ${r.requisito}\n` +
    `  Votos: ${p.votos_si || 0} a favor (${pct(Number(p.coeficiente_si), baseC)}% de cuotas), ${p.votos_no || 0} en contra (${pct(Number(p.coeficiente_no), baseC)}%), ${p.votos_abstencion || 0} abstenciones (${pct(Number(p.coeficiente_abstencion), baseC)}%). ` +
    `Base de cómputo: ${r.baseComputo.propietarios} propietarios y ${baseC.toFixed(2)}% de cuotas. ` +
    `Emitidos: ${p.votos_app || 0} por la app, ${p.votos_sala || 0} en sala y ${p.votos_representacion || 0} por representación.\n` +
    `  **Resultado: ${estado}**`;
  if (p.estado === 'cerrado' && r.estado === 'pendiente_ausentes') {
    linea += `\n  El acuerdo no alcanza la mayoría con los votos de los presentes. Se comunicará a los ${r.ausentes} propietarios ausentes, y se computarán como favorables los de quienes, en el plazo de 30 días naturales desde la notificación, no manifiesten su discrepancia (art. 17.8 LPH).`;
  }
  return linea;
}

function generarActa(meeting, puntos, intervenciones = [], privados = [], asistencia = [], votos = []) {
  if (!meeting) return '';
  const fecha = meeting.fecha_hora_prevista
    ? new Date(meeting.fecha_hora_prevista).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })
    : 'fecha por determinar';
  const convocatoria = meeting.convocatoria === 'segunda' ? 'segunda' : 'primera';
  const totalCenso = Number(meeting.censo_total_coeficiente) || 0;

  return (
    `# ACTA DE LA ${meeting.tipo === 'extraordinaria' ? 'JUNTA GENERAL EXTRAORDINARIA' : 'JUNTA GENERAL ORDINARIA'} DE PROPIETARIOS\n` +
    `**COMUNIDAD:** ${meeting.finca_nombre || ''}\n` +
    `**CONVOCATORIA:** ${meeting.titulo}\n` +
    `**FECHA Y HORA:** ${fecha}\n` +
    `**CELEBRADA EN:** ${convocatoria} convocatoria\n\n` +
    `## 1. CENSO Y ASISTENTES\n` +
    `Censo de la finca a fecha de convocatoria: ${meeting.censo_total_propietarios || 0} propietarios (${totalCenso.toFixed(2)}% de coeficiente).\n\n` +
    `${seccionAsistencia(asistencia, votos)}\n\n` +
    `## 2. PROPIETARIOS PRIVADOS DEL DERECHO DE VOTO (art. 15.2 LPH)\n${seccionPrivados(privados)}\n\n` +
    `## 3. PUNTOS DEL ORDEN DEL DÍA Y ACUERDOS\n${puntos.map(lineaPunto).join('\n\n') || 'Sin puntos registrados.'}` +
    seccionIntervenciones(puntos, intervenciones)
  );
}

export default function MinutesAI() {
  const navigate = useNavigate();
  const location = useLocation();
  const { meetingId, fincaId } = location.state || {};

  const [vistaActiva, setVistaActiva] = useState('documento');
  const [editando, setEditando] = useState(false);
  const [cargando, setCargando] = useState(true);

  const [meeting, setMeeting] = useState(null);
  const [puntos, setPuntos] = useState([]);
  const [actaTexto, setActaTexto] = useState('Cargando datos de la junta...');

  const [mostrarModalCierre, setMostrarModalCierre] = useState(false);
  const [envioEstado, setEnvioEstado] = useState('idle'); // idle | enviando | completado | error
  const [errorEnvio, setErrorEnvio] = useState('');

  useEffect(() => {
    if (!meetingId) { setCargando(false); return; }
    (async () => {
      try {
        const respuesta = await fetch(`/api/meetings/detalle/${meetingId}`, { credentials: 'include' });
        const resultado = await respuesta.json();
        if (respuesta.ok) {
          setMeeting(resultado.meeting);
          setPuntos(resultado.puntos || []);
          setActaTexto(generarActa(resultado.meeting, resultado.puntos || [], resultado.intervenciones || [], resultado.privadosVoto || [], resultado.asistencia || [], resultado.votos || []));
        }
      } catch (err) {
        console.error('Fallo al cargar la junta:', err);
      } finally {
        setCargando(false);
      }
    })();
  }, [meetingId]);

  const chartSeries = useMemo(() => {
    const totales = puntos.filter((p) => p.tipo === 'votacion').reduce((acc, p) => ({
      si: acc.si + Number(p.coeficiente_si || 0),
      no: acc.no + Number(p.coeficiente_no || 0),
      abstencion: acc.abstencion + Number(p.coeficiente_abstencion || 0)
    }), { si: 0, no: 0, abstencion: 0 });
    return [totales.si, totales.no, totales.abstencion];
  }, [puntos]);

  const chartOptions = {
    chart: { type: 'donut', background: 'transparent' },
    colors: ['#10b981', '#f43f5e', '#64748b'],
    labels: ['A Favor', 'En Contra', 'Abstención'],
    dataLabels: { enabled: false },
    legend: { labels: { colors: '#64748b' } }
  };

  const handleCerrarJunta = async () => {
    setEnvioEstado('enviando');
    setErrorEnvio('');
    try {
      const respuesta = await fetch(`/api/meetings/${meetingId}/cerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ acta_texto: actaTexto })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setEnvioEstado('completado');
        setTimeout(() => navigate('/hub'), 2000);
      } else {
        setErrorEnvio(resultado.error || 'No se pudo cerrar la junta.');
        setEnvioEstado('error');
      }
    } catch (err) {
      console.error('Error al cerrar la junta:', err);
      setErrorEnvio('Fallo de red al cerrar la junta.');
      setEnvioEstado('error');
    }
  };

  if (!meetingId) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-500">
        <p className="text-3xs font-bold uppercase tracking-widest">No se ha seleccionado ninguna junta.</p>
        <button onClick={() => navigate('/hub')} className="text-4xs font-black text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
          <ArrowLeft size={12} /> Volver al hub
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col h-screen overflow-hidden relative">
      <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-3 flex justify-between items-center gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/admin/${fincaId}/junta/${meetingId}`)} className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400"><ArrowLeft size={16} /></button>
          <div>
            <div className="flex items-center gap-2 text-blue-400 text-4xs font-bold uppercase tracking-widest"><FileText size={12} /> Cierre y Difusión de la Junta</div>
            <h1 className="text-sm font-black text-white">{meeting?.titulo || 'Central de Firmas'}</h1>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditando(!editando)}
            className={`text-3xs font-black uppercase px-4 py-2.5 rounded-xl border transition-all ${editando
              ? 'bg-blue-600 border-blue-500 text-white shadow-md'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
              }`}
          >
            {editando ? '💾 Guardar Apuntes' : '✏️ Corrección Manual'}
          </button>

          <button
            type="button"
            disabled={editando || meeting?.estado === 'cerrada'}
            onClick={() => setMostrarModalCierre(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-3xs font-black uppercase px-5 py-2.5 rounded-xl shadow-lg active:scale-99 disabled:opacity-40"
          >
            ✓ Cerrar Junta y Enviar Acta
          </button>
        </div>
      </nav>

      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
        <Card className="w-full lg:w-5/12 flex flex-col h-full overflow-hidden" padding="p-5">
          <div className="flex justify-between items-center mb-4 border-b border-slate-900 pb-3">
            <h3 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><ListChecks size={14} className="text-blue-500" /> Resultado por Punto</h3>
          </div>
          <div className="space-y-3 overflow-y-auto pr-1 flex-grow custom-scrollbar">
            {cargando ? (
              <p className="text-4xs text-slate-500 uppercase tracking-widest text-center py-8">Cargando...</p>
            ) : puntos.length === 0 ? (
              <p className="text-4xs text-slate-500 uppercase tracking-widest text-center py-8">Sin puntos registrados.</p>
            ) : (
              puntos.map((p) => (
                <div key={p.id} className="p-3 bg-slate-950 rounded-xl border border-slate-900 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-3xs font-bold text-slate-200">{p.orden}. {p.texto}</span>
                    <StatusBadge tone={p.estado === 'cerrado' ? 'success' : 'neutral'}>{LABEL_ESTADO[p.estado] || p.estado}</StatusBadge>
                  </div>
                  {p.tipo === 'votacion' && (
                    <p className="text-4xs font-mono text-slate-500">{p.votos_si || 0} SÍ · {p.votos_no || 0} NO · {p.votos_abstencion || 0} ABS.</p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        <div className="w-full lg:w-7/12 bg-white text-slate-900 rounded-2xl p-5 flex flex-col h-full overflow-hidden relative border border-slate-200">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3 text-slate-500">
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
              <button onClick={() => setVistaActiva('documento')} className={`px-4 py-1.5 rounded-lg text-3xs font-black uppercase transition-all ${vistaActiva === 'documento' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>Documento</button>
              <button onClick={() => setVistaActiva('estadisticas')} className={`px-4 py-1.5 rounded-lg text-3xs font-black uppercase transition-all ${vistaActiva === 'estadisticas' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>Estadísticas</button>
            </div>
          </div>

          <div className="flex-grow flex flex-col overflow-hidden">
            {vistaActiva === 'documento' ? (
              editando ? (
                <textarea
                  value={actaTexto}
                  onChange={(e) => setActaTexto(e.target.value)}
                  className="w-full h-full bg-slate-50 text-slate-900 rounded-xl p-5 text-3xs font-sans font-medium focus:outline-none border-2 border-blue-500 shadow-inner resize-none overflow-y-auto leading-relaxed"
                  placeholder="Añada apuntes finales, anexos de cuotas o correcciones aquí..."
                />
              ) : (
                <div className="w-full h-full bg-slate-50 rounded-xl p-5 text-3xs font-sans text-slate-800 overflow-y-auto whitespace-pre-line border border-slate-100 shadow-inner leading-relaxed">
                  {actaTexto}
                </div>
              )
            ) : (
              <div className="flex-grow flex flex-col justify-center items-center h-full">
                <div className="w-full max-w-sm">
                  <Chart options={chartOptions} series={chartSeries} type="donut" width="100%" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mostrarModalCierre && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-5 text-center shadow-2xl relative overflow-hidden">

              {envioEstado === 'idle' && (
                <>
                  <div className="w-14 h-14 bg-blue-600/10 text-blue-400 rounded-full flex items-center justify-center mx-auto border border-blue-500/10"><Send size={24} /></div>
                  <div>
                    <h3 className="text-sm font-black text-white">Cerrar Junta y Notificar a los Propietarios</h3>
                    <p className="text-3xs text-slate-400 mt-1 leading-normal">Se cerrará la junta y se enviará el acta al censo completo de la finca por email/WhatsApp.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setMostrarModalCierre(false)} className="bg-slate-950 border border-slate-800 text-slate-400 py-2.5 rounded-xl text-3xs font-bold uppercase tracking-wider">Revisar</button>
                    <button type="button" onClick={handleCerrarJunta} className="bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-3xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5"><Lock size={12} /> Cerrar y Notificar</button>
                  </div>
                </>
              )}

              {envioEstado === 'enviando' && (
                <div className="py-6 space-y-4 animate-fade-in">
                  <div className="w-12 h-12 bg-blue-600/10 text-blue-400 rounded-xl flex items-center justify-center mx-auto animate-pulse border border-blue-500/20"><Send size={22} /></div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">Cerrando la junta y notificando al censo...</h3>
                </div>
              )}

              {envioEstado === 'error' && (
                <div className="py-6 space-y-4 animate-fade-in">
                  <div className="w-12 h-12 bg-rose-600/10 text-rose-400 rounded-xl flex items-center justify-center mx-auto border border-rose-500/20"><AlertTriangle size={22} /></div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">No se pudo cerrar la junta</h3>
                  <p className="text-3xs text-rose-400">{errorEnvio}</p>
                  <button type="button" onClick={() => setEnvioEstado('idle')} className="text-4xs font-black text-slate-400 hover:text-white uppercase tracking-wider">Volver a intentar</button>
                </div>
              )}

              {envioEstado === 'completado' && (
                <div className="py-6 space-y-2 animate-fade-in">
                  <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                    <CheckCircle size={24} />
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider pt-2">Junta cerrada correctamente</h3>
                  <p className="text-4xs text-slate-400 max-w-xs mx-auto">Acta archivada. Los propietarios del censo han sido notificados.</p>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
