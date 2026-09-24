import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Brand from '../../components/Brand.jsx';
import { PLANES_RESPALDO, LEMA_PLAN, caracteristicasPlan } from '../../lib/planes.js';
import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  FileSignature,
  FileText,
  Gavel,
  Landmark,
  Mail,
  Menu,
  MessageSquare,
  Mic,
  PiggyBank,
  Receipt,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Vote,
  WalletCards,
  X
} from 'lucide-react';

// =========================================================================
// Web pública de VotifAI. Estética propia del sector (despacho, acta,
// papel), distinta de la de NexuraIA: cabecera y portada en azul tinta
// (el logo tiene "Votif" en blanco y necesita fondo oscuro), el resto sobre
// fondo papel con titulares en serifa. Todo lo que se promete aquí existe
// en la app: si se cambia una función, revisar este texto.
// =========================================================================

const TINTA = 'bg-[#0b1a33]';
const PAPEL = 'bg-[#f6f3ec]';

const CICLO = [
  { icon: Mail, paso: 'Convocatoria', texto: 'Orden del día a cada propietario por email, con la relación de morosos que la ley obliga a incluir.' },
  { icon: UserCheck, paso: 'Delegaciones', texto: 'El vecino delega su voto en otro desde el móvil, con el consentimiento de ambos. Las representaciones en sala, también.' },
  { icon: Vote, paso: 'Votación', texto: 'Desde el móvil o a mano alzada en la sala. Cada voto pondera por su coeficiente, en primera o segunda convocatoria.' },
  { icon: Gavel, paso: 'Resultado', texto: 'Mayoría simple, tres quintos o unanimidad, con doble mayoría de propietarios y cuotas en cada punto.' },
  { icon: FileSignature, paso: 'Acta', texto: 'Borrador del acta con asistentes, resultados e intervenciones transcritas. PDF y envío a todos al cerrar.' }
];

const LPH = [
  { art: 'Art. 15.2', titulo: 'Privación del voto', texto: 'Los propietarios con deudas vencidas aparecen como privados de voto y no computan en las mayorías.' },
  { art: 'Art. 16.2', titulo: 'Convocatoria', texto: 'La convocatoria incluye la relación de propietarios que no están al corriente de pago.' },
  { art: 'Art. 17', titulo: 'Mayorías', texto: 'Cada punto se vota con la mayoría que le corresponde y se calcula por propietarios y por cuotas.' },
  { art: 'Art. 17.8', titulo: 'Ausentes', texto: 'Si el acuerdo depende de los ausentes, queda pendiente del plazo para que manifiesten su voto.' },
  { art: 'Art. 19', titulo: 'Acta', texto: 'Asistentes, representaciones, resultados y acuerdos, listos para revisar y firmar.' },
  { art: 'Art. 9.1.f', titulo: 'Fondo de reserva', texto: 'Control de la aportación mínima del 10 % del último presupuesto ordinario.' }
];

const GESTION = [
  { icon: WalletCards, titulo: 'Cuotas y recibos', texto: 'Emisión masiva por coeficiente o a partes iguales, cobros, recibos en PDF y certificados de deuda.' },
  { icon: Landmark, titulo: 'Contabilidad', texto: 'Presupuestos por partidas, ejecución, cobros que se contabilizan solos y liquidaciones en PDF.' },
  { icon: PiggyBank, titulo: 'Fondo de reserva', texto: 'Aportaciones, movimientos y saldo de cada comunidad, siempre a la vista.' },
  { icon: BellRing, titulo: 'Incidencias', texto: 'Avisos, proveedores y estados, con el historial de cada avería.' },
  { icon: FileText, titulo: 'Documentos', texto: 'Actas, estatutos, plantillas y comunicados de cada finca en su sitio.' },
  { icon: CalendarDays, titulo: 'Agenda y reservas', texto: 'Juntas, vencimientos y reservas de zonas comunes sin solapamientos.' },
  { icon: MessageSquare, titulo: 'Atención al propietario', texto: 'Consultas y reclamaciones con seguimiento para todo el despacho.' },
  { icon: Building2, titulo: 'Censo y titularidad', texto: 'Propietarios, coeficientes y cambios de titular con su historial.' }
];

