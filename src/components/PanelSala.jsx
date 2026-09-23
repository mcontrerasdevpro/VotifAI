import { useMemo, useState } from 'react';
import { Armchair, Search, UserCheck, UserPlus, X } from 'lucide-react';

const ETIQUETA_VOTO = { si: 'SÍ', no: 'NO', abstencion: 'ABS.' };
const COLOR_VOTO = {
  si: 'bg-emerald-600 border-emerald-500 text-white',
  no: 'bg-rose-600 border-rose-500 text-white',
  abstencion: 'bg-slate-600 border-slate-500 text-white'
};

/**
 * Sala: el despacho registra quién asiste en persona o representado
 * (art. 15.1 LPH) y el voto de cada uno en el punto abierto. Esos votos se
 * suman en el servidor con los emitidos desde la app (un voto por
 * propietario y punto), así que el recuento y las mayorías ya los incluyen.
 */
export default function PanelSala({ meetingId, censo, asistencia, votos, privadosVoto, puntoAbierto, onCambio }) {
  const [busqueda, setBusqueda] = useState('');
  const [enviando, setEnviando] = useState(false);

  const asistenciaPorId = useMemo(() => new Map(asistencia.map((a) => [a.propietario_id, a])), [asistencia]);
  const sinDerecho = useMemo(() => new Set(privadosVoto.filter((p) => !p.habilitado).map((p) => p.propietario_id)), [privadosVoto]);
  const votaronEnApp = useMemo(() => new Set(votos.filter((v) => v.origen === 'app').map((v) => v.propietario_id)), [votos]);
  const votoEnPunto = useMemo(() => {
    if (!puntoAbierto) return new Map();
    return new Map(votos.filter((v) => v.punto_id === puntoAbierto.id).map((v) => [v.propietario_id, v]));
  }, [votos, puntoAbierto]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return censo;
    return censo.filter((p) => p.nombre_completo.toLowerCase().includes(termino) || p.propiedad_detalle?.toLowerCase().includes(termino));
  }, [censo, busqueda]);

  const presentes = asistencia.filter((a) => a.modo === 'presencial').length;
  const representados = asistencia.filter((a) => a.modo === 'representado').length;
  const puedeVotarSala = puntoAbierto?.tipo === 'votacion' && puntoAbierto.estado === 'votando';

  // Mano alzada: se preguntan los votos en contra y las abstenciones y el
  // resto de asistentes se computa a favor.
  const pendientesDeVoto = asistencia.filter((a) => !votoEnPunto.has(a.propietario_id) && !sinDerecho.has(a.propietario_id));

  const pedir = async (url, opciones) => {
    setEnviando(true);
    try {
      const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opciones });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'No se pudo guardar el cambio.');
        return;
      }
      if (data.rechazados?.length) {
        alert(`No se registraron ${data.rechazados.length} voto(s):\n${data.rechazados.map((r) => `· ${censo.find((p) => p.id === r.propietario_id)?.nombre_completo || r.propietario_id}: ${r.motivo}`).join('\n')}`);
      }
      await onCambio();
    } catch (err) {
      console.error(err);
      alert('Fallo de red al guardar el cambio.');
    } finally {
      setEnviando(false);
    }
  };

  const marcarPresente = (p) => pedir(`/api/meetings/${meetingId}/asistencia/${p.id}`, { method: 'PUT', body: JSON.stringify({ modo: 'presencial' }) });

  const marcarRepresentado = (p) => {
    const representante = window.prompt(`¿Quién representa a ${p.nombre_completo}${p.propiedad_detalle ? ` (${p.propiedad_detalle})` : ''}?`);
    if (!representante?.trim()) return;
    const escrita = window.confirm('¿La representación consta por escrito firmado por el propietario (art. 15.1 LPH)?');
    pedir(`/api/meetings/${meetingId}/asistencia/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify({ modo: 'representado', representante_nombre: representante.trim(), representacion_escrita: escrita })
    });
  };

  const quitarAsistencia = (p) => pedir(`/api/meetings/${meetingId}/asistencia/${p.id}`, { method: 'DELETE' });

  const votar = (votosSala) => pedir(`/api/meetings/${meetingId}/puntos/${puntoAbierto.id}/votos-sala`, { method: 'PUT', body: JSON.stringify({ votos: votosSala }) });

  const restoAFavor = () => {
    if (pendientesDeVoto.length === 0) return;
    if (!window.confirm(`Se registrará SÍ para ${pendientesDeVoto.length} asistente(s) en sala o representados que aún no han votado este punto. ¿Continuar?`)) return;
    votar(pendientesDeVoto.map((a) => ({ propietario_id: a.propietario_id, voto: 'si' })));
  };

  return (
    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-3xs font-black uppercase tracking-widest text-slate-300">
          <Armchair size={13} className="text-blue-400" /> Sala: asistencia y votos
        </h3>
        <span className="text-4xs text-slate-500">{presentes} presentes · {representados} representados</span>
      </div>

      {puedeVotarSala ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
          <p className="text-4xs text-slate-400">Registrando votos del <strong className="text-slate-200">punto {puntoAbierto.orden}</strong>. Se suman a los de la app.</p>
          <button
            type="button" onClick={restoAFavor} disabled={enviando || pendientesDeVoto.length === 0}
            className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md border border-emerald-500/30 text-emerald-300 disabled:opacity-40"
          >
            Resto de asistentes a favor ({pendientesDeVoto.length})
          </button>
        </div>
      ) : (
        <p className="text-4xs text-slate-500">Abre la votación de un punto para registrar los votos de la sala.</p>
      )}

      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-2.5 text-slate-600" />
        <input
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar propietario o vivienda..."
          className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 pl-7 pr-2 text-3xs text-slate-200 focus:outline-none focus:border-blue-500"
        />
      </div>

      <ul className="max-h-80 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
        {filtrados.map((p) => {
          const asiste = asistenciaPorId.get(p.id);
          const privado = sinDerecho.has(p.id);
          const voto = votoEnPunto.get(p.id);
          return (
            <li key={p.id} className="rounded-lg border border-slate-900 px-3 py-2 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-3xs font-bold text-white">{p.nombre_completo}{p.propiedad_detalle ? ` · ${p.propiedad_detalle}` : ''}</p>
                  <p className="text-4xs text-slate-500">
                    {Number(p.coeficiente).toFixed(2)}%
                    {asiste?.modo === 'presencial' && ' · Presente en sala'}
                    {asiste?.modo === 'representado' && ` · Representado por ${asiste.representante_nombre}${asiste.delegacion_id ? ' (delegación en VotifAI aceptada por ambos)' : asiste.representacion_escrita ? ' (por escrito)' : ' (sin escrito)'}`}
                    {!asiste && votaronEnApp.has(p.id) && ' · Participa por la app'}
                    {privado && ' · Privado de voto'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {asiste ? (
                    <button type="button" disabled={enviando} onClick={() => quitarAsistencia(p)} title="Quitar de la sala" className="p-1 rounded-md border border-slate-800 text-slate-500 hover:text-rose-300">
                      <X size={12} />
                    </button>
                  ) : (
                    <>
                      <button type="button" disabled={enviando} onClick={() => marcarPresente(p)} title="Presente en sala" className="p-1 rounded-md border border-slate-800 text-slate-400 hover:text-emerald-300">
                        <UserCheck size={12} />
                      </button>
                      <button type="button" disabled={enviando} onClick={() => marcarRepresentado(p)} title="Representado por otra persona" className="p-1 rounded-md border border-slate-800 text-slate-400 hover:text-blue-300">
                        <UserPlus size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {puedeVotarSala && !privado && (
                <div className="flex items-center gap-1.5">
                  {['si', 'no', 'abstencion'].map((opcion) => (
                    <button
                      key={opcion} type="button" disabled={enviando}
                      onClick={() => votar([{ propietario_id: p.id, voto: voto?.voto === opcion && voto.origen !== 'app' ? null : opcion }])}
                      className={`flex-1 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border transition-colors ${voto?.voto === opcion ? COLOR_VOTO[opcion] : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                    >
                      {ETIQUETA_VOTO[opcion]}
                    </button>
                  ))}
                  {voto && <span className="text-[9px] text-slate-500 w-14 text-right">{voto.origen === 'app' ? 'por app' : voto.origen === 'representacion' ? 'represent.' : 'en sala'}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
