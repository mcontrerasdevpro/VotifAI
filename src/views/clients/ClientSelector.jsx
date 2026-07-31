import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVotifaiStore } from '../../store.jsx';
import { Building2, Search, Plus, FolderOpen, LogOut, Users, UserPlus, Scale } from 'lucide-react';
import CensoPropietarios from '../../components/CensoPropietarios.jsx';

export default function ClientSelector() {
  const navigate = useNavigate();
  const { state, dispatch } = useVotifaiStore() || { state: { tenant: null }, dispatch: () => { } };

  const [busqueda, setBusqueda] = useState('');
  const [comunidadesReales, setComunidadesReales] = useState([]);
  const [entidadSeleccionada, setEntidadSeleccionada] = useState(null);
  const [cargandoFincas, setCargandoFincas] = useState(true);

  const [mostrarModalDelegar, setMostrarModalDelegar] = useState(false);
  const [vecinoIdDelegante, setVecinoIdDelegante] = useState('');
  const [representanteNombre, setRepresentanteNombre] = useState('Presidente (Voto Delegado)');

  const [editandoFinca, setEditandoFinca] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editCif, setEditCif] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editPresidente, setEditPresidente] = useState('');
  const [editTesorero, setEditTesorero] = useState('');

  const tenantIdActual = state.tenant?.tenantId || state.tenant?.id;
  const adminGlobal = state.tenant?.admin;
  const nombreDespacho = adminGlobal?.despacho || state.tenant?.nombreEntidad || "Mi Despacho SaaS";
  useEffect(() => {
    if (entidadSeleccionada) {
      setEditNombre(entidadSeleccionada.nombre || '');
      setEditCif(entidadSeleccionada.cif || '');
      setEditDireccion(entidadSeleccionada.direccion || '');

      let metadatos = {};
      if (entidadSeleccionada.metadatos_legales) {
        try {
          metadatos = typeof entidadSeleccionada.metadatos_legales === 'string'
            ? JSON.parse(entidadSeleccionada.metadatos_legales)
            : entidadSeleccionada.metadatos_legales;
        } catch (e) { console.error(e); }
      }

      setEditPresidente(metadatos.presidente || 'D. Manuel Contreras Jaén');
      setEditTesorero(metadatos.tesorero || 'Dª. Carmen Ortiz Sanz');
      setEditandoFinca(false);
    }
  }, [entidadSeleccionada]);

  useEffect(() => {
    const cargarFincasDesdeNeon = async () => {
      if (!tenantIdActual) { setCargandoFincas(false); return; }
      try {
        const respuesta = await fetch(`/api/entities/${tenantIdActual}`);
        const datosServidor = await respuesta.json();

        if (respuesta.ok && datosServidor) {
          let listaFincasRAW = [];
          if (Array.isArray(datosServidor)) {
            listaFincasRAW = datosServidor;
          } else if (typeof datosServidor === 'object') {
            listaFincasRAW = datosServidor.fincas || datosServidor.entities || datosServidor.comunidadesYEmpresas || [];
          }

          const fincasEstructuradas = listaFincasRAW.map(f => ({
            id: f.id || f.entityId,
            nombre: f.nombre || f.nombre_entidad || 'Finca sin nombre',
            tipo: f.tipo || 'comunidad',
            cif: f.cif || 'H-00000000',
            direccion: f.direccion || 'Dirección Registrada',
            estado: 'Junta Programada — HOY 18:00',
            propietarios: Array.from({ length: 20 }, (_, i) => ({
              id: `vtr_${i + 1}`,
              nombre: ["Manuel Contreras", "Carmen Ortiz", "Juan Pérez", "Ana Gómez", "Carlos Ruiz", "María José", "David León", "Laura Sanz", "Antonio López", "Elena G.", "Francisco B.", "Lucia M.", "Javier P.", "Isabel D.", "Miguel A.", "Sonia V.", "Pedro C.", "Nuria F.", "Diego R.", "Raquel H."][i] || `Vecino ${i + 1}`,
              propiedad: `Piso ${Math.floor(i / 4) + 1}º${["A", "B", "C", "D"][i % 4]}`,
              email: `vecino_${i + 1}@correo.com`,
              telefono: `+34 600 123 0${i + 1}`,
              coeficiente: "5.00",
              representative: null
            }))
          }));

          setComunidadesReales(fincasEstructuradas);
          if (fincasEstructuradas.length > 0) setEntidadSeleccionada(fincasEstructuradas[0]);
        }
      } catch (error) {
        console.error("Fallo crítico de lectura en el catálogo:", error);
      } finally {
        setCargandoFincas(false);
      }
    };
    cargarFincasDesdeNeon();
  }, [tenantIdActual]);

  const entidadesFiltradas = comunidadesReales.filter(e =>
    e.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );
  const handleRegistrarDelegacion = (e) => {
    e.preventDefault();
    if (!vecinoIdDelegante) return;

    const censoActualizado = entidadSeleccionada.propietarios.map(v =>
      v.id === vecinoIdDelegante ? { ...v, representative: representanteNombre } : v
    );

    const fincaActualizada = { ...entidadSeleccionada, propietarios: censoActualizado };
    setEntidadSeleccionada(fincaActualizada);
    setComunidadesReales(prev => prev.map(c => c.id === entidadSeleccionada.id ? fincaActualizada : c));
    setMostrarModalDelegar(false);
    setVecinoIdDelegante('');
  };

  const handleGuardarCambiosFinca = async () => {
    if (!entidadSeleccionada) return;
    const payload = {
      id: entidadSeleccionada.id,
      nombre: editNombre,
      cif: editCif,
      direccion: editDireccion,
      presidente: editPresidente,
      tesorero: editTesorero
    };

    try {
      const respuesta = await fetch('/api/entities/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!respuesta.ok) return;
      const resultado = await respuesta.json();

      if (resultado.success) {
        setEntidadSeleccionada({
          ...entidadSeleccionada,
          nombre: editNombre, cif: editCif, direccion: editDireccion,
          metadatos_legales: { presidente: editPresidente, tesorero: editTesorero }
        });
        setComunidadesReales(prev => prev.map(c => c.id === entidadSeleccionada.id ? { ...c, nombre: editNombre, cif: editCif, direccion: editDireccion, metadatos_legales: { presidente: editPresidente, tesorero: editTesorero } } : c));
        setEditandoFinca(false);
        alert("✓ Expediente de Gobernanza actualizado correctamente.");
      }
    } catch (error) { console.error(error); }
  };

  const handleDispararConvocatoria = async () => {
    if (!entidadSeleccionada) return;
    const payload = {
      fincaId: entidadSeleccionada.id,
      nombreFinca: entidadSeleccionada.nombre,
      propietarios: entidadSeleccionada.propietarios || []
    };

    try {
      const respuesta = await fetch('/api/notifications/convocar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const resultado = await respuesta.json();

      if (respuesta.ok && resultado.success) {
        alert(`⚡ Sistema de Notificaciones VotifAI:\n\n${resultado.mensaje}`);
      } else {
        alert(`❌ Error en la pasarela: ${resultado.error || 'No se pudo despachar la campaña.'}`);
      }
    } catch (error) {
      console.error("Error al despachar las notificaciones:", error);
      alert("❌ Fallo de red: El servidor unificado no responde.");
    }
  };

  const handleSubirPDFOriginal = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo || !entidadSeleccionada) return;

    const lector = new FileReader();
    lector.readAsDataURL(archivo);
    lector.onloadend = async () => {
      const base64Limpio = lector.result;
      try {
        const respuesta = await fetch('/api/entities/upload-pdf', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityId: entidadSeleccionada.id, pdfBase64: base64Limpio })
        });
        if (respuesta.ok) {
          alert("✓ Documento PDF original digitalizado y sincronizado en la nube.");
          setEntidadSeleccionada({ ...entidadSeleccionada, documento_adjunto: base64Limpio });
        }
      } catch (err) { console.error("Fallo al subir acta original:", err); }
    };
  };

  const handleEliminarFinca = async () => {
    if (!entidadSeleccionada) return;

    const confirmacion = window.confirm(
      `⚠️ ADVERTENCIA LEGAL (VotifAI)\n\n¿Desea eliminar la entidad "${entidadSeleccionada.nombre}"?\n\nEsta acción destruirá el censo de propietarios y los datos en Neon Cloud.`
    );

    if (!confirmacion) return;

    try {
      const respuesta = await fetch(`/api/entities/delete/${entidadSeleccionada.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (respuesta.ok) {
        alert("✓ Entidad eliminada correctamente de la base de datos.");
        const listaLimpia = comunidadesReales.filter(c => c.id !== entidadSeleccionada.id);
        setComunidadesReales(listaLimpia);
        setEntidadSeleccionada(listaLimpia.length > 0 ? listaLimpia[0] : null);
      } else {
        alert("❌ Error: No se ha podido completar la purga de la entidad.");
      }
    } catch (error) {
      console.error("Fallo de red en la purga registral:", error);
      alert("❌ Error de red: El servidor de aislamiento no responde.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col h-screen overflow-hidden">

      {/* HEADER SUPERIOR PANORÁMICO */}
      <header className="border-b border-slate-900 bg-slate-950 px-6 py-4 flex justify-between items-center shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white"><FolderOpen size={20} /></div>
          <div>
            <h1 className="text-sm font-black text-white">{nombreDespacho}</h1>
            <p className="text-4xs uppercase tracking-widest text-slate-500 font-bold">Consola Maestro de Gestión de Carteras</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {adminGlobal?.nombre && (
            <span className="text-4xs font-mono bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1.5 rounded-lg">
              👤 {adminGlobal.nombre}
            </span>
          )}
          <button
            onClick={() => navigate('/alta-finca')}
            className="bg-blue-600 hover:bg-blue-500 transition-colors text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md"
          >
            Dar de Alta Nueva Finca
          </button>
          <button onClick={() => { dispatch({ type: 'CERRAR_SESION' }); navigate('/'); }} className="p-2.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl hover:text-white transition-colors"><LogOut size={14} /></button>
        </div>
      </header>

      {/* CUERPO TRES COLUMNAS PANORÁMICO */}
      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden p-4 gap-4">

        {/* COLUMNA 1: LISTADO Y FILTRADO LATERAL DE FINCAS */}
        <div className="w-full lg:flex-grow bg-slate-900/30 border border-slate-900 rounded-2xl p-4 flex flex-col h-full overflow-hidden">
          <div className="relative bg-slate-950 p-1 rounded-2xl border border-slate-900 mb-4 shrink-0">
            <Search className="absolute left-4 top-4 text-slate-500" size={16} />
            <input type="text" placeholder="Filtrar por dirección o nombre de finca..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full bg-slate-900 border border-transparent rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-200 focus:outline-none" />
          </div>

          <div className="space-y-2 overflow-y-auto flex-grow pr-1 custom-scrollbar">
            {cargandoFincas ? (
              <div className="text-center py-8 text-4xs text-slate-500 font-bold uppercase tracking-wider">Interrogando a Neon Cloud...</div>
            ) : entidadesFiltradas.length > 0 ? (
              entidadesFiltradas.map((entidad) => (
                <div key={entidad.id} onClick={() => setEntidadSeleccionada(entidad)} className={`p-4 rounded-xl border flex flex-col gap-3 cursor-pointer transition-all ${entidadSeleccionada?.id === entidad.id ? 'bg-blue-600/10 border-blue-500' : 'bg-slate-950 border-slate-900'}`}>
                  <div className="flex justify-between text-4xs font-mono text-slate-500"><span>📍 Finca Activa</span><span>CENSO: {entidad.propietarios?.length || 0}</span></div>
                  <h3 className="text-xs font-bold text-white">{entidad.nombre}</h3>
                  <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-4xs">
                    <span className="text-amber-400 font-bold">{entidad.estado}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/${entidad.id}`); }}
                      className="bg-blue-600 hover:bg-blue-500 transition-colors px-3 py-1.5 rounded-xl text-white text-5xs font-black uppercase tracking-wider shadow-md"
                    >
                      Entrar a Sala ➔
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-4xs text-slate-500 font-bold tracking-wider">No se han encontrado fincas registradas.</div>
            )}
          </div>
        </div>
        {/* COLUMNA 2: EXPEDIENTE E INFORMACIÓN REAL DE LA FINCA SELECCIONADA */}
        <div className="w-full lg:w-7/12 bg-slate-950/40 border border-slate-900 rounded-2xl p-5 flex flex-col h-full overflow-hidden justify-between">
          {entidadSeleccionada ? (
            <div className="flex flex-col h-full overflow-hidden justify-between">
              <div className="flex flex-col flex-grow overflow-hidden">

                {/* CABECERA DEL EXPEDIENTE CON BOTÓN DE EDICIÓN EN CALIENTE */}
                 <div className="border-b border-slate-900 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                  {/* Bloque Izquierdo: Identificación e Título */}
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5">
                      <Users size={14} className="text-blue-500" /> Expediente y Censo de la Finca
                    </h3>
                    <p className="text-4xs text-blue-400 font-mono mt-0.5 uppercase tracking-wider">
                      {editandoFinca ? "Modificando Registro en Neon Cloud" : entidadSeleccionada.nombre}
                    </p>
                  </div>

                  {/* Bloque Derecho: Agrupación Estratégica de Botones */}
                  <div className="flex flex-wrap items-center gap-1.5 justify-start md:justify-end">
                    
                    {/* Grupo A: Gestión Documental y Datos */}
                    <div className="flex items-center bg-slate-900/60 p-1 rounded-xl border border-slate-900 gap-1">
                      <label className="bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white text-5xs font-black px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer">
                        <Plus size={10} className="text-blue-400" /> PDF
                        <input type="file" accept="application/pdf" onChange={handleSubirPDFOriginal} className="hidden" />
                      </label>

                      {editandoFinca ? (
                        <>
                          <button type="button" onClick={() => setEditandoFinca(false)} className="bg-slate-950 text-slate-400 hover:text-white text-5xs font-black px-2.5 py-1.5 rounded-lg transition-all uppercase">
                            X
                          </button>
                          <button type="button" onClick={handleGuardarCambiosFinca} className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-5xs font-black px-2.5 py-1.5 rounded-lg transition-all uppercase font-bold">
                            💾 Guardar
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setEditandoFinca(true)} className="bg-slate-950 text-slate-400 hover:text-white text-5xs font-black px-2.5 py-1.5 rounded-lg transition-colors uppercase">
                          ✏️ Editar
                        </button>
                      )}
                    </div>

                    {/* Grupo B: Trámites Jurídicos de Asamblea */}
                    <div className="flex items-center bg-slate-900/60 p-1 rounded-xl border border-slate-900 gap-1">
                      <button type="button" onClick={() => alert("Pasarela de representación activa")} className="bg-slate-950 text-purple-400 hover:text-purple-300 text-5xs font-black px-2.5 py-1.5 rounded-lg transition-colors uppercase flex items-center gap-1">
                        👤 Representación
                      </button>
                      
                      <button type="button" onClick={() => alert("Enviando convocatoria masiva por WA...")} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black px-2.5 py-1.5 rounded-lg transition-colors uppercase flex items-center gap-1 font-bold shadow-md shadow-blue-600/10">
                        📞 Convocar WA
                      </button>
                    </div>

                    {/* Acción Crítica: Eliminar (Aislado para evitar clics accidentales) */}
                    {!editandoFinca && (
                      <button type="button" onClick={handleEliminarFinca} className="bg-rose-950/20 border border-rose-900/40 hover:bg-rose-900 text-rose-400 hover:text-white text-5xs font-black px-2.5 py-1.5 rounded-lg transition-colors">
                        🗑️
                      </button>
                    )}

                  </div>
                </div>

                {/* FORMULARIO DE EDICIÓN O VISOR EN CALIENTE */}
                <div className="my-3 shrink-0">
                  {editandoFinca ? (
                    <div className="bg-slate-900/60 border border-blue-500/30 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-lg">
                      <div className="sm:col-span-3">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre Comercial de la Finca</label>
                        <input type="text" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none font-bold" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Código CIF Legal</label>
                        <input type="text" value={editCif} onChange={(e) => setEditCif(e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-200 font-mono focus:outline-none uppercase" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Dirección Postal / Sede</label>
                        <input type="text" value={editDireccion} onChange={(e) => setEditDireccion(e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-slate-900/50 border border-slate-900 p-3 rounded-xl shadow-inner">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Código CIF Legal</span>
                        <p className="text-3xs font-mono font-bold text-slate-200 mt-1 uppercase">{entidadSeleccionada?.cif || "H-00000000"}</p>
                      </div>
                      <div className="bg-slate-900/50 border border-slate-900 p-3 rounded-xl shadow-inner sm:col-span-2">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Dirección de la Propiedad</span>
                        <p className="text-3xs font-medium text-slate-200 mt-1 truncate">{entidadSeleccionada?.direccion || "Calle no especificada"}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* TABLA DEL CENSO LEGAL */}
                <CensoPropietarios
                  fincaId={entidadSeleccionada?.id}
                  nombreFinca={entidadSeleccionada?.nombre}
                />

              </div>

              {/* PIE METRIFICADO DINÁMICO */}
              <div className="text-5xs text-slate-500 font-bold border-t border-slate-900 pt-3 flex justify-between uppercase shrink-0">
                <span>Régimen General: Art. 17 LPH</span>
                <span className="text-blue-500 font-mono font-black">
                  Suma Coeficientes: {(entidadSeleccionada?.propietarios?.reduce((acc, v) => acc + parseFloat(v.coeficiente), 0) || 100).toFixed(2)}%
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center h-full text-slate-500 p-6">
              <Building2 size={32} className="text-slate-700 animate-pulse" />
              <h3 className="text-3xs font-black uppercase text-slate-500 mt-2 tracking-widest">Visor Inactivo</h3>
              <p className="text-5xs text-slate-600 mt-1 max-w-[180px]">Selecciona una finca para interrogar sus credenciales.</p>
            </div>
          )}
        </div>
      </div>

      {/* 🗳️ MODAL DE GESTIÓN DE VOTO DELEGADO ANTICIPADO */}
      {mostrarModalDelegar && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleRegistrarDelegacion} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-2">
                <Scale size={16} className="text-blue-500" /> Otorgar Representación Legal
              </h2>
              <p className="text-5xs text-slate-400 mt-1 uppercase tracking-wider">Delegación Anticipada de Cuotas</p>
            </div>
            <div>
              <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Seleccionar Propietario Ausente</label>
              <select
                required
                value={vecinoIdDelegante}
                onChange={(e) => setVecinoIdDelegante(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Elige un vecino --</option>
                {entidadSeleccionada?.propietarios?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.propiedad} - {v.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-4xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nombre del Apoderado / Representante</label>
              <input
                type="text"
                required
                value={representanteNombre}
                onChange={(e) => setRepresentanteNombre(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMostrarModalDelegar(false)}
                className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-xs font-bold"
              >
                Emitir Apoderamiento
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}