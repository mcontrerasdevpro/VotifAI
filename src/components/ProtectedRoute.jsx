import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useVotifaiStore } from '../store.jsx';
import { hasActiveTenant } from '../store/session.js';

export default function ProtectedRoute() {
  const { state, dispatch } = useVotifaiStore() || { state: { tenant: null }, dispatch: () => {} };
  const tenant = state?.tenant;
  const [validando, setValidando] = useState(!hasActiveTenant(tenant));

  useEffect(() => {
    if (hasActiveTenant(tenant)) {
      setValidando(false);
      return;
    }

    let ignore = false;
    const verificarSesion = async () => {
      try {
        const respuesta = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await respuesta.json();
        if (ignore) return;

        if (respuesta.ok && data?.tenant) {
          dispatch({ type: 'REGISTRAR_ORGANIZACION', payload: data.tenant });
          setValidando(false);
          return;
        }

        setValidando(false);
      } catch {
        if (!ignore) setValidando(false);
      }
    };

    verificarSesion();
    return () => { ignore = true; };
  }, [tenant, dispatch]);

  if (validando && !hasActiveTenant(tenant)) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Validando sesión…</div>;
  }

  if (!hasActiveTenant(state?.tenant)) {
    return <Navigate to="/login/corporativo" replace />;
  }

  return <Outlet />;
}