/**
 * Panel/tarjeta base: fondo, borde y radio que ya se repetían a mano en
 * las columnas del dashboard y en el hub (bg-slate-900/xx border rounded-2xl).
 */
export default function Card({ children, className = '', padding = 'p-4', as: Componente = 'div' }) {
  return (
    <Componente className={`bg-slate-900/30 border border-slate-900 rounded-2xl ${padding} ${className}`}>
      {children}
    </Componente>
  );
}
