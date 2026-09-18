/**
 * Panel/tarjeta base: fondo, borde y radio que ya se repetían a mano en
 * las columnas del dashboard y en el hub (bg-slate-900/xx border rounded-2xl).
 *
 * `light`: variante "papel" (fondo blanco) para superficies de trabajo con
 * datos (tablas, formularios) donde se lee mejor que sobre fondo oscuro —
 * mismo criterio que ya usaba el editor de Acta IA a mano.
 */
export default function Card({ children, className = '', padding = 'p-4', as: Componente = 'div', light = false }) {
  const superficie = light
    ? 'bg-white text-slate-900 border-slate-200'
    : 'bg-slate-900/30 border-slate-900';
  return (
    <Componente className={`${superficie} border rounded-2xl ${padding} ${className}`}>
      {children}
    </Componente>
  );
}
