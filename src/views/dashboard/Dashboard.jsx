import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useVotifaiStore } from '../../store.jsx';
import SubNavContexto from '../../components/SubNavContexto.jsx';
import ColumnaOrdenDia from '../../components/ColumnaOrdenDia.jsx';
import ColumnaMonitorCentral from '../../components/ColumnaMonitorCentral.jsx';
import PanelEscrutinio from '../../components/PanelEscrutinio.jsx';
import ModalConvocatoria from '../../components/ModalConvocatoria.jsx';

export default function Dashboard() {
  const { fincaId } = useParams();
  const entidadIdActiva = fincaId;

  const { state, dispatch } = useVotifaiStore() || { state: { tenant: null, salaControl: {} } };
  const tenantGlobal = state?.tenant;
  const { mercado, puntoActivo } = state?.salaControl || {};

  const [mostrarModalConvocatoria, setMostrarModalConvocatoria] = useState(false);
  const [datosAdmin, setDatosAdmin] = useState(null);
  const [entidadSeleccionada, setEntidadSeleccionada] = useState(null);
  const [entidadesReales, setEntidadesReales] = useState([]);
  const [cargandoEntidades, setCargandoEntidades] = useState(true);
  const [censoPersonas, setCensoPersonas] = useState([]);
  const [modoAuditoria, setModoAuditoria] = useState(false);
  const [actaHistoricaTexto, setActaHistoricaTexto] = useState('');
  const [personaDestinataria, setPersonaDestinataria] = useState('');
  const [reenviandoPush, setReenviandoPush] = useState(false);

  useEffect(() => {
    let idRealDeNeon = tenantGlobal?.tenantId || tenantGlobal?.id;
    if (!idRealDeNeon) {
      const sesionGuardada = localStorage.getItem('votifai_tenant');
      if (sesionGuardada) {
        try { idRealDeNeon = JSON.parse(sesionGuardada)?.tenantId || JSON.parse(sesionGuardada)?.id; } catch (e) { }
      }
    }
    if (!idRealDeNeon || !entidadIdActiva) return;

    const inicializarSalaJuntas = async () => {
      try {
        const resCat = await fetch(`/api/entities/${idRealDeNeon}`);
        const dataCat = await resCat.json();

        const listaFiltrada = dataCat.fincas || [];

        if (resCat.ok && listaFiltrada.length > 0) {
          setEntidadesReales(listaFiltrada);
          const actual = listaFiltrada.find(e => e.id === entidadIdActiva) || listaFiltrada[0];
          setEntidadSeleccionada(actual);

          const resEstado = await fetch(`/api/meetings/estado/${entidadIdActiva}`);
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

        const resCenso = await fetch(`/api/propietarios/lista/${entidadIdActiva}`);
        const dataCenso = await resCenso.json();
        if (resCenso.ok) {
          setCensoPersonas(dataCenso.propietarios || []);
        }

      } catch (err) {
        console.error("Fallo crítico al inicializar la sesión:", err);
      } finally {
        setCargandoEntidades(false);
      }
    };

    inicializarSalaJuntas();
  }, [tenantGlobal, entidadIdActiva]);

  const handleReenviarCopiaActa = async (e) => {
    e.preventDefault();
    if (!personaDestinataria || !actaHistoricaTexto) {
      alert("⚠️ Selecciona un propietario del censo para procesar el despacho.");
      return;
    }

    setReenviandoPush(true);
    try {
      const respuesta = await fetch('/api/notifications/reenviar-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propietarioId: personaDestinataria,
          nombreFinca: entidadSeleccionada?.nombre || 'Comunidad Activa',
          actaTexto: actaHistoricaTexto
        })
      });

      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        alert(`✓ Pasarela Telefónica VotifAI:\n\n${resultado.mensaje}`);
        setPersonaDestinataria('');
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

  const datosConvocatoria = entidadSeleccionada ? {
    entidad: entidadSeleccionada.nombre,
    convocatoria: "Junta General Extraordinaria (Neon Cloud)",
    cuorum: "100%",
    subCuorum: `Finca con CIF: ${entidadSeleccionada.cif}`,
    coeficiente: `Dirección: ${entidadSeleccionada.direccion}`,
    puntos: puntosActuales
  } : {
    entidad: "Cargando entorno...",
    convocatoria: "Buscando juntas...",
    cuorum: "0.00%",
    subCuorum: "Buscando fincas en la nube...",
    coeficiente: "—",
    puntos: puntosActuales
  };

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden relative font-sans antialiased">

      <SubNavContexto
        setMostrarModalConvocatoria={setMostrarModalConvocatoria}
      />

      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden p-4 gap-4">

        <ColumnaOrdenDia
          cargandoFincas={cargandoEntidades}
          datosAdmin={datosAdmin}
          tenantGlobal={tenantGlobal}
          fincasReales={entidadesReales}
          fincaSeleccionada={entidadSeleccionada}
          setFincaSeleccionada={setEntidadSeleccionada}
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
          censo={censoPersonas}
        />

        <PanelEscrutinio
          entidadId={entidadIdActiva}
          puntoActivo={puntoActivo || 0}
          dispatch={dispatch}
          state={state}
        />

      </div>

      <ModalConvocatoria
        mostrarModalConvocatoria={mostrarModalConvocatoria}
        setMostrarModalConvocatoria={setMostrarModalConvocatoria}
        fincaSeleccionada={entidadSeleccionada}
        datos={datosConvocatoria}
      />
    </div>
  );
}
