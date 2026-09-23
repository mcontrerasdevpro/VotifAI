import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVotifaiStore } from '../../store.jsx';
import { ShieldCheck, ArrowRight, ArrowLeft, Mail, Lock, Sparkles, AudioLines, FileJson, Scale, Phone, MapPin, User } from 'lucide-react';
import Brand from '../../components/Brand.jsx';
import Field from '../../components/ui/Field.jsx';

export default function Register() {
  const navigate = useNavigate();
  const { dispatch } = useVotifaiStore() || { dispatch: () => { } };

  const tipoOrganizacion = 'administrador';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [nombreEntidad, setNombreEntidad] = useState('');
  const [nombreResponsable, setNombreResponsable] = useState('');
  const [cif, setCif] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');

  const [aceptaCondiciones, setAceptaCondiciones] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');

  const handleSiguientePaso = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErrorEnvio('');

    const payload = {
      tipoOrganizacion,
      nombreEntidad,
      nombreResponsable,
      cif,
      telefono,
      direccion,
      email,
      password,
      aceptaCondiciones,
      plan: 'starter'
    };

    try {
      const respuesta = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        setErrorEnvio(resultado.error || 'Fallo al procesar el registro del despacho.');
        setEnviando(false);
        return;
      }

      dispatch({
        type: 'REGISTRAR_ORGANIZACION',
        payload: resultado.tenant
      });

      navigate('/hub');

    } catch (error) {
      console.error('Error de comunicación al registrar el despacho:', error);
      setErrorEnvio('Fallo de red: el servidor no ha podido procesar la petición.');
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row font-sans antialiased overflow-hidden">

      {/* ================= COLUMNA IZQUIERDA: SERVICIOS Y MARKETING (50% de la pantalla) ================= */}
      <div className="w-full lg:w-1/2 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-900 p-8 md:p-16 flex flex-col justify-between overflow-y-auto custom-scrollbar">

        {/* LOGO */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all text-slate-400 hover:text-white"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <Brand className="h-9" />
          </div>
        </div>

        {/* BENEFICIOS COMERCIALES CENTRALES */}
        <div className="my-12 space-y-8 max-w-lg">
          <div className="space-y-3">
            <div className="text-blue-500 text-3xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={14} className="animate-pulse" /> Ecosistema de Gobernanza SaaS
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
              Ahorra más de 12 horas de trabajo burocrático por junta.
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              VotifAI automatiza las tareas más pesadas de los administradores y secretarios, garantizando la validez legal y eliminando las impugnaciones.
            </p>
          </div>

          {/* LISTADO DE ARGUMENTOS DE VENTA */}
          <div className="space-y-4">
            <div className="flex gap-4 items-start bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
              <AudioLines size={20} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-2xs font-bold text-white uppercase tracking-wide">Diarización y Reconocimiento de Voz</h4>
                <p className="text-3xs text-slate-400 mt-1 leading-normal">El sistema graba el audio en vivo, separa las intervenciones y asocia cada frase al vecino o accionista de forma inequívoca.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
              <FileJson size={20} className="text-purple-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-2xs font-bold text-white uppercase tracking-wide">Redacción de Actas en 2 Minutos</h4>
                <p className="text-3xs text-slate-400 mt-1 leading-normal">Nuestros modelos entrenados estructuran el borrador oficial en base a la legislación (LPH/LSC) de forma inmediata al finalizar.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
              <Scale size={20} className="text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-2xs font-bold text-white uppercase tracking-wide">Escrutinio Blindado por Coeficientes</h4>
                <p className="text-3xs text-slate-400 mt-1 leading-normal">Control absoluto de cuórum en sala, dobles mayorías cruzadas y firmas digitales protegidas mediante Hash criptográfico.</p>
              </div>
            </div>
          </div>
        </div>

        {/* PIE DE COLUMNA */}
        <p className="text-4xs text-slate-500 font-bold tracking-widest uppercase flex items-center gap-2">
          <ShieldCheck size={12} /> Protección de datos y acceso seguro
        </p>
      </div>

      {/* ================= COLUMNA DERECHA: FORMULARIO DE ALTA (50% de la pantalla) ================= */}
      <div className="w-full lg:w-1/2 p-8 md:p-16 flex flex-col justify-between overflow-y-auto custom-scrollbar bg-slate-950">

        {/* CONTENEDOR CENTRAL DEL FORMULARIO */}
        <form onSubmit={handleSiguientePaso} className="my-auto py-8 space-y-6 max-w-xl mx-auto w-full">

          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Registrar mi Despacho Profesional
            </h1>
            <p className="text-3xs text-slate-400 leading-normal">
              Crea tu cuenta sin introducir datos bancarios. Podrás dar de alta tus comunidades desde el panel.
            </p>

            <p className="text-4xs text-slate-500 font-medium mt-1">
                ¿Ya tienes una cuenta de despacho?{' '}
                <span
                  onClick={() => navigate('/login/corporativo')}
                  className="text-blue-400 font-black cursor-pointer hover:underline"
                >
                  Iniciar Sesión Aquí
                </span>
            </p>
          </div>

          {errorEnvio && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-3xs font-bold rounded-xl">
              {errorEnvio}
            </div>
          )}

          <div className="space-y-5 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  className="sm:col-span-2"
                  label="Nombre del Despacho / Razón Social Profesional"
                  type="text" required placeholder="Ej: Gestión Inmobiliaria Martínez S.L." value={nombreEntidad}
                  onChange={(e) => setNombreEntidad(e.target.value)}
                />
                <Field
                  label="Nombre del Responsable" icon={User}
                  type="text" required placeholder="Ej: Manuel Contreras" value={nombreResponsable}
                  onChange={(e) => setNombreResponsable(e.target.value)}
                />
                <Field
                  label="CIF / NIF del Despacho"
                  type="text" required placeholder="Ej: B12345678" value={cif}
                  onChange={(e) => setCif(e.target.value)}
                  inputClassName="font-mono uppercase"
                />
                <Field
                  label="Teléfono de Contacto" icon={Phone}
                  type="tel" required placeholder="+34 600 000 000" value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
                <Field
                  label="Dirección del Despacho" icon={MapPin}
                  type="text" required placeholder="Calle Mayor 14, Madrid" value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                />
              </div>

              <div className="space-y-4 pt-2 border-t border-slate-900">
                <Field
                  className="mt-4"
                  label="Email Maestro del Administrador" icon={Mail}
                  type="email" required placeholder="director@midespacho.com" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  inputClassName="py-3.5 font-medium"
                />
                <Field
                  label="Contraseña de Control de Acceso" icon={Lock}
                  type="password" required minLength={8} placeholder="Mínimo 8 caracteres" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  inputClassName="py-3.5 font-medium"
                />
              </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="flex items-center gap-2"><Sparkles size={14} className="text-blue-400" /><span className="text-4xs uppercase tracking-wider text-slate-300 font-bold">Plan Starter · 15 días de prueba</span></div>
            <span className="text-4xs font-bold text-emerald-400">Gratis</span>
          </div>

          <label className="flex items-start gap-3 text-3xs leading-relaxed text-slate-400">
            <input
              type="checkbox" required checked={aceptaCondiciones}
              onChange={(e) => setAceptaCondiciones(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
            />
            <span>
              Acepto los{' '}
              <a href="/legal/terminos" target="_blank" rel="noreferrer" className="font-bold text-blue-400 hover:underline">Términos y Condiciones</a>,
              la{' '}
              <a href="/legal/privacidad" target="_blank" rel="noreferrer" className="font-bold text-blue-400 hover:underline">Política de Privacidad</a>{' '}
              y el{' '}
              <a href="/legal/encargo-tratamiento" target="_blank" rel="noreferrer" className="font-bold text-blue-400 hover:underline">Contrato de Encargo del Tratamiento (art. 28 RGPD)</a>,
              por el que NexuraIA trata por cuenta de mi despacho los datos de los propietarios de las comunidades que gestiono.
            </span>
          </label>

          {/* BOTÓN MAESTRO DE ACCIÓN */}
          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl text-3xs uppercase tracking-widest transition-all mt-4 flex items-center justify-center gap-2 shadow-lg active:scale-99 shadow-blue-600/10 disabled:opacity-50"
          >
            {enviando ? "Registrando despacho..." : "Crear mi cuenta y comenzar"}
            <ArrowRight size={14} />
          </button>
        </form>

        {/* PIE DE PÁGINA COLUMNA DERECHA */}
        <footer className="text-center text-4xs text-slate-600 font-bold tracking-widest uppercase shrink-0 pt-4">
          VotifAI · NexuraIA © {new Date().getFullYear()}
        </footer>
      </div>

    </div>
  );
}
