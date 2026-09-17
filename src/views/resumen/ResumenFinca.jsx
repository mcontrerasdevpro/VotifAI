import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useVotifaiStore } from '../../store.jsx';
import { Building2, MapPin, Hash, Users } from 'lucide-react';
import Card from '../../components/ui/Card.jsx';
import CensoPropietarios from '../../components/CensoPropietarios.jsx';

/**
 * Ficha de la entidad activa: datos generales + número de propietarios +
 * censo completo. Es el índice de la consola de una finca/empresa — antes
 * se entraba directo a "Junta en Vivo", ahora eso es un módulo más.
 */
export default function ResumenFinca() {
  const { fincaId, empresaId } = useParams();
  const entidadIdActiva = empresaId || fincaId;
  const esEmpresa = !!empresaId;

  const { state } = useVotifaiStore() || { state: { tenant: null } };
  const tenantId = state?.tenant?.tenantId || state?.tenant?.id;

  const [entidad, setEntidad] = useState(null);
  const [numPropietarios, setNumPropietarios] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargarResumen = async () => {
      if (!tenantId || !entidadIdActiva) {
        setCargando(false);
        return;
      }

      try {
        const resEntidad = await fetch(`/api/entities/${tenantId}`, { credentials: 'include' });
        const dataEntidad = await resEntidad.json();
        if (resEntidad.ok) {
          const encontrada = (dataEntidad.fincas || []).find(f => f.id === entidadIdActiva);
          setEntidad(encontrada || null);
        }

        const endpointCenso = esEmpresa
          ? `/api/socios/lista/${entidadIdActiva}`
          : `/api/propietarios/lista/${entidadIdActiva}`;
        const resCenso = await fetch(endpointCenso, { credentials: 'include' });
        const dataCenso = await resCenso.json();
        if (resCenso.ok) {
          setNumPropietarios((esEmpresa ? dataCenso.socios : dataCenso.propietarios)?.length ?? 0);
        }
      } catch (err) {
        console.error('Fallo al cargar el resumen de la entidad:', err);
      } finally {
        setCargando(false);
      }
    };

    cargarResumen();
  }, [tenantId, entidadIdActiva, esEmpresa]);

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-lg font-black text-white flex items-center gap-2">
          <Building2 className="text-blue-500" size={20} />
          {cargando ? 'Cargando...' : entidad?.nombre || 'Entidad no encontrada'}
        </h1>
        <p className="text-3xs text-slate-500 uppercase tracking-wider mt-1 font-bold">
          {esEmpresa ? 'Sociedad — Ley de Sociedades de Capital (LSC)' : 'Comunidad de Propietarios — Ley de Propiedad Horizontal (LPH)'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
        <Card>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Hash size={12} /> CIF</span>
          <p className="text-sm font-mono font-bold text-slate-200 mt-1 uppercase">{entidad?.cif || '—'}</p>
        </Card>
        <Card>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Users size={12} /> {esEmpresa ? 'Socios' : 'Viviendas'}</span>
          <p className="text-sm font-black text-blue-400 mt-1">{numPropietarios ?? '—'}</p>
        </Card>
        <Card>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><MapPin size={12} /> Dirección</span>
          <p className="text-sm font-medium text-slate-200 mt-1 truncate">{entidad?.direccion || '—'}</p>
        </Card>
      </div>

      <Card className="flex-grow overflow-hidden flex flex-col min-h-0" padding="p-5">
        <h2 className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-2 mb-4 shrink-0">
          <Users size={16} className="text-blue-500" /> Censo de {esEmpresa ? 'Socios' : 'Propietarios'}
        </h2>
        <div className="flex-grow overflow-hidden min-h-0">
          <CensoPropietarios fincaId={entidadIdActiva} nombreFinca={entidad?.nombre} />
        </div>
      </Card>
    </div>
  );
}
