import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, FileText, ArrowLeftRight, UserPlus, Scale, AlertCircle, RefreshCw, ClipboardList } from 'lucide-react';

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
                    {cargando ? (
                        <div className="h-full flex flex-col justify-center items-center text-4xs text-slate-500 font-bold uppercase tracking-widest animate-pulse gap-2">
                            <RefreshCw size={16} className="animate-spin text-blue-500" /> Sincronizando Censo Registral...
                        </div>
                    ) : vistaActiva === 'censo' ? (
                         /* ========================================================================= */
            /* VISTA A: TABLA DEL CENSO LEGAL ACTUALIZADO              */
            /* ========================================================================= */
            <table className="w-full text-left font-sans text-4xs">
              <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800 font-bold z-10">
                <tr>
                  <th className="py-2.5 px-3">Inmueble</th>
                  <th className="py-2.5 px-3">Titular Activo</th>
                  <th className="py-2.5 px-3">Medios de Contacto</th>
                  <th className="py-2.5 px-3 text-right">Coef.</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-slate-300">
                {propietarios && propietarios.length > 0 ? (
                  propietarios.map((v, index) => (
                    <tr key={v.id || `prop_${index}`} className="hover:bg-slate-900/30 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-blue-400">{v.propiedad_detalle || 'Vivienda'}</td>
                      <td className="py-2.5 px-3 text-white font-bold">{v.nombre_completo}</td>
                      <td className="py-2.5 px-3 space-y-0.5">
                        {v.telefono && <p className="text-slate-300 font-medium">📞 {v.telefono}</p>}
                        {v.email && <p className="text-slate-400 truncate max-w-[120px]">✉️ {v.email}</p>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-400">
                        {parseFloat(v.coeficiente || 5.00).toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
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
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-600 font-medium uppercase tracking-widest text-[9px]">
                      No hay propietarios dados de alta en esta comunidad.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
                    ) : (
                        /* ========================================================================= */
                        /* VISTA B: HISTORIAL INMUTABLE DE AUDITORÍA (CAMBIOS DE TITULAR)            */
                        /* ========================================================================= */
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
                                            <span className={`px-2 py-0.5 rounded font-black uppercase tracking-wider text-[8px] shrink-0 ${h.motivo_cambio === 'venta' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                h.motivo_cambio === 'alquiler' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                    'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                                }`}>
                                                {h.motivo_cambio}
                                            </span>
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

            {/* FORMULARIO FLOTANTE ANIMADO: TRAMITACIÓN DE CAMBIO DE TITULARIDAD */}
      <AnimatePresence>
        {propietarioSustituir && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleTramitarCambioTitular}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl overflow-hidden"
            >
              <div>
                <h2 className="text-sm font-black text-white flex items-center gap-2">
                  <Scale size={16} className="text-blue-500" /> Modificar Datos de Vivienda
                </h2>
                <p className="text-5xs text-slate-400 mt-1 uppercase tracking-wider">
                  Traspaso de Propiedad: <span className="text-white font-bold">{propietarioSustituir.propiedad_detalle}</span>
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-5xs font-bold text-slate-400 uppercase tracking-widest">Nombre del Nuevo Propietario</label>
                  <input type="text" required value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500" placeholder="Ej: Francisco Gómez Ruiz" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-5xs font-bold text-slate-400 uppercase tracking-widest">Teléfono Móvil</label>
                    <input type="text" value={nuevoTelefono} onChange={(e) => setNuevoTelefono(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500" placeholder="Ej: +34600123456" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-5xs font-bold text-slate-400 uppercase tracking-widest">Correo Electrónico</label>
                    <input type="email" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500" placeholder="Ej: nuevo@correo.com" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-5xs font-bold text-slate-400 uppercase tracking-widest">Motivo Legal del Traspaso</label>
                  <select value={motivoCambio} onChange={(e) => setMotivoCambio(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500">
                    <option value="venta">🔑 Venta / Compraventa</option>
                    <option value="alquiler">📋 Alquiler / Arrendamiento</option>
                    <option value="cesion">🤝 Cesión de Propiedad</option>
                    <option value="herencia">📜 Herencia / Sucesión</option>
                    <option value="otro">⚙️ Otro Motivo</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-5xs font-bold text-slate-400 uppercase tracking-widest">Detalles Adicionales y Notas de Auditoría</label>
                  <textarea value={detalles} onChange={(e) => setDetalles(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 h-16 resize-none" placeholder="Ej: Escritura firmada ante Notario..." />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800/60">
                <button type="button" onClick={() => setPropietarioSustituir(null)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900 transition-colors hover:text-white">Cancelar</button>
                <button type="submit" disabled={procesandoTransaccion} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
                  {procesandoTransaccion ? 'Inscribiendo...' : 'Inscribir Traspaso'}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* 👤 MODAL FLOTANTE ANIMADO: ALTA INICIAL DE VECINOS EN EL CENSO */}
      <AnimatePresence>
        {mostrarModalAlta && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleRegistrarPropietarioInicial}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl"
            >
              <div>
                <h2 className="text-sm font-black text-white flex items-center gap-2">
                  <UserPlus size={16} className="text-blue-500" /> Inscribir Propietario Inicial
                </h2>
                <p className="text-5xs text-slate-400 mt-1 uppercase tracking-wider">Alta directa en libro de censo</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-5xs font-bold text-slate-400 uppercase tracking-widest">Nombre y Apellidos</label>
                  <input type="text" required value={altaNombre} onChange={(e) => setAltaNombre(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500" placeholder="Ej: Juan Pérez Gómez" />
                </div>
                <div className="space-y-1">
                  <label className="block text-5xs font-bold text-slate-400 uppercase tracking-widest">Vivienda / Propiedad</label>
                  <input type="text" required value={altaDireccion} onChange={(e) => setAltaDireccion(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500" placeholder="Ej: Piso 1ºB o Local Izquierdo" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-5xs font-bold text-slate-400 uppercase tracking-widest">Teléfono Móvil</label>
                    <input type="text" value={altaTelefono} onChange={(e) => setAltaTelefono(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500" placeholder="+34600000000" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-5xs font-bold text-slate-400 uppercase tracking-widest">Email de Notificación</label>
                    <input type="email" value={altaEmail} onChange={(e) => setAltaEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500" placeholder="vecino@correo.com" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-5xs font-bold text-slate-400 uppercase tracking-widest">Coeficiente de Participación (%)</label>
                  <input type="number" step="0.01" min="0.01" max="100" required value={altaCoeficiente} onChange={(e) => setAltaCoeficiente(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500" placeholder="5.00" />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800/60">
                <button type="button" onClick={() => setMostrarModalAlta(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900 transition-colors hover:text-white">Cancelar</button>
                <button type="submit" disabled={guardandoAlta} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
                  {guardandoAlta ? 'Inscribiendo...' : 'Registrar Vecino'}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}