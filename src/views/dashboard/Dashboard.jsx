import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVotifaiStore } from '../../store.jsx';

// Importación de submódulos independientes
import HeaderDashboard from '../../components/HeaderDashboard.jsx';
import SubNavContexto from '../../components/SubNavContexto.jsx';
import ColumnaOrdenDia from '../../components/ColumnaOrdenDia.jsx';
import ColumnaMonitorCentral from '../../components/ColumnaMonitorCentral.jsx';
import PanelEscrutinio from '../../components/PanelEscrutinio.jsx';
import ModalConvocatoria from '../../components/ModalConvocatoria.jsx';

export default function Dashboard() {
  const { fincaId } = useParams(); // ⚡ Capturamos el UUID real de la URL del navegador
  const navigate = useNavigate();

  // Consumo del Reducer del Contexto global
  const { state, dispatch } = useVotifaiStore() || { state: { tenant: null, salaControl: {} } };
  const tenantGlobal = state?.tenant;
  const { jactiva, mercado, puntoActivo } = state?.salaControl || {};

  // Estados locales mínimos unificados y corregidos
  const [mostrarModalConvocatoria, setMostrarModalConvocatoria] = useState(false);
  const [datosAdmin, setDatosAdmin] = useState(null);
  const [fincaSeleccionada, setFincaSeleccionada] = useState(null);
  const [fincasReales, setFincasReales] = useState([]); // ⚡ CORRECCIÓN: Declaramos el estado que faltaba
  const [cargandoFincas, setCargandoFincas] = useState(true);

  const [propietarios, setPropietarios] = useState([]);
  const [modoAuditoria, setModoAuditoria] = useState(false);
  const [actaHistoricaTexto, setActaHistoricaTexto] = useState('');
  const [propietarioDestinatario, setPropietarioDestinatario] = useState('');
  const [reenviandoPush, setReenviandoPush] = useState(false);

  // 📡 Pasarela de Red: Interroga la API basándose de forma estricta en el ID seleccionado
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
        // A. Consultamos el catálogo de fincas del administrador
        const resCat = await fetch(`/api/entities/${idRealDeNeon}`);
        const dataCat = await resCat.json();

        if (resCat.ok && dataCat.fincas && dataCat.fincas.length > 0) {
          setFincasReales(dataCat.fincas);
          const fincaActual = dataCat.fincas.find(f => f.id === fincaId) || dataCat.fincas[0];
          setFincaSeleccionada(fincaActual);

          // B. INTERROGACIÓN LEGAL: Validamos si la junta está abierta o cerrada por el Art. 17 LPH
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

        // C. Descargamos el censo de propietarios activos para el selector de reenvíos
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
  // Variables calculadas de contexto normativo basadas en la LPH
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


        {/* Columna 3: Diarización por IA y Captura Asíncrona */}
        <PanelEscrutinio
          puntoActivo={puntoActivo || 0}
          dispatch={dispatch}
          state={state}
        />

      </div>

      {/* Modal Inteligente Condicional */}
      <ModalConvocatoria
        mostrarModalConvocatoria={mostrarModalConvocatoria}
        setMostrarModalConvocatoria={setMostrarModalConvocatoria}
        fincaSeleccionada={fincaSeleccionada}
        datos={datosConvocatoria}
      />
    </div>
  );
}