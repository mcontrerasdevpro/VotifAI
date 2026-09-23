import React, { createContext, useContext, useReducer } from 'react';
import { normalizeTenant, loadStoredTenant, hasActiveTenant } from './store/session.js';

const initialState = {
  tenant: loadStoredTenant(),
  // Estado de sala puramente de UI (no persistido): qué tarjetas del
  // orden del día están expandidas y las cifras de asistencia/coeficiente
  // del censo real de la finca activa. El orden del día, los puntos y los
  // votos viven en el servidor (ver server/routes/meetings.js) y se
  // consultan por meetingId, no aquí.
  salaControl: {
    totalAsistentesSala: 0,
    coeficienteTotal: 0,
    puntosExpandidos: {}
  }
};

function votifaiReducer(state, action) {
  switch (action.type) {
    case 'REGISTRAR_ORGANIZACION': {
      const nuevoTenant = normalizeTenant(action.payload);
      if (nuevoTenant) {
        localStorage.setItem('votifai_tenant', JSON.stringify(nuevoTenant));
      }
      return { ...state, tenant: nuevoTenant };
    }

    // Datos editados en "Mi despacho": se mezclan con la sesión guardada sin
    // perder las comunidades ya cargadas.
    case 'ACTUALIZAR_PERFIL': {
      if (!state.tenant) return state;
      const perfil = normalizeTenant({ ...action.payload, comunidades: state.tenant.comunidades });
      const tenantActualizado = { ...state.tenant, ...perfil, tenantId: state.tenant.tenantId };
      localStorage.setItem('votifai_tenant', JSON.stringify(tenantActualizado));
      return { ...state, tenant: tenantActualizado };
    }

    case 'CERRAR_SESION':
      localStorage.removeItem('votifai_tenant');
      return { ...state, tenant: null, salaControl: initialState.salaControl };

    case 'AÑADIR_ENTIDAD': {
      if (!state.tenant) return state;
      const tenantActualizado = {
        ...state.tenant,
        comunidades: [...(state.tenant.comunidades || []), action.payload]
      };
      localStorage.setItem('votifai_tenant', JSON.stringify(tenantActualizado));
      return { ...state, tenant: tenantActualizado };
    }

    case 'SET_SALA_STATE':
      return {
        ...state,
        salaControl: { ...state.salaControl, ...action.payload }
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