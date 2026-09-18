import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './store.jsx';
import Welcome from './views/auth/Welcome';
import Login from './views/auth/Login';
import Register from './views/auth/Register';
import ClientSelector from './views/clients/ClientSelector';
import Dashboard from './views/dashboard/Dashboard';
import MinutesAI from './views/minutes/MinutesAI';
import VoterScreen from './views/voter/VoterScreen';
import AltaFinca from './components/AltaFinca.jsx';
import AltaEmpresa from './components/AltaEmpresa.jsx';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell.jsx';
import ResumenFinca from './views/resumen/ResumenFinca.jsx';
import Incidencias from './views/incidencias/Incidencias.jsx';
import Cuotas from './views/cuotas/Cuotas.jsx';
import Documentos from './views/documentos/Documentos.jsx';
import Reservas from './views/reservas/Reservas.jsx';
import Crm from './views/crm/Crm.jsx';

function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/login/:perfil" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/voto-vecino" element={<VoterScreen tipoUsuario="vecino" />} />
          <Route path="/voto-socio" element={<VoterScreen tipoUsuario="empresa" />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/hub" element={<ClientSelector />} />
            <Route path="/acta-ia" element={<MinutesAI />} />
            <Route path="/alta-finca" element={<AltaFinca />} />
            <Route path="/alta-empresa" element={<AltaEmpresa />} />

            <Route path="/admin/:fincaId" element={<AppShell />}>
              <Route index element={<ResumenFinca />} />
              <Route path="junta" element={<Dashboard />} />
              <Route path="incidencias" element={<Incidencias />} />
              <Route path="cuotas" element={<Cuotas />} />
              <Route path="documentos" element={<Documentos />} />
              <Route path="reservas" element={<Reservas />} />
              <Route path="crm" element={<Crm />} />
            </Route>

            <Route path="/admin/empresa/:empresaId" element={<AppShell />}>
              <Route index element={<ResumenFinca />} />
              <Route path="junta" element={<Dashboard />} />
              <Route path="crm" element={<Crm />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}

export default App;