import { Wallet } from 'lucide-react';
import PlaceholderModulo from '../../components/ui/PlaceholderModulo.jsx';

export default function Cuotas() {
  return (
    <PlaceholderModulo
      icon={Wallet}
      titulo="Cuotas y Morosidad"
      descripcion="Próximamente: gestión de recibos, pagos e impagos de cada propietario, con actualización automática del estado de morosidad."
    />
  );
}
