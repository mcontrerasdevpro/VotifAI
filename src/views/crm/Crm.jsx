import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Headset, Plus, Trash2, Clock, MessageSquare } from 'lucide-react';
import Card from '../../components/ui/Card.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Field from '../../components/ui/Field.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';

const TONOS_PRIORIDAD = { baja: 'neutral', media: 'brand', alta: 'warning', urgente: 'danger' };
const TONOS_ESTADO = { abierta: 'danger', en_curso: 'warning', resuelta: 'success', cerrada: 'neutral' };
const ETIQUETAS_ESTADO = { abierta: 'Abierta', en_curso: 'En Curso', resuelta: 'Resuelta', cerrada: 'Cerrada' };
const ETIQUETAS_CATEGORIA = { consulta: 'Consulta', reclamacion: 'Reclamación', documentacion: 'Documentación', facturacion: 'Facturación', otro: 'Otro' };
const ETIQUETAS_CANAL = { telefono: 'Teléfono', email: 'Email', whatsapp: 'WhatsApp', presencial: 'Presencial', otro: 'Otro' };

export default function Crm() {
  const { fincaId } = useParams();
  const entidadId = fincaId;

  const [solicitudes, setSolicitudes] = useState([]);
  const [propietarios, setPropietarios] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [modalNuevaAbierto, setModalNuevaAbierto] = useState(false);
  const [guardandoNueva, setGuardandoNueva] = useState(false);
  const [nvPropietarioId, setNvPropietarioId] = useState('');
  const [nvTitulo, setNvTitulo] = useState('');
  const [nvDescripcion, setNvDescripcion] = useState('');
  const [nvCategoria, setNvCategoria] = useState('consulta');
  const [nvCanal, setNvCanal] = useState('telefono');
  const [nvPrioridad, setNvPrioridad] = useState('media');

  const [detalle, setDetalle] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [cargandoEventos, setCargandoEventos] = useState(false);
  const [comentario, setComentario] = useState('');

  const refrescar = useCallback(async () => {
    try {
      const [resSol, resProp] = await Promise.all([
        fetch(`/api/crm/lista/${entidadId}`, { credentials: 'include' }),
        fetch(`/api/propietarios/lista/${entidadId}`, { credentials: 'include' })
      ]);
      const dataSol = await resSol.json();
      const dataProp = await resProp.json();
      if (resSol.ok) setSolicitudes(dataSol.solicitudes || []);
      if (resProp.ok) setPropietarios(dataProp.propietarios || []);
    } catch (err) {
      console.error('Fallo al cargar solicitudes CRM:', err);
    }
  }, [entidadId]);

  useEffect(() => {
    const cargarInicial = async () => {
      if (!entidadId) {
        setCargando(false);
        return;
      }
      await refrescar();
      setCargando(false);
    };
    cargarInicial();
  }, [entidadId, refrescar]);

  const cargarEventos = async (solicitudId) => {
    setCargandoEventos(true);
    try {
      const respuesta = await fetch(`/api/crm/${solicitudId}/eventos`, { credentials: 'include' });
      const resultado = await respuesta.json();
      if (respuesta.ok) setEventos(resultado.eventos || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCargandoEventos(false);
    }
  };

  const abrirDetalle = (solicitud) => {
    setDetalle(solicitud);
    cargarEventos(solicitud.id);
  };

  const handleCrearSolicitud = async (e) => {
    e.preventDefault();
    if (!nvTitulo) return;

    setGuardandoNueva(true);
    try {
      const respuesta = await fetch('/api/crm/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          entity_id: entidadId,
          propietario_id: nvPropietarioId || null,
          titulo: nvTitulo,
          descripcion: nvDescripcion,
          categoria: nvCategoria,
          canal: nvCanal,
          prioridad: nvPrioridad
        })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setModalNuevaAbierto(false);
        setNvPropietarioId(''); setNvTitulo(''); setNvDescripcion(''); setNvCategoria('consulta'); setNvCanal('telefono'); setNvPrioridad('media');
        await refrescar();
      } else {
        alert(`❌ Error: ${resultado.error || 'No se pudo crear la solicitud.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al crear la solicitud.');
    } finally {
      setGuardandoNueva(false);
    }
  };

  const handleCambiarEstado = async (estado) => {
    if (!detalle) return;
    try {
      const respuesta = await fetch(`/api/crm/${detalle.id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ estado })
      });
      if (respuesta.ok) {
        setDetalle({ ...detalle, estado });
        await cargarEventos(detalle.id);
        await refrescar();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleComentar = async (e) => {
    e.preventDefault();
    if (!comentario || !detalle) return;
    try {
      const respuesta = await fetch(`/api/crm/${detalle.id}/comentario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mensaje: comentario })
      });
      if (respuesta.ok) {
        setComentario('');
        await cargarEventos(detalle.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEliminarSolicitud = async (id) => {
    if (!window.confirm('¿Eliminar esta solicitud y todo su historial?')) return;
    try {
      const respuesta = await fetch(`/api/crm/delete/${id}`, { method: 'DELETE', credentials: 'include' });
      if (respuesta.ok) await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const columnasSolicitudes = [
    { key: 'titulo', header: 'Solicitud', render: (s) => (
      <button onClick={() => abrirDetalle(s)} className="text-left hover:text-blue-600 transition-colors">
        <p className="font-bold text-slate-900">{s.titulo}</p>
        {s.propietario_nombre && <p className="text-slate-500 mt-0.5">{s.propiedad_detalle} — {s.propietario_nombre}</p>}
      </button>
    ) },
    { key: 'categoria', header: 'Categoría', render: (s) => ETIQUETAS_CATEGORIA[s.categoria] || s.categoria },
    { key: 'canal', header: 'Canal', render: (s) => ETIQUETAS_CANAL[s.canal] || s.canal },
    { key: 'prioridad', header: 'Prioridad', render: (s) => <StatusBadge light tone={TONOS_PRIORIDAD[s.prioridad] || 'neutral'}>{s.prioridad}</StatusBadge> },
    { key: 'estado', header: 'Estado', render: (s) => <StatusBadge light tone={TONOS_ESTADO[s.estado] || 'neutral'}>{ETIQUETAS_ESTADO[s.estado] || s.estado}</StatusBadge> },
    { key: 'acciones', header: 'Acciones', align: 'center', render: (s) => (
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => handleEliminarSolicitud(s.id)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300" title="Eliminar">
          <Trash2 size={12} />
        </button>
      </div>
    ) }
  ];

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center shrink-0">
        <h1 className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-2">
          <Headset size={16} className="text-blue-500" /> Atención al Cliente
        </h1>
        <button onClick={() => setModalNuevaAbierto(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
          <Plus size={12} /> Nueva Solicitud
        </button>
      </div>

      <Card className="flex-grow overflow-hidden" padding="p-0" light>
        <div className="h-full overflow-y-auto custom-scrollbar">
          <DataTable light columns={columnasSolicitudes} data={solicitudes} loading={cargando} loadingLabel="Cargando solicitudes..." emptyLabel="No hay solicitudes registradas." />
        </div>
      </Card>

      {/* MODAL: NUEVA SOLICITUD */}
      <Modal
        open={modalNuevaAbierto}
        onClose={() => setModalNuevaAbierto(false)}
        icon={Headset}
        title="Nueva Solicitud"
        subtitle="Consulta, reclamación o petición del cliente"
        footer={
          <>
            <button type="button" onClick={() => setModalNuevaAbierto(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-nueva-solicitud" disabled={guardandoNueva} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              {guardandoNueva ? 'Creando...' : 'Crear Solicitud'}
            </button>
          </>
        }
      >
        <form id="form-nueva-solicitud" onSubmit={handleCrearSolicitud} className="space-y-3">
          <Field label="Propietario (opcional)" as="select" value={nvPropietarioId} onChange={(e) => setNvPropietarioId(e.target.value)}>
            <option value="">-- Sin asociar --</option>
            {propietarios.map(p => (
              <option key={p.id} value={p.id}>{p.propiedad_detalle} — {p.nombre_completo}</option>
            ))}
          </Field>
          <Field label="Título" required value={nvTitulo} onChange={(e) => setNvTitulo(e.target.value)} placeholder="Ej: Duda sobre el recibo de la cuota" />
          <Field label="Descripción" as="textarea" rows={3} value={nvDescripcion} onChange={(e) => setNvDescripcion(e.target.value)} placeholder="Detalles de la solicitud" />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Categoría" as="select" value={nvCategoria} onChange={(e) => setNvCategoria(e.target.value)}>
              {Object.entries(ETIQUETAS_CATEGORIA).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
            </Field>
            <Field label="Canal" as="select" value={nvCanal} onChange={(e) => setNvCanal(e.target.value)}>
              {Object.entries(ETIQUETAS_CANAL).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
            </Field>
            <Field label="Prioridad" as="select" value={nvPrioridad} onChange={(e) => setNvPrioridad(e.target.value)}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </Field>
          </div>
        </form>
      </Modal>

      {/* MODAL: DETALLE + TIMELINE */}
      <Modal
        open={!!detalle}
        onClose={() => setDetalle(null)}
        icon={Headset}
        size="lg"
        title={detalle?.titulo}
        subtitle={detalle?.propietario_nombre}
      >
        {detalle && (
          <div className="space-y-4">
            {detalle.descripcion && <p className="text-3xs text-slate-300 leading-relaxed">{detalle.descripcion}</p>}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Estado" as="select" value={detalle.estado} onChange={(e) => handleCambiarEstado(e.target.value)}>
                <option value="abierta">Abierta</option>
                <option value="en_curso">En Curso</option>
                <option value="resuelta">Resuelta</option>
                <option value="cerrada">Cerrada</option>
              </Field>
              <div>
                <span className="block text-3xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Categoría / Canal</span>
                <p className="text-xs text-slate-200 bg-slate-900 border border-slate-800 rounded-xl py-3 px-4">
                  {ETIQUETAS_CATEGORIA[detalle.categoria] || detalle.categoria} · {ETIQUETAS_CANAL[detalle.canal] || detalle.canal}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-3xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Clock size={12} /> Historial
              </h3>
              <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {cargandoEventos ? (
                  <p className="text-4xs text-slate-500 text-center py-4">Cargando historial...</p>
                ) : eventos.length === 0 ? (
                  <p className="text-4xs text-slate-600 text-center py-4">Sin eventos todavía.</p>
                ) : (
                  eventos.map((ev) => (
                    <div key={ev.id} className="bg-slate-950 border border-slate-900 rounded-xl p-3 text-4xs">
                      <div className="flex justify-between items-center text-slate-500 font-mono uppercase tracking-wider mb-1">
                        <span>{ev.tipo_evento === 'comentario' ? 'Comentario' : 'Cambio de estado'}</span>
                        <span>{new Date(ev.creado_en).toLocaleString('es-ES')}</span>
                      </div>
                      {ev.estado_nuevo && ev.tipo_evento === 'cambio_estado' && (
                        <p className="text-slate-300">
                          {ev.estado_anterior ? `${ETIQUETAS_ESTADO[ev.estado_anterior] || ev.estado_anterior} → ` : ''}
                          <span className="font-bold">{ETIQUETAS_ESTADO[ev.estado_nuevo] || ev.estado_nuevo}</span>
                        </p>
                      )}
                      {ev.mensaje && <p className="text-slate-300 mt-1">{ev.mensaje}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>

            <form onSubmit={handleComentar} className="flex gap-2">
              <input
                type="text"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Añadir un comentario..."
                className="flex-grow bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
              <button type="submit" className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl">
                <MessageSquare size={14} />
              </button>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
