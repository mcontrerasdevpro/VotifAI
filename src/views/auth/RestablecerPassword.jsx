import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import Field from '../../components/ui/Field.jsx';
import Brand from '../../components/Brand.jsx';

export default function RestablecerPassword() {
  const { perfil } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const esComunidad = perfil === 'comunidad';
  const token = searchParams.get('token') || '';
  // alta=1: el vecino crea su contraseña por primera vez (enlace de activación)
  const esAlta = esComunidad && searchParams.get('alta') === '1';

  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setCargando(true);
    try {
      const endpoint = esComunidad ? '/api/vecinos/restablecer-password' : '/api/auth/restablecer-password';
      const respuesta = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        setError(resultado.error || 'No se pudo restablecer la contraseña.');
        setCargando(false);
        return;
      }

      setExito(true);
    } catch (err) {
      console.error('Error al restablecer contraseña:', err);
      setError('Fallo de red al restablecer la contraseña.');
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 antialiased relative">
      <div className="w-full max-w-md bg-slate-950 rounded-3xl shadow-2xl overflow-hidden border border-slate-800/60">
        <div className="p-6 text-center border-b border-slate-900 bg-slate-950">
          <div className="flex justify-center items-center gap-2 mb-1">
            <Brand className="h-8" />
          </div>
          <p className="text-xs text-slate-400 mt-2">{esAlta ? 'Activa tu cuenta de vecino' : 'Crear una nueva contraseña'}</p>
        </div>

        <div className="p-6">
          {!token ? (
            <p className="text-3xs text-rose-400 text-center py-4">Enlace no válido: falta el token de recuperación.</p>
          ) : exito ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
              <p className="text-xs text-slate-300">{esAlta ? 'Cuenta activada. Ya puedes entrar con tu correo y tu contraseña.' : 'Contraseña actualizada correctamente.'}</p>
              <button
                onClick={() => navigate(`/login/${perfil}`)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all mt-2"
              >
                Iniciar Sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-3xs font-bold rounded-xl flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" /> {error}
                </div>
              )}
              <Field
                label={esAlta ? 'Tu contraseña' : 'Nueva Contraseña'} icon={Lock}
                type="password" required minLength={8} placeholder="Mínimo 8 caracteres" value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Field
                label="Confirmar Contraseña" icon={Lock}
                type="password" required minLength={8} placeholder="Repite la contraseña" value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
              <button
                type="submit" disabled={cargando}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/10 active:scale-98 disabled:opacity-50"
              >
                {cargando ? 'Guardando...' : esAlta ? 'Crear contraseña' : 'Restablecer Contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
