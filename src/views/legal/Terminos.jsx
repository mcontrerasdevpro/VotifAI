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

      <h2>Planes, precios y pago</h2>
      <p>
        El Despacho dispone de 15 días de prueba gratuita del plan que elija al registrarse, que incluye la
        celebración de hasta 2 juntas y, en los planes con transcripción de voz, hasta 3 horas de transcripción por
        junta. Después, el servicio requiere una suscripción mensual a uno de los planes publicados. Los precios se muestran sin IVA; se añade el 21 % de IVA en cada factura.
        La suscripción se renueva automáticamente cada mes y el cobro se realiza con tarjeta a través de Stripe.
        Los cambios de plan se prorratean en la siguiente factura. El Despacho puede cancelar en cualquier momento
        desde la gestión de su suscripción; la cancelación surte efecto al final del periodo ya pagado.
      </p>
      <p>
        Si la prueba termina sin contratar un plan, o la suscripción se cancela o queda impagada tras los
        reintentos de cobro, la cuenta pasa a modo consulta: el Despacho puede seguir accediendo a sus datos y
        descargarlos, pero no crear ni modificar información hasta reactivar la suscripción.
      </p>

      <h2>Protección de datos</h2>
      <p>
        Respecto de los datos de los propietarios, el Despacho es responsable del tratamiento y NexuraIA actúa como
        encargado, en los términos del{' '}
        <a href="/legal/encargo-tratamiento" className="font-bold text-blue-400 hover:underline">Contrato de Encargo del Tratamiento</a>,
        que forma parte de estos términos.
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
        Para cualquier consulta sobre estos términos: <strong>contacto@nexuraia.com</strong>.
      </p>
    </LegalLayout>
  );
}
