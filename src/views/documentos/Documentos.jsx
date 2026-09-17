import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FileStack, Megaphone, Plus, Download, Trash2, Pin, Upload } from 'lucide-react';
import Card from '../../components/ui/Card.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Field from '../../components/ui/Field.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';

const CATEGORIAS = [
  { value: 'general', label: 'General' },
  { value: 'acta', label: 'Acta' },
  { value: 'normativa', label: 'Normativa / Estatutos' },
  { value: 'factura', label: 'Factura' },
  { value: 'otro', label: 'Otro' }
];

export default function Documentos() {
  const { fincaId, empresaId } = useParams();
  const entidadId = empresaId || fincaId;

  const [tab, setTab] = useState('documentos');
  const [documentos, setDocumentos] = useState([]);
  const [comunicados, setComunicados] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [modalDocAbierto, setModalDocAbierto] = useState(false);
  const [guardandoDoc, setGuardandoDoc] = useState(false);
  const [docTitulo, setDocTitulo] = useState('');
  const [docDescripcion, setDocDescripcion] = useState('');
  const [docCategoria, setDocCategoria] = useState('general');
  const [docVisibilidad, setDocVisibilidad] = useState('publico');
  const [docArchivo, setDocArchivo] = useState(null);

  const [modalComAbierto, setModalComAbierto] = useState(false);
  const [guardandoCom, setGuardandoCom] = useState(false);
  const [comTitulo, setComTitulo] = useState('');
  const [comCuerpo, setComCuerpo] = useState('');
  const [comFijado, setComFijado] = useState(false);

  const refrescar = useCallback(async () => {
    try {
      const [resDocs, resComs] = await Promise.all([
        fetch(`/api/documentos/lista/${entidadId}`, { credentials: 'include' }),
        fetch(`/api/comunicados/lista/${entidadId}`, { credentials: 'include' })
      ]);
      const dataDocs = await resDocs.json();
      const dataComs = await resComs.json();
      if (resDocs.ok) setDocumentos(dataDocs.documentos || []);
      if (resComs.ok) setComunicados(dataComs.comunicados || []);
    } catch (err) {
      console.error('Fallo al cargar documentos/comunicados:', err);
    }
  }, [entidadId]);

  useEffect(() => {
    const cargarInicial = async () => {
      if (!entidadId) {
        setCargando(false);
        return;
      }
      await refrescar();
      setCargando(false);
    };
    cargarInicial();
  }, [entidadId, refrescar]);

  const resetFormDoc = () => {
    setDocTitulo(''); setDocDescripcion(''); setDocCategoria('general'); setDocVisibilidad('publico'); setDocArchivo(null);
  };

  const handleSubirDocumento = (e) => {
    e.preventDefault();
    if (!docTitulo || !docArchivo) return;

    setGuardandoDoc(true);
    const lector = new FileReader();
    lector.readAsDataURL(docArchivo);
    lector.onloadend = async () => {
      try {
        const respuesta = await fetch('/api/documentos/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            entity_id: entidadId,
            titulo: docTitulo,
            descripcion: docDescripcion,
            categoria: docCategoria,
            archivo_nombre: docArchivo.name,
            archivo_mime: docArchivo.type,
            archivo_base64: lector.result,
            visibilidad: docVisibilidad
          })
        });
        const resultado = await respuesta.json();
        if (respuesta.ok && resultado.success) {
          setModalDocAbierto(false);
          resetFormDoc();
          await refrescar();
        } else {
          alert(`❌ Error: ${resultado.error || 'No se pudo subir el documento.'}`);
        }
      } catch (err) {
        console.error(err);
        alert('❌ Fallo de red al subir el documento.');
      } finally {
        setGuardandoDoc(false);
      }
    };
  };

  const handleDescargarDocumento = async (id) => {
    try {
      const respuesta = await fetch(`/api/documentos/archivo/${id}`, { credentials: 'include' });
      const resultado = await respuesta.json();
      if (!respuesta.ok) {
        alert(`❌ Error: ${resultado.error || 'No se pudo descargar el documento.'}`);
        return;
      }
      const enlace = document.createElement('a');
      enlace.href = resultado.documento.archivo_base64;
      enlace.download = resultado.documento.archivo_nombre || resultado.documento.titulo;
      enlace.click();
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al descargar el documento.');
    }
  };

  const handleEliminarDocumento = async (id) => {
    if (!window.confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return;
    try {
      const respuesta = await fetch(`/api/documentos/delete/${id}`, { method: 'DELETE', credentials: 'include' });
      if (respuesta.ok) await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublicarComunicado = async (e) => {
    e.preventDefault();
    if (!comTitulo || !comCuerpo) return;

    setGuardandoCom(true);
    try {
      const respuesta = await fetch('/api/comunicados/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entity_id: entidadId, titulo: comTitulo, cuerpo: comCuerpo, fijado: comFijado })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setModalComAbierto(false);
        setComTitulo(''); setComCuerpo(''); setComFijado(false);
        await refrescar();
      } else {
        alert(`❌ Error: ${resultado.error || 'No se pudo publicar el comunicado.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al publicar el comunicado.');
    } finally {
      setGuardandoCom(false);
    }
  };

  const handleEliminarComunicado = async (id) => {
    if (!window.confirm('¿Eliminar este comunicado?')) return;
    try {
      const respuesta = await fetch(`/api/comunicados/delete/${id}`, { method: 'DELETE', credentials: 'include' });
      if (respuesta.ok) await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const columnasDocumentos = [
    { key: 'titulo', header: 'Documento', render: (d) => (
      <div>
        <p className="font-bold text-white">{d.titulo}</p>
        {d.descripcion && <p className="text-slate-500 mt-0.5">{d.descripcion}</p>}
      </div>
    ) },
    { key: 'categoria', header: 'Categoría', render: (d) => <StatusBadge tone="brand">{CATEGORIAS.find(c => c.value === d.categoria)?.label || d.categoria}</StatusBadge> },
    { key: 'visibilidad', header: 'Visibilidad', render: (d) => <StatusBadge tone={d.visibilidad === 'solo_admin' ? 'warning' : 'success'}>{d.visibilidad === 'solo_admin' ? 'Solo Admin' : 'Público'}</StatusBadge> },
    { key: 'creado_en', header: 'Fecha', render: (d) => new Date(d.creado_en).toLocaleDateString('es-ES') },
    { key: 'acciones', header: 'Acciones', align: 'center', render: (d) => (
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => handleDescargarDocumento(d.id)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-blue-400 hover:text-blue-300" title="Descargar">
          <Download size={12} />
        </button>
        <button onClick={() => handleEliminarDocumento(d.id)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300" title="Eliminar">
          <Trash2 size={12} />
        </button>
      </div>
    ) }
  ];

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center shrink-0">
        <div className="flex gap-2 bg-slate-950 p-1 rounded-xl border border-slate-900 max-w-md">
          <button
            onClick={() => setTab('documentos')}
            className={`flex-1 py-2 px-4 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${tab === 'documentos' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <FileStack size={12} /> Documentos
          </button>
          <button
            onClick={() => setTab('comunicados')}
            className={`flex-1 py-2 px-4 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${tab === 'comunicados' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <Megaphone size={12} /> Comunicados
          </button>
        </div>

        {tab === 'documentos' ? (
          <button onClick={() => setModalDocAbierto(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
            <Plus size={12} /> Subir Documento
          </button>
        ) : (
          <button onClick={() => setModalComAbierto(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
            <Plus size={12} /> Publicar Comunicado
          </button>
        )}
      </div>

      {tab === 'documentos' ? (
        <Card className="flex-grow overflow-hidden" padding="p-0">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <DataTable
              columns={columnasDocumentos}
              data={documentos}
              loading={cargando}
              loadingLabel="Cargando documentos..."
              emptyLabel="No hay documentos subidos todavía."
            />
          </div>
        </Card>
      ) : (
        <div className="flex-grow overflow-y-auto custom-scrollbar space-y-3">
          {cargando ? (
            <div className="text-center py-12 text-4xs text-slate-500 font-bold uppercase tracking-widest">Cargando comunicados...</div>
          ) : comunicados.length === 0 ? (
            <div className="text-center py-12 text-4xs text-slate-600 font-bold uppercase tracking-widest">No hay comunicados publicados todavía.</div>
          ) : (
            comunicados.map((c) => (
              <Card key={c.id} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {c.fijado && <Pin size={12} className="text-amber-400 shrink-0" />}
                    <h3 className="text-sm font-black text-white">{c.titulo}</h3>
                  </div>
                  <button onClick={() => handleEliminarComunicado(c.id)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300 shrink-0" title="Eliminar">
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="text-3xs text-slate-300 leading-relaxed whitespace-pre-wrap">{c.cuerpo}</p>
                <p className="text-4xs text-slate-600 font-mono uppercase tracking-wider">
                  Publicado: {new Date(c.fecha_publicacion).toLocaleDateString('es-ES')}
                </p>
              </Card>
            ))
          )}
        </div>
      )}

      {/* MODAL: SUBIR DOCUMENTO */}
      <Modal
        open={modalDocAbierto}
        onClose={() => setModalDocAbierto(false)}
        icon={FileStack}
        title="Subir Documento"
        subtitle="Repositorio de documentos de la comunidad"
        footer={
          <>
            <button type="button" onClick={() => setModalDocAbierto(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-subir-documento" disabled={guardandoDoc} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              {guardandoDoc ? 'Subiendo...' : 'Subir Documento'}
            </button>
          </>
        }
      >
        <form id="form-subir-documento" onSubmit={handleSubirDocumento} className="space-y-3">
          <Field label="Título" required value={docTitulo} onChange={(e) => setDocTitulo(e.target.value)} placeholder="Ej: Estatutos de la Comunidad" />
          <Field label="Descripción (opcional)" as="textarea" rows={2} value={docDescripcion} onChange={(e) => setDocDescripcion(e.target.value)} placeholder="Notas adicionales sobre el documento" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría" as="select" value={docCategoria} onChange={(e) => setDocCategoria(e.target.value)}>
              {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Field>
            <Field label="Visibilidad" as="select" value={docVisibilidad} onChange={(e) => setDocVisibilidad(e.target.value)}>
              <option value="publico">Público (vecinos)</option>
              <option value="solo_admin">Solo Administrador</option>
            </Field>
          </div>
          <div>
            <label className="block text-3xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Archivo</label>
            <label className="w-full border border-dashed border-slate-800 hover:border-slate-700 bg-slate-900 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors">
              <input type="file" required onChange={(e) => setDocArchivo(e.target.files?.[0] || null)} className="hidden" />
              <Upload size={16} className={docArchivo ? 'text-blue-400' : 'text-slate-500'} />
              <span className="text-4xs font-bold text-slate-400 uppercase tracking-wider truncate max-w-full px-2">
                {docArchivo ? docArchivo.name : 'Seleccionar archivo'}
              </span>
            </label>
          </div>
        </form>
      </Modal>

      {/* MODAL: PUBLICAR COMUNICADO */}
      <Modal
        open={modalComAbierto}
        onClose={() => setModalComAbierto(false)}
        icon={Megaphone}
        title="Publicar Comunicado"
        subtitle="Tablón digital de la comunidad"
        footer={
          <>
            <button type="button" onClick={() => setModalComAbierto(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-publicar-comunicado" disabled={guardandoCom} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              {guardandoCom ? 'Publicando...' : 'Publicar'}
            </button>
          </>
        }
      >
        <form id="form-publicar-comunicado" onSubmit={handlePublicarComunicado} className="space-y-3">
          <Field label="Título" required value={comTitulo} onChange={(e) => setComTitulo(e.target.value)} placeholder="Ej: Corte de agua programado" />
          <Field label="Mensaje" as="textarea" required rows={5} value={comCuerpo} onChange={(e) => setComCuerpo(e.target.value)} placeholder="Escribe el comunicado para los vecinos..." />
          <label className="flex items-center gap-2 text-3xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer">
            <input type="checkbox" checked={comFijado} onChange={(e) => setComFijado(e.target.checked)} className="rounded" />
            Fijar arriba del tablón
          </label>
        </form>
      </Modal>
    </div>
  );
}
