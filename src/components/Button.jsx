import React from 'react';
import { motion } from 'framer-motion';

export default function Button({ children, onClick, variant = 'vecino', type = 'button', disabled = false }) {
  const estilosVariante = variant === 'vecino'
    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/10'
    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/10';

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileActive={disabled ? {} : { scale: 0.98 }}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`w-full font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${estilosVariante}`}
    >
      {children}
    </motion.button>
  );
}