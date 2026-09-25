import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import Field from '../../components/ui/Field.jsx';
import Brand from '../../components/Brand.jsx';

export default function OlvidePassword() {
  const { perfil } = useParams();
  const navigate = useNavigate();
  const esComunidad = perfil === 'comunidad';

  const [email, setEmail] = useState('');
  const [cargando, setCargando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      const endpoint = esComunidad ? '/api/vecinos/olvide-password' : '/api/auth/olvide-password';
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
    } catch (err) {
      console.error('Error al solicitar recuperación de contraseña:', err);
    } finally {
      setEnviado(true);
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 antialiased relative">
      <button
        onClick={() => navigate(`/login/${perfil}`)}
        className="absolute top-6 left-6 flex items-center gap-2 text-xs text-slate-400 hover:text-white font-bold transition-colors bg-slate-950 px-4 py-2 rounded-xl border border-slate-800"
      >
        <ArrowLeft size={14} /> Volver
      </button>

      <div className="w-full max-w-md bg-slate-950 rounded-3xl shadow-2xl overflow-hidden border border-slate-800/60">
        <div className="p-6 text-center border-b border-slate-900 bg-slate-950">
          <div className="flex justify-center items-center gap-2 mb-1">
            <Brand className="h-14" />
          </div>
          <p className="text-xs text-slate-400 mt-2">Recuperar contraseña</p>
        </div>

        <div className="p-6">
          {enviado ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
              <p className="text-xs text-slate-300 leading-relaxed">
                Si ese correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.
              </p>
              <Link to={`/login/${perfil}`} className="inline-block text-3xs font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider mt-2">
                Volver a iniciar sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-3xs text-slate-500 leading-relaxed">
                Introduce el correo con el que te registraste y te enviaremos un enlace para crear una contraseña nueva.
              </p>
              <Field
                label="Correo Electrónico" icon={Mail}
                type="email" required placeholder="tu@correo.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="submit" disabled={cargando}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/10 active:scale-98 disabled:opacity-50"
              >
                {cargando ? 'Enviando...' : 'Enviar Enlace de Recuperación'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
