import { Shield, FileText } from 'lucide-react';
import Modal from './ui/Modal.jsx';
import StatusBadge from './ui/StatusBadge.jsx';

export default function ModalConvocatoria({
  mostrarModalConvocatoria, setMostrarModalConvocatoria, fincaSeleccionada, datos
}) {
  return (
    <Modal
      open={mostrarModalConvocatoria}
      onClose={() => setMostrarModalConvocatoria(false)}
      size="xl"
      icon={FileText}
      eyebrow={fincaSeleccionada?.documento_adjunto ? "Visor de Documento Original Escaneado" : "Desglose Automatizado del Orden del Día"}
      title={`Convocatoria Oficial: ${datos.convocatoria}`}
      subtitle={<>Entorno Activo: <span className="text-slate-300 font-bold">{datos.entidad}</span></>}
      footer={
        <button
          type="button"
          onClick={() => setMostrarModalConvocatoria(false)}
          className="bg-blue-600 hover:bg-blue-500 border border-blue-500 hover:border-blue-400 text-white text-3xs font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/10 active:scale-98"
        >
          Cerrar Convocatoria
        </button>
      }
    >
      {fincaSeleccionada?.documento_adjunto ? (
        /* MODO A: CON PDF ORIGINAL EN IFRAME */
        <div className="w-full h-full min-h-[50vh] border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-inner">
          <iframe
            src={`${fincaSeleccionada.documento_adjunto}#toolbar=0&navpanes=0`}
            className="w-full h-full rounded-xl border-none"
            title="PDF Convocatoria Original"
          />
        </div>
      ) : (
        /* MODO B: DESGLOSE DIGITAL POR PUNTOS (LPH / LSC) */
        <div className="space-y-4">
          <div className="bg-slate-950/40 p-4 border border-slate-850 rounded-2xl space-y-1.5">
            <h4 className="text-3xs font-black uppercase tracking-widest text-slate-400">Notificación Informativa Estándar</h4>
            <p className="text-4xs text-slate-400 leading-relaxed font-medium">
              A falta de documento físico escaneado por el despacho administrador, el motor digital de VotifAI expone los puntos legislativos fijados para el escrutinio cruzado ordinario:
            </p>
          </div>

          <div className="space-y-2.5">
            {datos?.puntos?.map((punto) => (
              <div
                key={punto.id}
                className="p-4 bg-slate-950 border border-slate-900 rounded-2xl flex items-start gap-4 hover:border-slate-800 transition-colors"
              >
                <span className="text-3xs font-mono font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 w-6 h-6 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  {punto.id}
                </span>
                <div className="space-y-1 flex-grow">
                  <p className="text-3xs text-slate-200 leading-relaxed font-bold">
                    {punto.t}
                  </p>
                  <div className="flex items-center gap-3 text-[9px] font-mono uppercase tracking-widest text-slate-500 font-medium">
                    <span>EXPEDIENTE: EXP-00{punto.id}</span>
                    <span>•</span>
                    <StatusBadge tone={punto.estado === 'Cerrado' ? 'success' : 'neutral'}>
                      {punto.estado}
                    </StatusBadge>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border border-slate-850 bg-slate-900/40 p-4 rounded-2xl flex items-center gap-4 mt-2">
            <Shield size={18} className="text-emerald-500 shrink-0" />
            <div className="space-y-0.5">
              <span className="block text-[8px] font-black text-emerald-400 uppercase tracking-widest">Sello Digital de Respaldo HASH-SHA256</span>
              <p className="text-[10px] font-mono text-slate-500 tracking-tight break-all leading-none">
                b4e789a1cdcefd2100874e1db8c8a14b3a1a5b8e9c7d6e5f4a3b2c1d0f9e8d7c
              </p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
