import Card from './Card.jsx';

/**
 * Placeholder para un módulo aún no construido. Confirma que el routing
 * y el AppShell funcionan antes de implementar la lógica real del módulo
 * (fases posteriores).
 */
export default function PlaceholderModulo({ icon: Icon, titulo, descripcion }) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <Card className="max-w-lg mx-auto mt-12 text-center" padding="p-8">
        {Icon && <Icon size={28} className="text-brand-400 mx-auto mb-3" />}
        <h2 className="text-sm font-black text-white uppercase tracking-wide">{titulo}</h2>
        <p className="text-3xs text-slate-500 mt-2 leading-relaxed">{descripcion}</p>
      </Card>
    </div>
  );
}
