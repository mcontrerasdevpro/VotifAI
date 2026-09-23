import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Wallet, Plus, CreditCard, Trash2, Users, FileText, FileDown, Ban } from 'lucide-react';
import Card from '../../components/ui/Card.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Field from '../../components/ui/Field.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import ModalEmisionCuotas from '../../components/ModalEmisionCuotas.jsx';

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
  const [modalEmisionAbierto, setModalEmisionAbierto] = useState(false);
  const [avisoEmision, setAvisoEmision] = useState('');
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
  const [cobrosCuota, setCobrosCuota] = useState([]);
  const [modalCertificadoAbierto, setModalCertificadoAbierto] = useState(false);
  const [certPropietario, setCertPropietario] = useState('');
  const [certFinalidad, setCertFinalidad] = useState('');

  // Certificado de deuda (art. 9.1.e LPH): se abre el PDF en otra pestaña.
  const abrirCertificado = (e) => {
    e.preventDefault();
    if (!certPropietario) return;
    const finalidad = certFinalidad.trim() ? `?finalidad=${encodeURIComponent(certFinalidad.trim())}` : '';
    window.open(`/api/cuotas/certificado-deuda/${certPropietario}${finalidad}`, '_blank', 'noopener');
    setModalCertificadoAbierto(false);
    setCertPropietario('');
    setCertFinalidad('');
  };

  // Cobros ya registrados de la cuota abierta, para poder anular uno
  // registrado por error (también retira su ingreso de la contabilidad).
  const abrirCobros = async (c) => {
    setCuotaPago(c);
    setPagoImporte(Math.max(0, parseFloat(c.importe) - parseFloat(c.total_pagado)).toFixed(2));
    setCobrosCuota([]);
    try {
      const res = await fetch(`/api/cuotas/${c.id}/pagos`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setCobrosCuota(data.pagos || []);
    } catch (err) {
      console.error('Fallo al cargar los cobros:', err);
    }
  };

  const handleAnularCobro = async (pago) => {
    if (!window.confirm(`¿Anular el cobro de ${parseFloat(pago.importe).toFixed(2)} € del ${new Date(pago.fecha_pago).toLocaleDateString('es-ES')}? También se retirará su ingreso de la contabilidad.`)) return;
    const res = await fetch(`/api/cuotas/pagos/${pago.id}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || 'No se pudo anular el cobro.');
      return;
    }
    setCuotaPago(null);
    await refrescar();
  };

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

  // Borrar solo para una cuota creada por error y sin cobros; lo normal es
  // anularla, que la deja en el historial con su motivo.
  const handleEliminarCuota = async (id) => {
    if (!window.confirm('¿Borrar esta cuota? Hazlo solo si se creó por error: si no procede cobrarla, es mejor anularla para que quede en el historial.')) return;
    try {
      const respuesta = await fetch(`/api/cuotas/delete/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) alert(data.error || 'No se pudo borrar la cuota.');
      await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAnularCuota = async (c) => {
    const motivo = window.prompt(`Motivo de la anulación de "${c.concepto}${c.periodo ? ` (${c.periodo})` : ''}" de ${c.nombre_completo}:`);
    if (!motivo?.trim()) return;
    const todaLaEmision = Boolean(c.emision_id) && window.confirm('Esta cuota forma parte de una emisión a toda la comunidad. ¿Anular también el resto de cuotas de esa emisión que no tengan cobros?\n\nAceptar: anular toda la emisión · Cancelar: solo esta cuota');
    const respuesta = await fetch(`/api/cuotas/${c.id}/anular`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: motivo.trim(), toda_la_emision: todaLaEmision })
    });
    const data = await respuesta.json().catch(() => ({}));
    alert(respuesta.ok ? data.mensaje : data.error || 'No se pudo anular la cuota.');
    await refrescar();
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
    { key: 'estado', header: 'Estado', render: (c) => (
      <div>
        <StatusBadge light tone={TONOS_ESTADO[c.estado] || 'neutral'}>{ETIQUETAS_ESTADO[c.estado] || c.estado}</StatusBadge>
        {c.estado === 'anulada' && c.motivo_anulacion && <p className="mt-1 max-w-[12rem] text-[10px] text-slate-500">{c.motivo_anulacion}</p>}
      </div>
    ) },
    { key: 'acciones', header: 'Acciones', align: 'center', render: (c) => (
      <div className="flex items-center justify-center gap-2">
        {(c.estado === 'pendiente' || c.estado === 'parcial' || c.estado === 'impagada' || parseFloat(c.total_pagado) > 0) && (
          <button onClick={() => abrirCobros(c)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 hover:text-emerald-300" title={c.estado === 'pagada' ? 'Ver cobros' : 'Registrar pago'}>
            <CreditCard size={12} />
          </button>
        )}
        {c.estado !== 'anulada' && parseFloat(c.total_pagado) === 0 && (
          <button onClick={() => handleAnularCuota(c)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-400 hover:text-amber-300" title="Anular (queda en el historial)">
            <Ban size={12} />
          </button>
        )}
        {parseFloat(c.total_pagado) === 0 && (
          <button onClick={() => handleEliminarCuota(c.id)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300" title="Borrar (solo si se creó por error)">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    ) }
  ];

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center shrink-0">
        <h1 className="text-lg font-black text-white flex items-center gap-2">
          <Wallet className="text-blue-500" size={20} /> Cuotas y Morosidad
        </h1>
        <div className="flex gap-2">
          <button onClick={() => setModalCertificadoAbierto(true)} className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5">
            <FileText size={12} /> Certificado de deuda
          </button>
          <button onClick={() => setModalCuotaAbierto(true)} className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5">
            <Plus size={12} /> Cuota individual
          </button>
          <button onClick={() => setModalEmisionAbierto(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
            <Users size={12} /> Emitir a toda la comunidad
          </button>
        </div>
      </div>

      {avisoEmision && (
        <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-3xs font-bold text-emerald-300">{avisoEmision}</p>
      )}

      <ModalEmisionCuotas
        open={modalEmisionAbierto}
        onClose={() => setModalEmisionAbierto(false)}
        entityId={entidadId}
        propietarios={propietarios}
        onEmitida={async (mensaje) => {
          setModalEmisionAbierto(false);
          setAvisoEmision(mensaje);
          await refrescar();
        }}
      />

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

      {/* MODAL: CERTIFICADO DE DEUDA */}
      <Modal
        open={modalCertificadoAbierto}
        onClose={() => setModalCertificadoAbierto(false)}
        icon={FileText}
        title="Certificado de deuda"
        subtitle="Art. 9.1.e LPH — el que se exige en la venta de un piso o local"
        footer={
          <>
            <button type="button" onClick={() => setModalCertificadoAbierto(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-certificado" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all">Generar certificado</button>
          </>
        }
      >
        <form id="form-certificado" onSubmit={abrirCertificado} className="space-y-3">
          <Field label="Propietario" as="select" required value={certPropietario} onChange={(e) => setCertPropietario(e.target.value)}>
            <option value="">-- Selecciona un propietario --</option>
            {propietarios.map((p) => <option key={p.id} value={p.id}>{p.propiedad_detalle} — {p.nombre_completo}</option>)}
          </Field>
          <Field label="Finalidad (opcional)" value={certFinalidad} onChange={(e) => setCertFinalidad(e.target.value)} placeholder="Ej: la compraventa de la vivienda 2ºB" />
          <p className="text-4xs text-slate-500">Recoge las deudas vencidas (o que está al corriente) y, a título informativo, las cuotas emitidas aún no vencidas. Lleva firma del secretario-administrador y el visto bueno del presidente de la finca.</p>
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
            {cuotaPago?.estado !== 'pagada' && (
              <button type="submit" form="form-registrar-pago" disabled={guardandoPago} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
                {guardandoPago ? 'Registrando...' : 'Registrar Pago'}
              </button>
            )}
          </>
        }
      >
        {cobrosCuota.length > 0 && (
          <div className="mb-4 space-y-1.5">
            <p className="text-5xs font-black uppercase tracking-widest text-slate-400">Cobros registrados</p>
            {cobrosCuota.map((pg) => (
              <div key={pg.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2 text-3xs text-slate-300">
                <span>{new Date(pg.fecha_pago).toLocaleDateString('es-ES')} · {parseFloat(pg.importe).toFixed(2)} € · {pg.metodo_pago || '—'}{pg.referencia ? ` · ${pg.referencia}` : ''}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <a href={`/api/cuotas/pagos/${pg.id}/recibo`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300">
                    <FileDown size={11} /> Recibo
                  </a>
                  <button type="button" onClick={() => handleAnularCobro(pg)} className="text-[10px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300">Anular</button>
                </span>
              </div>
            ))}
          </div>
        )}
        {cuotaPago?.estado !== 'pagada' && (
        <form id="form-registrar-pago" onSubmit={handleRegistrarPago} className="space-y-3">
          <p className="text-4xs text-slate-500">El cobro se anotará automáticamente como ingreso en la contabilidad de la comunidad.</p>
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
        )}
      </Modal>
    </div>
  );
}
