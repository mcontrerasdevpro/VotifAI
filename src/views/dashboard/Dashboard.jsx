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

    fetch(`/api/entities/${idRealDeNeon}`)
      .then((res) => {
        if (!res.ok) throw new Error("Error en la pasarela de red.");
        return res.json();
      })
      .then((data) => {
        if (data.administrador) setDatosAdmin(data.administrador);
        if (data.fincas && data.fincas.length > 0) {
          setFincasReales(data.fincas);

          // ⚡ Sincronización: Buscamos la finca exacta de la URL, si no, fallback a la primera
          const fincaActual = data.fincas.find(f => f.id === fincaId) || data.fincas[0];
          setFincaSeleccionada(fincaActual);
        }
        setCargandoFincas(false);
      })
      .catch((err) => {
        console.error("Fallo al recuperar catálogo de Neon:", err);
        setCargandoFincas(false);
      });
  }, [tenantGlobal, fincaId]);
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