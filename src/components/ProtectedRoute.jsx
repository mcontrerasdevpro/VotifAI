import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useVotifaiStore } from '../store.jsx'; 

export default function ProtectedRoute() {
  const { state } = useVotifaiStore() || { state: { tenant: null } };
  const admin = state?.tenant?.admin;

  if (!admin) {
    return <Navigate to="/login/corporativo" replace />;
  }

  return <Outlet />;
}