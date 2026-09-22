import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Brand from '../../components/Brand.jsx';
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Menu,
  MessageSquare,
  Play,
  Sparkles,
  Users,
  WalletCards,
  X
} from 'lucide-react';

const MODULES = [
  { icon: ClipboardCheck, title: 'Juntas y votaciones', description: 'Controla asistencia, quórum y votaciones ponderadas por coeficiente desde una única pantalla.', color: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20' },
  { icon: BellRing, title: 'Incidencias', description: 'Organiza avisos, proveedores y estados para que cada problema tenga seguimiento.', color: 'text-amber-300 bg-amber-400/10 border-amber-400/20' },
  { icon: WalletCards, title: 'Cuotas y pagos', description: 'Consulta cuotas, pagos y morosidad con la información de cada propietario en contexto.', color: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20' },
  { icon: FileText, title: 'Documentos y comunicados', description: 'Centraliza archivos, plantillas y comunicaciones para dejar atrás las búsquedas interminables.', color: 'text-blue-300 bg-blue-400/10 border-blue-400/20' },
  { icon: CalendarDays, title: 'Agenda y reservas', description: 'Coordina juntas, vencimientos y reservas de zonas comunes sin solapamientos.', color: 'text-violet-300 bg-violet-400/10 border-violet-400/20' },
  { icon: MessageSquare, title: 'Atención al propietario', description: 'Da seguimiento a consultas y reclamaciones con un historial claro para todo el despacho.', color: 'text-sky-300 bg-sky-400/10 border-sky-400/20' }
];

const FAQS = [
  ['¿Para quién está pensado VotifAI?', 'Para despachos profesionales que administran varias comunidades y necesitan centralizar su operativa sin añadir más herramientas desconectadas.'],
  ['¿Puedo empezar con una sola finca?', 'Sí. Puedes comenzar con una cartera pequeña y ampliar el uso conforme tu despacho incorpore más comunidades.'],
  ['¿Qué hace la IA?', 'Ayuda a organizar y preparar información de juntas, transcripciones y borradores. La revisión final siempre permanece bajo el control del despacho.'],
  ['¿Los propietarios necesitan usar la misma cuenta?', 'No. El despacho y los propietarios tienen flujos de acceso separados, con permisos diferentes según su papel.']
];

function ProductPreview({ activeModule, setActiveModule }) {
  const previewData = {
    juntas: { label: 'Próxima junta', title: 'Residencial Los Olivos', value: '82%', note: 'quórum confirmado', icon: ClipboardCheck },
    incidencias: { label: 'Incidencia prioritaria', title: 'Avería ascensor principal', value: 'En curso', note: 'Proveedor asignado', icon: BellRing },
    cuotas: { label: 'Recaudación del mes', title: 'Estado de cuotas', value: '96,4%', note: 'cobrado hasta hoy', icon: WalletCards },
    documentos: { label: 'Último documento', title: 'Acta junta ordinaria', value: 'Listo', note: 'pendiente de revisión', icon: FileText }
  };
  const preview = previewData[activeModule];
  const PreviewIcon = preview.icon;

  return (
    <div className="relative mx-auto w-full max-w-[570px]">
      <div className="absolute -inset-5 rounded-[2rem] bg-cyan-400/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-[#0b1527]/95 p-4 shadow-2xl shadow-cyan-950/50 backdrop-blur-xl sm:p-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /><span className="ml-2 text-[11px] font-medium text-slate-500">panel.votifai</span></div>
          <span className="flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold text-cyan-200"><Sparkles size={11} /> Asistente activo</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 py-5">
          {Object.entries(previewData).map(([key, item]) => (
            <button key={key} type="button" aria-label={key} onClick={() => setActiveModule(key)} className={`rounded-xl px-2 py-2.5 text-[10px] font-bold transition ${activeModule === key ? 'bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-400/20' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white'}`}>
              <item.icon size={14} className="mx-auto mb-1" />
              <span className="hidden sm:block">{key === 'juntas' ? 'Juntas' : key === 'incidencias' ? 'Incidencias' : key === 'cuotas' ? 'Cuotas' : 'Documentos'}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
            <div className="mb-8 flex items-start justify-between gap-3"><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">{preview.label}</p><h3 className="text-base font-bold text-white">{preview.title}</h3></div><PreviewIcon size={19} className="text-cyan-300" /></div>
            <div className="flex items-end justify-between"><div><p className="text-3xl font-black tracking-tight text-white">{preview.value}</p><p className="mt-1 text-xs text-slate-500">{preview.note}</p></div><div className="flex h-14 items-end gap-1.5">{[45, 62, 50, 78, 68, 88, 72].map((height, index) => <span key={index} className="w-2 rounded-t bg-gradient-to-t from-blue-600 to-cyan-300" style={{ height: `${height}%` }} />)}</div></div>
          </div>
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] p-5"><p className="mb-5 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">Resumen del despacho</p><div className="space-y-4"><div><p className="text-2xl font-black text-white">24</p><p className="text-xs text-slate-500">comunidades</p></div><div><p className="text-2xl font-black text-white">438</p><p className="text-xs text-slate-500">propietarios</p></div><div className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><Check size={14} /> Todo bajo control</div></div></div>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs"><span className="text-slate-400">Una vista para cada decisión importante.</span><span className="font-bold text-cyan-300">VotifAI</span></div>
      </div>
    </div>
  );
}

function DemoModal({ open, onClose }) {
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setEnviando(true);
    setError('');

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('/api/demo-solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo enviar la solicitud.');
      setEnviada(true);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setEnviando(false);
    }
  };

  const handleClose = () => {
    setEnviada(false);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="demo-title">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-cyan-300/20 bg-[#0b1527] p-6 shadow-2xl shadow-cyan-950/50 sm:p-8">
        <button type="button" onClick={handleClose} aria-label="Cerrar solicitud de demo" className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><X size={20} /></button>
        {enviada ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"><Check size={28} /></div>
            <h2 id="demo-title" className="mt-5 text-2xl font-black text-white">Solicitud recibida</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Te contactaremos para enseñarte VotifAI con el contexto de tu despacho.</p>
            <button type="button" onClick={handleClose} className="mt-7 rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950">Cerrar</button>
          </div>
        ) : (
          <>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Demo personalizada</p>
            <h2 id="demo-title" className="mt-3 text-2xl font-black text-white">Ve cómo encaja VotifAI en tu despacho.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Cuéntanos lo esencial y prepararemos una demostración centrada en tu cartera.</p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <input name="nombre" required placeholder="Nombre y apellidos" aria-label="Nombre y apellidos" className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50" />
              <input name="email" required type="email" placeholder="Correo profesional" aria-label="Correo profesional" className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50" />
              <div className="grid gap-4 sm:grid-cols-2">
                <input name="telefono" type="tel" placeholder="Teléfono" aria-label="Teléfono" className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50" />
                <select name="comunidades" aria-label="Número de comunidades" defaultValue="" className="w-full rounded-xl border border-white/10 bg-[#101d32] px-4 py-3 text-sm text-slate-300 outline-none focus:border-cyan-300/50"><option value="" disabled>Comunidades gestionadas</option><option>1 - 20</option><option>21 - 50</option><option>51 - 150</option><option>Más de 150</option></select>
              </div>
              <textarea name="mensaje" rows="3" placeholder="¿Qué te gustaría resolver primero?" aria-label="Mensaje" className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50" />
              <label className="flex items-start gap-3 text-xs leading-5 text-slate-400"><input name="consentimientoPrivacidad" type="checkbox" value="true" required className="mt-1 h-4 w-4 accent-cyan-300" /><span>Acepto la <Link to="/legal/privacidad" onClick={handleClose} className="text-cyan-300 underline underline-offset-2">política de privacidad</Link> y el contacto para gestionar esta solicitud.</span></label>
              {error && <p className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
              <button type="submit" disabled={enviando} className="w-full rounded-xl bg-cyan-300 px-5 py-3.5 font-extrabold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60">{enviando ? 'Enviando solicitud...' : 'Solicitar mi demo'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function Welcome() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModule, setActiveModule] = useState('juntas');
  const [openFaq, setOpenFaq] = useState(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const goTo = (path) => {
    setMenuOpen(false);
    if (path === '/demo') {
      setDemoOpen(true);
      return;
    }
    navigate(path);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070d18] text-slate-100 selection:bg-cyan-300 selection:text-slate-950">
      <div className="pointer-events-none fixed inset-0 -z-0 opacity-70 [background-image:linear-gradient(rgba(148,163,184,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.045)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="pointer-events-none fixed left-[-20rem] top-[-18rem] h-[42rem] w-[42rem] rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="pointer-events-none fixed right-[-18rem] top-[30rem] h-[38rem] w-[38rem] rounded-full bg-blue-600/10 blur-[120px]" />

      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#070d18]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8"><Link to="/" aria-label="VotifAI inicio"><Brand className="h-14" /></Link><nav className="hidden items-center gap-8 text-sm font-medium text-slate-400 lg:flex"><a href="#plataforma" className="transition hover:text-white">Plataforma</a><a href="#problemas" className="transition hover:text-white">Qué resuelve</a><a href="#planes" className="transition hover:text-white">Planes</a><a href="#preguntas" className="transition hover:text-white">Preguntas</a></nav><div className="hidden items-center gap-3 sm:flex"><button type="button" onClick={() => goTo('/login/corporativo')} className="px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white">Iniciar sesión</button><button type="button" onClick={() => goTo('/demo')} className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-cyan-400/20 transition hover:-translate-y-0.5 hover:bg-cyan-200">Solicitar una demo</button></div><button type="button" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen(!menuOpen)} className="rounded-lg p-2 text-slate-300 sm:hidden">{menuOpen ? <X size={22} /> : <Menu size={22} />}</button></div>
        {menuOpen && <div className="border-t border-white/[0.08] px-5 py-5 sm:hidden"><div className="flex flex-col gap-4 text-sm text-slate-300"><a href="#plataforma" onClick={() => setMenuOpen(false)}>Plataforma</a><a href="#problemas" onClick={() => setMenuOpen(false)}>Qué resuelve</a><a href="#planes" onClick={() => setMenuOpen(false)}>Planes</a><button type="button" onClick={() => goTo('/login/corporativo')} className="border-t border-white/10 pt-4 text-left">Iniciar sesión</button><button type="button" onClick={() => goTo('/demo')} className="rounded-xl bg-cyan-300 py-3 font-bold text-slate-950">Solicitar una demo</button></div></div>}
      </header>

      <main className="relative z-10">
        <section id="plataforma" className="mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:pb-28"><div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16"><div className="max-w-2xl"><div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3.5 py-2 text-xs font-bold text-cyan-200"><span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" /> Plataforma para administradores de fincas</div><h1 className="text-4xl font-black leading-[1.03] tracking-tight text-white sm:text-6xl lg:text-[4.55rem]">Menos gestión.<br /><span className="bg-gradient-to-r from-cyan-200 via-cyan-300 to-blue-500 bg-clip-text text-transparent">Más control</span> sobre tus comunidades.</h1><p className="mt-7 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">Centraliza juntas, incidencias, cuotas, documentos y comunicación en una sola plataforma para que tu despacho avance sin perseguir información.</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => goTo('/register')} className="group inline-flex items-center justify-center gap-3 rounded-xl bg-cyan-300 px-6 py-4 font-extrabold text-slate-950 shadow-xl shadow-cyan-400/20 transition hover:-translate-y-1 hover:bg-cyan-200">Empezar con VotifAI <ArrowRight size={17} className="transition group-hover:translate-x-1" /></button><a href="#plataforma" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 py-4 font-bold text-white transition hover:bg-white/[0.09]"><Play size={16} className="fill-cyan-300 text-cyan-300" /> Ver cómo funciona</a></div><div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-slate-500"><span className="flex items-center gap-2"><Check size={14} className="text-emerald-300" /> Prueba inicial sin compromiso</span><span className="flex items-center gap-2"><Check size={14} className="text-emerald-300" /> Crece con tu cartera</span></div></div><div id="plataforma"><ProductPreview activeModule={activeModule} setActiveModule={setActiveModule} /></div></div></section>

        <section id="problemas" className="border-y border-white/[0.07] bg-white/[0.018] py-20 sm:py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"><div><p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Tu día a día, en orden</p><h2 className="max-w-lg text-3xl font-black tracking-tight text-white sm:text-4xl">El despacho no debería depender de diez herramientas distintas.</h2></div><p className="max-w-xl text-base leading-7 text-slate-400">Cuando cada comunidad se gestiona en un lugar distinto, las tareas se repiten y los detalles se pierden. VotifAI reúne el contexto donde lo necesitas.</p></div><div className="mt-14 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-[#0b1527]/80 p-6"><BarChart3 className="mb-8 text-cyan-300" size={24} /><h3 className="font-bold text-white">Información dispersa</h3><p className="mt-2 text-sm leading-6 text-slate-500">Encuentra juntas, documentos, avisos y pagos desde la ficha de cada finca.</p></div><div className="rounded-2xl border border-white/10 bg-[#0b1527]/80 p-6"><Users className="mb-8 text-cyan-300" size={24} /><h3 className="font-bold text-white">Seguimiento manual</h3><p className="mt-2 text-sm leading-6 text-slate-500">Conoce qué está pendiente, quién lo lleva y cuál es el siguiente paso.</p></div><div className="rounded-2xl border border-white/10 bg-[#0b1527]/80 p-6"><Sparkles className="mb-8 text-cyan-300" size={24} /><h3 className="font-bold text-white">Trabajo repetitivo</h3><p className="mt-2 text-sm leading-6 text-slate-500">Apóyate en IA para preparar información y dedicar más tiempo a tus clientes.</p></div></div></div></section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28"><div className="mx-auto max-w-2xl text-center"><p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Una plataforma, varios flujos</p><h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Todo el trabajo importante de tu despacho, conectado.</h2><p className="mt-4 leading-7 text-slate-400">Empieza por lo que más tiempo te quita y añade módulos cuando los necesites.</p></div><div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{MODULES.map(({ icon: Icon, title, description, color }) => <article key={title} className="group rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.045]"><div className={`mb-6 flex h-11 w-11 items-center justify-center rounded-xl border ${color}`}><Icon size={21} /></div><h3 className="font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p><div className="mt-5 flex items-center gap-2 text-xs font-bold text-cyan-300 opacity-0 transition group-hover:opacity-100">Conocer módulo <ArrowRight size={13} /></div></article>)}</div></section>

        <section id="planes" className="border-y border-white/[0.07] bg-[#0a1221] py-20 sm:py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]"><div><p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Crece a tu ritmo</p><h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Empieza con lo esencial. Amplía cuando tu despacho lo necesite.</h2><p className="mt-5 leading-7 text-slate-400">Planes desde 49 €/mes según el tamaño de tu cartera. En la demo definimos el nivel adecuado sin pagar por módulos que todavía no utilizas.</p><button type="button" onClick={() => goTo('/demo')} className="mt-8 inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 px-5 py-3 text-sm font-bold text-cyan-200 transition hover:bg-cyan-300/10">Solicitar orientación <ArrowRight size={15} /></button></div><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-bold text-cyan-300">Starter</p><p className="mt-3 text-2xl font-black text-white">Desde 49 €/mes</p><p className="mt-3 text-sm leading-6 text-slate-500">Gestión de fincas, propietarios, documentos e incidencias.</p></div><div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/[0.08] p-5 shadow-lg shadow-cyan-950/30"><p className="text-xs font-bold text-cyan-200">Profesional</p><p className="mt-3 text-2xl font-black text-white">Desde 99 €/mes</p><p className="mt-3 text-sm leading-6 text-slate-400">Más capacidad, cuotas, agenda, CRM y asistencia de IA.</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-bold text-cyan-300">Premium</p><p className="mt-3 text-2xl font-black text-white">Desde 199 €/mes</p><p className="mt-3 text-sm leading-6 text-slate-500">Mayor capacidad, automatización y soporte prioritario.</p></div></div></div></div></section>

        <section id="preguntas" className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-28"><div className="text-center"><p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Preguntas frecuentes</p><h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Antes de dar el siguiente paso</h2></div><div className="mt-12 space-y-3">{FAQS.map(([question, answer], index) => <div key={question} className="rounded-2xl border border-white/10 bg-white/[0.025] px-5"><button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-4 py-5 text-left font-bold text-white"><span>{question}</span><ChevronDown size={18} className={`shrink-0 text-cyan-300 transition ${openFaq === index ? 'rotate-180' : ''}`} /></button>{openFaq === index && <p className="border-t border-white/10 pb-5 pt-4 text-sm leading-6 text-slate-400">{answer}</p>}</div>)}</div></section>

        <section className="px-5 pb-20 sm:px-8 sm:pb-28"><div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/[0.13] via-blue-500/[0.08] to-transparent p-8 text-center sm:p-14"><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Menos tareas repetidas. Más tiempo para tu cartera.</p><h2 className="mx-auto mt-4 max-w-2xl text-3xl font-black tracking-tight text-white sm:text-5xl">Haz que tu despacho trabaje con una vista compartida.</h2><p className="mx-auto mt-5 max-w-xl leading-7 text-slate-400">Conoce VotifAI y descubre qué procesos puedes centralizar primero.</p><button type="button" onClick={() => goTo('/demo')} className="mt-8 inline-flex items-center gap-3 rounded-xl bg-cyan-300 px-6 py-4 font-extrabold text-slate-950 shadow-xl shadow-cyan-400/20 transition hover:-translate-y-1 hover:bg-cyan-200">Solicitar una demo <ArrowRight size={17} /></button></div></section>
      </main>

      <footer className="border-t border-white/[0.08] bg-[#050a12] py-10"><div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 text-sm text-slate-500 sm:px-8 lg:flex-row lg:items-center lg:justify-between"><div><Brand /><p className="mt-4 max-w-xs text-xs leading-5 text-slate-600">Gobernanza y gestión inteligente para despachos de administración de fincas.</p></div><div className="flex flex-wrap gap-x-6 gap-y-3 text-xs"><Link to="/legal/aviso-legal" className="transition hover:text-white">Aviso legal</Link><Link to="/legal/privacidad" className="transition hover:text-white">Privacidad</Link><Link to="/legal/terminos" className="transition hover:text-white">Términos</Link><button type="button" onClick={() => goTo('/login/corporativo')} className="transition hover:text-white">Acceso administradores</button></div><p className="text-xs text-slate-600">© {new Date().getFullYear()} VotifAI</p></div></footer>
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
