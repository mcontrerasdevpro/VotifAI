import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Smartphone, User, Landmark, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Vote } from 'lucide-react';
import Field from '../../components/ui/Field.jsx';
import Card from '../../components/ui/Card.jsx';

export default function VoterScreen() {
  const { tokenAcceso } = useParams();
  
  const [dniIngresado, setDniIngresado] = useState('');
  const [propietarioVerificado, setPropietarioVerificado] = useState(null);
  const [autenticando, setAutenticando] = useState(false);
  const [errorLogin, setErrorLogin] = useState('');
  
  const [puntosJunta, setPuntosJunta] = useState([]);
  const [cargandoPuntos, setCargandoPuntos] = useState(false);
  const [votosEmitidos, setVotosEmitidos] = useState({}); 
  const [enviandoVoto, setEnviandoVoto] = useState(null); 
  
  const handleVerificarIdentidad = async (e) => {
    e.preventDefault();
    if (!dniIngresado) return;

    setAutenticando(true);
    setErrorLogin('');

    try {      
      const respuesta = await fetch(`/api/auth/voter-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: dniIngresado.toUpperCase(), token: tokenAcceso })
      });
      const datos = await respuesta.json();

      if (respuesta.ok && datos.success) {
        setPropietarioVerificado(datos.propietario);        
        await cargarOrdenDiaPropietario(datos.propietario.entity_id);
      } else {
        setErrorLogin(datos.error || 'El DNI introducido no coincide con el propietario registrado para este enlace.');
      }
    } catch (err) {
      console.error(err);
      setErrorLogin('Fallo de conexión: El servidor de votación no responde.');
    } finally {
      setAutenticando(false);
    }
  };
  
  const cargarOrdenDiaPropietario = async (fincaId) => {
    setCargandoPuntos(true);
    try {
      const res = await fetch(`/api/propietarios/lista/${fincaId}`);
      const data = await res.json();
      if (res.ok) {
        setPuntosJunta([
          { id: 1, titulo: "Aprobación de cuentas del ejercicio anterior", estado: 'votacion' },
          { id: 2, titulo: "Presupuesto ordinario para el nuevo año", estado: 'votacion' },
          { id: 3, titulo: "Renovación de cargos de la Junta (Presidente y Tesorero)", estado: 'votacion' }
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCargandoPuntos(false);
    }
  };

  const handleEmitirVotoRemoto = async (puntoId, sentidoVoto) => {
    setEnviandoVoto(puntoId);
    try {
      const respuesta = await fetch('/api/meetings/emitir-voto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propietario_id: propietarioVerificado.id,
          entity_id: propietarioVerificado.entity_id,
          punto_id: puntoId,
          sentido: sentidoVoto,
          coeficiente: propietarioVerificado.coeficiente
        })
      });

      if (respuesta.ok) {
        setVotosEmitidos(prev => ({ ...prev, [puntoId]: sentidoVoto }));
      } else {
        alert("❌ No se pudo registrar el voto. Compruebe si el punto ya está cerrado.");
      }
    } catch (err) {
      console.error(err);
      alert("❌ Fallo de red al transmitir el voto criptográfico.");
    } finally {
      setEnviandoVoto(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 font-sans antialiased selection:bg-blue-500/30">
      
      {/* CABECERA DE SEGURIDAD INSTITUCIONAL */}
      <header className="w-full max-w-md mx-auto py-4 flex items-center justify-between border-b border-slate-900 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md shadow-blue-600/10">
            <Shield size={16} />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-tight text-white uppercase">VotifAI Mobile</h1>
            <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">Pasarela de Voto Remoto Certificado</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
          <span className="text-[8px] font-mono font-bold text-emerald-400 uppercase">SSL Seguro</span>
        </div>
      </header>

      {/* CUERPO CENTRAL INTERACTIVO */}
      <main className="w-full max-w-md mx-auto flex-grow flex flex-col justify-center py-6">
        <AnimatePresence mode="wait">
          
          {!propietarioVerificado ? (           
            <motion.div
              key="auth-gate"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-slate-900/50 border border-slate-900 rounded-3xl p-5 space-y-5 shadow-2xl relative overflow-hidden backdrop-blur-md"
            >
              <div className="space-y-1.5 text-center">
                <div className="w-12 h-12 bg-blue-600/10 text-blue-400 border border-blue-500/10 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                  <Smartphone size={20} />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-tight">Verificar Identidad Legal</h2>
                <p className="text-4xs text-slate-400 max-w-xs mx-auto leading-normal uppercase font-bold tracking-wider">
                  Para acceder al orden del día de su comunidad, por favor introduzca el documento de identidad del titular de la vivienda.
                </p>
              </div>

              <form onSubmit={handleVerificarIdentidad} className="space-y-4">
                <Field
                  label="DNI / NIF del Propietario" icon={User}
                  type="text"
                  required
                  maxLength={9}
                  value={dniIngresado}
                  onChange={(e) => setDniIngresado(e.target.value)}
                  inputClassName="font-mono uppercase font-bold"
                  placeholder="Ej: 12345678X"
                  disabled={autenticando}
                />

                {errorLogin && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-rose-400 text-4xs leading-relaxed font-bold animate-shake">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <p>{errorLogin}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={autenticando}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 rounded-xl text-4xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/10 transition-all flex items-center justify-center gap-1.5"
                >
                  {autenticando ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" /> Verificando Censo...
                    </>
                  ) : (
                    'Acceder a la Asamblea ➔'
                  )}
                </button>
              </form>
            </motion.div>
          ) : (          
            <motion.div
              key="voting-booth"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              {/* Tarjeta de Resumen del Copropietario */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-inner">
                <div className="space-y-0.5">
                  <span className="block text-[8px] font-mono text-blue-400 font-bold uppercase tracking-wider">👤 Vecino Autenticado</span>
                  <h3 className="text-2xs font-black text-white">{propietarioVerificado.nombre_completo}</h3>
                  <p className="text-[9px] text-slate-500 font-medium">Inmueble: {propietarioVerificado.propiedad_detalle || 'Vivienda'}</p>
                </div>
                <div className="text-right bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                  <span className="block text-[7px] font-mono text-slate-500 uppercase font-black">Coeficiente</span>
                  <span className="text-xs font-black text-emerald-400 font-mono">{parseFloat(propietarioVerificado.coeficiente || 5.00).toFixed(2)}%</span>
                </div>
              </div>

              {/* Listado de Puntos del Orden del Día */}
              <div className="space-y-3">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Vote size={12} className="text-blue-500" /> Puntos a Votación Ordinaria
                </div>

                {cargandoPuntos ? (
                  <div className="text-center py-8 text-5xs text-slate-500 font-bold uppercase tracking-widest animate-pulse flex items-center justify-center gap-2">
                    <RefreshCw size={12} className="animate-spin text-blue-500" /> Sincronizando Agenda...
                  </div>
                ) : (
                  puntosJunta.map((punto) => (
                    <Card key={punto.id} className="space-y-3 shadow-md" padding="p-4">
                      <div className="flex justify-between items-start gap-3">
                        <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded font-mono text-[8px] font-black text-slate-400">PUNTO {punto.id}</span>
                        <p className="text-3xs font-bold text-slate-200 flex-grow leading-normal">{punto.titulo}</p>
                      </div>

                      {/* Botonera de Emisión de Sentido de Voto */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <button
                          type="button"
                          disabled={enviandoVoto !== null || votosEmitidos[punto.id]}
                          onClick={() => handleEmitirVotoRemoto(punto.id, 'SI')}
                          className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${
                            votosEmitidos[punto.id] === 'SI'
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-300 disabled:opacity-40'
                          }`}
                        >
                          <CheckCircle2 size={10} /> A Favor
                        </button>

                        <button
                          type="button"
                          disabled={enviandoVoto !== null || votosEmitidos[punto.id]}
                          onClick={() => handleEmitirVotoRemoto(punto.id, 'NO')}
                          className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${
                            votosEmitidos[punto.id] === 'NO'
                              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/10'
                              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-300 disabled:opacity-40'
                          }`}
                        >
                          <XCircle size={10} /> En Contra
                        </button>

                        <button
                          type="button"
                          disabled={enviandoVoto !== null || votosEmitidos[punto.id]}
                          onClick={() => handleEmitirVotoRemoto(punto.id, 'ABSTENCION')}
                          className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                            votosEmitidos[punto.id] === 'ABSTENCION'
                              ? 'bg-slate-700 text-white shadow-lg'
                              : 'bg-slate-950 border border-slate-800 text-slate-500 hover:text-slate-400 disabled:opacity-40'
                          }`}
                        >
                          Abstenerse
                        </button>
                      </div>

                      {/* Notificación de Voto Inscrito de Forma Conforme */}
                      {votosEmitidos[punto.id] && (
                        <div className="text-[8px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 animate-fade-in shadow-inner">
                          <CheckCircle2 size={10} /> Su cuota ha sido computada de forma vinculante
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </motion.div>
          )}
          
        </AnimatePresence>
      </main>

      {/* PIE DE FIRMA CORPORATIVO Y CRIPTOGRÁFICO */}
      <footer className="w-full max-w-md mx-auto py-3 border-t border-slate-900 text-center shrink-0">
        <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest leading-none">
          Cifrado E2EE — Ley de Propiedad Horizontal Art. 15 — VotifAI
        </p>
      </footer>

    </div>
  );
}
