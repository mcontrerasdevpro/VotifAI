import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarClock, MapPinned, Plus, Check, X, Trash2 } from 'lucide-react';
import Card from '../../components/ui/Card.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Field from '../../components/ui/Field.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';

const TONOS_ESTADO = { pendiente: 'warning', confirmada: 'success', cancelada: 'neutral', rechazada: 'danger' };
const ETIQUETAS_ESTADO = { pendiente: 'Pendiente', confirmada: 'Confirmada', cancelada: 'Cancelada', rechazada: 'Rechazada' };

export default function Reservas() {
  const { fincaId, empresaId } = useParams();
  const entidadId = empresaId || fincaId;

  const [tab, setTab] = useState('reservas');
  const [reservas, setReservas] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [propietarios, setPropietarios] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [modalReservaAbierto, setModalReservaAbierto] = useState(false);
  const [guardandoReserva, setGuardandoReserva] = useState(false);
  const [errorReserva, setErrorReserva] = useState('');
  const [rvZonaId, setRvZonaId] = useState('');
  const [rvPropietarioId, setRvPropietarioId] = useState('');
  const [rvFecha, setRvFecha] = useState('');
  const [rvHoraInicio, setRvHoraInicio] = useState('');
  const [rvHoraFin, setRvHoraFin] = useState('');

  const [modalZonaAbierto, setModalZonaAbierto] = useState(false);
  const [guardandoZona, setGuardandoZona] = useState(false);
  const [znNombre, setZnNombre] = useState('');
  const [znTipo, setZnTipo] = useState('');
  const [znCapacidad, setZnCapacidad] = useState('');
  const [znRequiereAprobacion, setZnRequiereAprobacion] = useState(false);

  const refrescar = useCallback(async () => {
    try {
      const [resRes, resZonas, resProp] = await Promise.all([
        fetch(`/api/reservas/lista/${entidadId}`, { credentials: 'include' }),
        fetch(`/api/zonas-comunes/lista/${entidadId}`, { credentials: 'include' }),
        fetch(`/api/propietarios/lista/${entidadId}`, { credentials: 'include' })
      ]);
      const dataRes = await resRes.json();
      const dataZonas = await resZonas.json();
      const dataProp = await resProp.json();
      if (resRes.ok) setReservas(dataRes.reservas || []);
      if (resZonas.ok) setZonas(dataZonas.zonas || []);
      if (resProp.ok) setPropietarios(dataProp.propietarios || []);
    } catch (err) {
      console.error('Fallo al cargar reservas:', err);
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

  const handleCrearReserva = async (e) => {
    e.preventDefault();
    if (!rvZonaId || !rvPropietarioId || !rvFecha || !rvHoraInicio || !rvHoraFin) return;

    setGuardandoReserva(true);
    setErrorReserva('');
    try {
      const respuesta = await fetch('/api/reservas/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          entity_id: entidadId,
          zona_id: rvZonaId,
          propietario_id: rvPropietarioId,
          fecha: rvFecha,
          hora_inicio: rvHoraInicio,
          hora_fin: rvHoraFin
        })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setModalReservaAbierto(false);
        setRvZonaId(''); setRvPropietarioId(''); setRvFecha(''); setRvHoraInicio(''); setRvHoraFin('');
        await refrescar();
      } else {
        setErrorReserva(resultado.error || 'No se pudo crear la reserva.');
      }
    } catch (err) {
      console.error(err);
      setErrorReserva('Fallo de red al crear la reserva.');
    } finally {
      setGuardandoReserva(false);
    }
  };

  const handleCambiarEstadoReserva = async (id, estado) => {
    try {
      const respuesta = await fetch(`/api/reservas/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ estado })
      });
      if (respuesta.ok) await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEliminarReserva = async (id) => {
    if (!window.confirm('¿Eliminar esta reserva?')) return;
    try {
      const respuesta = await fetch(`/api/reservas/delete/${id}`, { method: 'DELETE', credentials: 'include' });
      if (respuesta.ok) await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCrearZona = async (e) => {
    e.preventDefault();
    if (!znNombre) return;

    setGuardandoZona(true);
    try {
      const respuesta = await fetch('/api/zonas-comunes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          entity_id: entidadId,
          nombre: znNombre,
          tipo: znTipo,
          capacidad_maxima: znCapacidad ? parseInt(znCapacidad, 10) : null,
          requiere_aprobacion: znRequiereAprobacion
        })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setModalZonaAbierto(false);
        setZnNombre(''); setZnTipo(''); setZnCapacidad(''); setZnRequiereAprobacion(false);
        await refrescar();
      } else {
        alert(`❌ Error: ${resultado.error || 'No se pudo crear la zona.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al crear la zona.');
    } finally {
      setGuardandoZona(false);
    }
  };

  const handleEliminarZona = async (id) => {
    if (!window.confirm('¿Eliminar esta zona común y todas sus reservas?')) return;
    try {
      const respuesta = await fetch(`/api/zonas-comunes/delete/${id}`, { method: 'DELETE', credentials: 'include' });
      if (respuesta.ok) await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const columnasReservas = [
    { key: 'zona_nombre', header: 'Zona', render: (r) => r.zona_nombre },
    { key: 'propietario_nombre', header: 'Propietario', render: (r) => (
      <div>
        <p className="font-bold text-white">{r.propietario_nombre}</p>
        <p className="text-slate-500 mt-0.5">{r.propiedad_detalle}</p>
      </div>
    ) },
    { key: 'fecha', header: 'Fecha', render: (r) => new Date(r.fecha).toLocaleDateString('es-ES') },
    { key: 'horario', header: 'Horario', render: (r) => `${r.hora_inicio.slice(0, 5)} - ${r.hora_fin.slice(0, 5)}` },
    { key: 'estado', header: 'Estado', render: (r) => <StatusBadge tone={TONOS_ESTADO[r.estado] || 'neutral'}>{ETIQUETAS_ESTADO[r.estado] || r.estado}</StatusBadge> },
    { key: 'acciones', header: 'Acciones', align: 'center', render: (r) => (
      <div className="flex items-center justify-center gap-2">
        {r.estado === 'pendiente' && (
          <>
            <button onClick={() => handleCambiarEstadoReserva(r.id, 'confirmada')} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 hover:text-emerald-300" title="Confirmar">
              <Check size={12} />
            </button>
            <button onClick={() => handleCambiarEstadoReserva(r.id, 'rechazada')} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300" title="Rechazar">
              <X size={12} />
            </button>
          </>
        )}
        <button onClick={() => handleEliminarReserva(r.id)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300" title="Eliminar">
          <Trash2 size={12} />
        </button>
      </div>
    ) }
  ];

  const columnasZonas = [
    { key: 'nombre', header: 'Zona', render: (z) => (
      <div>
        <p className="font-bold text-white">{z.nombre}</p>
        {z.tipo && <p className="text-slate-500 mt-0.5">{z.tipo}</p>}
      </div>
    ) },
    { key: 'horario', header: 'Horario', render: (z) => `${z.horario_apertura.slice(0, 5)} - ${z.horario_cierre.slice(0, 5)}` },
    { key: 'capacidad_maxima', header: 'Capacidad', align: 'center', render: (z) => z.capacidad_maxima || '—' },
    { key: 'requiere_aprobacion', header: 'Aprobación', render: (z) => <StatusBadge tone={z.requiere_aprobacion ? 'warning' : 'success'}>{z.requiere_aprobacion ? 'Manual' : 'Automática'}</StatusBadge> },
    { key: 'acciones', header: 'Acciones', align: 'center', render: (z) => (
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => handleEliminarZona(z.id)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300" title="Eliminar">
          <Trash2 size={12} />
        </button>
      </div>
    ) }
  ];

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center shrink-0">
        <div className="flex gap-2 bg-slate-950 p-1 rounded-xl border border-slate-900 max-w-md">
          <button onClick={() => setTab('reservas')} className={`flex-1 py-2 px-4 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${tab === 'reservas' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}>
            <CalendarClock size={12} /> Reservas
          </button>
          <button onClick={() => setTab('zonas')} className={`flex-1 py-2 px-4 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${tab === 'zonas' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}>
            <MapPinned size={12} /> Zonas Comunes
          </button>
        </div>

        {tab === 'reservas' ? (
          <button onClick={() => setModalReservaAbierto(true)} disabled={zonas.length === 0} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10 disabled:opacity-50">
            <Plus size={12} /> Nueva Reserva
          </button>
        ) : (
          <button onClick={() => setModalZonaAbierto(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
            <Plus size={12} /> Nueva Zona
          </button>
        )}
      </div>

      {tab === 'reservas' && zonas.length === 0 && !cargando && (
        <p className="text-4xs text-amber-400 font-bold uppercase tracking-wider shrink-0">
          Primero da de alta al menos una zona común en la pestaña "Zonas Comunes".
        </p>
      )}

      <Card className="flex-grow overflow-hidden" padding="p-0">
        <div className="h-full overflow-y-auto custom-scrollbar">
          {tab === 'reservas' ? (
            <DataTable columns={columnasReservas} data={reservas} loading={cargando} loadingLabel="Cargando reservas..." emptyLabel="No hay reservas registradas." />
          ) : (
            <DataTable columns={columnasZonas} data={zonas} loading={cargando} loadingLabel="Cargando zonas..." emptyLabel="No hay zonas comunes configuradas." />
          )}
        </div>
      </Card>

      {/* MODAL: NUEVA RESERVA */}
      <Modal
        open={modalReservaAbierto}
        onClose={() => setModalReservaAbierto(false)}
        icon={CalendarClock}
        title="Nueva Reserva"
        subtitle="Reservar una zona común"
        footer={
          <>
            <button type="button" onClick={() => setModalReservaAbierto(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-nueva-reserva" disabled={guardandoReserva} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              {guardandoReserva ? 'Reservando...' : 'Crear Reserva'}
            </button>
          </>
        }
      >
        <form id="form-nueva-reserva" onSubmit={handleCrearReserva} className="space-y-3">
          {errorReserva && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-3xs font-bold rounded-xl">
              {errorReserva}
            </div>
          )}
          <Field label="Zona común" as="select" required value={rvZonaId} onChange={(e) => setRvZonaId(e.target.value)}>
            <option value="">-- Selecciona una zona --</option>
            {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </Field>
          <Field label="Propietario" as="select" required value={rvPropietarioId} onChange={(e) => setRvPropietarioId(e.target.value)}>
            <option value="">-- Selecciona un propietario --</option>
            {propietarios.map(p => <option key={p.id} value={p.id}>{p.propiedad_detalle} — {p.nombre_completo}</option>)}
          </Field>
          <Field label="Fecha" type="date" required value={rvFecha} onChange={(e) => setRvFecha(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hora de inicio" type="time" required value={rvHoraInicio} onChange={(e) => setRvHoraInicio(e.target.value)} />
            <Field label="Hora de fin" type="time" required value={rvHoraFin} onChange={(e) => setRvHoraFin(e.target.value)} />
          </div>
        </form>
      </Modal>

      {/* MODAL: NUEVA ZONA COMÚN */}
      <Modal
        open={modalZonaAbierto}
        onClose={() => setModalZonaAbierto(false)}
        icon={MapPinned}
        title="Nueva Zona Común"
        subtitle="Configurar una zona reservable"
        footer={
          <>
            <button type="button" onClick={() => setModalZonaAbierto(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-nueva-zona" disabled={guardandoZona} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              {guardandoZona ? 'Creando...' : 'Crear Zona'}
            </button>
          </>
        }
      >
        <form id="form-nueva-zona" onSubmit={handleCrearZona} className="space-y-3">
          <Field label="Nombre" required value={znNombre} onChange={(e) => setZnNombre(e.target.value)} placeholder="Ej: Piscina" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo (opcional)" value={znTipo} onChange={(e) => setZnTipo(e.target.value)} placeholder="Ej: Deportiva" />
            <Field label="Capacidad máxima (opcional)" type="number" min="1" value={znCapacidad} onChange={(e) => setZnCapacidad(e.target.value)} placeholder="Ej: 20" />
          </div>
          <label className="flex items-center gap-2 text-3xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer">
            <input type="checkbox" checked={znRequiereAprobacion} onChange={(e) => setZnRequiereAprobacion(e.target.checked)} className="rounded" />
            Requiere aprobación manual del administrador
          </label>
        </form>
      </Modal>
    </div>
  );
}
