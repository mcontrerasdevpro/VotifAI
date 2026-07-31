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

  const [propietarios, setPropietarios] = useState([]);
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

      <HeaderDashboard admin={tenantGlobal?.admin || datosAdmin} />
      <SubNavContexto
        setMostrarModalConvocatoria={setMostrarModalConvocatoria}
        dispatch={dispatch}
        mercado={mercado}
      />

      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden p-4 gap-4">

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
        <ColumnaMonitorCentral
          datos={datosConvocatoria}
          puntoActivo={puntoActivo || 0}
          dispatch={dispatch}
          state={state}
        />

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