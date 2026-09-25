import { useEffect, useState } from 'react';
import { Mail, Plus, Send, Pencil, Trash2, CheckCircle2, AlertTriangle, LoaderCircle, Star, ChevronDown } from 'lucide-react';
import Card from './ui/Card.jsx';
import Field from './ui/Field.jsx';

// "Mi despacho" → Correo de envío. Cada despacho conecta su propio buzón
// (o varios, por área) y los emails a sus vecinos salen desde su cuenta:
// ni la dirección ni las respuestas pasan por VotifAI.

const PROVEEDORES = {
  gmail: { nombre: 'Gmail o Google Workspace', host: 'smtp.gmail.com', puerto: 465, seguro: true, ayuda: <>Google no acepta tu contraseña normal: activa la verificación en dos pasos y crea una <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="font-bold text-blue-400 underline">contraseña de aplicación</a> (16 letras) y pégala aquí.</> },
  microsoft365: { nombre: 'Microsoft 365 (Outlook de empresa)', host: 'smtp.office365.com', puerto: 587, seguro: false, ayuda: 'El buzón necesita tener activado "SMTP autenticado" en el centro de administración de Microsoft 365. Si usas verificación en dos pasos, crea una contraseña de aplicación. Si no conecta, avísanos.' },
  outlook: { nombre: 'Outlook.com / Hotmail (personal)', host: 'smtp-mail.outlook.com', puerto: 587, seguro: false, ayuda: 'Microsoft limita este acceso en las cuentas personales y puede no funcionar. Para un despacho recomendamos un correo con dominio propio o Google Workspace.' },
  hostinger: { nombre: 'Hostinger', host: 'smtp.hostinger.com', puerto: 465, seguro: true, ayuda: 'Usa el email completo como usuario y la contraseña del buzón (la de hPanel → Emails).' },
  ionos: { nombre: 'IONOS (1&1)', host: 'smtp.ionos.es', puerto: 465, seguro: true, ayuda: 'Usa el email completo como usuario y la contraseña del buzón.' },
  zoho: { nombre: 'Zoho Mail', host: 'smtp.zoho.eu', puerto: 465, seguro: true, ayuda: 'Si tienes la verificación en dos pasos activada, crea una contraseña específica de aplicación en Zoho.' },
  otro: { nombre: 'Otro proveedor', host: '', puerto: 465, seguro: true, ayuda: 'Tu proveedor de correo te indica el servidor SMTP, el puerto y la seguridad (normalmente 465 con SSL o 587 con STARTTLS).' }
};

const vacio = (nombreDespacho) => ({ proveedor: 'gmail', etiqueta: '', email: '', nombre_remitente: nombreDespacho || '', smtp_usuario: '', smtp_host: PROVEEDORES.gmail.host, smtp_puerto: 465, smtp_seguro: true, smtp_password: '', areas: [], principal: false });

async function llamar(url, metodo, datos) {
  const r = await fetch(url, { method: metodo, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: datos ? JSON.stringify(datos) : undefined });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(res.error || 'No se pudo completar la operación.');
  return res;
}

