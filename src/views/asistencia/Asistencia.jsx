import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Search, Mic, Square, CheckCircle2, RefreshCw, AlertTriangle, UserCheck } from 'lucide-react';

/**
 * Pantalla de "manos alzadas": el vecino accede desde su propio móvil al
 * enlace de la finca (el entity_id, no adivinable, hace de código de
 * sala), se identifica eligiendo su nombre del censo real — sin DNI ni
 * contraseña, ese sistema nunca llegó a construirse — y desde ahí graba
 * sus intervenciones, que se transcriben y aparecen en el panel del
 * secretario ya atribuidas a su nombre real.
 */
export default function Asistencia() {
  const { entityId } = useParams();

  const [propietarios, setPropietarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [yo, setYo] = useState(null);

  const [grabando, setGrabando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [errorMic, setErrorMic] = useState('');
  const [ultimaTranscripcion, setUltimaTranscripcion] = useState(null);

  const mediaRecorderRef = useRef(null);
  const trozosAudioRef = useRef([]);
  const cronometroRef = useRef(null);

  useEffect(() => {
    const cargarCenso = async () => {
      try {
        const respuesta = await fetch(`/api/asistencia/${entityId}/censo`);
        const resultado = await respuesta.json();
        if (respuesta.ok) setPropietarios(resultado.propietarios || []);
      } catch (err) {
        console.error('Fallo al cargar el censo de asistencia:', err);
      } finally {
        setCargando(false);
      }
    };
    cargarCenso();

    const guardado = sessionStorage.getItem(`votifai_asistencia_${entityId}`);
    if (guardado) {
      try { setYo(JSON.parse(guardado)); } catch (e) { /* ignorar */ }
    }
  }, [entityId]);

  const propietariosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return propietarios;
    return propietarios.filter(p =>
      p.nombre_completo.toLowerCase().includes(termino) || p.propiedad_detalle?.toLowerCase().includes(termino)
    );
  }, [propietarios, busqueda]);

  const elegirme = (propietario) => {
    setYo(propietario);
    sessionStorage.setItem(`votifai_asistencia_${entityId}`, JSON.stringify(propietario));
  };

  const cambiarDeVecino = () => {
    setYo(null);
    sessionStorage.removeItem(`votifai_asistencia_${entityId}`);
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
      formulario.append('propietario_id', yo.id);
      formulario.append('duracion_segundos', duracion);

      const respuesta = await fetch(`/api/asistencia/${entityId}/voz`, { method: 'POST', body: formulario });
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

      <header className="w-full max-w-md mx-auto py-4 flex items-center gap-2 shrink-0">
        <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md shadow-blue-600/10">
          <Shield size={16} />
        </div>
        <div>
          <h1 className="text-xs font-black tracking-tight text-white uppercase">VotifAI — Sala de Asistencia</h1>
          <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">Manos Alzadas y Transcripción de Intervenciones</p>
        </div>
      </header>

      <main className="w-full max-w-md mx-auto flex-grow flex flex-col justify-center py-6">
        <AnimatePresence mode="wait">
          {!yo ? (
            <motion.div key="identificacion" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
              <div className="space-y-1.5 text-center">
                <h2 className="text-sm font-black text-white uppercase tracking-tight">¿Quién eres?</h2>
                <p className="text-4xs text-slate-500 uppercase font-bold tracking-wider">Elige tu nombre del censo para identificar tus intervenciones</p>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 text-slate-500" size={16} />
                <input
                  type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Busca tu nombre o vivienda..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
                {cargando ? (
                  <p className="text-4xs text-slate-500 text-center py-8 uppercase tracking-widest">Cargando censo...</p>
                ) : propietariosFiltrados.length === 0 ? (
                  <p className="text-4xs text-slate-600 text-center py-8 uppercase tracking-widest">Sin resultados.</p>
                ) : (
                  propietariosFiltrados.map((p) => (
                    <button
                      key={p.id} onClick={() => elegirme(p)}
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
            </motion.div>
          ) : (
            <motion.div key="grabacion" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-inner">
                <div>
                  <span className="block text-[8px] font-mono text-blue-400 font-bold uppercase tracking-wider">Interviniendo como</span>
                  <h3 className="text-xs font-black text-white">{yo.nombre_completo}</h3>
                  <p className="text-4xs text-slate-500">{yo.propiedad_detalle}</p>
                </div>
                <button onClick={cambiarDeVecino} className="text-4xs text-slate-500 hover:text-white font-bold uppercase tracking-wider underline underline-offset-2">
                  No soy yo
                </button>
              </div>

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
      </main>

      <footer className="w-full max-w-md mx-auto py-3 text-center shrink-0">
        <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest leading-none">
          Cifrado en tránsito — Ley de Propiedad Horizontal Art. 15 — VotifAI
        </p>
      </footer>
    </div>
  );
}
