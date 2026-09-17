import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVotifaiStore } from '../../store.jsx';
import SubNavContexto from '../../components/SubNavContexto.jsx';
import ColumnaOrdenDia from '../../components/ColumnaOrdenDia.jsx';
import ColumnaMonitorCentral from '../../components/ColumnaMonitorCentral.jsx';
import PanelEscrutinio from '../../components/PanelEscrutinio.jsx';
import ModalConvocatoria from '../../components/ModalConvocatoria.jsx';

export default function Dashboard() {
  const { fincaId, empresaId } = useParams(); 
  const navigate = useNavigate();

  const esEmpresa = !!empresaId;
  const entidadIdActiva = esEmpresa ? empresaId : fincaId;

  const { state, dispatch } = useVotifaiStore() || { state: { tenant: null, salaControl: {} } };
  const tenantGlobal = state?.tenant;
  const { jactiva, mercado, puntoActivo } = state?.salaControl || {};

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

        const listaFiltrada = esEmpresa ? (dataCat.empresas || []) : (dataCat.fincas || []);
        
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

        const endpointCenso = esEmpresa 
          ? `/api/socios/lista/${entidadIdActiva}` 
          : `/api/propietarios/lista/${entidadIdActiva}`;

        const resCenso = await fetch(endpointCenso);
        const dataCenso = await resCenso.json();
        if (resCenso.ok) {
          setCensoPersonas(esEmpresa ? (dataCenso.socios || []) : (dataCenso.propietarios || []));
        }

      } catch (err) {
        console.error("Fallo crítico al inicializar la sesión:", err);
      } finally {
        setCargandoEntidades(false);
      }
    };

    inicializarSalaJuntas();
  }, [tenantGlobal, entidadIdActiva, esEmpresa]);

  const handleReenviarCopiaActa = async (e) => {
    e.preventDefault();
    if (!personaDestinataria || !actaHistoricaTexto) {
      alert(esEmpresa ? "⚠️ Selecciona un socio del censo para procesar el despacho." : "⚠️ Selecciona un propietario del censo para procesar el despacho.");
      return;
    }

    setReenviandoPush(true);
    try {
      const respuesta = await fetch('/api/notifications/reenviar-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propietarioId: personaDestinataria,
          nombreFinca: entidadSeleccionada?.nombre || (esEmpresa ? 'Sociedad Activa' : 'Comunidad Activa'),
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

  const puntosActuales = state?.salaControl?.juntasData?.[mercado || (esEmpresa ? 'empresa' : 'comunidad')]?.puntos || [];

  const datosConvocatoria = entidadSeleccionada ? {
    entidad: entidadSeleccionada.nombre,
    convocatoria: esEmpresa ? "Asamblea General de Socios (Neon Cloud)" : "Junta General Extraordinaria (Neon Cloud)",
    cuorum: "100%",
    subCuorum: esEmpresa ? `Sociedad con CIF: ${entidadSeleccionada.cif}` : `Finca con CIF: ${entidadSeleccionada.cif}`,
    coeficiente: esEmpresa ? `Domicilio Social: ${entidadSeleccionada.direccion}` : `Dirección: ${entidadSeleccionada.direccion}`,
    puntos: puntosActuales
  } : {
    entidad: "Cargando entorno...",
    convocatoria: esEmpresa ? "Buscando asambleas..." : "Buscando juntas...",
    cuorum: "0.00%",
    subCuorum: esEmpresa ? "Buscando empresas en la nube..." : "Buscando fincas en la nube...",
    coeficiente: "—",
    puntos: puntosActuales
  };

  return (
    <div className="h-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden relative font-sans antialiased">

      <SubNavContexto
        setMostrarModalConvocatoria={setMostrarModalConvocatoria}
        dispatch={dispatch}
        mercado={mercado}
        esEmpresa={esEmpresa} 
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
          esEmpresa={esEmpresa}
        />
        
        <ColumnaMonitorCentral
          datos={datosConvocatoria}
          puntoActivo={puntoActivo || 0}
          dispatch={dispatch}
          state={state}
          esEmpresa={esEmpresa}
          censo={censoPersonas}
        />

        <PanelEscrutinio
          puntoActivo={puntoActivo || 0}
          dispatch={dispatch}
          state={state}
          esEmpresa={esEmpresa}
        />

      </div>

      <ModalConvocatoria
        mostrarModalConvocatoria={mostrarModalConvocatoria}
        setMostrarModalConvocatoria={setMostrarModalConvocatoria}
        fincaSeleccionada={entidadSeleccionada}
        datos={datosConvocatoria}
        esEmpresa={esEmpresa}
      />
    </div>
  );
}