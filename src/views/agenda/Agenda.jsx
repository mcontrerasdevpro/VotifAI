import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVotifaiStore } from '../../store.jsx';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Building2, ArrowLeft } from 'lucide-react';
import Card from '../../components/ui/Card.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Field from '../../components/ui/Field.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';

const TIPOS = {
  junta: { label: 'Junta', tono: 'brand', punto: 'bg-brand-400' },
  vencimiento: { label: 'Vencimiento', tono: 'warning', punto: 'bg-amber-400' },
  tarea: { label: 'Tarea', tono: 'neutral', punto: 'bg-slate-400' },
  recordatorio: { label: 'Recordatorio', tono: 'info', punto: 'bg-purple-400' },
  otro: { label: 'Otro', tono: 'neutral', punto: 'bg-slate-400' }
};

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const aClaveFecha = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const generarCuadricula = (fechaRef) => {
  const año = fechaRef.getFullYear();
  const mes = fechaRef.getMonth();
  const primerDiaMes = new Date(año, mes, 1);
  const ultimoDiaMes = new Date(año, mes + 1, 0);
  const offsetInicio = (primerDiaMes.getDay() + 6) % 7; // Lunes = 0

  const dias = [];
  for (let i = offsetInicio; i > 0; i--) dias.push({ fecha: new Date(año, mes, 1 - i), delMes: false });
  for (let d = 1; d <= ultimoDiaMes.getDate(); d++) dias.push({ fecha: new Date(año, mes, d), delMes: true });
  while (dias.length % 7 !== 0) {
    const siguiente = new Date(dias[dias.length - 1].fecha);
    siguiente.setDate(siguiente.getDate() + 1);
    dias.push({ fecha: siguiente, delMes: false });
  }
  return dias;
};

