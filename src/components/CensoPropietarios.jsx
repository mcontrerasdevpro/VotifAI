import React, { useState, useEffect } from 'react';
import { Users, ArrowLeftRight, UserPlus, Scale, ClipboardList } from 'lucide-react';
import DataTable from './ui/DataTable.jsx';
import StatusBadge from './ui/StatusBadge.jsx';
import Modal from './ui/Modal.jsx';
import Field from './ui/Field.jsx';

const TONO_MOTIVO = {
    venta: 'success',
    alquiler: 'warning'
};

export default function CensoPropietarios({ fincaId, nombreFinca }) {
    const [propietarios, setPropietarios] = useState([]);
    const [historial, setHistorial] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [vistaActiva, setVistaActiva] = useState('censo');

    const [mostrarModalAlta, setMostrarModalAlta] = useState(false);
    const [altaNombre, setAltaNombre] = useState('');
    const [altaDni, setAltaDni] = useState('');
    const [altaDireccion, setAltaDireccion] = useState('');
    const [altaTelefono, setAltaTelefono] = useState('');
    const [altaEmail, setAltaEmail] = useState('');
    const [altaCoeficiente, setAltaCoeficiente] = useState('5.00');
    const [guardandoAlta, setGuardandoAlta] = useState(false);

    const [propietarioSustituir, setPropietarioSustituir] = useState(null);
    const [nuevoNombre, setNuevoNombre] = useState('');
    const [nuevoDni, setNuevoDni] = useState('');
    const [nuevoTelefono, setNuevoTelefono] = useState('');
    const [nuevoEmail, setNuevoEmail] = useState('');
    const [motivoCambio, setMotivoCambio] = useState('venta');
    const [detalles, setDetalles] = useState('');
    const [procesandoTransaccion, setProcesandoTransaccion] = useState(false);

    const consultarCensoNeon = async () => {
        if (!fincaId) return;
        setCargando(true);
        try {
            const res = await fetch(`/api/propietarios/lista/${fincaId}`);
            const data = await res.json();
            if (res.ok) {
                setPropietarios(data.propietarios || []);
                setHistorial(data.historial || []);
            }
        } catch (err) {
            console.error("Fallo al recuperar censo:", err);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        consultarCensoNeon();
    }, [fincaId]);

    const handleTramitarCambioTitular = async (e) => {
        e.preventDefault();
        if (!propietarioSustituir || !nuevoNombre || !nuevoDni || !motivoCambio) return;

        if (!nuevoTelefono && !nuevoEmail) {
            alert("❌ Error de Normativa LPH:\n\nEl nuevo titular debe disponer obligatoriamente de al menos un método de contacto (Teléfono o Correo electrónico).");
            return;
        }

        setProcesandoTransaccion(true);

        const payload = {
            propietario_id: propietarioSustituir.id,
            nuevo_nombre: nuevoNombre,
            nuevo_dni: nuevoDni,
            nuevo_telefono: nuevoTelefono,
            nuevo_email: nuevoEmail,
            nuevo_direccion: propietarioSustituir.direccion_postal,
            motivo_cambio: motivoCambio,
            detalles: detalles
        };

        try {
            const respuesta = await fetch('/api/propietarios/cambio-titular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const resultado = await respuesta.json();

            if (respuesta.ok && resultado.success) {
                alert("✓ Cambio de titularidad procesado e inscrito con éxito en Neon Cloud.");

                setPropietarioSustituir(null);
                setNuevoNombre('');
                setNuevoDni('');
                setNuevoTelefono('');
                setNuevoEmail('');
                setDetalles('');

                await consultarCensoNeon();
            } else {
                alert(`❌ Error en la pasarela: ${resultado.error || 'No se pudo completar el trámite.'}`);
            }
        } catch (error) {
            console.error("Fallo al tramitar el cambio de titularidad:", error);
            alert("❌ Fallo de red: El servidor de aislamiento no responde.");
        } finally {
            setProcesandoTransaccion(false);
        }
    };

    const handleRegistrarPropietarioInicial = async (e) => {
        e.preventDefault();
        if (!altaNombre || !altaDireccion || !altaCoeficiente) return;

        if (!altaTelefono && !altaEmail) {
            alert("❌ Error de Normativa LPH:\n\nDebe facilitar obligatoriamente un Teléfono o un Correo electrónico.");
            return;
        }

        setGuardandoAlta(true);

        const payload = {
            entity_id: fincaId,
            nombre_completo: altaNombre,
            direccion_postal: altaDireccion,
            telefono: altaTelefono || null,
            email: altaEmail || null,
            coeficiente: parseFloat(altaCoeficiente)
        };

        try {
            const res = await fetch('/api/propietarios/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok && data.success) {
                alert("✓ Propietario inscrito correctamente en el censo legal.");
                setMostrarModalAlta(false);
                setAltaNombre(''); setAltaDireccion(''); setAltaTelefono(''); setAltaEmail(''); setAltaCoeficiente('5.00');
                if (typeof setAltaDni === 'function') setAltaDni('');
                await consultarCensoNeon();
            } else {
                alert(`❌ Error: ${data.error || 'No se pudo registrar.'}`);
            }
        } catch (err) {
            console.error(err);
            alert("❌ Error de red con Neon Cloud.");
        } finally {
            setGuardandoAlta(false);
        }
    };

    const columnasCenso = [
        {
            key: 'inmueble', header: 'Inmueble',
            render: (v) => <span className="font-bold text-blue-400">{v.propiedad_detalle || 'Vivienda'}</span>
        },
        {
            key: 'titular', header: 'Titular Activo',
            render: (v) => <span className="text-white font-bold">{v.nombre_completo}</span>
        },
        {
            key: 'contacto', header: 'Medios de Contacto',
            render: (v) => (
                <div className="space-y-0.5">
                    {v.telefono && <p className="text-slate-300 font-medium">📞 {v.telefono}</p>}
                    {v.email && <p className="text-slate-400 truncate max-w-[120px]">✉️ {v.email}</p>}
                </div>
            )
        },
        {
            key: 'coeficiente', header: 'Coef.', align: 'right',
            render: (v) => <span className="font-black text-emerald-400">{parseFloat(v.coeficiente || 5.00).toFixed(2)}%</span>
        },
        {
            key: 'acciones', header: 'Acciones', align: 'center',
            render: (v) => (
                <button
                    type="button"
                    onClick={() => {
                        setPropietarioSustituir(v);
                        setNuevoNombre('');
                        setNuevoTelefono('');
                        setNuevoEmail('');
                    }}
                    className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-blue-400 hover:text-blue-300 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 mx-auto shadow-sm"
                >
                    <ArrowLeftRight size={10} /> Traspasar
                </button>
            )
        }
    ];

    return (
        <div className="flex flex-col h-full overflow-hidden justify-between">
            <div className="flex flex-col flex-grow overflow-hidden">

                {/* PESTAÑAS DE CONTROL DE VISTA + BOTÓN ALTA INICIAL */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4 shrink-0 justify-between sm:items-center">
                    <div className="flex gap-2 bg-slate-950 p-1 rounded-xl border border-slate-900 flex-grow max-w-md">
                        <button
                            type="button"
                            onClick={() => setVistaActiva('censo')}
                            className={`flex-1 py-2 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${vistaActiva === 'censo' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'
                                }`}
                        >
                            <Users size={12} /> Censo Activo
                        </button>
                        <button
                            type="button"
                            onClick={() => setVistaActiva('historial')}
                            className={`flex-1 py-2 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${vistaActiva === 'historial' ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-400'
                                }`}
                        >
                            <ClipboardList size={12} /> Auditoría de Titularidades
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => setMostrarModalAlta(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10 shrink-0 self-end sm:self-auto"
                    >
                        <UserPlus size={12} /> Añadir Propietario
                    </button>
                </div>

                {/* CONTENEDOR CENTRAL INTERACTIVO CON CONMUTACIÓN DE VISTAS */}
                <div className="flex-grow overflow-y-auto custom-scrollbar mb-3 border border-slate-900 rounded-xl bg-slate-950">
                    {vistaActiva === 'censo' ? (
                        /* VISTA A: TABLA DEL CENSO LEGAL ACTUALIZADO */
                        <DataTable
                            columns={columnasCenso}
                            data={propietarios}
                            loading={cargando}
                            loadingLabel="Sincronizando Censo Registral..."
                            emptyLabel="No hay propietarios dados de alta en esta comunidad."
                        />
                    ) : (
                        /* VISTA B: HISTORIAL INMUTABLE DE AUDITORÍA (CAMBIOS DE TITULAR) */
                        <div className="p-3 space-y-2.5">
                            {historial.length > 0 ? (
                                historial.map((h) => (
                                    <div key={h.historial_id} className="p-3 bg-slate-900/40 border border-slate-900 rounded-xl space-y-1.5 shadow-sm">
                                        <div className="flex justify-between items-center text-4xs font-mono">
                                            <span className="text-blue-400 font-bold">🏠 Propiedad: {h.direccion_postal}</span>
                                            <span className="text-slate-500">{new Date(h.fecha_cambio).toLocaleDateString('es-ES')}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-3xs font-medium py-1 border-y border-slate-900/60">
                                            <span className="text-rose-400 line-through truncate max-w-[120px]">{h.anterior_titular}</span>
                                            <ArrowLeftRight size={10} className="text-slate-600 shrink-0" />
                                            <span className="text-emerald-400 font-bold truncate max-w-[120px]">{h.nuevo_titular}</span>
                                        </div>
                                        <div className="flex justify-between items-start gap-4 text-4xs">
                                            <p className="text-slate-400 font-medium leading-relaxed">
                                                <span className="text-slate-500 font-bold uppercase tracking-wider">Detalles:</span> "{h.detalles}"
                                            </p>
                                            <StatusBadge tone={TONO_MOTIVO[h.motivo_cambio] || 'info'} className="shrink-0">
                                                {h.motivo_cambio}
                                            </StatusBadge>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 text-slate-600 font-medium text-4xs uppercase tracking-wider">
                                    No se registran variaciones de titularidad en el libro de actas.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {/* PIE METRIFICADO DE CUÓRUM LEGAL CRUZADO */}
            <div className="text-5xs text-slate-500 font-bold border-t border-slate-900 pt-3 flex justify-between uppercase shrink-0">
                <span>Régimen General: Art. 17 LPH — VotifAI</span>
                <span className="text-blue-500 font-mono font-black">
                    Suma Coeficientes Cruzados: {(propietarios.reduce((acc, v) => acc + parseFloat(v.coeficiente || 0), 0) || 100).toFixed(2)}%
                </span>
            </div>

            {/* FORMULARIO FLOTANTE: TRAMITACIÓN DE CAMBIO DE TITULARIDAD */}
            <Modal
                open={!!propietarioSustituir}
                onClose={() => setPropietarioSustituir(null)}
                icon={Scale}
                eyebrow={propietarioSustituir ? `Traspaso de Propiedad: ${propietarioSustituir.propiedad_detalle}` : ''}
                title="Modificar Datos de Vivienda"
                footer={
                    <>
                        <button type="button" onClick={() => setPropietarioSustituir(null)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900 transition-colors hover:text-white">Cancelar</button>
                        <button type="submit" form="form-cambio-titular" disabled={procesandoTransaccion} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
                            {procesandoTransaccion ? 'Inscribiendo...' : 'Inscribir Traspaso'}
                        </button>
                    </>
                }
            >
                <form id="form-cambio-titular" onSubmit={handleTramitarCambioTitular} className="space-y-3">
                    <Field label="Nombre del Nuevo Propietario" type="text" required value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Ej: Francisco Gómez Ruiz" />
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Teléfono Móvil" type="text" value={nuevoTelefono} onChange={(e) => setNuevoTelefono(e.target.value)} placeholder="Ej: +34600123456" />
                        <Field label="Correo Electrónico" type="email" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} placeholder="Ej: nuevo@correo.com" />
                    </div>
                    <Field as="select" label="Motivo Legal del Traspaso" value={motivoCambio} onChange={(e) => setMotivoCambio(e.target.value)}>
                        <option value="venta">🔑 Venta / Compraventa</option>
                        <option value="alquiler">📋 Alquiler / Arrendamiento</option>
                        <option value="cesion">🤝 Cesión de Propiedad</option>
                        <option value="herencia">📜 Herencia / Sucesión</option>
                        <option value="otro">⚙️ Otro Motivo</option>
                    </Field>
                    <Field as="textarea" label="Detalles Adicionales y Notas de Auditoría" value={detalles} onChange={(e) => setDetalles(e.target.value)} inputClassName="h-16" placeholder="Ej: Escritura firmada ante Notario..." />
                </form>
            </Modal>

            {/* MODAL: ALTA INICIAL DE VECINOS EN EL CENSO */}
            <Modal
                open={mostrarModalAlta}
                onClose={() => setMostrarModalAlta(false)}
                icon={UserPlus}
                eyebrow="Alta directa en libro de censo"
                title="Inscribir Propietario Inicial"
                footer={
                    <>
                        <button type="button" onClick={() => setMostrarModalAlta(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900 transition-colors hover:text-white">Cancelar</button>
                        <button type="submit" form="form-alta-propietario" disabled={guardandoAlta} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
                            {guardandoAlta ? 'Inscribiendo...' : 'Registrar Vecino'}
                        </button>
                    </>
                }
            >
                <form id="form-alta-propietario" onSubmit={handleRegistrarPropietarioInicial} className="space-y-3">
                    <Field label="Nombre y Apellidos" type="text" required value={altaNombre} onChange={(e) => setAltaNombre(e.target.value)} placeholder="Ej: Juan Pérez Gómez" />
                    <Field label="Vivienda / Propiedad" type="text" required value={altaDireccion} onChange={(e) => setAltaDireccion(e.target.value)} placeholder="Ej: Piso 1ºB o Local Izquierdo" />
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Teléfono Móvil" type="text" value={altaTelefono} onChange={(e) => setAltaTelefono(e.target.value)} placeholder="+34600000000" />
                        <Field label="Email de Notificación" type="email" value={altaEmail} onChange={(e) => setAltaEmail(e.target.value)} placeholder="vecino@correo.com" />
                    </div>
                    <Field label="Coeficiente de Participación (%)" type="number" step="0.01" min="0.01" max="100" required value={altaCoeficiente} onChange={(e) => setAltaCoeficiente(e.target.value)} placeholder="5.00" />
                </form>
            </Modal>

        </div>
    );
}