export default function CorreosDespacho({ nombreDespacho, emailAcceso }) {
  const [correos, setCorreos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [cifradoDisponible, setCifradoDisponible] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState(null); // null | { id?, ...campos }
  const [avanzado, setAvanzado] = useState(false);
  const [estado, setEstado] = useState({ enviando: false, ok: '', error: '' });
  const [probando, setProbando] = useState(null);

  const cargar = () => llamar('/api/despacho/correos', 'GET')
    .then((r) => {
      setCorreos(r.correos);
      setAreas(r.areas);
      setCifradoDisponible(r.cifrado_disponible);
    })
    .catch((err) => setEstado({ enviando: false, ok: '', error: err.message }))
    .finally(() => setCargando(false));
  useEffect(() => {
    cargar();
  }, []);

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const elegirProveedor = (e) => {
    const p = PROVEEDORES[e.target.value];
    setForm((f) => ({ ...f, proveedor: e.target.value, smtp_host: p.host, smtp_puerto: p.puerto, smtp_seguro: p.seguro }));
    setAvanzado(e.target.value === 'otro');
  };
  const alternarArea = (id) => setForm((f) => ({ ...f, areas: f.areas.includes(id) ? f.areas.filter((a) => a !== id) : [...f.areas, id] }));

  const abrirNuevo = () => { setForm(vacio(nombreDespacho)); setAvanzado(false); setEstado({ enviando: false, ok: '', error: '' }); };
  const abrirEdicion = (c) => { setForm({ ...c, smtp_password: '' }); setAvanzado(c.proveedor === 'otro'); setEstado({ enviando: false, ok: '', error: '' }); };

  const guardar = async (e) => {
    e.preventDefault();
    setEstado({ enviando: true, ok: '', error: '' });
    try {
      const datos = { ...form, smtp_puerto: Number(form.smtp_puerto), smtp_usuario: form.smtp_usuario || form.email };
      const r = form.id ? await llamar(`/api/despacho/correos/${form.id}`, 'PUT', datos) : await llamar('/api/despacho/correos', 'POST', datos);
      setForm(null);
      setEstado({ enviando: false, ok: r.mensaje, error: '' });
      cargar();
    } catch (err) {
      setEstado({ enviando: false, ok: '', error: err.message });
    }
  };

  const probar = async (c) => {
    setProbando(c.id);
    setEstado({ enviando: false, ok: '', error: '' });
    try {
      const r = await llamar(`/api/despacho/correos/${c.id}/probar`, 'POST');
      setEstado({ enviando: false, ok: r.mensaje, error: '' });
    } catch (err) {
      setEstado({ enviando: false, ok: '', error: err.message });
    } finally {
      setProbando(null);
      cargar();
    }
  };

  const desconectar = async (c) => {
    if (!window.confirm(`¿Desconectar ${c.email}? Los emails de sus áreas pasarán a salir del buzón principal.`)) return;
    try {
      await llamar(`/api/despacho/correos/${c.id}`, 'DELETE');
      cargar();
    } catch (err) {
      setEstado({ enviando: false, ok: '', error: err.message });
    }
  };

  const principal = correos.find((c) => c.principal);
  const buzonDeArea = (id) => correos.find((c) => c.areas.includes(id)) || principal;
  const proveedor = form ? PROVEEDORES[form.proveedor] || PROVEEDORES.otro : null;

  return (
    <Card padding="p-6">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-black text-white"><Mail size={16} className="text-blue-400" /> Correo de envío</h2>
            <p className="mt-1 text-3xs leading-relaxed text-slate-500">Las convocatorias, actas y avisos a tus vecinos salen desde tu propio correo, y sus respuestas te llegan a tu buzón. Puedes conectar varios buzones y elegir de cuál sale cada tipo de email.</p>
          </div>
          {!form && correos.length > 0 && (
            <button type="button" onClick={abrirNuevo} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-800 px-3 py-2 text-3xs font-bold text-slate-300 hover:text-white"><Plus size={13} /> Añadir buzón</button>
          )}
        </div>

        {!cifradoDisponible && (
          <p className="flex gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-3xs font-bold text-amber-200"><AlertTriangle size={14} className="shrink-0" /> El servidor aún no tiene configurada la clave para guardar contraseñas de correo (CORREOS_CLAVE_CIFRADO). Hasta entonces no se pueden conectar buzones.</p>
        )}

        {cargando ? (
          <p className="text-3xs text-slate-500">Cargando buzones...</p>
        ) : correos.length === 0 && !form ? (
          <div className="rounded-2xl border border-dashed border-slate-800 p-5 text-center">
            <p className="text-xs font-bold text-white">Aún no has conectado tu correo</p>
            <p className="mx-auto mt-1 max-w-md text-3xs leading-relaxed text-slate-500">Mientras tanto, los emails a tus vecinos salen desde VotifAI en nombre de tu despacho, y las respuestas llegan a {emailAcceso || 'tu email de acceso'}.</p>
            <button type="button" onClick={abrirNuevo} disabled={!cifradoDisponible} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-40"><Plus size={14} /> Conectar mi correo</button>
          </div>
        ) : (
          <>
            {correos.length > 0 && (
              <div className="space-y-2">
                {correos.map((c) => (
                  <div key={c.id} className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-white">
                        {c.email}
                        {c.principal && <span className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-5xs font-black uppercase tracking-wider text-blue-300"><Star size={9} /> Principal</span>}
                        {c.etiqueta && <span className="text-3xs font-medium text-slate-500">{c.etiqueta}</span>}
                      </p>
                      <p className="mt-1 text-4xs text-slate-500">Remitente: {c.nombre_remitente}</p>
                      {c.ultimo_error ? (
                        <p className="mt-1 flex items-start gap-1.5 text-4xs font-bold text-rose-300"><AlertTriangle size={11} className="mt-0.5 shrink-0" /> Último envío fallido: {c.ultimo_error}</p>
                      ) : c.verificado_en && (
                        <p className="mt-1 flex items-center gap-1.5 text-4xs font-bold text-emerald-300"><CheckCircle2 size={11} /> Conectado</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => probar(c)} disabled={probando === c.id} className="flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-1.5 text-4xs font-bold text-slate-300 hover:text-white disabled:opacity-50">{probando === c.id ? <LoaderCircle size={11} className="animate-spin" /> : <Send size={11} />} Probar</button>
                      <button type="button" onClick={() => abrirEdicion(c)} className="flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-1.5 text-4xs font-bold text-slate-300 hover:text-white"><Pencil size={11} /> Editar</button>
                      <button type="button" onClick={() => desconectar(c)} aria-label={`Desconectar ${c.email}`} className="rounded-lg border border-slate-800 px-2 py-1.5 text-slate-500 hover:text-rose-300"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
                <div className="rounded-xl bg-slate-900/60 px-4 py-3 text-4xs text-slate-400">
                  {areas.map((a) => <p key={a.id}><span className="font-bold text-slate-300">{a.descripcion}</span> → {buzonDeArea(a.id)?.email || '—'}</p>)}
                </div>
              </div>
            )}

            {form && (
              <form onSubmit={guardar} className="space-y-4 rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-4">
                <p className="text-xs font-black text-white">{form.id ? `Editar ${form.email}` : 'Conectar un buzón'}</p>
                <label className="block">
                  <span className="mb-1.5 block text-4xs font-bold uppercase tracking-wider text-slate-400">Proveedor de correo</span>
                  <select value={form.proveedor} onChange={elegirProveedor} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none">
                    {Object.entries(PROVEEDORES).map(([id, p]) => <option key={id} value={id}>{p.nombre}</option>)}
                  </select>
                </label>
                <p className="rounded-xl bg-slate-950 px-3 py-2.5 text-4xs leading-relaxed text-slate-400">{proveedor.ayuda}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Email del buzón" icon={Mail} type="email" required value={form.email} onChange={cambiar('email')} placeholder="convocatorias@tudespacho.es" />
                  <Field label={form.id ? 'Contraseña (vacío = la misma)' : 'Contraseña o contraseña de aplicación'} type="password" required={!form.id} value={form.smtp_password} onChange={cambiar('smtp_password')} autoComplete="new-password" />
                  <Field label="Nombre que verán los vecinos" type="text" required value={form.nombre_remitente} onChange={cambiar('nombre_remitente')} placeholder="Gestiones Olmo" />
                  <Field label="Etiqueta (opcional)" type="text" value={form.etiqueta} onChange={cambiar('etiqueta')} placeholder="Convocatorias, Administración..." />
                </div>

                <button type="button" onClick={() => setAvanzado((v) => !v)} className="flex items-center gap-1 text-4xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300">
                  <ChevronDown size={12} className={avanzado ? 'rotate-180' : ''} /> Servidor y puerto
                </button>
                {avanzado && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <Field className="sm:col-span-2" label="Servidor SMTP" type="text" required value={form.smtp_host} onChange={cambiar('smtp_host')} placeholder="smtp.tuproveedor.com" />
                    <Field label="Puerto" type="number" required value={form.smtp_puerto} onChange={cambiar('smtp_puerto')} />
                    <label className="block">
                      <span className="mb-1.5 block text-4xs font-bold uppercase tracking-wider text-slate-400">Seguridad</span>
                      <select value={form.smtp_seguro ? 'ssl' : 'starttls'} onChange={(e) => setForm((f) => ({ ...f, smtp_seguro: e.target.value === 'ssl' }))} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none">
                        <option value="ssl">SSL/TLS (465)</option>
                        <option value="starttls">STARTTLS (587)</option>
                      </select>
                    </label>
                    <Field className="sm:col-span-4" label="Usuario (si no es el email)" type="text" value={form.smtp_usuario} onChange={cambiar('smtp_usuario')} placeholder={form.email || 'El email del buzón'} />
                  </div>
                )}

                {(correos.length > 0 || form.id) && (
                  <div className="space-y-2">
                    <p className="text-4xs font-bold uppercase tracking-wider text-slate-400">Qué emails salen de este buzón</p>
                    {areas.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 text-3xs text-slate-300">
                        <input type="checkbox" checked={form.areas.includes(a.id)} onChange={() => alternarArea(a.id)} className="accent-blue-500" /> {a.descripcion}
                      </label>
                    ))}
                    <label className="flex items-center gap-2 text-3xs text-slate-300">
                      <input type="checkbox" checked={form.principal} onChange={cambiar('principal')} className="accent-blue-500" /> Buzón principal (envía todo lo que no tenga otro buzón asignado)
                    </label>
                  </div>
                )}

                <p className="text-4xs leading-relaxed text-slate-500">Al guardar te enviaremos un email de prueba a este buzón. La contraseña se guarda cifrada y solo se usa para enviar tus emails.</p>
                {estado.error && <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-3xs font-bold text-rose-200">{estado.error}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm(null)} className="rounded-xl border border-slate-800 px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white">Cancelar</button>
                  <button type="submit" disabled={estado.enviando} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50">
                    {estado.enviando && <LoaderCircle size={14} className="animate-spin" />}{estado.enviando ? 'Comprobando conexión...' : 'Guardar y probar'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {!form && estado.ok && <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-xs font-bold text-emerald-200">{estado.ok}</p>}
        {!form && estado.error && <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-xs font-bold text-rose-200">{estado.error}</p>}
      </div>
    </Card>
  );
}
