import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Wallet, Plus, CreditCard, Trash2 } from 'lucide-react';
import Card from '../../components/ui/Card.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Field from '../../components/ui/Field.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';

const TONOS_ESTADO = {
  pendiente: 'neutral',
  parcial: 'warning',
  pagada: 'success',
  impagada: 'danger',
  anulada: 'neutral'
};

const ETIQUETAS_ESTADO = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  pagada: 'Pagada',
  impagada: 'Impagada',
  anulada: 'Anulada'
};

export default function Cuotas() {
  const { fincaId } = useParams();
  const entidadId = fincaId;

  const [cuotas, setCuotas] = useState([]);
  const [propietarios, setPropietarios] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [modalCuotaAbierto, setModalCuotaAbierto] = useState(false);
  const [guardandoCuota, setGuardandoCuota] = useState(false);
  const [propietarioId, setPropietarioId] = useState('');
  const [concepto, setConcepto] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [importe, setImporte] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');

  const [cuotaPago, setCuotaPago] = useState(null);
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [pagoImporte, setPagoImporte] = useState('');
  const [pagoMetodo, setPagoMetodo] = useState('transferencia');
  const [pagoReferencia, setPagoReferencia] = useState('');

  const refrescar = useCallback(async () => {
    try {
      const [resCuotas, resProp] = await Promise.all([
        fetch(`/api/cuotas/lista/${entidadId}`, { credentials: 'include' }),
        fetch(`/api/propietarios/lista/${entidadId}`, { credentials: 'include' })
      ]);
      const dataCuotas = await resCuotas.json();
      const dataProp = await resProp.json();
      if (resCuotas.ok) setCuotas(dataCuotas.cuotas || []);
      if (resProp.ok) setPropietarios(dataProp.propietarios || []);
    } catch (err) {
      console.error('Fallo al cargar cuotas:', err);
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

  const resetFormCuota = () => {
    setPropietarioId(''); setConcepto(''); setPeriodo(''); setImporte(''); setFechaVencimiento('');
  };

  const handleCrearCuota = async (e) => {
    e.preventDefault();
    if (!propietarioId || !concepto || !importe || !fechaVencimiento) return;

    setGuardandoCuota(true);
    try {
      const respuesta = await fetch('/api/cuotas/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          entity_id: entidadId,
          propietario_id: propietarioId,
          concepto,
          periodo,
          importe: parseFloat(importe),
          fecha_vencimiento: fechaVencimiento
        })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setModalCuotaAbierto(false);
        resetFormCuota();
        await refrescar();
      } else {
        alert(`❌ Error: ${resultado.error || 'No se pudo crear la cuota.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al crear la cuota.');
    } finally {
      setGuardandoCuota(false);
    }
  };

  const handleRegistrarPago = async (e) => {
    e.preventDefault();
    if (!cuotaPago || !pagoImporte) return;

    setGuardandoPago(true);
    try {
      const respuesta = await fetch(`/api/cuotas/${cuotaPago.id}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ importe: parseFloat(pagoImporte), metodo_pago: pagoMetodo, referencia: pagoReferencia })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setCuotaPago(null);
        setPagoImporte(''); setPagoMetodo('transferencia'); setPagoReferencia('');
        await refrescar();
      } else {
        alert(`❌ Error: ${resultado.error || 'No se pudo registrar el pago.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al registrar el pago.');
    } finally {
      setGuardandoPago(false);
    }
  };

  const handleEliminarCuota = async (id) => {
    if (!window.confirm('¿Eliminar esta cuota y todos sus pagos asociados?')) return;
    try {
      const respuesta = await fetch(`/api/cuotas/delete/${id}`, { method: 'DELETE', credentials: 'include' });
      if (respuesta.ok) await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const columnas = [
    { key: 'propietario', header: 'Propietario', render: (c) => (
      <div>
        <p className="font-bold text-slate-900">{c.nombre_completo}</p>
        <p className="text-slate-500 mt-0.5">{c.propiedad_detalle}</p>
      </div>
    ) },
    { key: 'concepto', header: 'Concepto', render: (c) => (
      <div>
        <p className="text-slate-700">{c.concepto}</p>
        {c.periodo && <p className="text-slate-500 mt-0.5">{c.periodo}</p>}
      </div>
    ) },
    { key: 'importe', header: 'Importe', align: 'right', render: (c) => (
      <div className="text-right">
        <p className="font-bold text-slate-900">{parseFloat(c.importe).toFixed(2)}€</p>
        {parseFloat(c.total_pagado) > 0 && parseFloat(c.total_pagado) < parseFloat(c.importe) && (
          <p className="text-emerald-600 mt-0.5">Pagado: {parseFloat(c.total_pagado).toFixed(2)}€</p>
        )}
      </div>
    ) },
    { key: 'fecha_vencimiento', header: 'Vencimiento', render: (c) => new Date(c.fecha_vencimiento).toLocaleDateString('es-ES') },
    { key: 'estado', header: 'Estado', render: (c) => <StatusBadge light tone={TONOS_ESTADO[c.estado] || 'neutral'}>{ETIQUETAS_ESTADO[c.estado] || c.estado}</StatusBadge> },
    { key: 'acciones', header: 'Acciones', align: 'center', render: (c) => (
      <div className="flex items-center justify-center gap-2">
        {(c.estado === 'pendiente' || c.estado === 'parcial' || c.estado === 'impagada') && (
          <button onClick={() => { setCuotaPago(c); setPagoImporte((parseFloat(c.importe) - parseFloat(c.total_pagado)).toFixed(2)); }} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 hover:text-emerald-300" title="Registrar pago">
          <CreditCard size={12} />
        </button>
        )}
        <button onClick={() => handleEliminarCuota(c.id)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300" title="Eliminar">
          <Trash2 size={12} />
        </button>
      </div>
    ) }
  ];

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center shrink-0">
        <h1 className="text-lg font-black text-white flex items-center gap-2">
          <Wallet className="text-blue-500" size={20} /> Cuotas y Morosidad
        </h1>
        <button onClick={() => setModalCuotaAbierto(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
          <Plus size={12} /> Nueva Cuota
        </button>
      </div>

      <Card className="flex-grow overflow-hidden" padding="p-0" light>
        <div className="h-full overflow-y-auto custom-scrollbar">
          <DataTable
            light
            columns={columnas}
            data={cuotas}
            loading={cargando}
            loadingLabel="Cargando cuotas..."
            emptyLabel="No hay cuotas emitidas todavía."
          />
        </div>
      </Card>

      {/* MODAL: NUEVA CUOTA */}
      <Modal
        open={modalCuotaAbierto}
        onClose={() => setModalCuotaAbierto(false)}
        icon={Wallet}
        title="Nueva Cuota"
        subtitle="Emitir un recibo a un propietario"
        footer={
          <>
            <button type="button" onClick={() => setModalCuotaAbierto(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-nueva-cuota" disabled={guardandoCuota} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              {guardandoCuota ? 'Creando...' : 'Crear Cuota'}
            </button>
          </>
        }
      >
        <form id="form-nueva-cuota" onSubmit={handleCrearCuota} className="space-y-3">
          <Field label="Propietario" as="select" required value={propietarioId} onChange={(e) => setPropietarioId(e.target.value)}>
            <option value="">-- Selecciona un propietario --</option>
            {propietarios.map(p => (
              <option key={p.id} value={p.id}>{p.propiedad_detalle} — {p.nombre_completo}</option>
            ))}
          </Field>
          <Field label="Concepto" required value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: Cuota ordinaria mensual" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Periodo (opcional)" value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ej: Marzo 2026" />
            <Field label="Importe (€)" type="number" step="0.01" min="0.01" required value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="50.00" />
          </div>
          <Field label="Fecha de vencimiento" type="date" required value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
        </form>
      </Modal>

      {/* MODAL: REGISTRAR PAGO */}
      <Modal
        open={!!cuotaPago}
        onClose={() => setCuotaPago(null)}
        icon={CreditCard}
        title="Registrar Pago"
        subtitle={cuotaPago ? `${cuotaPago.nombre_completo} — ${cuotaPago.concepto}` : ''}
        footer={
          <>
            <button type="button" onClick={() => setCuotaPago(null)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-registrar-pago" disabled={guardandoPago} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              {guardandoPago ? 'Registrando...' : 'Registrar Pago'}
            </button>
          </>
        }
      >
        <form id="form-registrar-pago" onSubmit={handleRegistrarPago} className="space-y-3">
          <Field label="Importe (€)" type="number" step="0.01" min="0.01" required value={pagoImporte} onChange={(e) => setPagoImporte(e.target.value)} />
          <Field label="Método de pago" as="select" value={pagoMetodo} onChange={(e) => setPagoMetodo(e.target.value)}>
            <option value="transferencia">Transferencia</option>
            <option value="domiciliacion">Domiciliación bancaria</option>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="otro">Otro</option>
          </Field>
          <Field label="Referencia (opcional)" value={pagoReferencia} onChange={(e) => setPagoReferencia(e.target.value)} placeholder="Ej: Nº de transferencia" />
        </form>
      </Modal>
    </div>
  );
}
