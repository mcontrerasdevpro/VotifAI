import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVotifaiStore } from '../../store.jsx';
import { ArrowLeft, ShieldCheck, KeyRound, Building, Mail, Lock, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Field from '../../components/ui/Field.jsx';

export default function Login() {
  const { perfil } = useParams();
  const navigate = useNavigate();
  const { dispatch } = useVotifaiStore() || { dispatch: () => { } };
  const esComunidad = perfil === 'comunidad';

  const [cargando, setCargando] = useState(false);
  const [errorMensaje, setErrorMensaje] = useState('');

  const [codigoJunta, setCodigoJunta] = useState('');

  const [cifDespacho, setCifDespacho] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [password, setPassword] = useState('');

   const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMensaje('');

    if (esComunidad) {
      setCargando(true);
      try {
        const respuesta = await fetch('/api/vecinos/resolver-codigo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codigo: codigoJunta })
        });
        const resultado = await respuesta.json();

        if (!respuesta.ok) {
          setErrorMensaje(resultado.error || 'Código de acceso no válido.');
          setCargando(false);
          return;
        }

        navigate(`/asistencia/${resultado.entity_id}`);
      } catch (error) {
        console.error('Error al resolver el código de acceso:', error);
        setErrorMensaje('No se pudo establecer comunicación con el servidor central de VotifAI.');
        setCargando(false);
      }
    } else {
      setCargando(true);

      const payload = {
        email: emailAdmin,
        password: password
      };

      try {
        const respuesta = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
          setErrorMensaje(resultado.error || 'Credenciales de acceso incorrectas.');
          setCargando(false);
          return;
        }

        if (resultado.tenant) {
          const nuevoTenantCaché = {
            tenantId: resultado.tenant.id || resultado.tenant.tenantId,
            nombreEntidad: resultado.tenant.nombre_entidad || resultado.tenant.nombreEntidad || "Despacho Profesional",
            email: resultado.tenant.email_maestro || resultado.tenant.email || emailAdmin,
            tipoOrganizacion: resultado.tenant.tipo_organizacion || resultado.tenant.tipoOrganizacion || 'administrador',
            plan: resultado.tenant.plan_suscripcion || resultado.tenant.plan || 'trial_15_dias',

            admin: {
              nombre: resultado.tenant.nombre_responsable || resultado.tenant.admin_nombre || resultado.tenant.adminNombre || resultado.tenant.nombre || "Admin General",
              despacho: resultado.tenant.nombre_entidad || resultado.tenant.nombreEntidad || "Despacho Administrador"
            },

            comunidades: resultado.tenant.comunidades || []
          };

          localStorage.setItem('votifai_tenant', JSON.stringify(nuevoTenantCaché));

          localStorage.setItem('tenantId', resultado.tenant.id);
        }

        dispatch({
          type: 'REGISTRAR_ORGANIZACION',
          payload: resultado.tenant
        });

        navigate('/hub');

      } catch (error) {
        console.error('Error de red en pasarela de acceso:', error);
        setErrorMensaje('No se pudo establecer comunicación con el servidor central de VotifAI.');
        setCargando(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 antialiased relative">

      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 flex items-center gap-2 text-xs text-slate-400 hover:text-white font-bold transition-colors bg-slate-950 px-4 py-2 rounded-xl border border-slate-800"
      >
        <ArrowLeft size={14} /> Volver
      </button>

      <div className="w-full max-w-md bg-slate-950 rounded-3xl shadow-2xl overflow-hidden border border-slate-800/60">

        <div className="p-6 text-center border-b border-slate-900 bg-slate-950">
          <div className="flex justify-center items-center gap-2 mb-1">
            <ShieldCheck size={24} className="text-blue-500" />
            <span className="text-xl font-black text-white">Votif<span className="text-blue-500">AI</span></span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {esComunidad ? 'Acreditación para Junta de Propietarios' : 'Acceso de Administrador de Fincas'}
          </p>
        </div>

        {/* ALERTA VISUAL DE CREDENCIALES FALLIDAS */}
        <AnimatePresence>
          {errorMensaje && (
            <motion.div
              initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
              className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-3xs font-bold rounded-xl flex items-center gap-2"
            >
              <AlertCircle size={14} className="shrink-0" /> {errorMensaje}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {esComunidad ? (
            /* FORMULARIO VECINAL: solo el código que reparte el administrador — la
               identificación real (elegirte del censo + contraseña) vive en /asistencia */
            <div className="space-y-4">
              <Field
                label="Código de Acceso de tu Comunidad" icon={KeyRound}
                type="text" required placeholder="Ej: VAI-7721-M" value={codigoJunta}
                onChange={(e) => setCodigoJunta(e.target.value)}
                inputClassName="font-mono tracking-widest uppercase"
              />
              <p className="text-4xs text-slate-500 leading-relaxed">
                Este código te lo facilita el administrador de tu comunidad. Con él identificarás tu vivienda y crearás (o iniciarás) tu cuenta de vecino.
              </p>
            </div>
          ) : (
            /* FORMULARIO DE ADMINISTRADOR DE FINCAS CONECTADO A NEON */
            <div className="space-y-4">
              <Field
                label="1. CIF del Despacho" icon={Building}
                type="text" required placeholder="Ej: A-82345678" value={cifDespacho}
                onChange={(e) => setCifDespacho(e.target.value)}
                inputClassName="font-mono uppercase"
              />

              <Field
                label="2. Correo Corporativo" icon={Mail}
                type="email" required placeholder="admin@despacho.com" value={emailAdmin}
                onChange={(e) => setEmailAdmin(e.target.value)}
              />

              <Field
                label="3. Clave de Acceso" icon={Lock}
                type="password" required placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => navigate('/olvide-password/despacho')}
                  className="text-4xs text-slate-500 hover:text-blue-400 font-bold uppercase tracking-wider"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </div>
          )}

          <button
            type="submit" disabled={cargando}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all mt-6 shadow-lg shadow-blue-600/10 active:scale-98 disabled:opacity-50"
          >
            {cargando ? 'Interrogando a Neon Cloud...' : 'Verificar Identidad y Acceder'}
          </button>
        </form>
      </div>
    </div>
  );
}
