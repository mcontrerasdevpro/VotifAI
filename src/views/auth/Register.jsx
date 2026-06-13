import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVotifaiStore } from '../../store.jsx';
import { ShieldCheck, Building2, Users, ArrowRight, ArrowLeft, Mail, Lock, Sparkles, CheckCircle2, CreditCard, AudioLines, FileJson, Scale } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const { dispatch } = useVotifaiStore() || { dispatch: () => { } };

  const [paso, setPaso] = useState(1);
  const [tipoOrganizacion, setTipoOrganizacion] = useState('administrador');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [razonSocial, setRazonSocial] = useState('');
  const [cifEmpresa, setCifEmpresa] = useState('');
  const [direccionEmpresa, setDireccionEmpresa] = useState('');
  const [administradores, setAdministradores] = useState('');
  const [sector, setSector] = useState('');
  const [capitalSocial, setCapitalSocial] = useState('');
  const [numAcciones, setNumAcciones] = useState('');
  const [regimenMayoria, setRegimenMayoria] = useState('simple');

  const [nombreAdminFincas, setNombreAdminFincas] = useState('');
  const [nombreComunidad, setNombreComunidad] = useState('');
  const [cifComunidad, setCifComunidad] = useState('');
  const [direccionComunidad, setDireccionComunidad] = useState('');
  const [nombrePresidente, setNombrePresidente] = useState('');
  const [totalPropiedades, setTotalPropiedades] = useState('');
  const [recargoMora, setRecargoMora] = useState('');
  const [cpComunidad, setCpComunidad] = useState('');
  const [ciudadComunidad, setCiudadComunidad] = useState('');
  const [provinciaComunidad, setProvinciaComunidad] = useState('');

  const [titularCuenta, setTitularCuenta] = useState('');
  const [iban, setIban] = useState('');

  const handleSiguientePaso = async (e) => {
    e.preventDefault();
    if (paso < 3) {
      setPaso(paso + 1);
    } else {
       const payload = {
        tipoOrganizacion,
        nombreEntidad: tipoOrganizacion === 'empresa' ? razonSocial : nombreComunidad,
        email,
        plan: 'trial_15_dias',
        metadatosFiscales: tipoOrganizacion === 'empresa'
          ? { cifEmpresa, direccionEmpresa, administradores, sector, capitalSocial, numAcciones, regimenMayoria }
          : { 
              nombreAdminFincas, 
              nombreComunidad, 
              cifComunidad, 
              direccionComunidad, 
              nombrePresidente, 
              totalPropiedades, 
              recargoMora,
              codigo_postal: cpComunidad,
              ciudad: ciudadComunidad,
              provincia: provinciaComunidad
            },
        banco: { titularCuenta, iban }
      };

      try {
        const respuesta = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
          alert(resultado.error || 'Fallo al procesar la inserción en Neon Cloud.');
          return;
        }

        if (resultado.tenant && resultado.tenant.id) {
          localStorage.setItem('tenantId', resultado.tenant.id);
        } else {
          console.error("El servidor no devolvió el objeto tenant esperado:", resultado);
        }
       
        
        const payloadSincronizado = {
          ...resultado.tenant,
          adminNombre: tipoOrganizacion === 'administrador' ? nombreAdminFincas : razonSocial,          
          comunidadesYEmpresas: resultado.tenant?.comunidadesYEmpresas || [
            {
              id: `ent_inicial_${Math.random().toString(36).substr(2, 5)}`,
              nombre: tipoOrganizacion === 'empresa' ? razonSocial : nombreComunidad,
              tipo: tipoOrganizacion,
              ubicacion: tipoOrganizacion === 'empresa' ? direccionEmpresa : direccionComunidad,
              estado: 'Creada - Esperando Convocatoria',
              cif: tipoOrganizacion === 'empresa' ? cifEmpresa : cifComunidad,
              direccion: tipoOrganizacion === 'empresa' ? direccionEmpresa : direccionComunidad
            }
          ]
        };

        dispatch({
          type: 'REGISTRAR_ORGANIZACION',
          payload: payloadSincronizado
        });
        
        navigate('/hub');

      } catch (error) {
        console.error('Error de comunicación en Render:', error);
        alert('Fallo de red: El servidor unificado no ha podido procesar la petición HTTP.');
      }
    }
  };


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row font-sans antialiased overflow-hidden">

      {/* ================= COLUMNA IZQUIERDA: SERVICIOS Y MARKETING (50% de la pantalla) ================= */}
      <div className="w-full lg:w-1/2 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-900 p-8 md:p-16 flex flex-col justify-between overflow-y-auto custom-scrollbar">

        {/* LOGO */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={paso === 1 ? () => navigate('/') : () => setPaso(paso - 1)}
            className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition-all text-slate-400 hover:text-white"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={26} className="text-blue-500" />
            <span className="text-2xl font-black text-white">Votif<span className="text-blue-500">AI</span></span>
          </div>
        </div>

        {/* BENEFICIOS COMERCIALES CENTRALES */}
        <div className="my-12 space-y-8 max-w-lg">
          <div className="space-y-3">
            <div className="text-blue-500 text-3xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={14} className="animate-pulse" /> Ecosistema de Gobernanza SaaS
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
              Ahorra más de 12 horas de trabajo burocrático por junta.
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              VotifAI automatiza las tareas más pesadas de los administradores y secretarios, garantizando la validez legal y eliminando las impugnaciones.
            </p>
          </div>

          {/* LISTADO DE ARGUMENTOS DE VENTA */}
          <div className="space-y-4">
            <div className="flex gap-4 items-start bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
              <AudioLines size={20} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-2xs font-bold text-white uppercase tracking-wide">Diarización y Reconocimiento de Voz</h4>
                <p className="text-3xs text-slate-400 mt-1 leading-normal">El sistema graba el audio en vivo, separa las intervenciones y asocia cada frase al vecino o accionista de forma inequívoca.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
              <FileJson size={20} className="text-purple-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-2xs font-bold text-white uppercase tracking-wide">Redacción de Actas en 2 Minutos</h4>
                <p className="text-3xs text-slate-400 mt-1 leading-normal">Nuestros modelos entrenados estructuran el borrador oficial en base a la legislación (LPH/LSC) de forma inmediata al finalizar.</p>
              </div>
            </div>

            <div className="flex gap-4 items-start bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
              <Scale size={20} className="text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-2xs font-bold text-white uppercase tracking-wide">Escrutinio Blindado por Coeficientes</h4>
                <p className="text-3xs text-slate-400 mt-1 leading-normal">Control absoluto de cuórum en sala, dobles mayorías cruzadas y firmas digitales protegidas mediante Hash criptográfico.</p>
              </div>
            </div>
          </div>
        </div>

        {/* PIE DE COLUMNA */}
        <p className="text-4xs text-slate-500 font-bold tracking-widest uppercase flex items-center gap-2">
          <ShieldCheck size={12} /> Cumplimiento Normativo RGPD y Estándar Bancario SEPA
        </p>
      </div>

      {/* ================= COLUMNA DERECHA: FORMULARIO MULTI-PASO (50% de la pantalla) ================= */}
      <div className="w-full lg:w-1/2 p-8 md:p-16 flex flex-col justify-between overflow-y-auto custom-scrollbar bg-slate-950">

        {/* INDICADOR DE PASOS SUPERIOR */}
        <div className="flex justify-end gap-4 text-4xs font-black uppercase tracking-widest text-slate-600 shrink-0">
          <span className={paso === 1 ? "text-blue-500 border-b border-blue-500 pb-1" : ""}>1. Credenciales</span>
          <span className={paso === 2 ? "text-blue-500 border-b border-blue-500 pb-1" : ""}>2. Configuración Legal</span>
          <span className={paso === 3 ? "text-blue-500 border-b border-blue-500 pb-1" : ""}>3. Domiciliación</span>
        </div>

        {/* CONTENEDOR CENTRAL DEL FORMULARIO (Estirado verticalmente por flex) */}
        <form onSubmit={handleSiguientePaso} className="my-auto py-8 space-y-6 max-w-xl mx-auto w-full">

          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              {paso === 1 && "Crear Perfil Profesional"}
              {paso === 2 && (tipoOrganizacion === 'empresa' ? "Configuración de la Sociedad" : "Configuración de la Finca")}
              {paso === 3 && "Domiciliación Bancaria Directa"}
            </h1>
            <p className="text-3xs text-slate-400 leading-normal">
              {paso === 1 && "Establece tu correo de control y el entorno correspondiente."}
              {paso === 2 && "Completa los parámetros normativos para calibrar el motor inteligente de votación."}
              {paso === 3 && "Introduce los datos bancarios. Activaremos la prueba de 15 días a coste cero."}
            </p>

            {/* 🔒 ENLACE DIRECTO PARA ADMINISTRADORES YA REGISTRADOS */}
            {paso === 1 && (
              <p className="text-4xs text-slate-500 font-medium mt-1">
                ¿Ya tienes una cuenta de despacho?{' '}
                <span
                  onClick={() => navigate('/login/corporativo')}
                  className="text-blue-400 font-black cursor-pointer hover:underline"
                >
                  Iniciar Sesión Aquí
                </span>
              </p>
            )}
          </div>

          {/* ================= CONTENIDO: PASO 1 ================= */}
          {paso === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-2">
                <label className="block text-3xs font-bold text-slate-500 uppercase tracking-widest">¿Qué tipo de perfil vas a gestionar?</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button" onClick={() => setTipoOrganizacion('administrador')}
                    className={`flex items-center justify-center gap-3 py-4 px-4 text-3xs font-black uppercase tracking-wider rounded-xl transition-all border ${tipoOrganizacion === 'administrador' ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                  >
                    <Users size={14} /> Admin. Fincas / Vecinos
                  </button>
                  <button
                    type="button" onClick={() => setTipoOrganizacion('empresa')}
                    className={`flex items-center justify-center gap-3 py-4 px-4 text-3xs font-black uppercase tracking-wider rounded-xl transition-all border ${tipoOrganizacion === 'empresa' ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                  >
                    <Building2 size={14} /> Empresa / Corporación
                  </button>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-3xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Maestro del Administrador</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 text-slate-600" size={16} />
                    <input type="email" required placeholder="director@miempresa.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3.5 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium" />
                  </div>
                </div>
                <div>
                  <label className="block text-3xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Contraseña de Control de Acceso</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 text-slate-600" size={16} />
                    <input type="password" required placeholder="••••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3.5 pl-10 pr-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= CONTENIDO: PASO 2 EMPRESAS ================= */}
          {paso === 2 && tipoOrganizacion === 'empresa' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
              <div className="sm:col-span-2">
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Nombre o Razón Social</label>
                <input type="text" required placeholder="Ej: Inversiones Globales S.A." value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">CIF de la Sociedad</label>
                <input type="text" required placeholder="Ej: A-82345678" value={cifEmpresa} onChange={(e) => setCifEmpresa(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none uppercase font-mono focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Sector de Actividad</label>
                <input type="text" required placeholder="Ej: Tecnología / Inmobiliario" value={sector} onChange={(e) => setSector(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Dirección Social / Sede Central</label>
                <input type="text" required placeholder="Ej: Av. de la Constitución 14, Planta 4" value={direccionEmpresa} onChange={(e) => setDireccionEmpresa(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Capital Social Suscrito (€)</label>
                <input type="number" required placeholder="Ej: 60000" value={capitalSocial} onChange={(e) => setCapitalSocial(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Número de Acciones</label>
                <input type="number" required placeholder="Ej: 10000" value={numAcciones} onChange={(e) => setNumAcciones(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Nombre de Administrador o Consejeros Delegados</label>
                <input type="text" required placeholder="Ej: Juan Gómez y Carlos Ortiz" value={administradores} onChange={(e) => setAdministradores(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Régimen de Mayoría Estatutaria</label>
                <select value={regimenMayoria} onChange={(e) => setRegimenMayoria(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium">
                  <option value="simple">Mayoría Simple (Más SÍ que NO)</option>
                  <option value="absoluta">Mayoría Absoluta (50% + 1 del capital total)</option>
                  <option value="reforzada">Mayoría Reforzada (Estatutos - 2/3 partes)</option>
                </select>
              </div>
            </div>
          )}

          {/* ================= CONTENIDO: PASO 2 VECINOS ================= */}
          {paso === 2 && tipoOrganizacion === 'administrador' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
              <div className="sm:col-span-2">
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Razón Social del Administrador de Fincas</label>
                <input type="text" required placeholder="Ej: Gestión Inmobiliaria Martínez S.L." value={nombreAdminFincas} onChange={(e) => setNombreAdminFincas(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Nombre de la Comunidad de Vecinos Inicial</label>
                <input type="text" required placeholder="Ej: Comunidad Paseo de la Castellana 42" value={nombreComunidad} onChange={(e) => setNombreComunidad(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">CIF de la Comunidad de Vecinos</label>
                <input type="text" required placeholder="Ej: H-81234567" value={cifComunidad} onChange={(e) => setCifComunidad(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none uppercase font-mono focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Nombre del Presidente Actual</label>
                <input type="text" required placeholder="Ej: D. Manuel Contreras Jaén" value={nombrePresidente} onChange={(e) => setNombrePresidente(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Nº Propiedades Totales (Pisos/Locales)</label>
                <input type="number" required placeholder="Ej: 32" value={totalPropiedades} onChange={(e) => setTotalPropiedades(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Recargo por Mora Estatutario (%)</label>
                <input type="number" required placeholder="Ej: 5" value={recargoMora} onChange={(e) => setRecargoMora(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Dirección Geográfica de la Finca</label>
                <input type="text" required placeholder="Ej: Calle de la Gran Vía 12, Madrid" value={direccionComunidad} onChange={(e) => setDireccionComunidad(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>

              {/* 🏠 NUEVO BLOQUE: GEOLOCALIZACIÓN COMPLETA REQUERIDA (AMOLDADO A TU DISEÑO) */}
               <div className="sm:col-span-1">
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Código Postal</label>
                <input type="text" required placeholder="Ej: 28907" value={cpComunidad} onChange={(e) => setCpComunidad(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono font-bold" />
              </div>
              
              <div className="sm:col-span-1">
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Ciudad / Municipio</label>
                <input type="text" required placeholder="Ej: Getafe" value={ciudadComunidad} onChange={(e) => setCiudadComunidad(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-3xs font-bold text-slate-400 tracking-widest uppercase mb-1.5">Provincia</label>
                <input type="text" required placeholder="Ej: Madrid" value={provinciaComunidad} onChange={(e) => setProvinciaComunidad(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>

            </div>
          )}

          {/* ================= CONTENIDO: PASO 3 ================= */}
          {paso === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-slate-950 border border-blue-500/10 rounded-2xl flex gap-3 items-center">
                <CreditCard size={18} className="text-blue-500" />
                <p className="text-4xs text-slate-400 leading-normal">
                  Cumpliendo la normativa bancaria SEPA, registramos un IBAN verificado para mantener activa tu cuenta tras concluir tus **15 días de prueba gratis**. No realizaremos cargos ahora.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-3xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nombre del Titular de la Cuenta Bancaria</label>
                  <input type="text" required placeholder="Ej: Manuel Contreras Jaén" value={titularCuenta} onChange={(e) => setTitularCuenta(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3.5 px-4 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-3xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Código de Cuenta Internacional (IBAN)</label>
                  <input type="text" required placeholder="ES21 0049 1234 5678 9012 3456" value={iban} onChange={(e) => setIban(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3.5 px-4 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 tracking-wider" />
                </div>
              </div>

              <div className="bg-slate-950 border border-blue-500/20 p-4 rounded-xl flex justify-between items-center mt-6">
                <div className="flex gap-2 items-center">
                  <Sparkles size={14} className="text-blue-400" />
                  <span className="text-4xs uppercase tracking-wider text-slate-300 font-bold">Modo de Prueba Activado: 15 Días Completos</span>
                </div>
                <span className="text-4xs text-emerald-400 font-bold">0€ / Gratis</span>
              </div>
            </div>
          )}

          {/* BOTÓN MAESTRO DE ACCIÓN COMPACTO PERO LARGO */}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl text-3xs uppercase tracking-widest transition-all mt-4 flex items-center justify-center gap-2 shadow-lg active:scale-99 shadow-blue-600/10"
          >
            {paso === 3 ? "Activar Mi Cuenta y Comenzar Prueba de 15 Días" : "Continuar al siguiente paso"}
            <ArrowRight size={14} />
          </button>
        </form>

        {/* PIE DE PÁGINA COLUMNA DERECHA */}
        <footer className="text-center text-4xs text-slate-600 font-bold tracking-widest uppercase shrink-0 pt-4">
          VotifAI Inc. © {new Date().getFullYear()} — Licencia de Software Homologada
        </footer>
      </div>

    </div>
  );
}