import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './store.jsx';
import Welcome from './views/auth/Welcome';
import Login from './views/auth/Login';
import Register from './views/auth/Register';
import ClientSelector from './views/clients/ClientSelector';
import Dashboard from './views/dashboard/Dashboard';
import HistorialJuntas from './views/juntas/HistorialJuntas';
import MinutesAI from './views/minutes/MinutesAI';
import AltaFinca from './components/AltaFinca.jsx';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell.jsx';
import ResumenFinca from './views/resumen/ResumenFinca.jsx';
import Incidencias from './views/incidencias/Incidencias.jsx';
import Cuotas from './views/cuotas/Cuotas.jsx';
import Documentos from './views/documentos/Documentos.jsx';
import Reservas from './views/reservas/Reservas.jsx';
import Crm from './views/crm/Crm.jsx';
import Agenda from './views/agenda/Agenda.jsx';
import Contabilidad from './views/contabilidad/Contabilidad.jsx';
import Asistencia from './views/asistencia/Asistencia.jsx';
import OlvidePassword from './views/auth/OlvidePassword.jsx';
import RestablecerPassword from './views/auth/RestablecerPassword.jsx';
import AvisoLegal from './views/legal/AvisoLegal.jsx';
import Privacidad from './views/legal/Privacidad.jsx';
import Terminos from './views/legal/Terminos.jsx';
import Billing from './views/billing/Billing.jsx';

function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/login/:perfil" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/asistencia/:entityId" element={<Asistencia />} />
          <Route path="/olvide-password/:perfil" element={<OlvidePassword />} />
          <Route path="/restablecer-password/:perfil" element={<RestablecerPassword />} />
          <Route path="/legal/aviso-legal" element={<AvisoLegal />} />
          <Route path="/legal/privacidad" element={<Privacidad />} />
          <Route path="/legal/terminos" element={<Terminos />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/hub" element={<ClientSelector />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/acta-ia" element={<MinutesAI />} />
            <Route path="/alta-finca" element={<AltaFinca />} />

            <Route path="/admin/:fincaId" element={<AppShell />}>
              <Route index element={<ResumenFinca />} />
              <Route path="junta" element={<HistorialJuntas />} />
              <Route path="junta/:meetingId" element={<Dashboard />} />
              <Route path="incidencias" element={<Incidencias />} />
              <Route path="cuotas" element={<Cuotas />} />
              <Route path="documentos" element={<Documentos />} />
              <Route path="reservas" element={<Reservas />} />
              <Route path="crm" element={<Crm />} />
              <Route path="contabilidad" element={<Contabilidad />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}

export default App;