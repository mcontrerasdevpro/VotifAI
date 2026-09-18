import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const ANCHOS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
};

const ACENTOS = {
  vecino: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  empresa: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  brand: 'text-brand-400 bg-brand-500/10 border-brand-500/20'
};

/**
 * Modal genérico de VotifAI: overlay + tarjeta con cabecera/cuerpo/pie
 * opcionales. Sustituye el patrón "fixed inset-0 bg-slate-950/80..."
 * que hasta ahora se repetía a mano en cada componente con su propio
 * AnimatePresence.
 */
export default function Modal({
  open,
  onClose,
  title,
  eyebrow,
  subtitle,
  icon: Icon,
  size = 'md',
  variant = 'vecino',
  footer,
  children
}) {
  const acento = ACENTOS[variant] || ACENTOS.vecino;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className={`bg-slate-900 border border-slate-800 w-full ${ANCHOS[size] || ANCHOS.md} rounded-3xl shadow-2xl overflow-hidden flex flex-col my-4`}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || eyebrow || onClose) && (
              <div className="p-5 border-b border-slate-800/80 bg-slate-950/40 flex justify-between items-start gap-4 shrink-0">
                <div className="flex items-start gap-3 min-w-0">
                  {Icon && (
                    <span className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center ${acento}`}>
                      <Icon size={16} />
                    </span>
                  )}
                  <div className="min-w-0">
                    {eyebrow && (
                      <span className={`inline-block text-[9px] font-mono font-bold px-2.5 py-1 rounded uppercase tracking-wider border ${acento}`}>
                        {eyebrow}
                      </span>
                    )}
                    {title && <h2 className="text-sm font-black text-white mt-1 tracking-tight truncate">{title}</h2>}
                    {subtitle && <p className="text-4xs text-slate-500 font-mono mt-0.5 uppercase tracking-wider truncate">{subtitle}</p>}
                  </div>
                </div>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                    aria-label="Cerrar"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}

            <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
              {children}
            </div>

            {footer && (
              <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-3 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
