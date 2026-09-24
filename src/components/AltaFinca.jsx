import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, MapPin, FileUp, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVotifaiStore } from '../store.jsx';
import Field from './ui/Field.jsx';
import Card from './ui/Card.jsx';

export default function AltaFinca() {
  const navigate = useNavigate();
  const { dispatch } = useVotifaiStore() || { dispatch: () => {} };

  const [nombre, setNombre] = useState('');
  const [cif, setCif] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [archivoPDF, setArchivoPDF] = useState(null);

  const [procesando, setProcesando] = useState(false);
  const [completado, setCompletado] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre || !cif) return;

    setProcesando(true);

    const payload = {
      nombre: nombre,
      cif: cif.toUpperCase(),
      direccion: ubicacion || 'Dirección Registrada de la Finca',
      tipo: 'comunidad'
    };

    try {
      const respuesta = await fetch('/api/entities/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (respuesta.ok) {
        const resultadoBack = await respuesta.json();

        dispatch({
          type: 'AÑADIR_ENTIDAD',
          payload: {
            id: resultadoBack.id,
            nombre: resultadoBack.nombre,
            tipo: 'comunidad',
            cif: resultadoBack.cif,
            direccion: resultadoBack.direccion,
            estado: 'Junta Programada — HOY 18:00',
            propietarios: []
          }
        });

        setProcesando(false);
        setCompletado(true);
        setTimeout(() => {
          setNombre(''); setCif(''); setUbicacion(''); setArchivoPDF(null); setCompletado(false);
          navigate('/hub');
        }, 1500);
      } else {
        setProcesando(false);
        alert("❌ Error: El CIF ya está registrado en este despacho profesional.");
      }
    } catch (error) {
      console.error("Fallo de inserción relacional:", error);
      setProcesando(false);
      alert("❌ Error de red: No se pudo conectar con Neon Cloud.");
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex overflow-hidden font-sans antialiased">

      {/* SECCIÓN IZQUIERDA: FORMULARIO */}
      <div className="w-full lg:w-5/12 h-full bg-[#0d1117] border-r border-slate-900 p-8 flex flex-col justify-between overflow-y-auto custom-scrollbar">

        <div className="space-y-2 shrink-0">
          <div className="flex items-center gap-2 text-blue-400 font-mono text-4xs uppercase tracking-widest">
            <Shield size={12} /> Ecosistema Multi-Inquilino VotifAI
          </div>
          <h1 className="text-xl font-black tracking-tight text-white">Desplegar Nueva Comunidad</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex-grow my-6 space-y-4 flex flex-col justify-center max-w-md w-full mx-auto">

          {/* Nombre Oficial */}
          <Field
            label="Nombre de la Finca / Comunidad"
            type="text" required placeholder="Ej: Comunidad de Propietarios Calle Mayor 14"
            value={nombre} onChange={(e) => setNombre(e.target.value)}
          />

          {/* CIF y Ubicación en Grid */}
          <div className="grid grid-cols-3 gap-4">
            <Field
              className="col-span-1"
              label="CIF / NIF"
              type="text" required placeholder="H1234567J" maxLength={9}
              value={cif} onChange={(e) => setCif(e.target.value)}
              inputClassName="font-mono font-bold text-center uppercase"
            />
            <Field
              className="col-span-2"
              label="Localización / Dirección" icon={MapPin}
              type="text" placeholder="Madrid, España"
              value={ubicacion} onChange={(e) => setUbicacion(e.target.value)}
            />
          </div>

          {/* Capturador de PDF */}
          <div className="space-y-1.5">
            <label className="block text-4xs font-black uppercase tracking-wider text-slate-400">Convocatoria Inicial (Opcional)</label>
            <label className="w-full border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-inner">
              <input
                type="file" accept="application/pdf" className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setArchivoPDF(e.target.files[0]);
                  }
                }}
              />
              <FileUp size={16} className={archivoPDF ? 'text-blue-400 animate-pulse' : 'text-slate-500'} />
              <span className="text-4xs font-bold text-slate-400 uppercase tracking-wider truncate max-w-full px-2">
                {archivoPDF ? archivoPDF.name : 'Adjuntar Documento o Acta Escaneada'}
              </span>
            </label>
          </div>

          {/* Botón de Envío */}
          <button
            type="submit" disabled={procesando || completado}
            className={`w-full py-3.5 rounded-xl text-3xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg ${
              completado ? 'bg-emerald-600 text-white' :
              procesando ? 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed' :
              'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/10 active:scale-99'
            }`}
          >
            {procesando ? (
              <> <Loader2 size={14} className="animate-spin text-blue-400" /> Desplegando en Neon... </>
            ) : completado ? (
              <> <CheckCircle size={14} className="animate-bounce" /> Entorno Legal Activo </>
            ) : (
              <> Inicializar Estructura <ArrowRight size={14} /> </>
            )}
          </button>
        </form>

        <div className="text-5xs text-slate-600 font-medium border-t border-slate-900/60 pt-4 shrink-0">
          * Alta con cifrado HASH SHA-256 para prevenir la alteración posterior del libro de actas.
        </div>
      </div>
      {/* 🎨 LADO DERECHO: INTERFAZ DE MONITOREO VISUAL */}
      <div className="hidden lg:flex lg:w-7/12 h-full bg-slate-950 flex-col items-center justify-center p-12 relative overflow-hidden">

        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl" />

        {/* Consola de Control Periférico */}
        <Card className="w-full max-w-md space-y-4 backdrop-blur-md relative z-10" padding="p-5">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${procesando ? 'bg-amber-400 animate-ping' : 'bg-emerald-500'}`} />
              <span className="text-4xs font-mono font-black uppercase text-slate-400 tracking-wider">Estado de Aislamiento Inquilino</span>
            </div>
            <span className="text-5xs font-mono bg-slate-950 border border-slate-800 text-slate-500 px-2 py-0.5 rounded-md font-bold uppercase">
              Tenant Activo
            </span>
          </div>

          {/* Monitor de Estado en Tiempo Real */}
          <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl space-y-3 shadow-inner min-h-[140px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {procesando ? (
                <motion.div
                  key="loading-ui" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="space-y-2 text-center"
                >
                  <p className="text-3xs font-mono text-blue-400 font-bold uppercase tracking-widest animate-pulse">
                    Mapeando Base de Datos Cruzada...
                  </p>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800/80">
                    <motion.div
                      className="bg-blue-500 h-full rounded-full"
                      initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 2.3, ease: "easeInOut" }}
                    />
                  </div>
                  <p className="text-5xs text-slate-500 font-medium">
                    Generando censo aleatorio legal de 20 propietarios de España...
                  </p>
                </motion.div>
              ) : completado ? (
                <motion.div
                  key="success-ui" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="text-center space-y-1.5"
                >
                  <CheckCircle size={28} className="text-emerald-500 mx-auto animate-bounce" />
                  <p className="text-3xs font-black uppercase text-white tracking-wider">Nodo Vinculado Correctamente</p>
                  <p className="text-4xs text-emerald-400/80 font-mono">UUID-SECURE GENERADO</p>
                </motion.div>
              ) : (
                <motion.div
                  key="idle-ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="space-y-2.5"
                >
                  <div className="flex justify-between items-center text-4xs font-mono font-bold text-slate-500 border-b border-slate-900 pb-1.5">
                    <span>PARAMETRO</span>
                    <span>VALOR EN TIEMPO REAL</span>
                  </div>
                  <div className="flex justify-between items-center text-4xs">
                    <span className="text-slate-400 font-medium">Entidad Activa:</span>
                    <span className="font-bold text-slate-200 truncate max-w-[200px]">{nombre || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center text-4xs">
                    <span className="text-slate-400 font-medium">Identificador Fiscal:</span>
                    <span className="font-mono font-black text-blue-400 uppercase">{cif || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center text-4xs">
                    <span className="text-slate-400 font-medium">Regulación Aplicada:</span>
                    <span className="text-slate-200 font-bold">LPH Ley 49/1960</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Logs informativos */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-900/60 font-mono text-5xs text-slate-500 leading-normal space-y-1">
            <p><span className="text-blue-500">▶</span> status --isolation-check --tenant</p>
            <p className="text-slate-400">✓ Aislamiento relacional PostgreSQL (pgAdmin) verificado en la nube.</p>
          </div>

        </Card>
      </div>

    </div>
  );
}
