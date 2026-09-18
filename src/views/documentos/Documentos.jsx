import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FileStack, Megaphone, PenSquare, LayoutTemplate, Plus, Download, Trash2, Pin, Upload } from 'lucide-react';
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
  const { fincaId } = useParams();
  const entidadId = fincaId;

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

  const [documentosTexto, setDocumentosTexto] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [modalRedactarAbierto, setModalRedactarAbierto] = useState(false);
  const [guardandoRedactar, setGuardandoRedactar] = useState(false);
  const [rdId, setRdId] = useState(null);
  const [rdTitulo, setRdTitulo] = useState('');
  const [rdPlantillaId, setRdPlantillaId] = useState('');
  const [rdContenido, setRdContenido] = useState('');

  const [modalPlantillaAbierto, setModalPlantillaAbierto] = useState(false);
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [plId, setPlId] = useState(null);
  const [plNombre, setPlNombre] = useState('');
  const [plDescripcion, setPlDescripcion] = useState('');
  const [plContenido, setPlContenido] = useState('');

  const refrescar = useCallback(async () => {
    try {
      const [resDocs, resComs, resTexto, resPlant] = await Promise.all([
        fetch(`/api/documentos/lista/${entidadId}`, { credentials: 'include' }),
        fetch(`/api/comunicados/lista/${entidadId}`, { credentials: 'include' }),
        fetch(`/api/documentos-editor/lista/${entidadId}`, { credentials: 'include' }),
        fetch('/api/plantillas/lista', { credentials: 'include' })
      ]);
      const dataDocs = await resDocs.json();
      const dataComs = await resComs.json();
      const dataTexto = await resTexto.json();
      const dataPlant = await resPlant.json();
      if (resDocs.ok) setDocumentos(dataDocs.documentos || []);
      if (resComs.ok) setComunicados(dataComs.comunicados || []);
      if (resTexto.ok) setDocumentosTexto(dataTexto.documentos || []);
      if (resPlant.ok) setPlantillas(dataPlant.plantillas || []);
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

  const abrirNuevoDocumentoTexto = () => {
    setRdId(null); setRdTitulo(''); setRdPlantillaId(''); setRdContenido('');
    setModalRedactarAbierto(true);
  };

  const abrirEditarDocumentoTexto = (doc) => {
    setRdId(doc.id); setRdTitulo(doc.titulo); setRdPlantillaId(doc.plantilla_id || ''); setRdContenido(doc.contenido || '');
    setModalRedactarAbierto(true);
  };

  const handleSeleccionarPlantilla = (plantillaId) => {
    setRdPlantillaId(plantillaId);
    const plantilla = plantillas.find(p => p.id === plantillaId);
    if (plantilla) setRdContenido(plantilla.contenido || '');
  };

  const handleGuardarDocumentoTexto = async (e) => {
    e.preventDefault();
    if (!rdTitulo) return;

    setGuardandoRedactar(true);
    try {
      const respuesta = await fetch(rdId ? `/api/documentos-editor/${rdId}` : '/api/documentos-editor/create', {
        method: rdId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entity_id: entidadId, plantilla_id: rdPlantillaId || null, titulo: rdTitulo, contenido: rdContenido })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setModalRedactarAbierto(false);
        await refrescar();
      } else {
        alert(`❌ Error: ${resultado.error || 'No se pudo guardar el documento.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al guardar el documento.');
    } finally {
      setGuardandoRedactar(false);
    }
  };

  const handleEliminarDocumentoTexto = async (id) => {
    if (!window.confirm('¿Eliminar este documento redactado?')) return;
    try {
      const respuesta = await fetch(`/api/documentos-editor/delete/${id}`, { method: 'DELETE', credentials: 'include' });
      if (respuesta.ok) await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const abrirNuevaPlantilla = () => {
    setPlId(null); setPlNombre(''); setPlDescripcion(''); setPlContenido('');
    setModalPlantillaAbierto(true);
  };

  const abrirEditarPlantilla = (plantilla) => {
    setPlId(plantilla.id); setPlNombre(plantilla.nombre); setPlDescripcion(plantilla.descripcion || ''); setPlContenido(plantilla.contenido || '');
    setModalPlantillaAbierto(true);
  };

  const handleGuardarPlantilla = async (e) => {
    e.preventDefault();
    if (!plNombre) return;

    setGuardandoPlantilla(true);
    try {
      const respuesta = await fetch(plId ? `/api/plantillas/update/${plId}` : '/api/plantillas/create', {
        method: plId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nombre: plNombre, descripcion: plDescripcion, contenido: plContenido })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setModalPlantillaAbierto(false);
        await refrescar();
      } else {
        alert(`❌ Error: ${resultado.error || 'No se pudo guardar la plantilla.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Fallo de red al guardar la plantilla.');
    } finally {
      setGuardandoPlantilla(false);
    }
  };

  const handleEliminarPlantilla = async (id) => {
    if (!window.confirm('¿Eliminar esta plantilla del despacho?')) return;
    try {
      const respuesta = await fetch(`/api/plantillas/delete/${id}`, { method: 'DELETE', credentials: 'include' });
      if (respuesta.ok) await refrescar();
    } catch (err) {
      console.error(err);
    }
  };

  const columnasDocumentos = [
    { key: 'titulo', header: 'Documento', render: (d) => (
      <div>
        <p className="font-bold text-slate-900">{d.titulo}</p>
        {d.descripcion && <p className="text-slate-500 mt-0.5">{d.descripcion}</p>}
      </div>
    ) },
    { key: 'categoria', header: 'Categoría', render: (d) => <StatusBadge light tone="brand">{CATEGORIAS.find(c => c.value === d.categoria)?.label || d.categoria}</StatusBadge> },
    { key: 'visibilidad', header: 'Visibilidad', render: (d) => <StatusBadge light tone={d.visibilidad === 'solo_admin' ? 'warning' : 'success'}>{d.visibilidad === 'solo_admin' ? 'Solo Admin' : 'Público'}</StatusBadge> },
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

  const columnasDocumentosTexto = [
    { key: 'titulo', header: 'Documento', render: (d) => (
      <button onClick={() => abrirEditarDocumentoTexto(d)} className="text-left hover:text-blue-600 transition-colors">
        <p className="font-bold text-slate-900">{d.titulo}</p>
        {d.plantilla_id && <p className="text-slate-500 mt-0.5">Generado desde plantilla</p>}
      </button>
    ) },
    { key: 'actualizado_en', header: 'Última edición', render: (d) => new Date(d.actualizado_en).toLocaleDateString('es-ES') },
    { key: 'acciones', header: 'Acciones', align: 'center', render: (d) => (
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => abrirEditarDocumentoTexto(d)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-blue-400 hover:text-blue-300" title="Editar">
          <PenSquare size={12} />
        </button>
        <button onClick={() => handleEliminarDocumentoTexto(d.id)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300" title="Eliminar">
          <Trash2 size={12} />
        </button>
      </div>
    ) }
  ];

  const columnasPlantillas = [
    { key: 'nombre', header: 'Plantilla', render: (p) => (
      <div>
        <p className="font-bold text-slate-900">{p.nombre}</p>
        {p.descripcion && <p className="text-slate-500 mt-0.5">{p.descripcion}</p>}
      </div>
    ) },
    { key: 'creado_en', header: 'Creada', render: (p) => new Date(p.creado_en).toLocaleDateString('es-ES') },
    { key: 'acciones', header: 'Acciones', align: 'center', render: (p) => (
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => abrirEditarPlantilla(p)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-blue-400 hover:text-blue-300" title="Editar">
          <PenSquare size={12} />
        </button>
        <button onClick={() => handleEliminarPlantilla(p.id)} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 hover:text-rose-300" title="Eliminar">
          <Trash2 size={12} />
        </button>
      </div>
    ) }
  ];

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center shrink-0">
        <div className="flex gap-2 bg-slate-950 p-1 rounded-xl border border-slate-900 flex-wrap">
          <button
            onClick={() => setTab('documentos')}
            className={`flex-1 py-2 px-4 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${tab === 'documentos' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <FileStack size={12} /> Documentos
          </button>
          <button
            onClick={() => setTab('comunicados')}
            className={`flex-1 py-2 px-4 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${tab === 'comunicados' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <Megaphone size={12} /> Comunicados
          </button>
          <button
            onClick={() => setTab('redactar')}
            className={`flex-1 py-2 px-4 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${tab === 'redactar' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <PenSquare size={12} /> Redactar
          </button>
          <button
            onClick={() => setTab('plantillas')}
            className={`flex-1 py-2 px-4 rounded-lg text-4xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${tab === 'plantillas' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <LayoutTemplate size={12} /> Plantillas
          </button>
        </div>

        {tab === 'documentos' ? (
          <button onClick={() => setModalDocAbierto(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
            <Plus size={12} /> Subir Documento
          </button>
        ) : tab === 'comunicados' ? (
          <button onClick={() => setModalComAbierto(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
            <Plus size={12} /> Publicar Comunicado
          </button>
        ) : tab === 'redactar' ? (
          <button onClick={abrirNuevoDocumentoTexto} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
            <Plus size={12} /> Nuevo Documento
          </button>
        ) : (
          <button onClick={abrirNuevaPlantilla} className="bg-blue-600 hover:bg-blue-500 text-white text-5xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10">
            <Plus size={12} /> Nueva Plantilla
          </button>
        )}
      </div>

      {tab === 'documentos' ? (
        <Card className="flex-grow overflow-hidden" padding="p-0" light>
          <div className="h-full overflow-y-auto custom-scrollbar">
            <DataTable
              light
              columns={columnasDocumentos}
              data={documentos}
              loading={cargando}
              loadingLabel="Cargando documentos..."
              emptyLabel="No hay documentos subidos todavía."
            />
          </div>
        </Card>
      ) : tab === 'comunicados' ? (
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
      ) : tab === 'redactar' ? (
        <Card className="flex-grow overflow-hidden" padding="p-0" light>
          <div className="h-full overflow-y-auto custom-scrollbar">
            <DataTable
              light
              columns={columnasDocumentosTexto}
              data={documentosTexto}
              loading={cargando}
              loadingLabel="Cargando documentos..."
              emptyLabel="No hay documentos redactados todavía."
            />
          </div>
        </Card>
      ) : (
        <Card className="flex-grow overflow-hidden" padding="p-0" light>
          <div className="h-full overflow-y-auto custom-scrollbar">
            <DataTable
              light
              columns={columnasPlantillas}
              data={plantillas}
              loading={cargando}
              loadingLabel="Cargando plantillas..."
              emptyLabel="No hay plantillas creadas todavía."
            />
          </div>
        </Card>
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

      {/* MODAL: REDACTAR / EDITAR DOCUMENTO DE TEXTO */}
      <Modal
        open={modalRedactarAbierto}
        onClose={() => setModalRedactarAbierto(false)}
        icon={PenSquare}
        size="lg"
        title={rdId ? 'Editar Documento' : 'Nuevo Documento'}
        subtitle="Redactado en el editor de texto"
        footer={
          <>
            <button type="button" onClick={() => setModalRedactarAbierto(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-redactar-documento" disabled={guardandoRedactar} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              {guardandoRedactar ? 'Guardando...' : 'Guardar Documento'}
            </button>
          </>
        }
      >
        <form id="form-redactar-documento" onSubmit={handleGuardarDocumentoTexto} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Título" required value={rdTitulo} onChange={(e) => setRdTitulo(e.target.value)} placeholder="Ej: Convocatoria Junta Ordinaria" />
            {!rdId && (
              <Field label="Partir de plantilla (opcional)" as="select" value={rdPlantillaId} onChange={(e) => handleSeleccionarPlantilla(e.target.value)}>
                <option value="">-- En blanco --</option>
                {plantillas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Field>
            )}
          </div>
          <Field label="Contenido" as="textarea" rows={12} value={rdContenido} onChange={(e) => setRdContenido(e.target.value)} placeholder="Redacta aquí el documento..." inputClassName="font-mono" />
        </form>
      </Modal>

      {/* MODAL: NUEVA / EDITAR PLANTILLA */}
      <Modal
        open={modalPlantillaAbierto}
        onClose={() => setModalPlantillaAbierto(false)}
        icon={LayoutTemplate}
        size="lg"
        title={plId ? 'Editar Plantilla' : 'Nueva Plantilla'}
        subtitle="Catálogo compartido del despacho"
        footer={
          <>
            <button type="button" onClick={() => setModalPlantillaAbierto(false)} className="flex-1 bg-slate-950 text-slate-400 py-2.5 rounded-xl text-xs font-bold border border-slate-900">Cancelar</button>
            <button type="submit" form="form-nueva-plantilla" disabled={guardandoPlantilla} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50">
              {guardandoPlantilla ? 'Guardando...' : 'Guardar Plantilla'}
            </button>
          </>
        }
      >
        <form id="form-nueva-plantilla" onSubmit={handleGuardarPlantilla} className="space-y-3">
          <Field label="Nombre" required value={plNombre} onChange={(e) => setPlNombre(e.target.value)} placeholder="Ej: Convocatoria de Junta Ordinaria" />
          <Field label="Descripción (opcional)" value={plDescripcion} onChange={(e) => setPlDescripcion(e.target.value)} placeholder="Para qué se usa esta plantilla" />
          <Field
            label="Contenido"
            as="textarea"
            rows={12}
            value={plContenido}
            onChange={(e) => setPlContenido(e.target.value)}
            placeholder={'Ej: Estimado/a {{nombre_propietario}},\n\nPor la presente se le convoca a la Junta de {{nombre_finca}}...'}
            hint="Usa variables tipo {{nombre_finca}} o {{nombre_propietario}} como recordatorio al rellenar el documento — se sustituyen a mano por ahora."
            inputClassName="font-mono"
          />
        </form>
      </Modal>
    </div>
  );
}
