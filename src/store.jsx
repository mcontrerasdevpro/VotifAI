import React, { createContext, useContext, useReducer } from 'react';

const initialState = {
  tenant: (() => {
    const saved = localStorage.getItem('votifai_tenant');
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      if (parsed && !parsed.comunidadesYEmpresas) {
        parsed.comunidadesYEmpresas = [];
      }
      return parsed;
    } catch (e) {
      return null;
    }
  })(),
  salaControl: {
    mercado: 'comunidad', 
    puntoActivo: 0,
    escuchandoIA: false,
    tiempoRestante: 60,
    votosRegistrados: 0,
    transcripcionesIA: [],
    puntosExpandidos: { 0: true },
    juntasData: {
      // 🏘️ ORDEN DEL DÍA POR DEFECTO PARA COMUNIDADES DE VECINOS
      comunidad: {
        puntos: [
          { id: 1, t: "Aprobación de la reforma urgente de impermeabilización del tejado, reparación integral de las bajantes de la letra C y consolidación de grietas en la fachada norte por razones de estanqueidad estructural.", si: 0, no: 0, abs: 0, estado: "Debatiendo" },
          { id: 2, t: "Instalación de cámaras de seguridad con grabación 4K continua y sensores de movimiento perimetrales en los tres accesos al garaje comunitario.", si: 0, no: 0, abs: 0, estado: "Pendiente" },
          { id: 3, t: "Renovación del contrato de mantenimiento técnico del ascensor principal con la empresa Otis, incluyendo cobertura de piezas de desgaste 24/7.", si: 0, no: 0, abs: 0, estado: "Pendiente" }
        ]
      },
      // 🏢 ORDEN DEL DÍA POR DEFECTO PARA SOCIEDADES MERCANTILES (LSC)
      empresa: {
        puntos: [
          { id: 1, t: "Examen y aprobación de las Cuentas Anuales correspondientes al ejercicio económico cerrado, junto con el informe de gestión de los administradores.", si: 0, no: 0, abs: 0, estado: "Debatiendo" },
          { id: 2, t: "Propuesta de aplicación del resultado del ejercicio económico y correspondiente distribución de dividendos cargados a reservas voluntarias.", si: 0, no: 0, abs: 0, estado: "Pendiente" },
          { id: 3, t: "Cese, nombramiento o ratificación de los miembros del órgano de administración (Consejo de Administración o Administradores Solidarios).", si: 0, no: 0, abs: 0, estado: "Pendiente" }
        ]
      }
    }
  }
};

function votifaiReducer(state, action) {
  switch (action.type) {
    case 'REGISTRAR_ORGANIZACION': {
      const datosServidor = action.payload;
      const nuevoTenant = {
        tenantId: datosServidor.id || datosServidor.tenantId,
        nombreEntidad: datosServidor.nombre_entidad || datosServidor.nombreEntidad || "Despacho Profesional",
        email: datosServidor.email_maestro || datosServidor.email,
        tipoOrganizacion: datosServidor.tipo_organizacion || datosServidor.tipoOrganizacion,
        plan: datosServidor.plan_suscripcion || datosServidor.plan || 'trial_15_dias',
        admin: {
          nombre: datosServidor.admin_nombre || datosServidor.adminNombre || datosServidor.nombre || "Admin General",
          despacho: datosServidor.nombre_entidad || datosServidor.nombreEntidad || "Despacho Administrador"
        },
        comunidadesYEmpresas: datosServidor.comunidadesYEmpresas || []
      };
      localStorage.setItem('votifai_tenant', JSON.stringify(nuevoTenant));
      return { ...state, tenant: nuevoTenant };
    }

    case 'CERRAR_SESION':
      localStorage.removeItem('votifai_tenant');
      return { ...state, tenant: null, salaControl: initialState.salaControl };

    case 'SET_SALA_STATE':
      return {
        ...state,
        salaControl: { ...state.salaControl, ...action.payload }
      };

    case 'ACTUALIZAR_PUNTOS':
      return {
        ...state,
        salaControl: {
          ...state.salaControl,
          juntasData: {
            ...state.salaControl.juntasData,
            [state.salaControl.mercado]: { puntos: action.payload }
          }
        }
      };

    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(votifaiReducer, initialState);
  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useVotifaiStore() {
  return useContext(StoreContext);
}