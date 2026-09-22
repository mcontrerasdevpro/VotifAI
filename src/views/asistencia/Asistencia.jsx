import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Mic, Square, CheckCircle2, RefreshCw, AlertTriangle, UserCheck, Mail, Lock, KeyRound, LogOut, ArrowLeft } from 'lucide-react';
import VotacionVecino from '../../components/VotacionVecino.jsx';
import HistorialVecino from '../../components/HistorialVecino.jsx';
import PreferenciaNotificacion from '../../components/PreferenciaNotificacion.jsx';
import Brand from '../../components/Brand.jsx';

/**
 * Pantalla de "manos alzadas": el vecino accede desde su propio móvil al
 * enlace de la finca y se identifica con una cuenta real (email +
 * contraseña), verificada la primera vez con el código de acceso que
 * reparte el administrador — no hay DNI en el censo, así que la
 * identidad se ancla a esa cuenta propia, no a un documento oficial.
 * Desde ahí graba sus intervenciones, que se transcriben y aparecen en
 * el panel del secretario ya atribuidas a su nombre real.
 */
export default function Asistencia() {
  const { entityId } = useParams();

  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [sesion, setSesion] = useState(null);

  // --- Identificación (sin sesión) ---
  const [modo, setModo] = useState('login'); // 'login' | 'registro'
  const [propietarios, setPropietarios] = useState([]);
  const [cargandoCenso, setCargandoCenso] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [elegido, setElegido] = useState(null);
  const [errorAuth, setErrorAuth] = useState('');
  const [enviandoAuth, setEnviandoAuth] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regCodigo, setRegCodigo] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // --- Grabación (con sesión) ---
  const [grabando, setGrabando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [errorMic, setErrorMic] = useState('');
  const [ultimaTranscripcion, setUltimaTranscripcion] = useState(null);

  const mediaRecorderRef = useRef(null);
  const trozosAudioRef = useRef([]);
  const cronometroRef = useRef(null);

  useEffect(() => {
    const comprobarSesion = async () => {
      try {
        const respuesta = await fetch('/api/vecinos/sesion', { credentials: 'include' });
        if (respuesta.ok) {
          const resultado = await respuesta.json();
          if (resultado.vecino?.entity_id === entityId) {
            setSesion(resultado.vecino);
          }
        }
      } catch (err) {
        console.error('Fallo al comprobar la sesión de vecino:', err);
      } finally {
        setCargandoSesion(false);
      }
    };
    comprobarSesion();
  }, [entityId]);

  useEffect(() => {
    if (sesion || modo !== 'registro') return;
    const cargarCenso = async () => {
      setCargandoCenso(true);
      try {
        const respuesta = await fetch(`/api/vecinos/censo/${entityId}`);
        const resultado = await respuesta.json();
        if (respuesta.ok) setPropietarios(resultado.propietarios || []);
      } catch (err) {
        console.error('Fallo al cargar el censo:', err);
      } finally {
        setCargandoCenso(false);
      }
    };
    cargarCenso();
  }, [entityId, modo, sesion]);

  const propietariosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return propietarios;
    return propietarios.filter(p =>
      p.nombre_completo.toLowerCase().includes(termino) || p.propiedad_detalle?.toLowerCase().includes(termino)
    );
  }, [propietarios, busqueda]);

  const elegirParaRegistro = (propietario) => {
    setErrorAuth('');
    if (propietario.tiene_cuenta) {
      setErrorAuth('Este vecino ya tiene una cuenta creada. Inicia sesión con su correo y contraseña.');
      setModo('login');
      setElegido(null);
      return;
    }
    setElegido(propietario);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorAuth('');
    setEnviandoAuth(true);
    try {
      const respuesta = await fetch('/api/vecinos/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setSesion(resultado.vecino);
      } else {
        setErrorAuth(resultado.error || 'No se pudo iniciar sesión.');
      }
    } catch (err) {
      console.error(err);
      setErrorAuth('Fallo de red al iniciar sesión.');
    } finally {
      setEnviandoAuth(false);
    }
  };

  const handleRegistro = async (e) => {
    e.preventDefault();
    setErrorAuth('');
    setEnviandoAuth(true);
    try {
      const respuesta = await fetch('/api/vecinos/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          entity_id: entityId,
          propietario_id: elegido.id,
          codigo_acceso: regCodigo,
          email: regEmail,
          password: regPassword
        })
      });
      const resultado = await respuesta.json();
      if (respuesta.ok && resultado.success) {
        setSesion(resultado.vecino);
      } else {
        setErrorAuth(resultado.error || 'No se pudo crear la cuenta.');
      }
    } catch (err) {
      console.error(err);
      setErrorAuth('Fallo de red al crear la cuenta.');
    } finally {
      setEnviandoAuth(false);
    }
  };

  const cerrarSesion = async () => {
    try {
      await fetch('/api/vecinos/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error(err);
    }
    setSesion(null);
    setElegido(null);
    setModo('login');
    setLoginEmail(''); setLoginPassword('');
  };

  const iniciarGrabacion = async () => {
    setErrorMic('');
    setUltimaTranscripcion(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      trozosAudioRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) trozosAudioRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        subirIntervencion();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setGrabando(true);
      setSegundos(0);
      cronometroRef.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    } catch (err) {
      console.error('No se pudo acceder al micrófono:', err);
      setErrorMic('No se pudo acceder al micrófono. Revisa los permisos del navegador.');
    }
  };

  const detenerGrabacion = () => {
    clearInterval(cronometroRef.current);
    setGrabando(false);
    mediaRecorderRef.current?.stop();
  };

  const subirIntervencion = async () => {
    const duracion = segundos;
    const blobAudio = new Blob(trozosAudioRef.current, { type: 'audio/webm' });
    if (blobAudio.size === 0) return;

    setEnviando(true);
    try {
      const formulario = new FormData();
      formulario.append('audio', blobAudio, 'intervencion.webm');
      formulario.append('duracion_segundos', duracion);

      const respuesta = await fetch(`/api/asistencia/${entityId}/voz`, { method: 'POST', credentials: 'include', body: formulario });
      const resultado = await respuesta.json();

      if (respuesta.ok && resultado.success) {
        setUltimaTranscripcion(resultado.vacio ? { vacio: true } : resultado.transcripcion);
      } else {
        setErrorMic(resultado.error || 'No se pudo transcribir la intervención.');
      }
    } catch (err) {
      console.error('Fallo al subir la intervención:', err);
      setErrorMic('Fallo de red al enviar la grabación.');
    } finally {
      setEnviando(false);
    }
  };

  const formatoTiempo = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-4 font-sans antialiased">

      <header className="w-full max-w-md mx-auto py-4 flex items-center gap-2.5 shrink-0">
        <Brand className="h-7" />
        <div>
          <h1 className="text-4xs font-black tracking-widest text-slate-400 uppercase">Sala de Asistencia</h1>
          <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">Manos Alzadas y Transcripción de Intervenciones</p>
        </div>
      </header>

      <main className="w-full max-w-md mx-auto flex-grow flex flex-col justify-center py-6">
        {cargandoSesion ? (
          <div className="text-center py-12 text-4xs text-slate-500 font-bold uppercase tracking-widest">Comprobando tu sesión...</div>
        ) : (
          <AnimatePresence mode="wait">
            {!sesion ? (
              <motion.div key="auth" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">

                <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => { setModo('login'); setErrorAuth(''); }}
                    className={`flex-1 py-2.5 rounded-lg text-4xs font-black uppercase tracking-widest transition-all ${modo === 'login' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}
                  >
                    Ya tengo cuenta
                  </button>
                  <button
                    onClick={() => { setModo('registro'); setErrorAuth(''); }}
                    className={`flex-1 py-2.5 rounded-lg text-4xs font-black uppercase tracking-widest transition-all ${modo === 'registro' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}
                  >
                    Primera vez
                  </button>
                </div>

                {errorAuth && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-rose-400 text-4xs leading-relaxed font-bold">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {errorAuth}
                  </div>
                )}

                {modo === 'login' ? (
                  <form onSubmit={handleLogin} className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="block text-5xs font-black text-slate-400 uppercase tracking-widest">Correo Electrónico</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3.5 text-slate-500" size={14} />
                        <input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="tu@correo.com"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-5xs font-black text-slate-400 uppercase tracking-widest">Contraseña</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3.5 text-slate-500" size={14} />
                        <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                    <button type="submit" disabled={enviandoAuth}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl text-4xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/10 transition-all">
                      {enviandoAuth ? 'Entrando...' : 'Entrar'}
                    </button>
                    <div className="text-center">
                      <Link to="/olvide-password/comunidad" className="text-4xs text-slate-500 hover:text-blue-400 font-bold uppercase tracking-wider">
                        ¿Olvidaste tu contraseña?
                      </Link>
                    </div>
                  </form>
                ) : !elegido ? (
                  <div className="space-y-3">
                    <p className="text-4xs text-slate-500 uppercase font-bold tracking-wider text-center">Primero, elige tu nombre del censo</p>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-3.5 text-slate-500" size={16} />
                      <input
                        type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Busca tu nombre o vivienda..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                      {cargandoCenso ? (
                        <p className="text-4xs text-slate-500 text-center py-8 uppercase tracking-widest">Cargando censo...</p>
                      ) : propietariosFiltrados.length === 0 ? (
                        <p className="text-4xs text-slate-600 text-center py-8 uppercase tracking-widest">Sin resultados.</p>
                      ) : (
                        propietariosFiltrados.map((p) => (
                          <button
                            key={p.id} onClick={() => elegirParaRegistro(p)}
                            className="w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl px-4 py-3 transition-colors flex items-center justify-between gap-2"
                          >
                            <div>
                              <p className="text-xs font-bold text-white">{p.nombre_completo}</p>
                              <p className="text-4xs text-slate-500 mt-0.5">{p.propiedad_detalle}</p>
                            </div>
                            <UserCheck size={14} className="text-slate-600 shrink-0" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleRegistro} className="space-y-3">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-white">{elegido.nombre_completo}</p>
                        <p className="text-4xs text-slate-500">{elegido.propiedad_detalle}</p>
                      </div>
                      <button type="button" onClick={() => setElegido(null)} className="text-4xs text-slate-500 hover:text-white font-bold uppercase tracking-wider flex items-center gap-1">
                        <ArrowLeft size={11} /> Cambiar
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-5xs font-black text-slate-400 uppercase tracking-widest">Código de Acceso de tu Comunidad</label>
                      <div className="relative">
                        <KeyRound className="absolute left-3.5 top-3.5 text-slate-500" size={14} />
                        <input type="text" required value={regCodigo} onChange={(e) => setRegCodigo(e.target.value)}
                          placeholder="Ej: VAI-7721-M"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-slate-200 font-mono uppercase tracking-widest focus:outline-none focus:border-blue-500" />
                      </div>
                      <p className="text-[9px] text-slate-600">Te lo facilita el administrador de tu comunidad.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-5xs font-black text-slate-400 uppercase tracking-widest">Tu Correo Electrónico</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3.5 text-slate-500" size={14} />
                        <input type="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="tu@correo.com"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-5xs font-black text-slate-400 uppercase tracking-widest">Crea una Contraseña</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3.5 text-slate-500" size={14} />
                        <input type="password" required minLength={8} value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="Mínimo 8 caracteres"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>

                    <button type="submit" disabled={enviandoAuth}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl text-4xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/10 transition-all">
                      {enviandoAuth ? 'Creando cuenta...' : 'Crear Cuenta y Entrar'}
                    </button>
                  </form>
                )}
              </motion.div>
            ) : (
              <motion.div key="grabacion" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-inner">
                  <div>
                    <span className="block text-[8px] font-mono text-blue-400 font-bold uppercase tracking-wider">Interviniendo como</span>
                    <h3 className="text-xs font-black text-white">{sesion.nombre_completo}</h3>
                    <p className="text-4xs text-slate-500">{sesion.propiedad_detalle}</p>
                  </div>
                  <button onClick={cerrarSesion} className="text-4xs text-slate-500 hover:text-white font-bold uppercase tracking-wider flex items-center gap-1">
                    <LogOut size={11} /> Salir
                  </button>
                </div>

                <PreferenciaNotificacion
                  sesion={sesion}
                  onActualizado={(canal) => setSesion((actual) => ({ ...actual, canal_notificacion: canal }))}
                />

                <VotacionVecino entityId={entityId} />

                <HistorialVecino entityId={entityId} />

                <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-8 flex flex-col items-center justify-center gap-5 min-h-[260px]">
                  {enviando ? (
                    <>
                      <RefreshCw size={32} className="text-blue-500 animate-spin" />
                      <p className="text-4xs text-slate-400 uppercase tracking-widest font-bold">Transcribiendo intervención...</p>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={grabando ? detenerGrabacion : iniciarGrabacion}
                        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
                          grabando ? 'bg-rose-600 shadow-rose-600/30 animate-pulse' : 'bg-blue-600 shadow-blue-600/20 hover:bg-blue-500'
                        }`}
                      >
                        {grabando ? <Square size={28} className="text-white" /> : <Mic size={32} className="text-white" />}
                      </button>
                      <div className="text-center">
                        <p className="text-xs font-black text-white">{grabando ? formatoTiempo(segundos) : 'Pulsa para hablar'}</p>
                        <p className="text-4xs text-slate-500 uppercase tracking-widest mt-1">
                          {grabando ? 'Pulsa de nuevo para terminar y enviar' : 'Se transcribirá y aparecerá con tu nombre'}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {errorMic && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-rose-400 text-4xs leading-relaxed font-bold">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {errorMic}
                  </div>
                )}

                {ultimaTranscripcion && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-emerald-400 text-4xs font-black uppercase tracking-wider">
                      <CheckCircle2 size={12} /> {ultimaTranscripcion.vacio ? 'Sin voz detectada' : 'Intervención registrada'}
                    </div>
                    {!ultimaTranscripcion.vacio && (
                      <p className="text-3xs text-slate-300 leading-relaxed italic">"{ultimaTranscripcion.texto}"</p>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      <footer className="w-full max-w-md mx-auto py-3 text-center shrink-0">
        <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest leading-none">
          Cifrado en tránsito — Ley de Propiedad Horizontal Art. 15 — VotifAI
        </p>
      </footer>
    </div>
  );
}