const FAQS = [
  ['¿Los propietarios tienen que instalar algo?', 'No. Entran desde el navegador del móvil o del ordenador con su correo y su contraseña. La primera vez reciben un enlace en el correo que el despacho tiene en el censo.'],
  ['¿Y los vecinos que no usan el móvil?', 'El administrador registra en la sala la asistencia, las representaciones y los votos a mano alzada. Todo suma en el resultado y queda reflejado en el acta.'],
  ['¿Qué hace la inteligencia artificial?', 'Transcribe las intervenciones de la junta y prepara el borrador del acta. El administrador revisa y aprueba siempre el texto final.'],
  ['¿Puedo empezar con una sola comunidad?', 'Sí. Todos los planes incluyen todos los módulos; solo cambian el número de fincas y la transcripción de voz. Pruébalo 15 días gratis, sin tarjeta.'],
  ['¿Cómo se tratan los datos de los propietarios?', 'El despacho es el responsable del tratamiento y VotifAI actúa como encargado, con su contrato de encargo del tratamiento (art. 28 RGPD) aceptado al registrarse.']
];

// Maqueta del acta en vivo: un punto del orden del día con su mayoría y
// el resultado por coeficiente, como lo ve el administrador en la junta.
function ActaEnVivo() {
  const puntos = [
    { n: 1, titulo: 'Aprobación de cuentas del ejercicio 2025', mayoria: 'Simple', favor: 71.4, contra: 9.2, resultado: 'Aprobado' },
    { n: 2, titulo: 'Instalación de ascensor', mayoria: 'Tres quintos', favor: 64.8, contra: 18.1, resultado: 'Aprobado' },
    { n: 3, titulo: 'Cambio de los estatutos', mayoria: 'Unanimidad', favor: 88.5, contra: 0, resultado: 'Pendiente de ausentes' }
  ];
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div className="absolute -right-6 -top-6 hidden h-full w-full rounded-[1.75rem] border border-white/10 sm:block" />
      <div className="relative rounded-[1.75rem] bg-[#fbf9f4] p-5 text-slate-800 shadow-2xl shadow-black/40 sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-slate-300/70 pb-4">
          <div>
            <p className="text-4xs font-bold uppercase tracking-[0.2em] text-slate-500">Junta ordinaria · 2.ª convocatoria</p>
            <h3 className="mt-1 font-display text-xl font-semibold text-slate-900">C.P. Residencial Los Olivos</h3>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-600/10 px-2.5 py-1 text-4xs font-bold text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" /> En curso
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 py-4 text-center">
          <div><p className="font-display text-2xl font-semibold text-slate-900">31</p><p className="text-4xs text-slate-500">presentes</p></div>
          <div><p className="font-display text-2xl font-semibold text-slate-900">9</p><p className="text-4xs text-slate-500">representados</p></div>
          <div><p className="font-display text-2xl font-semibold text-slate-900">2</p><p className="text-4xs text-slate-500">privados de voto</p></div>
        </div>
        <ol className="space-y-3">
          {puntos.map((p) => (
            <li key={p.n} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold text-slate-900"><span className="mr-1.5 text-slate-400">{p.n}.</span>{p.titulo}</p>
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-5xs font-bold uppercase tracking-wider text-slate-500">{p.mayoria}</span>
              </div>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100">
                <span className="bg-emerald-600" style={{ width: `${p.favor}%` }} />
                <span className="bg-rose-500" style={{ width: `${p.contra}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-4xs">
                <span className="text-slate-500">{p.favor.toLocaleString('es-ES')} % de cuotas a favor</span>
                <span className={`font-bold ${p.resultado === 'Aprobado' ? 'text-emerald-700' : 'text-amber-700'}`}>{p.resultado}</span>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[#0b1a33] px-4 py-3 text-4xs text-slate-300">
          <Mic size={13} className="shrink-0 text-sky-300" />
          <span className="truncate"><span className="font-bold text-white">2.º B:</span> «Pido que conste en acta que el presupuesto incluye la…»</span>
        </div>
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

  const campo = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#1d4fd8]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1a33]/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="demo-title">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#fbf9f4] p-6 text-slate-800 shadow-2xl sm:p-8">
        <button type="button" onClick={handleClose} aria-label="Cerrar solicitud de demo" className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"><X size={20} /></button>
        {enviada ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700"><Check size={28} /></div>
            <h2 id="demo-title" className="mt-5 font-display text-2xl font-semibold text-slate-900">Solicitud recibida</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Te contactaremos para enseñarte VotifAI con las comunidades de tu despacho.</p>
            <button type="button" onClick={handleClose} className="mt-7 rounded-xl bg-[#1d4fd8] px-5 py-3 font-bold text-white">Cerrar</button>
          </div>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1d4fd8]">Demo personalizada</p>
            <h2 id="demo-title" className="mt-3 font-display text-2xl font-semibold text-slate-900">Te enseñamos una junta completa en VotifAI.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Cuéntanos cuántas comunidades llevas y qué quieres resolver primero.</p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <input name="nombre" required placeholder="Nombre y apellidos" aria-label="Nombre y apellidos" className={campo} />
              <input name="email" required type="email" placeholder="Correo profesional" aria-label="Correo profesional" className={campo} />
              <div className="grid gap-4 sm:grid-cols-2">
                <input name="telefono" type="tel" placeholder="Teléfono" aria-label="Teléfono" className={campo} />
                <select name="comunidades" aria-label="Número de comunidades" defaultValue="" className={campo}><option value="" disabled>Comunidades gestionadas</option><option>1 - 20</option><option>21 - 50</option><option>51 - 150</option><option>Más de 150</option></select>
              </div>
              <textarea name="mensaje" rows="3" placeholder="¿Qué te gustaría resolver primero?" aria-label="Mensaje" className={`${campo} resize-none`} />
              <label className="flex items-start gap-3 text-xs leading-5 text-slate-600"><input name="consentimientoPrivacidad" type="checkbox" value="true" required className="mt-1 h-4 w-4 accent-[#1d4fd8]" /><span>Acepto la <Link to="/legal/privacidad" onClick={handleClose} className="text-[#1d4fd8] underline underline-offset-2">política de privacidad</Link> y el contacto para gestionar esta solicitud.</span></label>
              {error && <p className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
              <button type="submit" disabled={enviando} className="w-full rounded-xl bg-[#1d4fd8] px-5 py-3.5 font-bold text-white transition hover:bg-[#1a43b8] disabled:cursor-wait disabled:opacity-60">{enviando ? 'Enviando solicitud...' : 'Solicitar mi demo'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Encabezado({ kicker, titulo, texto, centrado = false, oscuro = false }) {
  return (
    <div className={centrado ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className={`mb-3 text-xs font-bold uppercase tracking-[0.2em] ${oscuro ? 'text-sky-300' : 'text-[#1d4fd8]'}`}>{kicker}</p>
      <h2 className={`font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[2.6rem] ${oscuro ? 'text-white' : 'text-slate-900'}`}>{titulo}</h2>
      {texto && <p className={`mt-4 text-base leading-7 ${oscuro ? 'text-slate-400' : 'text-slate-600'}`}>{texto}</p>}
    </div>
  );
}

export default function Welcome() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);
  const [planes, setPlanes] = useState(PLANES_RESPALDO);
  useEffect(() => {
    fetch('/api/billing/planes')
      .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
      .then((datos) => { if (datos?.planes?.length) setPlanes(datos.planes); })
      .catch(() => {});
  }, []);
  const goTo = (path) => {
    setMenuOpen(false);
    if (path === '/demo') {
      setDemoOpen(true);
      return;
    }
    navigate(path);
  };

  return (
    <div className={`min-h-screen overflow-x-hidden ${PAPEL} text-slate-800 selection:bg-[#1d4fd8] selection:text-white`}>

      <header className={`sticky top-0 z-40 border-b border-white/10 bg-[#0b1a33]/95 backdrop-blur-xl`}>
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label="VotifAI inicio"><Brand className="h-12" /></Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 lg:flex">
            <a href="#junta" className="transition hover:text-white">La junta</a>
            <a href="#lph" className="transition hover:text-white">LPH</a>
            <a href="#gestion" className="transition hover:text-white">Gestión</a>
            <a href="#planes" className="transition hover:text-white">Planes</a>
            <a href="#preguntas" className="transition hover:text-white">Preguntas</a>
          </nav>
          <div className="hidden items-center gap-2 sm:flex">
            <button type="button" onClick={() => goTo('/login/comunidad')} className="px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white">Soy propietario</button>
            <button type="button" onClick={() => goTo('/login/corporativo')} className="px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white">Acceso despachos</button>
            <button type="button" onClick={() => goTo('/demo')} className="ml-1 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#0b1a33] transition hover:bg-slate-200">Solicitar demo</button>
          </div>
          <button type="button" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen(!menuOpen)} className="rounded-lg p-2 text-slate-200 sm:hidden">{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
        {menuOpen && (
          <div className="border-t border-white/10 px-5 py-5 sm:hidden">
            <div className="flex flex-col gap-4 text-sm text-slate-200">
              <a href="#junta" onClick={() => setMenuOpen(false)}>La junta</a>
              <a href="#lph" onClick={() => setMenuOpen(false)}>LPH</a>
              <a href="#gestion" onClick={() => setMenuOpen(false)}>Gestión</a>
              <a href="#planes" onClick={() => setMenuOpen(false)}>Planes</a>
              <button type="button" onClick={() => goTo('/login/comunidad')} className="border-t border-white/10 pt-4 text-left">Soy propietario</button>
              <button type="button" onClick={() => goTo('/login/corporativo')} className="text-left">Acceso despachos</button>
              <button type="button" onClick={() => goTo('/demo')} className="rounded-xl bg-white py-3 font-bold text-[#0b1a33]">Solicitar demo</button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* PORTADA */}
        <section className={`${TINTA} relative overflow-hidden text-white`}>
          <svg aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 hidden h-72 w-auto text-white/[0.035] lg:block" viewBox="0 0 400 300" fill="currentColor">
            <rect x="20" y="60" width="110" height="240" /><rect x="140" y="20" width="130" height="280" /><rect x="280" y="100" width="100" height="200" />
          </svg>
          <div className="relative mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] items-center gap-14 px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-2 lg:gap-16 lg:pb-28">
            <div>
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-slate-300">
                <Building2 size={14} className="text-sky-300" /> Para administradores de fincas
              </p>
              <h1 className="font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                La junta de propietarios, <span className="italic text-sky-300">de la convocatoria al acta.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                VotifAI calcula el quórum y las mayorías por coeficiente aplicando la Ley de Propiedad Horizontal, recoge los votos desde el móvil o en la sala y redacta el acta mientras la junta sucede. Y lleva el resto del año: cuotas, contabilidad e incidencias de cada comunidad.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => goTo('/register')} className="group inline-flex items-center justify-center gap-3 rounded-xl bg-[#1d4fd8] px-6 py-4 font-bold text-white shadow-xl shadow-black/30 transition hover:bg-[#2458e6]">
                  Probar 15 días gratis <ArrowRight size={17} className="transition group-hover:translate-x-1" />
                </button>
                <button type="button" onClick={() => goTo('/demo')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-6 py-4 font-bold text-white transition hover:bg-white/10">
                  Solicitar una demo
                </button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-slate-400">
                <span className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> Sin tarjeta</span>
                <span className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> Todos los módulos en todos los planes</span>
                <span className="flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-400" /> Contrato de encargo RGPD</span>
              </div>
            </div>
            <ActaEnVivo />
          </div>
        </section>

        {/* EL CICLO DE LA JUNTA */}
        <section id="junta" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
          <Encabezado
            kicker="Una junta, de principio a fin"
            titulo="Todo lo que pasa en una junta, en el mismo sitio."
            texto="Sin hojas de cálculo para sumar coeficientes ni actas redactadas de memoria dos semanas después."
          />
          <ol className="mt-14 grid gap-4 md:grid-cols-5">
            {CICLO.map(({ icon: Icon, paso, texto }, i) => (
              <li key={paso} className="relative rounded-2xl border border-slate-300/70 bg-white p-5">
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0b1a33] text-white"><Icon size={18} /></span>
                  <span className="font-display text-3xl font-semibold text-slate-200">{i + 1}</span>
                </div>
                <h3 className="font-bold text-slate-900">{paso}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{texto}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* LA LPH, INCLUIDA */}
        <section id="lph" className="scroll-mt-20 border-y border-slate-300/70 bg-[#efeadf] py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Encabezado
                kicker="Ley de Propiedad Horizontal"
                titulo="La ley ya viene aplicada."
                texto="Las reglas que un administrador revisa a mano en cada junta, VotifAI las aplica en cada punto del orden del día. Tú decides; el cálculo no se equivoca."
              />
            </div>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-slate-300/70 bg-slate-300/70 sm:grid-cols-2">
              {LPH.map(({ art, titulo, texto }) => (
                <div key={art} className="bg-[#fbf9f4] p-6">
                  <p className="font-display text-sm font-semibold italic text-[#1d4fd8]">{art}</p>
                  <h3 className="mt-2 font-bold text-slate-900">{titulo}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DOS ACCESOS */}
        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <Encabezado centrado kicker="Dos puertas" titulo="Una para el despacho. Otra para cada vecino." />
          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl bg-[#0b1a33] p-8 text-white">
              <Landmark size={26} className="text-sky-300" />
              <h3 className="mt-5 font-display text-2xl font-semibold">El despacho</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">Toda la cartera de comunidades en un panel.</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-200">
                {['Convoca, dirige la junta y cierra el acta', 'Registra en sala asistencia, representaciones y votos', 'Emite cuotas, cobra y lleva la contabilidad', 'Recibos, certificados de deuda y liquidaciones en PDF'].map((t) => (
                  <li key={t} className="flex gap-3"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />{t}</li>
                ))}
              </ul>
              <button type="button" onClick={() => goTo('/register')} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#0b1a33] transition hover:bg-slate-200">Dar de alta mi despacho <ArrowRight size={15} /></button>
            </div>
            <div className="rounded-3xl border border-slate-300/70 bg-white p-8">
              <Smartphone size={26} className="text-[#1d4fd8]" />
              <h3 className="mt-5 font-display text-2xl font-semibold text-slate-900">El propietario</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Desde el móvil, sin instalar nada.</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                {['Vota en la junta, esté en la sala o en casa', 'Delega su voto en otro vecino, con su consentimiento', 'Consulta sus cuotas y descarga sus recibos', 'Revisa el historial de juntas y sus actas'].map((t) => (
                  <li key={t} className="flex gap-3"><Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />{t}</li>
                ))}
              </ul>
              <button type="button" onClick={() => goTo('/login/comunidad')} className="mt-8 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100">Soy propietario <ArrowRight size={15} /></button>
            </div>
          </div>
        </section>

        {/* GESTIÓN DEL AÑO */}
        <section id="gestion" className="scroll-mt-20 border-t border-slate-300/70 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Encabezado
              kicker="Y el resto del año"
              titulo="La gestión diaria de cada comunidad, conectada con sus juntas."
              texto="Los morosos de la convocatoria salen de las cuotas, los privados de voto también, y cada cobro se contabiliza solo."
            />
            <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {GESTION.map(({ icon: Icon, titulo, texto }) => (
                <div key={titulo} className="border-t-2 border-[#0b1a33] pt-5">
                  <Icon size={20} className="text-[#1d4fd8]" />
                  <h3 className="mt-4 font-bold text-slate-900">{titulo}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PLANES */}
        <section id="planes" className={`${TINTA} scroll-mt-20 py-20 text-white sm:py-28`}>
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Encabezado
              oscuro centrado
              kicker="Planes"
              titulo="Paga por el tamaño de tu cartera, no por módulos."
              texto="Todos los planes incluyen todos los módulos. Solo cambian el número de fincas y la transcripción de voz. 15 días de prueba gratis, sin tarjeta."
            />
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {planes.map((plan) => {
                const destacado = plan.id === 'profesional';
                return (
                  <div key={plan.id} className={`flex flex-col rounded-2xl p-6 ${destacado ? 'bg-[#fbf9f4] text-slate-800 ring-2 ring-sky-300' : 'border border-white/15 bg-white/[0.04]'}`}>
                    <div className="flex items-center justify-between">
                      <p className={`font-display text-xl font-semibold ${destacado ? 'text-slate-900' : 'text-white'}`}>{plan.nombre}</p>
                      {destacado && <span className="rounded-full bg-[#1d4fd8] px-2.5 py-0.5 text-5xs font-bold uppercase tracking-wider text-white">Recomendado</span>}
                    </div>
                    <p className={`text-xs ${destacado ? 'text-slate-500' : 'text-slate-400'}`}>{LEMA_PLAN[plan.id]}</p>
                    <p className={`mt-5 font-display text-3xl font-semibold ${destacado ? 'text-slate-900' : 'text-white'}`}>
                      {plan.precioDesde === null ? 'A medida' : <>{plan.precioDesde} € <span className={`font-sans text-sm font-medium ${destacado ? 'text-slate-500' : 'text-slate-400'}`}>/mes + IVA</span></>}
                    </p>
                    <ul className={`mt-5 flex-grow space-y-2.5 text-sm ${destacado ? 'text-slate-700' : 'text-slate-300'}`}>
                      {caracteristicasPlan(plan).map(({ texto, incluido }) => (
                        <li key={texto} className={`flex gap-2 ${incluido ? '' : destacado ? 'text-slate-400' : 'text-slate-500'}`}>
                          {incluido ? <Check size={15} className={`mt-0.5 shrink-0 ${destacado ? 'text-emerald-600' : 'text-emerald-400'}`} /> : <X size={15} className="mt-0.5 shrink-0" />}
                          {incluido ? texto : `Sin ${texto.charAt(0).toLowerCase()}${texto.slice(1)}`}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => goTo(plan.id === 'enterprise' ? '/demo' : `/register?plan=${plan.id}`)}
                      className={`mt-6 rounded-xl px-4 py-3 text-sm font-bold transition ${destacado ? 'bg-[#1d4fd8] text-white hover:bg-[#1a43b8]' : 'border border-white/25 text-white hover:bg-white/10'}`}
                    >
                      {plan.id === 'enterprise' ? 'Hablemos' : 'Probar 15 días gratis'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* PREGUNTAS */}
        <section id="preguntas" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
          <Encabezado centrado kicker="Preguntas frecuentes" titulo="Lo que suelen preguntarnos los administradores" />
          <div className="mt-12 divide-y divide-slate-300/70 border-y border-slate-300/70">
            {FAQS.map(([question, answer], index) => (
              <div key={question}>
                <button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-4 py-5 text-left font-semibold text-slate-900">
                  <span>{question}</span>
                  <ChevronDown size={18} className={`shrink-0 text-[#1d4fd8] transition ${openFaq === index ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === index && <p className="pb-5 text-sm leading-7 text-slate-600">{answer}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* LLAMADA FINAL */}
        <section className="px-5 pb-20 sm:px-8 sm:pb-28">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[#0b1a33] p-8 text-center text-white sm:p-14">
            <Receipt aria-hidden="true" size={220} className="pointer-events-none absolute -right-10 -top-10 text-white/[0.04]" />
            <h2 className="relative mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-5xl">Tu próxima junta, con el acta hecha al terminar.</h2>
            <p className="relative mx-auto mt-5 max-w-xl leading-7 text-slate-400">Da de alta tu despacho y tu primera comunidad en unos minutos. Si prefieres verlo antes, te lo enseñamos.</p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={() => goTo('/register')} className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#1d4fd8] px-6 py-4 font-bold text-white transition hover:bg-[#2458e6]">Probar 15 días gratis <ArrowRight size={17} /></button>
              <button type="button" onClick={() => goTo('/demo')} className="inline-flex items-center justify-center rounded-xl border border-white/20 px-6 py-4 font-bold text-white transition hover:bg-white/10">Solicitar una demo</button>
            </div>
          </div>
        </section>
      </main>

      <footer className={`${TINTA} py-10`}>
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 text-sm text-slate-400 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Brand />
            <p className="mt-4 max-w-xs text-xs leading-5 text-slate-500">Juntas y gestión de comunidades de propietarios para despachos de administración de fincas.</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs">
            <Link to="/legal/aviso-legal" className="transition hover:text-white">Aviso legal</Link>
            <Link to="/legal/privacidad" className="transition hover:text-white">Privacidad</Link>
            <Link to="/legal/terminos" className="transition hover:text-white">Términos</Link>
            <Link to="/legal/encargo-tratamiento" className="transition hover:text-white">Encargo del tratamiento</Link>
            <button type="button" onClick={() => goTo('/login/corporativo')} className="transition hover:text-white">Acceso despachos</button>
            <button type="button" onClick={() => goTo('/login/comunidad')} className="transition hover:text-white">Acceso propietarios</button>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} VotifAI · un producto de NexuraIA</p>
        </div>
      </footer>
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
