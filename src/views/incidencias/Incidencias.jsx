import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Wrench, Truck, Plus, Trash2, Clock, MessageSquare } from 'lucide-react';
import Card from '../../components/ui/Card.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Field from '../../components/ui/Field.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';

const TONOS_PRIORIDAD = { baja: 'neutral', media: 'brand', alta: 'warning', urgente: 'danger' };
const TONOS_ESTADO = { abierta: 'danger', en_curso: 'warning', resuelta: 'success', cerrada: 'neutral' };
const ETIQUETAS_ESTADO = { abierta: 'Abierta', en_curso: 'En Curso', resuelta: 'Resuelta', cerrada: 'Cerrada' };

export default function Incidencias() {
  const { fincaId } = useParams();
  const entidadId = fincaId;

  const [tab, setTab] = useState('incidencias');
  const [incidencias, setIncidencias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [modalNuevaAbierto, setModalNuevaAbierto] = useState(false);
  const [guardandoNueva, setGuardandoNueva] = useState(false);
  const [nvTitulo, setNvTitulo] = useState('');
  const [nvDescripcion, setNvDescripcion] = useState('');
  const [nvUbicacion, setNvUbicacion] = useState('');
  const [nvPrioridad, setNvPrioridad] = useState('media');

  const [modalProvAbierto, setModalProvAbierto] = useState(false);
  const [guardandoProv, setGuardandoProv] = useState(false);
  const [prNombre, setPrNombre] = useState('');
  const [prCategoria, setPrCategoria] = useState('');
  const [prTelefono, setPrTelefono] = useState('');
  const [prEmail, setPrEmail] = useState('');

  const [detalle, setDetalle] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [cargandoEventos, setCargandoEventos] = useState(false);
  const [comentario, setComentario] = useState('');

  const refrescar = useCallback(async () => {
    try {
      const [resInc, resProv] = await Promise.all([
        fetch(`/api/incidencias/lista/${entidadId}`, { credentials: 'include' }),
        fetch('/api/proveedores/lista', { credentials: 'include' })
      ]);
      const dataInc = await resInc.json();
      const dataProv = await resProv.json();
      if (resInc.ok) setIncidencias(dataInc.incidencias || []);
      if (resProv.ok) setProveedores(dataProv.proveedores || []);
    } catch (err) {
      console.error('Fallo al cargar incidencias:', err);
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

  const cargarEventos = async (incidenciaId) => {
    setCargandoEventos(true);
    try {
      const respuesta = await fetch(`/api/incidencias/${incidenciaId}/eventos`, { credentials: 'include' });
      const resultado = await respuesta.json();
      if (respuesta.ok) setEventos(resultado.eventos || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCargandoEventos(false);
    }
  };

  const abrirDetalle = (incidencia) => {
    setDetalle(incidencia);
    cargarEventos(incidencia.id);
  };

  const handleCrearIncidencia = async (e) => {
    e.preventDefault();
    if (!nvTitulo) return;

    setGuardandoNueva(true);
    try {
      const respuesta = await fetch('/api/incidencias/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entity_id: entidadId, titulo: nvTitulo, descripcion: nvDescripcion, ubicacion: nvUbicacion, prioridad: nvPrioridad })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setModalNuevaAbierto(false);
        setNvTitulo(''); setNvDescripcion(''); setNvUbicacion(''); setNvPrioridad('media');
        await refrescar();
      } else {
        alert(`❌ Error: ${resultado.error || 'No se pudo crear la incidencia.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al crear la incidencia.');
    } finally {
      setGuardandoNueva(false);
    }
  };

  const handleCambiarEstado = async (estado) => {
    if (!detalle) return;
    try {
      const respuesta = await fetch(`/api/incidencias/${detalle.id}/estado`, {
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

  const handleAsignarProveedor = async (proveedorId) => {
    if (!detalle) return;
    try {
      const respuesta = await fetch(`/api/incidencias/${detalle.id}/asignar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ proveedor_id: proveedorId || null })
      });
      if (respuesta.ok) {
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
      const respuesta = await fetch(`/api/incidencias/${detalle.id}/comentario`, {
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

  const handleEliminarIncidencia = async (id) => {
    if (!window.confirm('¿Eliminar esta incidencia y todo su historial?')) return;
    try {
      const respuesta = await fetch(`/api/incidencias/delete/${id}`, { method: 'DELETE', credentials: 'include' });
      if (respuesta.ok) await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCrearProveedor = async (e) => {
    e.preventDefault();
    if (!prNombre) return;

    setGuardandoProv(true);
    try {
      const respuesta = await fetch('/api/proveedores/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nombre: prNombre, categoria: prCategoria, telefono: prTelefono, email: prEmail })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setModalProvAbierto(false);
        setPrNombre(''); setPrCategoria(''); setPrTelefono(''); setPrEmail('');
        await refrescar();
      } else {
        alert(`❌ Error: ${resultado.error || 'No se pudo añadir el proveedor.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al añadir el proveedor.');
    } finally {
      setGuardandoProv(false);
    }
  };

  const handleEliminarProveedor = async (id) => {
    if (!window.confirm('¿Eliminar este proveedor del catálogo del despacho?')) return;
    try {
      const respuesta = await fetch(`/api/proveedores/delete/${id}`, { method: 'DELETE', credentials: 'include' });
      if (respuesta.ok) await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const columnasIncidencias = [
    { key: 'titulo', header: 'Incidencia', render: (i) => (
      <button onClick={() => abrirDetalle(i)} className="text-left hover:text-blue-600 transition-colors">
        <p className="font-bold text-slate-900">{i.titulo}</p>
        {i.ubicacion && <p className="text-slate-500 mt-0.5">{i.ubicacion}</p>}
      </button>
    ) },
    { key: 'prioridad', header: 'Prioridad', render: (i) => <StatusBadge light tone={TONOS_PRIORIDAD[i.prioridad] || 'neutral'}>{i.prioridad}</StatusBadge> },
    { key: 'proveedor_nombre', header: 'Proveedor', render: (i) => i.proveedor_nombre || <span className="text-slate-600">Sin asignar</span> },
    { key: 'fecha_apertura', header: 'Apertura', render: (i) => new Date(i.fecha_apertura).toLocaleDateString('es-ES') },
    { key: 'estado', header: 'Estado', render: (i) => <StatusBadge light tone={TONOS_ESTADO[i.estado] || 'neutral'}>{ETIQUETAS_ESTADO[i.estado] || i.estado}</StatusBadge> },
    { key: 'acciones', header: 'Acciones', align: 'center', render: (i) => (
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => handleEliminarIncidencia(i.id)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300" title="Eliminar">
          <Trash2 size={12} />
        </button>
      </div>
    ) }
  ];

  const columnasProveedores = [
    { key: 'nombre', header: 'Proveedor', render: (p) => (
      <div>
        <p className="font-bold text-slate-900">{p.nombre}</p>
        {p.categoria && <p className="text-slate-500 mt-0.5">{p.categoria}</p>}
      </div>
    ) },
    { key: 'telefono', header: 'Teléfono', render: (p) => p.telefono || '—' },
    { key: 'email', header: 'Email', render: (p) => p.email || '—' },
    { key: 'acciones', header: 'Acciones', align: 'center', render: (p) => (
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => handleEliminarProveedor(p.id)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300" title="Eliminar">
          <Trash2 size={12} />
        </button>
      </div>
    ) }
  ];

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center shrink-0">
        <div className="flex gap-2 bg-slate-950 p-1 rounded-xl border border-slate-900 max-w-md">
          <button onClick={() => setTab('incidencias')} className={`flex-1 py-2 px-4 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${tab === 'incidencias' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}>
            <Wrench size={12} /> Incidencias
          </button>
          <button onClick={() => setTab('proveedores')} className={`flex-1 py-2 px-4 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${tab === 'proveedores' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}>
            <Truck size={12} /> Proveedores
          </button>
        </div>

        {tab === 'incidencias' ? (
          <button onClick={() => setModalNuevaAbierto(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
            <Plus size={12} /> Nueva Incidencia
          </button>
        ) : (
          <button onClick={() => setModalProvAbierto(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
            <Plus size={12} /> Nuevo Proveedor
          </button>
        )}
      </div>

      <Card className="flex-grow overflow-hidden" padding="p-0" light>
        <div className="h-full overflow-y-auto custom-scrollbar">
          {tab === 'incidencias' ? (
            <DataTable light columns={columnasIncidencias} data={incidencias} loading={cargando} loadingLabel="Cargando incidencias..." emptyLabel="No hay incidencias registradas." />
          ) : (
            <DataTable light columns={columnasProveedores} data={proveedores} loading={cargando} loadingLabel="Cargando proveedores..." emptyLabel="No hay proveedores en el catálogo." />
          )}
        </div>
      </Card>

      {/* MODAL: NUEVA INCIDENCIA */}
      <Modal
        open={modalNuevaAbierto}
        onClose={() => setModalNuevaAbierto(false)}
        icon={Wrench}
        title="Nueva Incidencia"
        subtitle="Parte de avería o mantenimiento"
        footer={
          <>
            <button type="button" onClick={() => setModalNuevaAbierto(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-nueva-incidencia" disabled={guardandoNueva} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              {guardandoNueva ? 'Creando...' : 'Crear Incidencia'}
            </button>
          </>
        }
      >
        <form id="form-nueva-incidencia" onSubmit={handleCrearIncidencia} className="space-y-3">
          <Field label="Título" required value={nvTitulo} onChange={(e) => setNvTitulo(e.target.value)} placeholder="Ej: Avería del ascensor" />
          <Field label="Descripción" as="textarea" rows={3} value={nvDescripcion} onChange={(e) => setNvDescripcion(e.target.value)} placeholder="Detalles de la incidencia" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ubicación" value={nvUbicacion} onChange={(e) => setNvUbicacion(e.target.value)} placeholder="Ej: Portal 2" />
            <Field label="Prioridad" as="select" value={nvPrioridad} onChange={(e) => setNvPrioridad(e.target.value)}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </Field>
          </div>
        </form>
      </Modal>

      {/* MODAL: NUEVO PROVEEDOR */}
      <Modal
        open={modalProvAbierto}
        onClose={() => setModalProvAbierto(false)}
        icon={Truck}
        title="Nuevo Proveedor"
        subtitle="Catálogo compartido del despacho"
        footer={
          <>
            <button type="button" onClick={() => setModalProvAbierto(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-nuevo-proveedor" disabled={guardandoProv} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              {guardandoProv ? 'Guardando...' : 'Añadir Proveedor'}
            </button>
          </>
        }
      >
        <form id="form-nuevo-proveedor" onSubmit={handleCrearProveedor} className="space-y-3">
          <Field label="Nombre" required value={prNombre} onChange={(e) => setPrNombre(e.target.value)} placeholder="Ej: Fontanería García" />
          <Field label="Categoría" value={prCategoria} onChange={(e) => setPrCategoria(e.target.value)} placeholder="Ej: Fontanería" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono" value={prTelefono} onChange={(e) => setPrTelefono(e.target.value)} placeholder="+34600000000" />
            <Field label="Email" type="email" value={prEmail} onChange={(e) => setPrEmail(e.target.value)} placeholder="contacto@proveedor.com" />
          </div>
        </form>
      </Modal>

      {/* MODAL: DETALLE + TIMELINE */}
      <Modal
        open={!!detalle}
        onClose={() => setDetalle(null)}
        icon={Wrench}
        size="lg"
        title={detalle?.titulo}
        subtitle={detalle?.ubicacion}
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
              <Field label="Proveedor asignado" as="select" value={detalle.proveedor_id || ''} onChange={(e) => handleAsignarProveedor(e.target.value)}>
                <option value="">Sin asignar</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Field>
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
                        <span>{ev.tipo_evento === 'comentario' ? 'Comentario' : ev.tipo_evento === 'asignacion' ? 'Asignación' : 'Cambio de estado'}</span>
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
