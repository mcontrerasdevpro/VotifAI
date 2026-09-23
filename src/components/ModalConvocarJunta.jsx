import { useState } from 'react';
import { CalendarPlus, Plus, Trash2, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import Modal from './ui/Modal.jsx';
import { OPCIONES_MAYORIA } from '../lib/mayorias.js';

const PUNTOS_INICIALES = [
  { texto: '', tipo: 'votacion', mayoria: 'simple' },
  { texto: 'Ruegos y preguntas', tipo: 'informativo', mayoria: 'simple' }
];

/**
 * Formulario de convocatoria real: el orden del día queda fijo al
 * convocar (no se pueden añadir puntos votables en directo, ver
 * ColumnaMonitorCentral) — el punto informativo final de "Ruegos y
 * preguntas" sirve para anotar en vivo lo que surja sin necesitar puntos
 * nuevos a mitad de sesión.
 */
export default function ModalConvocarJunta({ open, onClose, entityId, onConvocada }) {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('ordinaria');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [puntos, setPuntos] = useState(PUNTOS_INICIALES);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const reiniciar = () => {
    setTitulo(''); setTipo('ordinaria'); setFecha(''); setHora('');
    setPuntos(PUNTOS_INICIALES); setError('');
  };

  const cerrar = () => {
    if (enviando) return;
    reiniciar();
    onClose();
  };

  const actualizarPunto = (index, campo, valor) => {
    setPuntos((actual) => actual.map((p, i) => (i === index ? { ...p, [campo]: valor } : p)));
  };

  const moverPunto = (index, delta) => {
    setPuntos((actual) => {
      const destino = index + delta;
      if (destino < 0 || destino >= actual.length) return actual;
      const copia = [...actual];
      [copia[index], copia[destino]] = [copia[destino], copia[index]];
      return copia;
    });
  };

  const eliminarPunto = (index) => {
    setPuntos((actual) => actual.filter((_, i) => i !== index));
  };

  const añadirPunto = () => {
    setPuntos((actual) => [...actual, { texto: '', tipo: 'votacion', mayoria: 'simple' }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const puntosValidos = puntos.filter((p) => p.texto.trim());
    if (!titulo.trim()) {
      setError('Indica un título para la convocatoria.');
      return;
    }
    if (puntosValidos.length === 0) {
      setError('El orden del día debe incluir al menos un punto.');
      return;
    }

    const fechaHoraPrevista = fecha ? new Date(`${fecha}T${hora || '00:00'}`).toISOString() : null;

    setEnviando(true);
    try {
      const resCreate = await fetch('/api/meetings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          entity_id: entityId,
          titulo: titulo.trim(),
          tipo,
          fecha_hora_prevista: fechaHoraPrevista,
          puntos: puntosValidos
        })
      });
      const dataCreate = await resCreate.json();
      if (!resCreate.ok || !dataCreate.success) {
        setError(dataCreate.error || 'No se pudo crear la junta.');
        setEnviando(false);
        return;
      }

      const meetingId = dataCreate.meeting.id;
      const resConvocar = await fetch(`/api/meetings/${meetingId}/convocar`, {
        method: 'POST',
        credentials: 'include'
      });
      const dataConvocar = await resConvocar.json();
      if (!resConvocar.ok || !dataConvocar.success) {
        // La junta ya se creó — se deja seguir aunque la notificación falle,
        // el despacho puede reintentar la convocatoria desde el historial.
        console.error('La junta se creó, pero falló la convocatoria:', dataConvocar.error);
      }

      reiniciar();
      onConvocada(dataCreate.meeting);
    } catch (err) {
      console.error('Fallo al convocar la junta:', err);
      setError('Fallo de red al crear la junta.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={cerrar}
      size="lg"
      icon={CalendarPlus}
      eyebrow="Nueva convocatoria"
      title="Convocar Junta"
      subtitle="El orden del día queda fijo una vez enviada la convocatoria"
      footer={
        <>
          <button type="button" onClick={cerrar} disabled={enviando} className="text-3xs font-bold text-slate-500 hover:text-white uppercase tracking-wider px-4 py-2.5">
            Cancelar
          </button>
          <button
            type="submit"
            form="form-convocar-junta"
            disabled={enviando}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-3xs font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/10 flex items-center gap-2"
          >
            {enviando && <Loader2 size={12} className="animate-spin" />}
            {enviando ? 'Convocando...' : 'Convocar y Notificar'}
          </button>
        </>
      }
    >
      <form id="form-convocar-junta" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-4xs font-bold text-rose-400">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-5xs font-black text-slate-400 uppercase tracking-widest">Título de la convocatoria</label>
          <input
            required value={titulo} onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Junta General Ordinaria 2026"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="block text-5xs font-black text-slate-400 uppercase tracking-widest">Tipo</label>
            <select
              value={tipo} onChange={(e) => setTipo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-3xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ordinaria">Ordinaria</option>
              <option value="extraordinaria">Extraordinaria</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-5xs font-black text-slate-400 uppercase tracking-widest">Fecha</label>
            <input
              type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-3xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-5xs font-black text-slate-400 uppercase tracking-widest">Hora</label>
            <input
              type="time" value={hora} onChange={(e) => setHora(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-3xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="block text-5xs font-black text-slate-400 uppercase tracking-widest">Orden del día</label>
            <button type="button" onClick={añadirPunto} className="flex items-center gap-1 text-4xs font-black text-blue-400 uppercase tracking-wider">
              <Plus size={12} /> Añadir punto
            </button>
          </div>

          <div className="space-y-2">
            {puntos.map((punto, index) => (
              <div key={index} className="flex items-start gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <span className="text-4xs font-mono font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <div className="flex-grow space-y-1.5">
                  <input
                    value={punto.texto}
                    onChange={(e) => actualizarPunto(index, 'texto', e.target.value)}
                    placeholder="Describe el punto a tratar..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2.5 text-3xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                  <label className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={punto.tipo === 'informativo'}
                      onChange={(e) => actualizarPunto(index, 'tipo', e.target.checked ? 'informativo' : 'votacion')}
                      className="accent-blue-600"
                    />
                    Informativo (sin votación)
                  </label>
                  {punto.tipo !== 'informativo' && (
                    <label className="block space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Mayoría necesaria (LPH)</span>
                      <select
                        value={punto.mayoria || 'simple'}
                        onChange={(e) => actualizarPunto(index, 'mayoria', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2 text-3xs text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        {OPCIONES_MAYORIA.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
                      </select>
                      <span className="block text-[9px] text-slate-600">{OPCIONES_MAYORIA.find((o) => o.id === (punto.mayoria || 'simple'))?.ayuda}</span>
                    </label>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button type="button" onClick={() => moverPunto(index, -1)} disabled={index === 0} className="text-slate-600 hover:text-white disabled:opacity-30 p-0.5">
                    <ChevronUp size={12} />
                  </button>
                  <button type="button" onClick={() => moverPunto(index, 1)} disabled={index === puntos.length - 1} className="text-slate-600 hover:text-white disabled:opacity-30 p-0.5">
                    <ChevronDown size={12} />
                  </button>
                </div>
                <button type="button" onClick={() => eliminarPunto(index)} className="text-slate-600 hover:text-rose-400 p-0.5 shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
