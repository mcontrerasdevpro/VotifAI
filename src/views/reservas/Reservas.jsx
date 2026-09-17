import { CalendarClock } from 'lucide-react';
import PlaceholderModulo from '../../components/ui/PlaceholderModulo.jsx';

export default function Reservas() {
  return (
    <PlaceholderModulo
      icon={CalendarClock}
      titulo="Reservas de Zonas Comunes"
      descripcion="Próximamente: calendario de reservas para piscina, salón, trastero, parking y demás zonas comunes."
    />
  );
}
