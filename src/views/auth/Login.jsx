import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVotifaiStore } from '../../store.jsx';
import { ArrowLeft, KeyRound, Building, Mail, Lock, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Field from '../../components/ui/Field.jsx';
import Brand from '../../components/Brand.jsx';

export default function Login() {
  const { perfil } = useParams();
  const navigate = useNavigate();
  const { dispatch } = useVotifaiStore() || { dispatch: () => { } };
  const esComunidad = perfil === 'comunidad';

  const [cargando, setCargando] = useState(false);
  const [errorMensaje, setErrorMensaje] = useState('');

  const [codigoJunta, setCodigoJunta] = useState('');
  // El propietario que ya tiene cuenta entra con su email y contraseña, sin
  // código ni junta convocada. La primera vez recibe por email un enlace
  // para crear la contraseña (con el email que figura en el censo) o, si su
  // administrador no tiene su email, usa el código de la comunidad.
  const [modoVecino, setModoVecino] = useState('cuenta'); // 'cuenta' | 'alta' | 'codigo'
  const [enlaceEnviado, setEnlaceEnviado] = useState('');
  const [emailVecino, setEmailVecino] = useState('');
  const [passwordVecino, setPasswordVecino] = useState('');

  // Si ya hay una sesión de vecino abierta, directo a su comunidad.
  useEffect(() => {
    if (!esComunidad) return;
    fetch('/api/vecinos/sesion', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((r) => { if (r?.vecino?.entity_id) navigate(`/asistencia/${r.vecino.entity_id}`, { replace: true }); })
      .catch(() => {});
  }, [esComunidad, navigate]);

  const [cifDespacho, setCifDespacho] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [password, setPassword] = useState('');

   const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMensaje('');

    if (esComunidad && modoVecino === 'cuenta') {
      setCargando(true);
      try {
        const respuesta = await fetch('/api/vecinos/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: emailVecino, password: passwordVecino })
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
          setErrorMensaje(resultado.error || 'Credenciales incorrectas.');
          setCargando(false);
          return;
        }
        navigate(`/asistencia/${resultado.vecino.entity_id}`);
      } catch (error) {
        console.error('Error al iniciar sesión de vecino:', error);
        setErrorMensaje('No se pudo establecer comunicación con el servidor central de VotifAI.');
        setCargando(false);
      }
    } else if (esComunidad && modoVecino === 'alta') {
      setCargando(true);
      try {
        const respuesta = await fetch('/api/vecinos/activar-cuenta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailVecino })
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
          setErrorMensaje(resultado.error || 'No se pudo enviar el enlace.');
        } else {
          setEnlaceEnviado(resultado.mensaje);
        }
      } catch (error) {
        console.error('Error al solicitar la activación de cuenta:', error);
        setErrorMensaje('No se pudo establecer comunicación con el servidor central de VotifAI.');
      }
      setCargando(false);
    } else if (esComunidad) {
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
            cif: resultado.tenant.cif || resultado.tenant.cifDespacho || resultado.tenant.cifEmpresa || '',
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
            <Brand className="h-8" />
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
            /* FORMULARIO VECINAL: con cuenta, email + contraseña; la primera vez,
               el código que reparte el administrador (elegirte del censo y crear
               la contraseña vive en /asistencia) */
            <div className="space-y-4">
              <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {[['cuenta', 'Ya tengo cuenta'], ['alta', 'Primera vez']].map(([id, texto]) => (
                  <button key={id} type="button" onClick={() => { setModoVecino(id); setErrorMensaje(''); setEnlaceEnviado(''); }}
                    className={`flex-1 py-2.5 rounded-lg text-4xs font-black uppercase tracking-widest transition-all ${modoVecino === id || (id === 'alta' && modoVecino === 'codigo') ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}>
                    {texto}
                  </button>
                ))}
              </div>
              {modoVecino === 'cuenta' ? (
                <>
                  <Field
                    label="Tu correo" icon={Mail}
                    type="email" required placeholder="tu@correo.com" value={emailVecino}
                    onChange={(e) => setEmailVecino(e.target.value)}
                  />
                  <Field
                    label="Tu contraseña" icon={Lock}
                    type="password" required placeholder="••••••••" value={passwordVecino}
                    onChange={(e) => setPasswordVecino(e.target.value)}
                  />
                  <div className="text-right">
                    <button type="button" onClick={() => navigate('/olvide-password/comunidad')}
                      className="text-4xs text-slate-500 hover:text-blue-400 font-bold uppercase tracking-wider">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                </>
              ) : modoVecino === 'alta' ? (
                enlaceEnviado ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-3xs text-emerald-300 leading-relaxed space-y-2">
                    <p className="font-bold">{enlaceEnviado}</p>
                    <p className="text-slate-400">Revisa también la carpeta de spam. El enlace caduca en 24 horas.</p>
                  </div>
                ) : (
                <>
                  <Field
                    label="El correo que diste a tu administrador" icon={Mail}
                    type="email" required placeholder="tu@correo.com" value={emailVecino}
                    onChange={(e) => setEmailVecino(e.target.value)}
                  />
                  <p className="text-4xs text-slate-500 leading-relaxed">
                    Si figura en el censo de tu comunidad, te enviaremos un enlace para crear tu contraseña.
                  </p>
                  <p className="text-4xs text-slate-500 leading-relaxed">
                    ¿Tu administrador no tiene tu correo?{' '}
                    <button type="button" onClick={() => { setModoVecino('codigo'); setErrorMensaje(''); }} className="font-black text-blue-400 hover:underline">
                      Usa el código de tu comunidad
                    </button>
                  </p>
                </>
                )
              ) : (
              <>
              <Field
                label="Código de Acceso de tu Comunidad" icon={KeyRound}
                type="text" required placeholder="Ej: VAI-7721-M" value={codigoJunta}
                onChange={(e) => setCodigoJunta(e.target.value)}
                inputClassName="font-mono tracking-widest uppercase"
              />
              <p className="text-4xs text-slate-500 leading-relaxed">
                Este código te lo facilita el administrador de tu comunidad. Con él identificarás tu vivienda y crearás tu cuenta de vecino.
              </p>
              <p className="text-4xs text-slate-500 leading-relaxed">
                <button type="button" onClick={() => { setModoVecino('alta'); setErrorMensaje(''); }} className="font-black text-blue-400 hover:underline">
                  Prefiero recibir un enlace en mi correo
                </button>
              </p>
              </>
              )}
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

          {!(esComunidad && modoVecino === 'alta' && enlaceEnviado) && (
          <button
            type="submit" disabled={cargando}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all mt-6 shadow-lg shadow-blue-600/10 active:scale-98 disabled:opacity-50"
          >
            {cargando ? 'Comprobando...' : esComunidad && modoVecino === 'alta' ? 'Enviarme el enlace' : esComunidad && modoVecino === 'codigo' ? 'Continuar' : 'Entrar'}
          </button>
          )}

          {/* Cada perfil tiene su puerta: el propietario entra con el código de su
              comunidad; el despacho, con CIF, email y contraseña. */}
          <p className="text-center text-4xs text-slate-500 mt-5">
            {esComunidad ? '¿Eres administrador de fincas? ' : '¿Eres propietario de una comunidad? '}
            <button
              type="button"
              onClick={() => navigate(esComunidad ? '/login/corporativo' : '/login/comunidad')}
              className="font-black text-blue-400 hover:underline"
            >
              {esComunidad ? 'Acceso de despachos' : 'Acceso de propietarios'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
