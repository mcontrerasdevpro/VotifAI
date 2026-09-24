import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Landmark, TrendingUp, TrendingDown, Scale, Target, FileCheck2, Plus, Trash2, PiggyBank, FileDown, BarChart3, X } from 'lucide-react';
import Card from '../../components/ui/Card.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Field from '../../components/ui/Field.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import FondoReserva from '../../components/FondoReserva.jsx';
import EjecucionPresupuesto from '../../components/EjecucionPresupuesto.jsx';

const fmt = (n) => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Contabilidad() {
  const { fincaId } = useParams();
  const entidadId = fincaId;

  const [tab, setTab] = useState('movimientos');
  const [movimientos, setMovimientos] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [modalMovAbierto, setModalMovAbierto] = useState(false);
  const [guardandoMov, setGuardandoMov] = useState(false);
  const [mvTipo, setMvTipo] = useState('gasto');
  const [mvConcepto, setMvConcepto] = useState('');
  const [mvCategoria, setMvCategoria] = useState('');
  const [mvImporte, setMvImporte] = useState('');
  const [mvFecha, setMvFecha] = useState('');
  const [mvNotas, setMvNotas] = useState('');

  const [modalPresAbierto, setModalPresAbierto] = useState(false);
  const [guardandoPres, setGuardandoPres] = useState(false);
  const [prNombre, setPrNombre] = useState('');
  const [prAnio, setPrAnio] = useState(new Date().getFullYear());
  const [prImporte, setPrImporte] = useState('');
  const [prNotas, setPrNotas] = useState('');
  const [prTipo, setPrTipo] = useState('ordinario');
  // Partidas del presupuesto (limpieza, luz, ascensor…). Con partidas, el
  // total es su suma; sin ellas, se indica un importe total.
  const [prPartidas, setPrPartidas] = useState([{ nombre: '', importe: '' }]);
  const [presupuestoEjecucion, setPresupuestoEjecucion] = useState(null);

  const [modalLiqAbierto, setModalLiqAbierto] = useState(false);
  const [guardandoLiq, setGuardandoLiq] = useState(false);
  const [lqInicio, setLqInicio] = useState('');
  const [lqFin, setLqFin] = useState('');
  const [lqNotas, setLqNotas] = useState('');

  const refrescar = useCallback(async () => {
    try {
      const [resMov, resPres, resLiq] = await Promise.all([
        fetch(`/api/movimientos/lista/${entidadId}`, { credentials: 'include' }),
        fetch(`/api/presupuestos/lista/${entidadId}`, { credentials: 'include' }),
        fetch(`/api/liquidaciones/lista/${entidadId}`, { credentials: 'include' })
      ]);
      const dataMov = await resMov.json();
      const dataPres = await resPres.json();
      const dataLiq = await resLiq.json();
      if (resMov.ok) setMovimientos(dataMov.movimientos || []);
      if (resPres.ok) setPresupuestos(dataPres.presupuestos || []);
      if (resLiq.ok) setLiquidaciones(dataLiq.liquidaciones || []);
    } catch (err) {
      console.error('Fallo al cargar la contabilidad:', err);
    }
  }, [entidadId]);

  useEffect(() => {
    const cargarInicial = async () => {
      if (!entidadId) { setCargando(false); return; }
      await refrescar();
      setCargando(false);
    };
    cargarInicial();
  }, [entidadId, refrescar]);

  const totales = useMemo(() => {
    const ingresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((acc, m) => acc + Number(m.importe), 0);
    const gastos = movimientos.filter(m => m.tipo === 'gasto').reduce((acc, m) => acc + Number(m.importe), 0);
    return { ingresos, gastos, saldo: ingresos - gastos };
  }, [movimientos]);

  const gastoPorAnio = useMemo(() => {
    const mapa = {};
    for (const m of movimientos) {
      if (m.tipo !== 'gasto') continue;
      const anio = Number(String(m.fecha).slice(0, 4));
      mapa[anio] = (mapa[anio] || 0) + Number(m.importe);
    }
    return mapa;
  }, [movimientos]);

  const categoriasSugeridas = useMemo(
    () => [...new Set(presupuestos.flatMap((pr) => (pr.partidas || []).map((pa) => pa.nombre)))].sort(),
    [presupuestos]
  );

  const resetFormMov = () => {
    setMvTipo('gasto'); setMvConcepto(''); setMvCategoria(''); setMvImporte(''); setMvFecha(''); setMvNotas('');
  };

  const handleCrearMovimiento = async (e) => {
    e.preventDefault();
    if (!mvConcepto || !mvImporte || !mvFecha) return;

    setGuardandoMov(true);
    try {
      const respuesta = await fetch('/api/movimientos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entity_id: entidadId, tipo: mvTipo, concepto: mvConcepto, categoria: mvCategoria, importe: mvImporte, fecha: mvFecha, notas: mvNotas })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setModalMovAbierto(false);
        resetFormMov();
        await refrescar();
      } else {
        alert(`❌ Error: ${resultado.error || 'No se pudo registrar el movimiento.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al registrar el movimiento.');
    } finally {
      setGuardandoMov(false);
    }
  };

  const handleEliminarMovimiento = async (id) => {
    if (!window.confirm('¿Eliminar este movimiento?')) return;
    try {
      const respuesta = await fetch(`/api/movimientos/delete/${id}`, { method: 'DELETE', credentials: 'include' });
      if (respuesta.ok) await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const partidasValidas = prPartidas.filter((p) => p.nombre.trim() && Number(p.importe) >= 0 && p.importe !== '');
  const totalPartidas = partidasValidas.reduce((t, p) => t + Number(p.importe), 0);

  const handleCrearPresupuesto = async (e) => {
    e.preventDefault();
    if (!prNombre || !prAnio || (partidasValidas.length === 0 && !prImporte)) return;

    setGuardandoPres(true);
    try {
      const respuesta = await fetch('/api/presupuestos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          entity_id: entidadId, nombre: prNombre, anio: prAnio, tipo: prTipo, notas: prNotas,
          importe_previsto: partidasValidas.length ? totalPartidas : prImporte,
          partidas: partidasValidas.map((p) => ({ nombre: p.nombre.trim(), importe_previsto: Number(p.importe) }))
        })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setModalPresAbierto(false);
        setPrNombre(''); setPrAnio(new Date().getFullYear()); setPrImporte(''); setPrNotas('');
        setPrTipo('ordinario'); setPrPartidas([{ nombre: '', importe: '' }]);
        await refrescar();
      } else {
        alert(`❌ Error: ${resultado.error || 'No se pudo crear el presupuesto.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al crear el presupuesto.');
    } finally {
      setGuardandoPres(false);
    }
  };

  const handleEliminarPresupuesto = async (id) => {
    if (!window.confirm('¿Eliminar este presupuesto?')) return;
    try {
      const respuesta = await fetch(`/api/presupuestos/delete/${id}`, { method: 'DELETE', credentials: 'include' });
      if (respuesta.ok) await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCrearLiquidacion = async (e) => {
    e.preventDefault();
    if (!lqInicio || !lqFin) return;

    setGuardandoLiq(true);
    try {
      const respuesta = await fetch('/api/liquidaciones/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entity_id: entidadId, periodo_inicio: lqInicio, periodo_fin: lqFin, notas: lqNotas })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setModalLiqAbierto(false);
        setLqInicio(''); setLqFin(''); setLqNotas('');
        await refrescar();
      } else {
        alert(`❌ Error: ${resultado.error || 'No se pudo calcular la liquidación.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al calcular la liquidación.');
    } finally {
      setGuardandoLiq(false);
    }
  };

  // Una liquidación no se borra: se anula con motivo (sigue en la lista) y
  // su periodo vuelve a quedar abierto para corregir y liquidar de nuevo.
  const handleAnularLiquidacion = async (id) => {
    const motivo = window.prompt('Motivo de la anulación de esta liquidación (su periodo volverá a quedar abierto para corregir movimientos):');
    if (!motivo?.trim()) return;
    try {
      const respuesta = await fetch(`/api/liquidaciones/${id}/anular`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivo.trim() })
      });
      const data = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) alert(data.error || 'No se pudo anular la liquidación.');
      await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const columnasMovimientos = [
    { key: 'concepto', header: 'Concepto', render: (m) => (
      <div>
        <p className="font-bold text-slate-900">{m.concepto}</p>
        {m.categoria && <p className="text-slate-500 mt-0.5">{m.categoria}</p>}
        {m.origen === 'cuota' && <p className="mt-0.5 text-4xs font-bold uppercase tracking-wider text-blue-600">Automático · cobro de cuota</p>}
      </div>
    ) },
    { key: 'tipo', header: 'Tipo', render: (m) => <StatusBadge light tone={m.tipo === 'ingreso' ? 'success' : 'danger'}>{m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</StatusBadge> },
    { key: 'fecha', header: 'Fecha', render: (m) => new Date(m.fecha).toLocaleDateString('es-ES') },
    { key: 'importe', header: 'Importe', align: 'right', render: (m) => (
      <span className={`font-mono font-black ${m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
        {m.tipo === 'ingreso' ? '+' : '-'}{fmt(m.importe)} €
      </span>
    ) },
    { key: 'acciones', header: 'Acciones', align: 'center', render: (m) => (
      // Los ingresos de cuotas se retiran anulando el cobro desde Cuotas.
      m.origen === 'cuota' ? <span className="text-4xs text-slate-400" title="Se anula desde Cuotas">—</span> : (
        <button onClick={() => handleEliminarMovimiento(m.id)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300" title="Eliminar">
          <Trash2 size={12} />
        </button>
      )
    ) }
  ];

  const columnasPresupuestos = [
    { key: 'nombre', header: 'Presupuesto', render: (p) => (
      <div>
        <p className="font-bold text-slate-900">{p.nombre}</p>
        <p className="mt-0.5 text-4xs text-slate-500">
          {p.tipo === 'extraordinario' ? 'Extraordinario' : 'Ordinario'}
          {p.partidas?.length ? ` · ${p.partidas.length} partidas` : ' · sin partidas'}
        </p>
      </div>
    ) },
    { key: 'anio', header: 'Año' },
    { key: 'importe_previsto', header: 'Previsto', align: 'right', render: (p) => <span className="font-mono">{fmt(p.importe_previsto)} €</span> },
    { key: 'ejecutado', header: 'Gasto Ejecutado', align: 'right', render: (p) => <span className="font-mono">{fmt(gastoPorAnio[p.anio] || 0)} €</span> },
    { key: 'desviacion', header: 'Desviación', align: 'right', render: (p) => {
      const desviacion = Number(p.importe_previsto) - (gastoPorAnio[p.anio] || 0);
      return <StatusBadge light tone={desviacion >= 0 ? 'success' : 'danger'}>{desviacion >= 0 ? '+' : ''}{fmt(desviacion)} €</StatusBadge>;
    } },
    { key: 'acciones', header: 'Acciones', align: 'center', render: (p) => (
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => setPresupuestoEjecucion(p)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-blue-400 hover:text-blue-300" title="Ver ejecución por partidas">
          <BarChart3 size={12} />
        </button>
        <button onClick={() => handleEliminarPresupuesto(p.id)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300" title="Eliminar">
          <Trash2 size={12} />
        </button>
      </div>
    ) }
  ];

  const columnasLiquidaciones = [
    { key: 'periodo', header: 'Periodo', render: (l) => (
      <div>
        <p className={`font-bold ${l.anulada_en ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{new Date(l.periodo_inicio).toLocaleDateString('es-ES')} — {new Date(l.periodo_fin).toLocaleDateString('es-ES')}</p>
        {l.anulada_en
          ? <p className="mt-0.5 text-4xs font-bold text-amber-600">Anulada el {new Date(l.anulada_en).toLocaleDateString('es-ES')}: {l.motivo_anulacion}</p>
          : <p className="mt-0.5 text-4xs text-slate-500">Periodo cerrado: no admite cambios mientras esté vigente</p>}
      </div>
    ) },
    { key: 'total_ingresos', header: 'Ingresos', align: 'right', render: (l) => <span className="font-mono text-emerald-600">{fmt(l.total_ingresos)} €</span> },
    { key: 'total_gastos', header: 'Gastos', align: 'right', render: (l) => <span className="font-mono text-rose-600">{fmt(l.total_gastos)} €</span> },
    { key: 'saldo', header: 'Saldo', align: 'right', render: (l) => (
      <StatusBadge light tone={Number(l.saldo) >= 0 ? 'success' : 'danger'}>{fmt(l.saldo)} €</StatusBadge>
    ) },
    { key: 'acciones', header: 'Acciones', align: 'center', render: (l) => (
      <div className="flex items-center justify-center gap-2">
        <a href={`/api/liquidaciones/${l.id}/pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-4xs font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300" title="Liquidación con reparto por propietario, para la junta">
          <FileDown size={11} /> PDF
        </a>
        {!l.anulada_en && (
          <button onClick={() => handleAnularLiquidacion(l.id)} className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-4xs font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300" title="Anular y reabrir el periodo">
            Anular
          </button>
        )}
      </div>
    ) }
  ];

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center shrink-0">
        <h1 className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-2">
          <Landmark size={16} className="text-blue-500" /> Contabilidad
        </h1>
        <div className="flex gap-2 bg-slate-950 p-1 rounded-xl border border-slate-900 flex-wrap">
          <button onClick={() => setTab('movimientos')} className={`flex-1 py-2 px-4 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${tab === 'movimientos' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}>
            <Scale size={12} /> Movimientos
          </button>
          <button onClick={() => setTab('presupuestos')} className={`flex-1 py-2 px-4 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${tab === 'presupuestos' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}>
            <Target size={12} /> Presupuestos
          </button>
          <button onClick={() => setTab('liquidaciones')} className={`flex-1 py-2 px-4 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${tab === 'liquidaciones' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}>
            <FileCheck2 size={12} /> Liquidaciones
          </button>
          <button onClick={() => setTab('fondo')} className={`flex-1 py-2 px-4 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${tab === 'fondo' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}>
            <PiggyBank size={12} /> Fondo de reserva
          </button>
        </div>
      </div>

      {tab === 'movimientos' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
          <Card>
            <span className="text-5xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><TrendingUp size={12} className="text-emerald-500" /> Ingresos</span>
            <p className="text-sm font-black text-emerald-400 mt-1 font-mono">{fmt(totales.ingresos)} €</p>
          </Card>
          <Card>
            <span className="text-5xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><TrendingDown size={12} className="text-rose-500" /> Gastos</span>
            <p className="text-sm font-black text-rose-400 mt-1 font-mono">{fmt(totales.gastos)} €</p>
          </Card>
          <Card>
            <span className="text-5xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Scale size={12} className="text-blue-500" /> Saldo</span>
            <p className={`text-sm font-black mt-1 font-mono ${totales.saldo >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{fmt(totales.saldo)} €</p>
          </Card>
        </div>
      )}

      <div className="shrink-0 flex justify-end">
        {tab === 'movimientos' ? (
          <button onClick={() => setModalMovAbierto(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
            <Plus size={12} /> Nuevo Movimiento
          </button>
        ) : tab === 'presupuestos' ? (
          <button onClick={() => setModalPresAbierto(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
            <Plus size={12} /> Nuevo Presupuesto
          </button>
        ) : tab === 'liquidaciones' ? (
          <button onClick={() => setModalLiqAbierto(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
            <Plus size={12} /> Nueva Liquidación
          </button>
        ) : null}
      </div>

      {tab === 'fondo' ? (
        <FondoReserva entidadId={entidadId} />
      ) : (
      <Card className="flex-grow overflow-hidden" padding="p-0" light>
        <div className="h-full overflow-y-auto custom-scrollbar">
          {tab === 'movimientos' ? (
            <DataTable light columns={columnasMovimientos} data={movimientos} loading={cargando} loadingLabel="Cargando movimientos..." emptyLabel="No hay movimientos registrados." />
          ) : tab === 'presupuestos' ? (
            <DataTable light columns={columnasPresupuestos} data={presupuestos} loading={cargando} loadingLabel="Cargando presupuestos..." emptyLabel="No hay presupuestos creados." />
          ) : (
            <DataTable light columns={columnasLiquidaciones} data={liquidaciones} loading={cargando} loadingLabel="Cargando liquidaciones..." emptyLabel="No hay liquidaciones calculadas." />
          )}
        </div>
      </Card>
      )}

      <EjecucionPresupuesto presupuesto={presupuestoEjecucion} onClose={() => setPresupuestoEjecucion(null)} />

      {/* MODAL: NUEVO MOVIMIENTO */}
      <Modal
        open={modalMovAbierto}
        onClose={() => setModalMovAbierto(false)}
        icon={Scale}
        title="Nuevo Movimiento"
        subtitle="Ingreso o gasto de la comunidad"
        footer={
          <>
            <button type="button" onClick={() => setModalMovAbierto(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-nuevo-movimiento" disabled={guardandoMov} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              {guardandoMov ? 'Guardando...' : 'Registrar Movimiento'}
            </button>
          </>
        }
      >
        <form id="form-nuevo-movimiento" onSubmit={handleCrearMovimiento} className="space-y-3">
          <Field label="Tipo" as="select" value={mvTipo} onChange={(e) => setMvTipo(e.target.value)}>
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </Field>
          <Field label="Concepto" required value={mvConcepto} onChange={(e) => setMvConcepto(e.target.value)} placeholder="Ej: Reparación del ascensor" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría / partida" value={mvCategoria} onChange={(e) => setMvCategoria(e.target.value)} placeholder="Ej: Limpieza" list="partidas-presupuesto" />
            <Field label="Importe (€)" type="number" step="0.01" min="0.01" required value={mvImporte} onChange={(e) => setMvImporte(e.target.value)} placeholder="150.00" />
          </div>
          <datalist id="partidas-presupuesto">
            {categoriasSugeridas.map((c) => <option key={c} value={c} />)}
          </datalist>
          {mvTipo === 'gasto' && categoriasSugeridas.length > 0 && (
            <p className="text-4xs text-slate-500">Usa el nombre de una partida del presupuesto para que cuente en su ejecución.</p>
          )}
          <Field label="Fecha" type="date" required value={mvFecha} onChange={(e) => setMvFecha(e.target.value)} />
          <Field label="Notas (opcional)" as="textarea" rows={2} value={mvNotas} onChange={(e) => setMvNotas(e.target.value)} placeholder="Detalles adicionales" />
        </form>
      </Modal>

      {/* MODAL: NUEVO PRESUPUESTO */}
      <Modal
        open={modalPresAbierto}
        onClose={() => setModalPresAbierto(false)}
        icon={Target}
        title="Nuevo Presupuesto"
        subtitle="Previsión anual de gasto"
        footer={
          <>
            <button type="button" onClick={() => setModalPresAbierto(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-nuevo-presupuesto" disabled={guardandoPres} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              {guardandoPres ? 'Guardando...' : 'Crear Presupuesto'}
            </button>
          </>
        }
      >
        <form id="form-nuevo-presupuesto" onSubmit={handleCrearPresupuesto} className="space-y-3">
          <Field label="Nombre" required value={prNombre} onChange={(e) => setPrNombre(e.target.value)} placeholder="Ej: Presupuesto Ordinario 2026" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Año" type="number" required value={prAnio} onChange={(e) => setPrAnio(e.target.value)} />
            <Field label="Tipo" as="select" value={prTipo} onChange={(e) => setPrTipo(e.target.value)}>
              <option value="ordinario">Ordinario</option>
              <option value="extraordinario">Extraordinario (obra, derrama…)</option>
            </Field>
          </div>
          {prTipo === 'ordinario' && (
            <p className="text-4xs text-slate-500">El fondo de reserva se mide contra el último presupuesto ordinario: debe ser al menos el 10 % (art. 9.1.f LPH).</p>
          )}

          <div className="space-y-2">
            <p className="text-5xs font-black uppercase tracking-widest text-slate-400">Partidas</p>
            {prPartidas.map((pa, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={pa.nombre} placeholder="Ej: Limpieza"
                  onChange={(e) => setPrPartidas((l) => l.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                  className="flex-grow bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-3xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="number" step="0.01" min="0" value={pa.importe} placeholder="€"
                  onChange={(e) => setPrPartidas((l) => l.map((x, j) => (j === i ? { ...x, importe: e.target.value } : x)))}
                  className="w-28 bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-3xs text-slate-200 text-right focus:outline-none focus:border-blue-500"
                />
                <button type="button" onClick={() => setPrPartidas((l) => (l.length > 1 ? l.filter((_, j) => j !== i) : [{ nombre: '', importe: '' }]))} className="p-1.5 text-slate-500 hover:text-rose-400" title="Quitar partida">
                  <X size={12} />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setPrPartidas((l) => [...l, { nombre: '', importe: '' }])} className="flex items-center gap-1 text-4xs font-black uppercase tracking-wider text-blue-400">
              <Plus size={12} /> Añadir partida
            </button>
          </div>

          {partidasValidas.length > 0 ? (
            <p className="text-3xs text-slate-300">Total del presupuesto: <strong className="font-mono">{fmt(totalPartidas)} €</strong> (suma de las partidas)</p>
          ) : (
            <Field label="Importe total previsto (€) — si no lo desglosas en partidas" type="number" step="0.01" min="0.01" value={prImporte} onChange={(e) => setPrImporte(e.target.value)} placeholder="5000.00" />
          )}
          <Field label="Notas (opcional)" as="textarea" rows={2} value={prNotas} onChange={(e) => setPrNotas(e.target.value)} placeholder="Detalles adicionales" />
        </form>
      </Modal>

      {/* MODAL: NUEVA LIQUIDACIÓN */}
      <Modal
        open={modalLiqAbierto}
        onClose={() => setModalLiqAbierto(false)}
        icon={FileCheck2}
        title="Nueva Liquidación"
        subtitle="Cierre de un periodo — calcula y congela los totales"
        footer={
          <>
            <button type="button" onClick={() => setModalLiqAbierto(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-nueva-liquidacion" disabled={guardandoLiq} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              {guardandoLiq ? 'Calculando...' : 'Calcular y Cerrar'}
            </button>
          </>
        }
      >
        <form id="form-nueva-liquidacion" onSubmit={handleCrearLiquidacion} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inicio del Periodo" type="date" required value={lqInicio} onChange={(e) => setLqInicio(e.target.value)} />
            <Field label="Fin del Periodo" type="date" required value={lqFin} onChange={(e) => setLqFin(e.target.value)} />
          </div>
          <Field label="Notas (opcional)" as="textarea" rows={2} value={lqNotas} onChange={(e) => setLqNotas(e.target.value)} placeholder="Ej: Liquidación ordinaria del primer semestre" />
          <p className="text-4xs text-slate-500 leading-relaxed">
            Los totales de ingresos, gastos y saldo se calculan a partir de los movimientos registrados en ese periodo y quedan congelados — no se pueden editar después.
          </p>
        </form>
      </Modal>
    </div>
  );
}
