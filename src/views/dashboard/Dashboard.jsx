import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVotifaiStore } from '../../store.jsx';
import HeaderDashboard from '../../components/HeaderDashboard.jsx';
import SubNavContexto from '../../components/SubNavContexto.jsx';
import ColumnaOrdenDia from '../../components/ColumnaOrdenDia.jsx';
import ColumnaMonitorCentral from '../../components/ColumnaMonitorCentral.jsx';
import PanelEscrutinio from '../../components/PanelEscrutinio.jsx';
import ModalConvocatoria from '../../components/ModalConvocatoria.jsx';

export default function Dashboard() {
  const { fincaId } = useParams(); 
  const navigate = useNavigate();

  const { state, dispatch } = useVotifaiStore() || { state: { tenant: null, salaControl: {} } };
  const tenantGlobal = state?.tenant;
  const { jactiva, mercado, puntoActivo } = state?.salaControl || {};

  const [mostrarModalConvocatoria, setMostrarModalConvocatoria] = useState(false);
  const [datosAdmin, setDatosAdmin] = useState(null);
  const [fincaSeleccionada, setFincaSeleccionada] = useState(null);
  const [fincasReales, setFincasReales] = useState([]); 
  const [cargandoFincas, setCargandoFincas] = useState(true);

  const [modoAuditoria, setModoAuditoria] = useState(false);
  const [actaHistoricaTexto, setActaHistoricaTexto] = useState('');
  const [propietarioDestinatario, setPropietarioDestinatario] = useState('');
  const [reenviandoPush, setReenviandoPush] = useState(false);

  useEffect(() => {
    let idRealDeNeon = tenantGlobal?.tenantId || tenantGlobal?.id;
    if (!idRealDeNeon) {
      const sesionGuardada = localStorage.getItem('votifai_tenant');
      if (sesionGuardada) {
        try { idRealDeNeon = JSON.parse(sesionGuardada)?.tenantId || JSON.parse(sesionGuardada)?.id; } catch (e) { }
      }
    }
    if (!idRealDeNeon) return;

    const inicializarSalaJuntas = async () => {
      try {
        const resCat = await fetch(`/api/entities/${idRealDeNeon}`);
        const dataCat = await resCat.json();

        if (resCat.ok && dataCat.fincas && dataCat.fincas.length > 0) {
          setFincasReales(dataCat.fincas);
          const fincaActual = dataCat.fincas.find(f => f.id === fincaId) || dataCat.fincas[0];
          setFincaSeleccionada(fincaActual);

          const resEstado = await fetch(`/api/meetings/estado/${fincaId}`);
          const dataEstado = await resEstado.json();

          if (resEstado.ok && dataEstado.estado === 'clausurada') {
            console.log("🔒 Acceso Seguro: Bloqueando sala en modo de Solo Lectura Auditoría.");
            setModoAuditoria(true);
            setActaHistoricaTexto(dataEstado.acta_texto_final || 'Acta oficial archivada sin texto de volcado.');
          } else {
            setModoAuditoria(false);
            setActaHistoricaTexto('');
          }
        }

        const resCenso = await fetch(`/api/propietarios/lista/${fincaId}`);
        const dataCenso = await resCenso.json();
        if (resCenso.ok) {
          setPropietarios(dataCenso.propietarios || []);
        }

      } catch (err) {
        console.error("Fallo crítico al inicializar la sesión:", err);
      } finally {
        setCargandoFincas(false);
      }
    };

    inicializarSalaJuntas();
  }, [tenantGlobal, fincaId]);

  const handleReenviarCopiaActa = async (e) => {
    e.preventDefault();
    if (!propietarioDestinatario || !actaHistoricaTexto) {
      alert("⚠️ Selecciona un propietario del censo para procesar el despacho.");
      return;
    }

    setReenviandoPush(true);
    try {
      const respuesta = await fetch('/api/notifications/reenviar-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propietarioId: propietarioDestinatario,
          nombreFinca: fincaSeleccionada?.nombre || 'Comunidad Activa',
          actaTexto: actaHistoricaTexto
        })
      });

      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        alert(`✓ Pasarela Telefónica VotifAI:\n\n${resultado.mensaje}`);
        setPropietarioDestinatario('');
      } else {
        alert(`❌ Error en el despacho: ${resultado.error || 'No se pudo tramitar.'}`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Fallo de red: El servidor externo no responde.");
    } finally {
      setReenviandoPush(false);
    }
  };
  const puntosActuales = state?.salaControl?.juntasData?.[mercado || 'comunidad']?.puntos || [];

  const datosConvocatoria = fincaSeleccionada ? {
    entidad: fincaSeleccionada.nombre,
    convocatoria: "Junta General Extraordinaria (Neon Cloud)",
    cuorum: "100%",
    subCuorum: `Finca con CIF: ${fincaSeleccionada.cif}`,
    coeficiente: `Dirección: ${fincaSeleccionada.direccion}`,
    puntos: puntosActuales
  } : {
    entidad: "Cargando entorno...",
    convocatoria: "Buscando asambleas...",
    cuorum: "0.00%",
    subCuorum: "Buscando fincas en la nube...",
    coeficiente: "—",
    puntos: puntosActuales
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col h-screen overflow-hidden relative font-sans antialiased">

      {/* Navegación Superior Institucional */}
      <HeaderDashboard admin={tenantGlobal?.admin || datosAdmin} />

      {/* Barra de Contexto y Acciones de Convocatoria */}
      <SubNavContexto
        setMostrarModalConvocatoria={setMostrarModalConvocatoria}
        dispatch={dispatch}
        mercado={mercado}
      />

      {/* Distribución Panorámica de Control Interactivo */}
      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden p-4 gap-4">

        {/* Columna 1: Agenda y Acordeón Legislativo */}
        <ColumnaOrdenDia
          cargandoFincas={cargandoFincas}
          datosAdmin={datosAdmin}
          tenantGlobal={tenantGlobal}
          fincasReales={fincasReales}
          fincaSeleccionada={fincaSeleccionada}
          setFincaSeleccionada={setFincaSeleccionada}
          datos={datosConvocatoria}
          puntoActivo={puntoActivo || 0}
          dispatch={dispatch}
          state={state}
        />
        {/* Columna 2: Monitor Central, Reloj y Barómetro Móvil */}
        <ColumnaMonitorCentral
          datos={datosConvocatoria}
          puntoActivo={puntoActivo || 0}
          dispatch={dispatch}
          state={state}
        />

        <div className="w-full lg:w-6/12 flex flex-col h-full overflow-hidden justify-between bg-slate-900/10 border border-slate-900 rounded-2xl p-5">
          {modoAuditoria ? (
            <div className="flex flex-col h-full overflow-hidden justify-between space-y-4">

              <div className="p-3.5 bg-rose-950/20 border border-rose-900/40 rounded-xl flex items-center justify-between shrink-0 shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="bg-rose-600 text-white p-2 rounded-lg animate-pulse"><ShieldCheck size={16} /></div>
                  <div>
                    <span className="block text-[9px] font-black text-rose-400 uppercase tracking-widest">Gobernanza Criptográfica</span>
                    <h4 className="text-2xs font-black text-white uppercase mt-0.5">Asamblea Clausurada — Modo Auditoría</h4>
                  </div>
                </div>
                <span className="text-[9px] font-mono bg-slate-950 border border-slate-800 text-slate-500 px-2 py-1 rounded">Art. 17 LPH</span>
              </div>

              <div className="flex-grow overflow-y-auto bg-white text-slate-900 rounded-xl p-5 text-4xs font-sans whitespace-pre-line border border-slate-200 shadow-inner leading-relaxed">
                {actaHistoricaTexto}
              </div>

              <form onSubmit={handleReenviarCopiaActa} className="bg-slate-950 border border-slate-900 p-4 rounded-xl space-y-3 shrink-0 shadow-2xl">
                <div>
                  <h5 className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Share2 size={12} className="text-blue-400" /> Difusión Selectiva Post-Junta
                  </h5>
                  <p className="text-5xs text-slate-500 uppercase font-bold mt-0.5">Despacho de copias certificadas del acta</p>
                </div>

                <div className="flex gap-2 items-center">
                  <select
                    required
                    value={propietarioDestinatario}
                    onChange={(e) => setPropietarioDestinatario(e.target.value)}
                    className="flex-grow bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-3xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="">-- Seleccionar Vecino del Censo --</option>
                    {propietarios.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.propiedad_detail || p.propiedad_detalle || 'Vivienda'} - {p.nombre_completo}
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    disabled={reenviandoPush}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-4xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1"
                  >
                    {reenviandoPush ? 'Despachando...' : 'Reenviar WhatsApp'}
                  </button>
                </div>
              </form>

            </div>
          ) : (
            <ColumnaMonitorCentral
              datos={datosConvocatoria}
              puntoActivo={puntoActivo || 0}
              dispatch={dispatch}
              state={state}
            />
          )}
        </div>

        <PanelEscrutinio
          puntoActivo={puntoActivo || 0}
          dispatch={dispatch}
          state={state}
        />

      </div>

      <ModalConvocatoria
        mostrarModalConvocatoria={mostrarModalConvocatoria}
        setMostrarModalConvocatoria={setMostrarModalConvocatoria}
        fincaSeleccionada={fincaSeleccionada}
        datos={datosConvocatoria}
      />
    </div>
  );
}