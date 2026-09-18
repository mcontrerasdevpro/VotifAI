import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVotifaiStore } from '../../store.jsx';
import { Building2, Search, FolderOpen, LogOut, CalendarDays } from 'lucide-react';
import Card from '../../components/ui/Card.jsx';
import Field from '../../components/ui/Field.jsx';

/**
 * Hub: selector de la finca a gestionar, nada más. La ficha completa
 * (editar, PDF, censo, eliminar) vive en ResumenFinca.jsx, una vez
 * dentro — antes se duplicaba aquí sobre un censo de mentira que nunca
 * reflejaba los datos reales de Neon.
 */
export default function ClientSelector() {
  const navigate = useNavigate();
  const { state, dispatch } = useVotifaiStore() || { state: { tenant: null }, dispatch: () => { } };

  const [busqueda, setBusqueda] = useState('');
  const [fincas, setFincas] = useState([]);
  const [cargandoFincas, setCargandoFincas] = useState(true);

  const tenantIdActual = state.tenant?.tenantId || state.tenant?.id;
  const adminGlobal = state.tenant?.admin;
  const nombreDespacho = adminGlobal?.despacho || state.tenant?.nombreEntidad || "Mi Despacho SaaS";

  useEffect(() => {
    const cargarFincasDesdeNeon = async () => {
      if (!tenantIdActual) { setCargandoFincas(false); return; }
      try {
        const respuesta = await fetch(`/api/entities/${tenantIdActual}`, { credentials: 'include' });
        const datos = await respuesta.json();
        if (respuesta.ok) setFincas(datos.fincas || []);
      } catch (error) {
        console.error("Fallo crítico de lectura en el catálogo:", error);
      } finally {
        setCargandoFincas(false);
      }
    };
    cargarFincasDesdeNeon();
  }, [tenantIdActual]);

  const fincasFiltradas = fincas.filter(f =>
    f.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col h-screen overflow-hidden">

      <header className="border-b border-slate-900 bg-slate-950 px-6 py-4 flex justify-between items-center shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white"><FolderOpen size={20} /></div>
          <div>
            <h1 className="text-sm font-black text-white">{nombreDespacho}</h1>
            <p className="text-4xs uppercase tracking-widest text-slate-500 font-bold">Consola Maestro de Gestión de Carteras</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {adminGlobal?.nombre && (
            <span className="text-4xs font-mono bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1.5 rounded-lg">
              👤 {adminGlobal.nombre}
            </span>
          )}
          <button
            onClick={() => navigate('/agenda')}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors text-slate-300 hover:text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5"
          >
            <CalendarDays size={14} /> Agenda
          </button>
          <button
            onClick={() => navigate('/alta-finca')}
            className="bg-blue-600 hover:bg-blue-500 transition-colors text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md"
          >
            Dar de Alta Nueva Finca
          </button>
          <button
            onClick={handleLogout}
            className="p-2.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl hover:text-white transition-colors"
          ><LogOut size={14} /></button>
        </div>
      </header>

      <div className="flex-grow overflow-y-auto p-6">
        <Card className="max-w-5xl mx-auto" padding="p-5">
          <Field
            className="mb-4"
            icon={Search}
            type="text" placeholder="Filtrar por dirección o nombre de finca..." value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          {cargandoFincas ? (
            <div className="text-center py-12 text-4xs text-slate-500 font-bold uppercase tracking-wider">Interrogando a Neon Cloud...</div>
          ) : fincasFiltradas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fincasFiltradas.map((finca) => (
                <div
                  key={finca.id}
                  onClick={() => navigate(`/admin/${finca.id}`)}
                  className="p-4 rounded-xl border border-slate-900 bg-slate-950 hover:border-blue-500/40 cursor-pointer transition-all flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-white truncate">{finca.nombre}</h3>
                    <p className="text-4xs text-slate-500 font-mono mt-1 truncate">{finca.cif} · {finca.direccion}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/${finca.id}`); }}
                    className="bg-blue-600 hover:bg-blue-500 transition-colors px-3 py-1.5 rounded-xl text-white text-5xs font-black uppercase tracking-wider shadow-md shrink-0"
                  >
                    Gestionar ➔
                  </button>
                </div>
              ))}
            </div>
          ) : fincas.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 text-slate-500">
              <Building2 size={32} className="text-slate-700" />
              <h3 className="text-3xs font-black uppercase text-slate-400 mt-2 tracking-widest">Aún no tienes ninguna finca</h3>
              <p className="text-5xs text-slate-600 mt-1 max-w-[220px]">Da de alta tu primera comunidad para empezar a gestionarla.</p>
              <button
                onClick={() => navigate('/alta-finca')}
                className="mt-4 bg-blue-600 hover:bg-blue-500 transition-colors text-white text-4xs font-bold px-4 py-2.5 rounded-xl shadow-md uppercase tracking-wider"
              >
                Dar de Alta Nueva Finca
              </button>
            </div>
          ) : (
            <div className="text-center py-12 text-4xs text-slate-500 font-bold tracking-wider">No se han encontrado fincas registradas.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
