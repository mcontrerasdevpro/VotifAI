import { motion } from 'framer-motion';

const VARIANTES = {
  vecino: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/10',
  empresa: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/10',
  neutral: 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-600/10',
  outline: 'bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-800 shadow-none'
};

export default function Button({ children, onClick, variant = 'vecino', type = 'button', disabled = false }) {
  const estilosVariante = VARIANTES[variant] || VARIANTES.vecino;

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`w-full font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${estilosVariante}`}
    >
      {children}
    </motion.button>
  );
}