import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useVotifaiStore } from '../store.jsx';
import { ShieldCheck, Vote, Wrench, Wallet, FileStack, CalendarClock, ArrowLeft, LogOut } from 'lucide-react';

const MODULOS_COMUNIDAD = [
  { to: '.', end: true, icon: Vote, label: 'Junta en Vivo' },
  { to: 'incidencias', icon: Wrench, label: 'Incidencias' },
  { to: 'cuotas', icon: Wallet, label: 'Cuotas' },
  { to: 'documentos', icon: FileStack, label: 'Documentos' },
  { to: 'reservas', icon: CalendarClock, label: 'Reservas' }
];

const MODULOS_EMPRESA = [
  { to: '.', end: true, icon: Vote, label: 'Junta en Vivo' }
];

/**
 * Layout persistente para la consola de una finca/empresa concreta:
 * sidebar de navegación entre módulos + área de contenido (<Outlet/>).
 * "Junta en Vivo" (Dashboard.jsx) es un módulo más, no la pantalla de
 * entrada — el punto de entrada real sigue siendo /hub.
 */
export default function AppShell() {
  const navigate = useNavigate();
  const { empresaId } = useParams();
  const esEmpresa = !!empresaId;

  const { state, dispatch } = useVotifaiStore() || { state: { tenant: null }, dispatch: () => {} };
  const admin = state?.tenant?.admin;

  const modulos = esEmpresa ? MODULOS_EMPRESA : MODULOS_COMUNIDAD;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('Fallo al cerrar sesión en el servidor:', err);
    }
    dispatch({ type: 'CERRAR_SESION' });
    navigate('/');
  };

  return (
    <div className="h-screen w-screen flex bg-slate-950 overflow-hidden">
      <aside className="w-56 shrink-0 border-r border-slate-900 bg-slate-950 flex flex-col">
        <div className="h-16 px-4 flex items-center gap-2 border-b border-slate-900 shrink-0">
          <ShieldCheck size={20} className="text-blue-500" />
          <span className="text-sm font-black text-white">Votif<span className="text-blue-500">AI</span></span>
        </div>

        <button
          type="button"
          onClick={() => navigate('/hub')}
          className="mx-3 mt-3 flex items-center gap-2 text-4xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-wider"
        >
          <ArrowLeft size={12} /> Volver al Hub
        </button>

        <nav className="flex-grow px-3 mt-4 space-y-1">
          {modulos.map((m) => (
            <NavLink
              key={m.label}
              to={m.to}
              end={m.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-3xs font-bold uppercase tracking-wider transition-colors ${
                  isActive
                    ? 'bg-blue-600/10 border border-blue-500/30 text-blue-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                }`
              }
            >
              <m.icon size={14} /> {m.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-900 shrink-0">
          <div className="px-1 mb-2">
            <p className="text-3xs font-bold text-slate-300 truncate">{admin?.nombre || 'Administrador'}</p>
            <p className="text-4xs text-slate-600 truncate">{admin?.despacho || 'Despacho Profesional'}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-4xs font-bold uppercase tracking-wider text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition-colors"
          >
            <LogOut size={12} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-grow h-full overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
