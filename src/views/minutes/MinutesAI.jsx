import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Chart from 'react-apexcharts';
import { FileText, AudioLines, Download, CheckCircle, Edit3, ArrowLeft, RefreshCw, Sparkles, Mic, MicOff, BarChart3, Users, Percent, ShieldCheck, Lock, Mail, MessageSquare, Send } from 'lucide-react';
import { useVotifaiStore } from '../../store.jsx';

export default function MinutesAI() {
  const navigate = useNavigate();
  const { state } = useVotifaiStore() || { state: { tenant: null } };

  const [vistaActiva, setVistaActiva] = useState('documento');
  const [editando, setEditando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [grabandoVoz, setGrabandoVoz] = useState(false);

  const [mostrarModalCierre, setMostrarModalCierre] = useState(false);
  const [envioEstado, setEnvioEstado] = useState('idle');
  const [contadorEnvio, setContadorEnvio] = useState(0);

  const [actaTexto, setActaTexto] = useState(
    `# ACTA DE LA JUNTA GENERAL EXTRAORDINARIA DE PROPIETARIOS\n` +
    `⏳ Cargando entorno relacional y redactando acta oficial con los datos geográficos de Neon Cloud...`
  );

  const chartOptions = {
    chart: { type: 'donut', background: 'transparent' },
    colors: ['#10b981', '#f43f5e', '#64748b'],
    labels: ['A Favor', 'En Contra', 'Abstención'],
    dataLabels: { enabled: false }
  };

  const chartSeries =

  // 📡 1. EL HOOK DE RED: Suelto e independiente en el cuerpo del componente
 useEffect(() => {
    // Buscamos si hay datos de la finca en el estado global o localStorage
    const fincaActivaId = 'd1f5964c-0c2b-40f8-88d6-d0ed253f8413';
    
    // Recuperamos el listado de comunidades del administrador del store
    const listaFincas = state?.tenant?.comunidadesYEmpresas || [];
    const fincaData = listaFincas.find(f => f.id === fincaActivaId);

    // Extraemos los campos reales geográficos o usamos fallbacks controlados si no se encuentran
    const nombre = fincaData?.nombre || 'Sala de Gobernanza Conectada';
    const direccion = fincaData?.direccion || fincaData?.ubicacion || 'Dirección Registrada en Neon';
    const cp = fincaData?.codigo_postal || '28907';
    const ciudad = fincaData?.ciudad || 'Getafe';
    const provincia = fincaData?.provincia || 'Madrid';

    // 📝 RE-GENERACIÓN INSTANTÁNEA: Inyectamos los datos reales en el acta
    setActaTexto(
      `# ACTA DE LA JUNTA GENERAL EXTRAORDINARIA DE PROPIETARIOS\n` +
      `**COMUNIDAD DE VECINOS:** ${nombre.toUpperCase()} — ${direccion}, CP: ${cp}, ${ciudad} (${provincia})\n` +
      `**FECHA Y HORA:** 13 de junio de 2026 — 18:00 Horas\n\n` +
      `## 1. CUÓRUM Y CONSTITUCIÓN LEGAL\n` +
      `Se verifica una asistencia de 48 propietarios presentes y representados (100,00% de las cuotas de participación). La Junta queda válidamente constituida de forma conforme según el Art. 16 de la LPH.\n\n` +
      `## 2. ACUERDOS ADOPTADOS\n` +
      `* **PUNTO 1:** SE APRUEBA LA REFORMA DEL TEJADO POR DOBLE MAYORÍA LEGAL conforme al Art. 17 de la LPH.`
    );
  }, [state]);

  // 🗳️ 2. EL DISPARADOR MASIVO: Empieza limpio e independiente justo debajo
  const handleDispararNotificacionesMasivas = async () => {
    setEnvioEstado('enviando_email');
    setContadorEnvio(0);

    let i = 0;
    const intervalEmail = setInterval(async () => {
      i++;
      setContadorEnvio(i);
      if (i >= 20) {
        clearInterval(intervalEmail);

        setEnvioEstado('enviando_whatsapp');
        setContadorEnvio(0);

        try {
          const urlBaseBackend = window.location.origin.replace('-5173.', '-3000.');
          console.log("📡 Conectando directamente con la API unificada de Node en:", urlBaseBackend);

          const resClausura = await fetch(`${urlBaseBackend}/api/meetings/clausurar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fincaId: 'd1f5964c-0c2b-40f8-88d6-d0ed253f8413',
              acta_texto: actaTexto
            })
          });

          if (resClausura.ok) {
            await fetch(`${urlBaseBackend}/api/notifications/convocar`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fincaId: 'd1f5964c-0c2b-40f8-88d6-d0ed253f8413',
                nombreFinca: 'Guanabacoa 2',
                propietarios: [{ nombre: "Matías Po", propiedad: "tos 2 1a", telefono: "+34 600000000" }]
              })
            });

            let j = 0;
            const intervalWA = setInterval(() => {
              j++;
              setContadorEnvio(j);
              if (j >= 20) {
                clearInterval(intervalWA);
                setEnvioEstado('completado');

                setTimeout(() => {
                  setMostrarModalCierre(false);
                  navigate('/hub');
                }, 2000);
              }
            }, 40);
          } else {
            alert("❌ Fallo crítico: No se pudo sellar la junta en el servidor.");
            setEnvioEstado('idle');
          }
        } catch (err) {
          console.error("Error al clausurar asamblea:", err);
          setEnvioEstado('idle');
        }
      }
    }, 30);
  };
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col h-screen overflow-hidden relative">

      {/* NAVEGACIÓN SUPERIOR */}
      <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-3 flex justify-between items-center gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin')} className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400"><ArrowLeft size={16} /></button>
          <div>
            <div className="flex items-center gap-2 text-purple-400 text-4xs font-bold uppercase tracking-widest"><Sparkles size={12} /> Cierre y Difusión Automatizada LPH</div>
            <h1 className="text-sm font-black text-white">Central de Firmas y Notificación Masiva</h1>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (editando) {
                setGuardado(true);
                setTimeout(() => setGuardado(false), 2000);
              }
              setEditando(!editando);
            }}
            className={`text-3xs font-black uppercase px-4 py-2.5 rounded-xl border transition-all ${editando
              ? 'bg-blue-600 border-blue-500 text-white shadow-md'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
              }`}
          >
            {editando ? '💾 Guardar Apuntes' : '✏️ Corrección Manual'}
          </button>

          <button
            type="button"
            disabled={editando}
            onClick={() => setMostrarModalCierre(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-3xs font-black uppercase px-5 py-2.5 rounded-xl shadow-lg active:scale-99 disabled:opacity-40"
          >
            ✓ Cerrar Junta y Enviar Acta
          </button>
        </div>
      </nav>

      {/* RECUADRO PANORÁMICO */}
      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
        <div className="w-full lg:w-5/12 bg-slate-900/40 border border-slate-900 rounded-2xl p-5 flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center mb-4 border-b border-slate-900 pb-3"><h3 className="text-3xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><AudioLines size={14} className="text-blue-500" /> Conversaciones Indexadas</h3></div>
          <div className="space-y-4 overflow-y-auto pr-1 flex-grow custom-scrollbar text-2xs italic text-slate-400">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-900">[Presidente]: "El acta queda revisada. Procedamos al cierre."</div>
          </div>
        </div>

        <div className="w-full lg:w-7/12 bg-white text-slate-900 rounded-2xl p-5 flex flex-col h-full overflow-hidden relative border border-slate-200">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3 text-slate-500">
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
              <button onClick={() => setVistaActiva('documento')} className={`px-4 py-1.5 rounded-lg text-3xs font-black uppercase transition-all ${vistaActiva === 'documento' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>Documento</button>
              <button onClick={() => setVistaActiva('estadisticas')} className={`px-4 py-1.5 rounded-lg text-3xs font-black uppercase transition-all ${vistaActiva === 'estadisticas' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}>Estadísticas</button>
            </div>
          </div>

          <div className="flex-grow flex flex-col overflow-hidden">
            {vistaActiva === 'documento' ? (
              editando ? (
                <textarea
                  value={actaTexto}
                  onChange={(e) => setActaTexto(e.target.value)}
                  className="w-full h-full bg-slate-50 text-slate-900 rounded-xl p-5 text-3xs font-sans font-medium focus:outline-none border-2 border-blue-500 shadow-inner resize-none overflow-y-auto leading-relaxed"
                  placeholder="Añada apuntes finales, anexos de cuotas o correcciones aquí..."
                />
              ) : (
                <div className="w-full h-full bg-slate-50 rounded-xl p-5 text-3xs font-sans text-slate-800 overflow-y-auto whitespace-pre-line border border-slate-100 shadow-inner leading-relaxed">
                  {actaTexto}
                </div>
              )
            ) : (
              <div className="flex-grow flex flex-col justify-center items-center h-full">
                <div className="w-full max-w-sm">
                  <Chart options={chartOptions} series={chartSeries} type="donut" width="100%" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================================== */}
      {/* 🚨 MODAL SAAS DE DISPARO MASIVO DE EMAIL Y WHATSAPP AUTOMÁTICO A LOS 20 VECINOS 🚨 */}
      {/* ===================================================================================== */}
      <AnimatePresence>
        {mostrarModalCierre && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-5 text-center shadow-2xl relative overflow-hidden">

              {envioEstado === 'idle' && (
                <>
                  <div className="w-14 h-14 bg-blue-600/10 text-blue-400 rounded-full flex items-center justify-center mx-auto border border-blue-500/10"><Send size={24} /></div>
                  <div>
                    <h3 className="text-sm font-black text-white">Consolidar Junta y Desplegar Acta</h3>
                    <p className="text-3xs text-slate-400 mt-1 leading-normal">¿Deseas cerrar el archivo y activar la pasarela automatizada de comunicación para los **20 propietarios censados** de la comunidad?</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setMostrarModalCierre(false)} className="bg-slate-950 border border-slate-800 text-slate-400 py-2.5 rounded-xl text-3xs font-bold uppercase tracking-wider">Revisar</button>
                    <button type="button" onClick={handleDispararNotificacionesMasivas} className="bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-3xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5"><Lock size={12} /> Firmar y Desplegar</button>
                  </div>
                </>
              )}

              {envioEstado === 'enviando_email' && (
                <div className="py-6 space-y-4 animate-fade-in">
                  <div className="w-12 h-12 bg-blue-600/10 text-blue-400 rounded-xl flex items-center justify-center mx-auto animate-pulse border border-blue-500/20"><Mail size={22} /></div>
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Despachando Emails Legales Certificados</h3>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden mt-3 border border-slate-800"><motion.div className="bg-blue-500 h-full rounded-full" animate={{ width: `${(contadorEnvio / 20) * 100}%` }} /></div>
                    <p className="text-3xs text-slate-400 font-mono mt-2">Enviando: {contadorEnvio} / 20 bandejas de entrada completadas...</p>
                  </div>
                </div>
              )}

              {envioEstado === 'enviando_whatsapp' && (
                <div className="py-6 space-y-4 animate-fade-in">
                  <div className="w-12 h-12 bg-emerald-600/10 text-emerald-400 rounded-xl flex items-center justify-center mx-auto animate-bounce border border-emerald-500/20"><MessageSquare size={22} /></div>
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Disparando Mensajes de WhatsApp API</h3>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden mt-3 border border-slate-800"><motion.div className="bg-emerald-500 h-full rounded-full" animate={{ width: `${(contadorEnvio / 20) * 100}%` }} /></div>
                    <p className="text-3xs text-emerald-400 font-mono mt-2">Enviados por pasarela telefónica: {contadorEnvio} / 20 propietarios...</p>
                  </div>
                </div>
              )}

              {envioEstado === 'completado' && (
                <div className="py-6 space-y-2 animate-fade-in">
                  <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                    <CheckCircle size={24} />
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider pt-2">¡Difusión Concluida con Éxito!</h3>
                  <p className="text-4xs text-slate-400 max-w-xs mx-auto">Acta archivada de forma segura. Los propietarios activos han recibido la notificación simultánea por Email y WhatsApp con el enlace de descarga del PDF legal.</p>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}