import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Mail, Lock, User, Phone, MapPin, CreditCard, LoaderCircle } from 'lucide-react';
import { useVotifaiStore } from '../../store.jsx';
import Card from '../../components/ui/Card.jsx';
import Field from '../../components/ui/Field.jsx';
import CorreosDespacho from '../../components/CorreosDespacho.jsx';

/**
 * "Mi despacho": datos de la cuenta (los mismos que salen en el membrete
 * del acta en PDF y en las facturas de Stripe), email de acceso y
 * contraseña. Email y contraseña piden la contraseña actual.
 */
function Aviso({ tipo, children }) {
  if (!children) return null;
  const estilos = tipo === 'ok'
    ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
    : 'border-rose-300/20 bg-rose-300/10 text-rose-200';
  return <p className={`rounded-xl border px-4 py-3 text-xs font-bold ${estilos}`}>{children}</p>;
}

function BotonGuardar({ enviando, children }) {
  return (
    <button
      type="submit" disabled={enviando}
      className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
    >
      {enviando && <LoaderCircle size={14} className="animate-spin" />}{children}
    </button>
  );
}

async function enviar(url, datos) {
  const respuesta = await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });
  const resultado = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(resultado.error || 'No se pudieron guardar los cambios.');
  return resultado;
}

export default function PerfilDespacho() {
  const navigate = useNavigate();
  const { dispatch } = useVotifaiStore();

  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [emailActual, setEmailActual] = useState('');

  const [datos, setDatos] = useState({ nombreEntidad: '', nombreResponsable: '', cif: '', telefono: '', direccion: '' });
  const [estadoDatos, setEstadoDatos] = useState({ enviando: false, ok: '', error: '' });

  const [nuevoEmail, setNuevoEmail] = useState('');
  const [passwordEmail, setPasswordEmail] = useState('');
  const [estadoEmail, setEstadoEmail] = useState({ enviando: false, ok: '', error: '' });

  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordRepetida, setPasswordRepetida] = useState('');
  const [estadoPassword, setEstadoPassword] = useState({ enviando: false, ok: '', error: '' });

  const aplicarPerfil = (perfil) => {
    setEmailActual(perfil.email_maestro || '');
    setDatos({
      nombreEntidad: perfil.nombre_entidad || '',
      nombreResponsable: perfil.nombre_responsable || '',
      cif: perfil.cif || '',
      telefono: perfil.telefono || '',
      direccion: perfil.direccion || ''
    });
    // Refresca la sesión guardada para que la cabecera del panel muestre ya
    // el nombre o el email nuevos.
    dispatch({ type: 'ACTUALIZAR_PERFIL', payload: perfil });
  };

  useEffect(() => {
    const cargar = async () => {
      try {
        const respuesta = await fetch('/api/despacho/perfil', { credentials: 'include' });
        const resultado = await respuesta.json();
        if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo cargar el perfil.');
        aplicarPerfil(resultado.perfil);
      } catch (error) {
        setErrorCarga(error.message);
      } finally {
        setCargando(false);
      }
    };
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guardarDatos = async (e) => {
    e.preventDefault();
    setEstadoDatos({ enviando: true, ok: '', error: '' });
    try {
      const resultado = await enviar('/api/despacho/perfil', datos);
      aplicarPerfil(resultado.perfil);
      setEstadoDatos({ enviando: false, ok: resultado.mensaje, error: '' });
    } catch (error) {
      setEstadoDatos({ enviando: false, ok: '', error: error.message });
    }
  };

  const guardarEmail = async (e) => {
    e.preventDefault();
    setEstadoEmail({ enviando: true, ok: '', error: '' });
    try {
      const resultado = await enviar('/api/despacho/email', { email: nuevoEmail, passwordActual: passwordEmail });
      aplicarPerfil(resultado.perfil);
      setNuevoEmail('');
      setPasswordEmail('');
      setEstadoEmail({ enviando: false, ok: resultado.mensaje, error: '' });
    } catch (error) {
      setEstadoEmail({ enviando: false, ok: '', error: error.message });
    }
  };

  const guardarPassword = async (e) => {
    e.preventDefault();
    if (passwordNueva !== passwordRepetida) {
      setEstadoPassword({ enviando: false, ok: '', error: 'Las dos contraseñas nuevas no coinciden.' });
      return;
    }
    setEstadoPassword({ enviando: true, ok: '', error: '' });
    try {
      const resultado = await enviar('/api/despacho/password', { passwordActual, passwordNueva });
      setPasswordActual('');
      setPasswordNueva('');
      setPasswordRepetida('');
      setEstadoPassword({ enviando: false, ok: resultado.mensaje, error: '' });
    } catch (error) {
      setEstadoPassword({ enviando: false, ok: '', error: error.message });
    }
  };

  const cambiarDato = (campo) => (e) => setDatos((actual) => ({ ...actual, [campo]: e.target.value }));

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-6 text-slate-100 sm:px-8">
      <header className="mx-auto flex max-w-3xl items-center justify-between border-b border-slate-900 pb-5">
        <button type="button" onClick={() => navigate('/hub')} className="flex items-center gap-2 text-xs font-bold text-slate-400 transition hover:text-white">
          <ArrowLeft size={15} /> Volver al panel
        </button>
        <span className="flex items-center gap-2 text-sm font-black text-white"><Building2 size={17} className="text-blue-400" /> Mi despacho</span>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 py-8">
        {cargando ? (
          <p className="py-16 text-center text-sm text-slate-500">Cargando datos del despacho...</p>
        ) : errorCarga ? (
          <Aviso tipo="error">{errorCarga}</Aviso>
        ) : (
          <>
            <Card padding="p-6">
              <form onSubmit={guardarDatos} className="space-y-5">
                <div>
                  <h2 className="text-sm font-black text-white">Datos del despacho</h2>
                  <p className="mt-1 text-3xs text-slate-500">Aparecen en el membrete de las actas en PDF y en tus facturas.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field className="sm:col-span-2" label="Nombre del despacho / razón social" type="text" required value={datos.nombreEntidad} onChange={cambiarDato('nombreEntidad')} />
                  <Field label="Nombre del responsable" icon={User} type="text" value={datos.nombreResponsable} onChange={cambiarDato('nombreResponsable')} />
                  <Field label="CIF / NIF" type="text" value={datos.cif} onChange={cambiarDato('cif')} inputClassName="font-mono uppercase" />
                  <Field label="Teléfono" icon={Phone} type="tel" value={datos.telefono} onChange={cambiarDato('telefono')} />
                  <Field label="Dirección" icon={MapPin} type="text" value={datos.direccion} onChange={cambiarDato('direccion')} />
                </div>
                <Aviso tipo="ok">{estadoDatos.ok}</Aviso>
                <Aviso tipo="error">{estadoDatos.error}</Aviso>
                <BotonGuardar enviando={estadoDatos.enviando}>Guardar datos</BotonGuardar>
              </form>
            </Card>

            <CorreosDespacho nombreDespacho={datos.nombreEntidad} emailAcceso={emailActual} />

            <Card padding="p-6">
              <form onSubmit={guardarEmail} className="space-y-5">
                <div>
                  <h2 className="text-sm font-black text-white">Email de acceso</h2>
                  <p className="mt-1 text-3xs text-slate-500">
                    Actual: <span className="font-bold text-slate-300">{emailActual}</span>. Es el que usas para iniciar sesión y donde recibes las facturas.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Nuevo email" icon={Mail} type="email" required value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} />
                  <Field label="Tu contraseña actual" icon={Lock} type="password" required value={passwordEmail} onChange={(e) => setPasswordEmail(e.target.value)} />
                </div>
                <Aviso tipo="ok">{estadoEmail.ok}</Aviso>
                <Aviso tipo="error">{estadoEmail.error}</Aviso>
                <BotonGuardar enviando={estadoEmail.enviando}>Cambiar email</BotonGuardar>
              </form>
            </Card>

            <Card padding="p-6">
              <form onSubmit={guardarPassword} className="space-y-5">
                <h2 className="text-sm font-black text-white">Contraseña</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Contraseña actual" icon={Lock} type="password" required value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} />
                  <Field label="Nueva contraseña" icon={Lock} type="password" required minLength={8} placeholder="Mínimo 8 caracteres" value={passwordNueva} onChange={(e) => setPasswordNueva(e.target.value)} />
                  <Field label="Repite la nueva" icon={Lock} type="password" required minLength={8} value={passwordRepetida} onChange={(e) => setPasswordRepetida(e.target.value)} />
                </div>
                <Aviso tipo="ok">{estadoPassword.ok}</Aviso>
                <Aviso tipo="error">{estadoPassword.error}</Aviso>
                <BotonGuardar enviando={estadoPassword.enviando}>Cambiar contraseña</BotonGuardar>
              </form>
            </Card>

            <button
              type="button" onClick={() => navigate('/billing')}
              className="flex w-full items-center justify-between rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] px-5 py-4 text-left transition hover:bg-cyan-300/10"
            >
              <span className="flex items-center gap-3 text-xs font-bold text-white"><CreditCard size={16} className="text-cyan-300" /> Plan, suscripción y facturas</span>
              <span className="text-xs font-bold text-cyan-200">Ver planes →</span>
            </button>
          </>
        )}
      </main>
    </div>
  );
}
