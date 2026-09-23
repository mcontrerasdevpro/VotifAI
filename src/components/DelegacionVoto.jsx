import { useCallback, useEffect, useState } from 'react';
import { Handshake, Check, X, Undo2 } from 'lucide-react';

const TEXTO_ESTADO = {
  pendiente: 'Esperando a que acepte',
  aceptada: 'Aceptada: votará en tu nombre',
  rechazada: 'No aceptada',
  revocada: 'Revocada'
};

/**
 * Delegación de voto entre vecinos (art. 15.1 LPH): el vecino que no puede
 * ir elige a otro propietario con cuenta, y la representación solo existe
 * cuando ese otro la ACEPTA desde su propia cuenta. Aquí se ven las dos
 * caras: las que he pedido yo y las que me piden a mí.
 */
export default function DelegacionVoto({ entityId }) {
  const [datos, setDatos] = useState({ juntas: [], mias: [], recibidas: [], candidatos: [] });
  const [juntaId, setJuntaId] = useState('');
  const [representanteId, setRepresentanteId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/vecino/${entityId}/delegaciones`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setDatos(data);
    } catch (err) {
      console.error('Fallo al cargar las delegaciones:', err);
    }
  }, [entityId]);

  useEffect(() => {
    cargar();
    // Para ver a tiempo cuándo el representante acepta o llega una solicitud.
    const intervalo = setInterval(cargar, 15000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  const pedir = async (url, body) => {
    setEnviando(true);
    setMensaje('');
    try {
      const res = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMensaje(data.error || 'No se pudo completar la acción.');
      await cargar();
      return res.ok;
    } finally {
      setEnviando(false);
    }
  };

  const solicitar = async (e) => {
    e.preventDefault();
    if (!juntaId || !representanteId) return;
    const ok = await pedir('/api/meetings/vecino/delegaciones', { meeting_id: juntaId, representante_id: representanteId });
    if (ok) {
      setRepresentanteId('');
      setMensaje('Solicitud enviada. Le hemos avisado; la representación solo valdrá cuando la acepte.');
    }
  };

  const tituloJunta = (id) => datos.juntas.find((j) => j.id === id)?.titulo || 'Junta';
  const juntasSinDelegar = datos.juntas.filter((j) => !datos.mias.some((d) => d.meeting_id === j.id && ['pendiente', 'aceptada'].includes(d.estado)));

  if (datos.juntas.length === 0 && datos.recibidas.length === 0) return null;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
      <h3 className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-widest text-slate-300">
        <Handshake size={13} className="text-blue-400" /> Representación en juntas
      </h3>

      {datos.recibidas.length > 0 && (
        <div className="space-y-2">
          <p className="text-4xs font-bold uppercase tracking-wider text-amber-300">Te piden que les representes</p>
          {datos.recibidas.map((d) => (
            <div key={d.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
              <p className="text-3xs text-slate-200">
                <strong>{d.representado_nombre}{d.representado_propiedad ? ` (${d.representado_propiedad})` : ''}</strong> en «{tituloJunta(d.meeting_id)}»
              </p>
              {d.estado === 'pendiente' ? (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={enviando} onClick={() => pedir(`/api/meetings/vecino/delegaciones/${d.id}/aceptar`)} className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 py-2 text-4xs font-black uppercase tracking-wider text-white disabled:opacity-50">
                    <Check size={12} /> Acepto representarle
                  </button>
                  <button type="button" disabled={enviando} onClick={() => pedir(`/api/meetings/vecino/delegaciones/${d.id}/rechazar`)} className="flex items-center justify-center gap-1 rounded-lg border border-slate-700 py-2 text-4xs font-black uppercase tracking-wider text-slate-300 disabled:opacity-50">
                    <X size={12} /> No acepto
                  </button>
                </div>
              ) : (
                <p className="text-4xs text-emerald-300">Aceptada: durante la junta podrás votar también en su nombre.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {datos.mias.length > 0 && (
        <div className="space-y-2">
          <p className="text-4xs font-bold uppercase tracking-wider text-slate-400">Tus delegaciones</p>
          {datos.mias.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 p-3">
              <div className="min-w-0">
                <p className="truncate text-3xs text-slate-200">«{tituloJunta(d.meeting_id)}» → {d.representante_nombre}{d.representante_propiedad ? ` (${d.representante_propiedad})` : ''}</p>
                <p className={`text-4xs ${d.estado === 'aceptada' ? 'text-emerald-300' : d.estado === 'pendiente' ? 'text-amber-300' : 'text-slate-500'}`}>{TEXTO_ESTADO[d.estado]}</p>
              </div>
              {['pendiente', 'aceptada'].includes(d.estado) && (
                <button type="button" disabled={enviando} onClick={() => pedir(`/api/meetings/vecino/delegaciones/${d.id}/revocar`)} title="Revocar" className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-4xs font-bold text-slate-300 disabled:opacity-50">
                  <Undo2 size={11} /> Revocar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {juntasSinDelegar.length > 0 && (
        <form onSubmit={solicitar} className="space-y-2">
          <p className="text-4xs text-slate-500">¿No puedes asistir? Pide a otro propietario de tu comunidad que vote por ti. Solo contará si lo acepta desde su cuenta.</p>
          <select value={juntaId} onChange={(e) => setJuntaId(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-2.5 text-3xs text-slate-200 focus:outline-none focus:border-blue-500">
            <option value="">Elige la junta…</option>
            {juntasSinDelegar.map((j) => <option key={j.id} value={j.id}>{j.titulo}{j.fecha_hora_prevista ? ` · ${new Date(j.fecha_hora_prevista).toLocaleDateString('es-ES')}` : ''}</option>)}
          </select>
          <select value={representanteId} onChange={(e) => setRepresentanteId(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-2.5 text-3xs text-slate-200 focus:outline-none focus:border-blue-500">
            <option value="">¿Quién te representará?</option>
            {datos.candidatos.map((c) => <option key={c.id} value={c.id}>{c.nombre_completo}{c.propiedad_detalle ? ` · ${c.propiedad_detalle}` : ''}</option>)}
          </select>
          {datos.candidatos.length === 0 && <p className="text-4xs text-slate-500">Todavía no hay otros propietarios con cuenta en VotifAI. Si te va a representar otra persona, entrega tu escrito al administrador.</p>}
          <button type="submit" disabled={enviando || !juntaId || !representanteId} className="w-full rounded-lg bg-blue-600 py-2 text-4xs font-black uppercase tracking-wider text-white disabled:opacity-50">
            Pedir representación
          </button>
        </form>
      )}

      {mensaje && <p className="text-4xs text-slate-300">{mensaje}</p>}
    </div>
  );
}
