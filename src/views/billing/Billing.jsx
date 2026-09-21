import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, CreditCard, LoaderCircle } from 'lucide-react';

export default function Billing() {
  const navigate = useNavigate();
  const [planes, setPlanes] = useState([]);
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState('');

  useEffect(() => {
    const cargar = async () => {
      try {
        const [planesResponse, estadoResponse] = await Promise.all([
          fetch('/api/billing/planes'),
          fetch('/api/billing/estado', { credentials: 'include' })
        ]);
        const planesData = await planesResponse.json();
        const estadoData = await estadoResponse.json();
        if (!planesResponse.ok || !estadoResponse.ok) throw new Error('No se pudo cargar la información de facturación.');
        setPlanes(planesData.planes || []);
        setEstado(estadoData.estado);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, []);

  const iniciarCheckout = async (plan) => {
    setProcesando(plan);
    setError('');
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo iniciar el checkout.');
      window.location.assign(data.url);
    } catch (checkoutError) {
      setError(checkoutError.message);
      setProcesando('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-6 text-slate-100 sm:px-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-slate-900 pb-5">
        <button type="button" onClick={() => navigate('/hub')} className="flex items-center gap-2 text-xs font-bold text-slate-400 transition hover:text-white"><ArrowLeft size={15} /> Volver al Hub</button>
        <span className="flex items-center gap-2 text-sm font-black text-white"><CreditCard size={17} className="text-cyan-300" /> Mi plan</span>
      </header>

      <main className="mx-auto max-w-6xl py-10">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Facturación SaaS</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">Elige cómo quieres crecer.</h1>
          <p className="mt-4 leading-7 text-slate-400">Tu plan controla la capacidad de tu cartera y las funciones disponibles. Puedes empezar con el trial y ampliar cuando lo necesites.</p>
        </div>

        {estado && <div className="mt-8 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-5"><p className="text-xs font-bold uppercase tracking-wider text-cyan-200">Plan actual</p><div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><p className="text-2xl font-black text-white">{estado.nombrePlan}</p><p className="text-sm text-slate-400">{estado.uso.fincas} de {estado.limites.fincas ?? '∞'} fincas utilizadas · {estado.estado}</p></div></div>}

        {error && <p className="mt-6 rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

        {cargando ? <div className="py-16 text-center text-sm text-slate-500">Cargando planes...</div> : <div className="mt-8 grid gap-4 lg:grid-cols-4">{planes.map((plan) => {
          const actual = estado?.plan === plan.id;
          const esStarter = plan.id === 'starter';
          return <article key={plan.id} className={`flex flex-col rounded-2xl border p-5 ${actual ? 'border-cyan-300/40 bg-cyan-300/[0.08]' : 'border-white/10 bg-white/[0.03]'}`}>
            <div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-cyan-300">{plan.nombre}</p>{actual && <span className="rounded-full bg-cyan-300/15 px-2 py-1 text-[10px] font-bold text-cyan-200">Actual</span>}</div>
            <p className="mt-5 text-xl font-black text-white">{esStarter ? 'Para comenzar' : plan.id === 'enterprise' ? 'A medida' : 'Para crecer'}</p>
            <ul className="mt-5 flex-grow space-y-3 text-sm text-slate-400"><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-300" />{plan.maxFincas ?? 'Sin límite'} fincas</li><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-300" />Hasta {plan.maxPropietariosPorFinca ?? 'sin límite'} propietarios por finca</li><li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-emerald-300" />{plan.transcripcionVoz ? 'Transcripción de voz incluida' : 'Gestión esencial'}</li></ul>
            <button type="button" disabled={actual || !plan.disponibleParaCheckout || procesando === plan.id} onClick={() => iniciarCheckout(plan.id)} className="mt-7 flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 px-4 py-3 text-sm font-bold text-cyan-200 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50">{procesando === plan.id && <LoaderCircle size={15} className="animate-spin" />}{actual ? 'Plan actual' : plan.disponibleParaCheckout ? 'Elegir plan' : esStarter ? 'Incluido en trial' : 'Próximamente'}</button>
          </article>;
        })}</div>}
      </main>
    </div>
  );
}