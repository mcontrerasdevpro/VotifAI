import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVotifaiStore } from '../../store.jsx';
import { Building2, MapPin, Hash, Users, Pencil, Save, X, FileUp, Trash2, KeyRound, Check } from 'lucide-react';
import Card from '../../components/ui/Card.jsx';
import Field from '../../components/ui/Field.jsx';
import CensoPropietarios from '../../components/CensoPropietarios.jsx';
import JuntaGobierno from '../../components/JuntaGobierno.jsx';

/**
 * Ficha de la entidad activa: datos generales + número de propietarios +
 * censo completo. Es el índice de la consola de una finca — antes se
 * entraba directo a "Junta en Vivo", ahora eso es un módulo más.
 *
 * También es donde vive la edición del expediente (nombre/CIF/dirección/
 * ), la subida del PDF original y la baja de la
 * entidad — antes duplicado en el Hub (ClientSelector) operando sobre un
 * censo de mentira; aquí opera sobre los datos reales de la propia finca.
 */
export default function ResumenFinca() {
  const { fincaId } = useParams();
  const navigate = useNavigate();
  const entidadIdActiva = fincaId;

  const { state } = useVotifaiStore() || { state: { tenant: null } };
  const tenantId = state?.tenant?.tenantId || state?.tenant?.id;

  const [entidad, setEntidad] = useState(null);
  const [numPropietarios, setNumPropietarios] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editCif, setEditCif] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  // La junta de gobierno y el censo se avisan: nombrar un cargo refresca
  // las etiquetas del censo, y el botón "Cargo" del censo abre el alta.
  const [peticionCargo, setPeticionCargo] = useState(null);
  const [versionCargos, setVersionCargos] = useState(0);
  const [codigoCopiado, setCodigoCopiado] = useState(false);

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

      const resCenso = await fetch(`/api/propietarios/lista/${entidadIdActiva}`, { credentials: 'include' });
      const dataCenso = await resCenso.json();
      if (resCenso.ok) {
        setNumPropietarios(dataCenso.propietarios?.length ?? 0);
      }
    } catch (err) {
      console.error('Fallo al cargar el resumen de la entidad:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarResumen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, entidadIdActiva]);

  useEffect(() => {
    if (!entidad) return;
    setEditNombre(entidad.nombre || '');
    setEditCif(entidad.cif || '');
    setEditDireccion(entidad.direccion || '');

  }, [entidad]);

  const handleGuardarCambios = async () => {
    setGuardando(true);
    try {
      const respuesta = await fetch('/api/entities/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: entidadIdActiva,
          nombre: editNombre,
          cif: editCif,
          direccion: editDireccion
        })
      });
      if (respuesta.ok) {
        setEditando(false);
        await cargarResumen();
      } else {
        alert('❌ No se pudo actualizar el expediente.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al actualizar el expediente.');
    } finally {
      setGuardando(false);
    }
  };

  const handleSubirPDF = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.readAsDataURL(archivo);
    lector.onloadend = async () => {
      try {
        const respuesta = await fetch('/api/entities/upload-pdf', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ entityId: entidadIdActiva, pdfBase64: lector.result })
        });
        if (respuesta.ok) {
          alert('✓ Documento PDF sincronizado correctamente.');
        }
      } catch (err) {
        console.error('Fallo al subir el PDF:', err);
      }
    };
  };

  const copiarCodigoAcceso = async () => {
    if (!entidad?.codigo_acceso) return;
    try {
      await navigator.clipboard.writeText(entidad.codigo_acceso);
      setCodigoCopiado(true);
      setTimeout(() => setCodigoCopiado(false), 2000);
    } catch (err) {
      console.error('No se pudo copiar el código de acceso:', err);
    }
  };

  const handleEliminarFinca = async () => {
    const confirmacion = window.confirm(
      `⚠️ ¿Desea eliminar "${entidad?.nombre}"?\n\nEsta acción destruirá el censo de propietarios y todos sus datos asociados.`
    );
    if (!confirmacion) return;

    try {
      const respuesta = await fetch(`/api/entities/delete/${entidadIdActiva}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (respuesta.ok) {
        navigate('/hub');
      } else {
        alert('❌ No se ha podido eliminar la entidad.');
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al eliminar la entidad.');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-4">
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            <Building2 className="text-blue-500" size={20} />
            {cargando ? 'Cargando...' : entidad?.nombre || 'Entidad no encontrada'}
          </h1>
          <p className="text-3xs text-slate-500 uppercase tracking-wider mt-1 font-bold">
            Comunidad de Propietarios — Ley de Propiedad Horizontal (LPH)
          </p>
        </div>

        {entidad && (
          <div className="flex items-center gap-1.5 shrink-0">
            <label className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-4xs font-black px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer uppercase tracking-wider">
              <FileUp size={12} /> PDF
              <input type="file" accept="application/pdf" onChange={handleSubirPDF} className="hidden" />
            </label>

            {editando ? (
              <>
                <button type="button" onClick={() => setEditando(false)} className="bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-4xs font-black px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 uppercase tracking-wider">
                  <X size={12} /> Cancelar
                </button>
                <button type="button" onClick={handleGuardarCambios} disabled={guardando} className="bg-emerald-600 hover:bg-emerald-500 text-white text-4xs font-black px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 uppercase tracking-wider disabled:opacity-50">
                  <Save size={12} /> {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setEditando(true)} className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-4xs font-black px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 uppercase tracking-wider">
                <Pencil size={12} /> Editar
              </button>
            )}

            {!editando && (
              <button type="button" onClick={handleEliminarFinca} className="bg-rose-950/20 border border-rose-900/40 hover:bg-rose-900 text-rose-400 hover:text-white text-4xs font-black p-2 rounded-xl transition-colors" title="Eliminar entidad">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {editando ? (
        <Card className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0 border-blue-500/30" padding="p-5">
          <Field className="sm:col-span-2" label="Nombre Comercial" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
          <Field label="CIF" value={editCif} onChange={(e) => setEditCif(e.target.value)} inputClassName="font-mono uppercase" />
          <Field label="Dirección" value={editDireccion} onChange={(e) => setEditDireccion(e.target.value)} />
          <p className="sm:col-span-2 text-3xs text-slate-500">El presidente, el tesorero y el resto de cargos se nombran en "Junta de gobierno", debajo.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 shrink-0">
          <Card>
            <span className="text-5xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Hash size={12} /> CIF</span>
            <p className="text-sm font-mono font-bold text-slate-200 mt-1 uppercase">{entidad?.cif || '—'}</p>
          </Card>
          <Card>
            <span className="text-5xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Users size={12} /> Viviendas</span>
            <p className="text-sm font-black text-blue-400 mt-1">{numPropietarios ?? '—'}</p>
          </Card>
          <Card>
            <span className="text-5xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><MapPin size={12} /> Dirección</span>
            <p className="text-sm font-medium text-slate-200 mt-1 truncate">{entidad?.direccion || '—'}</p>
          </Card>
          <Card className="hover:border-blue-500/30 transition-colors">
            <button type="button" onClick={copiarCodigoAcceso} className="w-full text-left" disabled={!entidad?.codigo_acceso}>
              <span className="text-5xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><KeyRound size={12} /> Código de Acceso Vecinos</span>
              <p className="text-sm font-mono font-black text-blue-400 mt-1 flex items-center gap-1.5">
                {entidad?.codigo_acceso || '—'}
                {codigoCopiado ? <Check size={13} className="text-emerald-400" /> : null}
              </p>
            </button>
          </Card>
        </div>
      )}

      {entidad && (
        <JuntaGobierno fincaId={entidadIdActiva} peticion={peticionCargo} onCambio={() => setVersionCargos((v) => v + 1)} />
      )}

      <Card className="flex-grow overflow-hidden flex flex-col min-h-[420px]" padding="p-5">
        <h2 className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-2 mb-4 shrink-0">
          <Users size={16} className="text-blue-500" /> Censo de Propietarios
        </h2>
        <div className="flex-grow overflow-hidden min-h-0">
          <CensoPropietarios fincaId={entidadIdActiva} nombreFinca={entidad?.nombre} versionCargos={versionCargos} onNombrarCargo={(p) => setPeticionCargo({ propietarioId: p.id, n: Date.now() })} />
        </div>
      </Card>
    </div>
  );
}
