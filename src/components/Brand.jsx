// Logotipo único de la app — el mismo archivo que usa la landing page
// (Welcome.jsx) en vez de un icono lucide-react + texto estilizado
// distinto por pantalla. `className` controla el alto (y por tanto el
// ancho, ya que el PNG mantiene su proporción con object-contain).
export default function Brand({ className = 'h-9' }) {
  return (
    <img
      src="/Logo%20VotifAI.png"
      alt="VotifAI"
      className={`w-auto max-w-[220px] object-contain ${className}`}
    />
  );
}