export default function Agenda() {
  const navigate = useNavigate();
  const { state } = useVotifaiStore() || { state: { tenant: null } };
  const tenantId = state?.tenant?.tenantId || state?.tenant?.id;

  const [mesActivo, setMesActivo] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [eventos, setEventos] = useState([]);
  const [fincas, setFincas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [nvTitulo, setNvTitulo] = useState('');
  const [nvDescripcion, setNvDescripcion] = useState('');
  const [nvTipo, setNvTipo] = useState('junta');
  const [nvFecha, setNvFecha] = useState('');
  const [nvHora, setNvHora] = useState('');
  const [nvEntityId, setNvEntityId] = useState('');

  const refrescar = useCallback(async () => {
    try {
      const respuesta = await fetch('/api/agenda/lista', { credentials: 'include' });
      const resultado = await respuesta.json();
      if (respuesta.ok) setEventos(resultado.eventos || []);
    } catch (err) {
      console.error('Fallo al cargar la agenda:', err);
    }
  }, []);

  useEffect(() => {
    const cargarInicial = async () => {
      await refrescar();
      if (tenantId) {
        try {
          const respuesta = await fetch(`/api/entities/${tenantId}`, { credentials: 'include' });
          const resultado = await respuesta.json();
          if (respuesta.ok) setFincas(resultado.fincas || []);
        } catch (err) {
          console.error('Fallo al cargar el catálogo de fincas:', err);
        }
      }
      setCargando(false);
    };
    cargarInicial();
  }, [tenantId, refrescar]);

  const eventosPorDia = useMemo(() => {
    const mapa = {};
    for (const ev of eventos) {
      const clave = ev.fecha;
      if (!mapa[clave]) mapa[clave] = [];
      mapa[clave].push(ev);
    }
    return mapa;
  }, [eventos]);

  const proximosEventos = useMemo(() => {
    const hoy = aClaveFecha(new Date());
    return eventos.filter(ev => ev.fecha >= hoy).slice(0, 8);
  }, [eventos]);

  const dias = useMemo(() => generarCuadricula(mesActivo), [mesActivo]);
  const claveHoy = aClaveFecha(new Date());

  const abrirModalNuevo = (claveFecha) => {
    setNvTitulo(''); setNvDescripcion(''); setNvTipo('junta'); setNvHora(''); setNvEntityId('');
    setNvFecha(claveFecha || (diaSeleccionado ? aClaveFecha(diaSeleccionado) : aClaveFecha(new Date())));
    setModalAbierto(true);
  };

  const handleCrearEvento = async (e) => {
    e.preventDefault();
    if (!nvTitulo || !nvFecha) return;

    setGuardando(true);
    try {
      const respuesta = await fetch('/api/agenda/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          entity_id: nvEntityId || null,
          titulo: nvTitulo,
          descripcion: nvDescripcion,
          tipo: nvTipo,
          fecha: nvFecha,
          hora: nvHora || null
        })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setModalAbierto(false);
        await refrescar();
      } else {
        alert(`❌ Error: ${resultado.error || 'No se pudo crear el evento.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al crear el evento.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarEvento = async (id) => {
    if (!window.confirm('¿Eliminar este evento de la agenda?')) return;
    try {
      const respuesta = await fetch(`/api/agenda/delete/${id}`, { method: 'DELETE', credentials: 'include' });
      if (respuesta.ok) await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const claveDiaSeleccionado = diaSeleccionado ? aClaveFecha(diaSeleccionado) : null;
  const eventosDelDia = claveDiaSeleccionado ? (eventosPorDia[claveDiaSeleccionado] || []) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col h-screen overflow-hidden">
      <header className="border-b border-slate-900 bg-slate-950 px-6 py-4 flex justify-between items-center shrink-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/hub')}
            className="p-2.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl hover:text-white transition-colors"
          ><ArrowLeft size={14} /></button>
          <div className="bg-blue-600 p-2 rounded-xl text-white"><CalendarDays size={20} /></div>
          <div>
            <h1 className="text-sm font-black text-white">Agenda del Despacho</h1>
            <p className="text-4xs uppercase tracking-widest text-slate-500 font-bold">Juntas, vencimientos y tareas de toda la cartera</p>
          </div>
        </div>
        <button
          onClick={() => abrirModalNuevo(null)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10"
        >
          <Plus size={12} /> Nuevo Evento
        </button>
      </header>

      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
        {/* CALENDARIO */}
        <Card className="w-full lg:flex-grow flex flex-col overflow-hidden" padding="p-4">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <button onClick={() => setMesActivo(new Date(mesActivo.getFullYear(), mesActivo.getMonth() - 1, 1))} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white">
              <ChevronLeft size={14} />
            </button>
            <h2 className="text-xs font-black text-white uppercase tracking-widest">{MESES[mesActivo.getMonth()]} {mesActivo.getFullYear()}</h2>
            <button onClick={() => setMesActivo(new Date(mesActivo.getFullYear(), mesActivo.getMonth() + 1, 1))} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white">
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-4xs font-black uppercase tracking-widest text-slate-600 mb-1 shrink-0">
            {DIAS_SEMANA.map(d => <div key={d} className="py-1">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1 flex-grow overflow-hidden">
            {dias.map(({ fecha, delMes }) => {
              const clave = aClaveFecha(fecha);
              const eventosDia = eventosPorDia[clave] || [];
              const esHoy = clave === claveHoy;
              const esSeleccionado = clave === claveDiaSeleccionado;

              return (
                <button
                  key={clave}
                  onClick={() => setDiaSeleccionado(esSeleccionado ? null : fecha)}
                  className={`rounded-lg p-1.5 text-left flex flex-col gap-1 border transition-all min-h-[64px] ${
                    esSeleccionado ? 'bg-blue-600/10 border-blue-500' : esHoy ? 'bg-slate-900 border-blue-500/40' : 'bg-slate-950 border-slate-900 hover:border-slate-800'
                  } ${!delMes ? 'opacity-40' : ''}`}
                >
                  <span className={`text-4xs font-bold ${esHoy ? 'text-blue-400' : 'text-slate-400'}`}>{fecha.getDate()}</span>
                  <div className="flex flex-wrap gap-0.5">
                    {eventosDia.slice(0, 4).map((ev) => (
                      <span key={ev.id} className={`w-1.5 h-1.5 rounded-full ${TIPOS[ev.tipo]?.punto || TIPOS.otro.punto}`} title={ev.titulo} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* PANEL LATERAL: DÍA SELECCIONADO O PRÓXIMOS EVENTOS */}
        <Card className="w-full lg:w-80 flex flex-col overflow-hidden" padding="p-4">
          <h3 className="text-3xs font-black text-slate-400 uppercase tracking-widest mb-3 shrink-0">
            {diaSeleccionado
              ? diaSeleccionado.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
              : 'Próximos Eventos'}
          </h3>

          <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {cargando ? (
              <p className="text-4xs text-slate-500 text-center py-8">Cargando agenda...</p>
            ) : (diaSeleccionado ? eventosDelDia : proximosEventos).length === 0 ? (
              <p className="text-4xs text-slate-600 text-center py-8">
                {diaSeleccionado ? 'Sin eventos este día.' : 'Sin eventos próximos.'}
              </p>
            ) : (
              (diaSeleccionado ? eventosDelDia : proximosEventos).map((ev) => (
                <div key={ev.id} className="bg-slate-950 border border-slate-900 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <StatusBadge tone={TIPOS[ev.tipo]?.tono || 'neutral'}>{TIPOS[ev.tipo]?.label || ev.tipo}</StatusBadge>
                    <button onClick={() => handleEliminarEvento(ev.id)} className="text-slate-600 hover:text-rose-400 transition-colors shrink-0">
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <p className="text-3xs font-bold text-white">{ev.titulo}</p>
                  <div className="flex items-center gap-2 text-4xs text-slate-500 font-mono">
                    <span>{new Date(ev.fecha).toLocaleDateString('es-ES')}</span>
                    {ev.hora && <span>· {ev.hora.slice(0, 5)}</span>}
                  </div>
                  {ev.finca_nombre && (
                    <div className="flex items-center gap-1 text-4xs text-blue-400">
                      <Building2 size={10} /> {ev.finca_nombre}
                    </div>
                  )}
                  {ev.descripcion && <p className="text-4xs text-slate-400 leading-relaxed">{ev.descripcion}</p>}
                </div>
              ))
            )}
          </div>

          {diaSeleccionado && (
            <button
              onClick={() => abrirModalNuevo(claveDiaSeleccionado)}
              className="mt-3 shrink-0 w-full bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-4xs font-black uppercase tracking-wider py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus size={12} /> Añadir a este día
            </button>
          )}
        </Card>
      </div>

      {/* MODAL: NUEVO EVENTO */}
      <Modal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        icon={CalendarDays}
        title="Nuevo Evento"
        subtitle="Agenda del despacho"
        footer={
          <>
            <button type="button" onClick={() => setModalAbierto(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-nuevo-evento" disabled={guardando} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              {guardando ? 'Guardando...' : 'Añadir Evento'}
            </button>
          </>
        }
      >
        <form id="form-nuevo-evento" onSubmit={handleCrearEvento} className="space-y-3">
          <Field label="Título" required value={nvTitulo} onChange={(e) => setNvTitulo(e.target.value)} placeholder="Ej: Junta ordinaria anual" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" type="date" required value={nvFecha} onChange={(e) => setNvFecha(e.target.value)} />
            <Field label="Hora (opcional)" type="time" value={nvHora} onChange={(e) => setNvHora(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo" as="select" value={nvTipo} onChange={(e) => setNvTipo(e.target.value)}>
              {Object.entries(TIPOS).map(([valor, { label }]) => <option key={valor} value={valor}>{label}</option>)}
            </Field>
            <Field label="Finca (opcional)" as="select" value={nvEntityId} onChange={(e) => setNvEntityId(e.target.value)}>
              <option value="">-- Toda la cartera --</option>
              {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </Field>
          </div>
          <Field label="Descripción (opcional)" as="textarea" rows={2} value={nvDescripcion} onChange={(e) => setNvDescripcion(e.target.value)} placeholder="Notas adicionales" />
        </form>
      </Modal>
    </div>
  );
}
