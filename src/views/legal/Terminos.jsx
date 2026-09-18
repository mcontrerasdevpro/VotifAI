import React from 'react';
import LegalLayout from './LegalLayout.jsx';

export default function Terminos() {
  return (
    <LegalLayout titulo="Términos y Condiciones">
      <p>
        Estos términos regulan el uso de VotifAI por parte de despachos de administración de fincas
        (&quot;el Despacho&quot;) y de los propietarios de las comunidades que gestionan (&quot;el Vecino&quot;).
        El uso de la plataforma implica la aceptación de estos términos.
      </p>

      <h2>Cuentas y acceso</h2>
      <p>
        El Despacho se registra directamente con email y contraseña. El Vecino accede a su comunidad mediante el
        código de acceso facilitado por el Despacho y crea su propia cuenta con email y contraseña, verificada
        contra el censo de propietarios de su finca. Cada cuenta es personal e intransferible.
      </p>

      <h2>Uso del servicio</h2>
      <p>
        VotifAI ofrece, entre otras funciones: convocatoria de juntas, transcripción de intervenciones grabadas
        por cada propietario desde su propio dispositivo, gestión de incidencias, cuotas, documentos, reservas de
        zonas comunes y contabilidad simple del Despacho.
      </p>

      <h2>Disponibilidad del servicio</h2>
      <p>
        Algunas funciones dependen de servicios de terceros (transcripción de voz vía OpenAI, envío de
        notificaciones por WhatsApp/email vía un flujo de automatización) y pueden no estar activas hasta que el
        Despacho complete su configuración correspondiente.
      </p>

      <h2>Responsabilidad sobre el contenido</h2>
      <p>
        El Despacho es responsable de la exactitud de los datos del censo de propietarios y del contenido de las
        actas, convocatorias y comunicaciones que gestione a través de VotifAI.
      </p>

      <h2>Modificaciones</h2>
      <p>
        Estos términos pueden actualizarse para reflejar cambios en el servicio o en la normativa aplicable. Se
        notificará cualquier cambio sustancial a través de la propia plataforma.
      </p>

      <h2>Contacto</h2>
      <p>
        Para cualquier consulta sobre estos términos: <strong>[EMAIL DE CONTACTO PENDIENTE]</strong>.
      </p>
    </LegalLayout>
  );
}
