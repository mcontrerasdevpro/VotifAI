import React from 'react';
import LegalLayout from './LegalLayout.jsx';

export default function Privacidad() {
  return (
    <LegalLayout titulo="Política de Privacidad">
      <p>
        Esta política describe cómo VotifAI trata los datos personales de administradores de fincas y de
        propietarios de comunidades, conforme al Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).
      </p>

      <h2>Quién es responsable de cada dato</h2>
      <p>
        <strong>Datos de los despachos</strong> (cuenta, facturación y uso del servicio): el responsable es{' '}
        <strong>Miguel Contreras Gallardo</strong> (nombre comercial <strong>NexuraIA</strong>), con NIF{' '}
        <strong>26035618D</strong> y domicilio en <strong>Calle Guanabacoa 2A Bajo, 28907 Getafe, Madrid</strong>,
        contacto: <strong>contacto@nexuraia.com</strong>.
      </p>
      <p>
        <strong>Datos de los propietarios</strong> de las comunidades: el responsable es el despacho de
        administración de fincas que gestiona su comunidad. NexuraIA los trata solo por cuenta de ese despacho, como
        encargado del tratamiento, según el{' '}
        <a href="/legal/encargo-tratamiento" className="font-bold text-blue-400 hover:underline">Contrato de Encargo del Tratamiento</a>.
        Si eres propietario, puedes ejercer tus derechos ante tu administrador de fincas o escribirnos y le
        trasladaremos la solicitud.
      </p>

      <h2>Datos que tratamos</h2>
      <p>
        Según el rol del usuario: datos identificativos y de contacto del despacho administrador (nombre, CIF,
        email, teléfono); datos identificativos y de contacto de propietarios (nombre, propiedad, email, teléfono);
        credenciales de acceso (contraseñas almacenadas siempre cifradas, nunca en texto plano); y, cuando el
        propietario graba una intervención en una junta, el audio y su transcripción textual, atribuidos a su cuenta.
      </p>

      <h2>Finalidad y base legal</h2>
      <p>
        Tratamos estos datos para prestar el servicio contratado por el despacho (ejecución de un contrato,
        art. 6.1.b RGPD) y, en el caso de la gestión de comunidades bajo la LPH, para el cumplimiento de las
        obligaciones legales del administrador de fincas (art. 6.1.c RGPD).
      </p>

      <h2>Conservación</h2>
      <p>
        Los datos se conservan mientras el despacho mantenga una cuenta activa en VotifAI y, posteriormente,
        durante los plazos legalmente exigidos para actas y documentación de comunidades de propietarios.
      </p>

      <h2>Encargados de tratamiento y transferencias</h2>
      <p>
        Recurrimos a estos proveedores, que tratan los datos solo para prestar su servicio: Hostinger (alojamiento
        del servidor y la base de datos), Backblaze (copias de seguridad, en la UE), OpenAI (transcripción de voz,
        EE. UU., con garantías del Marco de Privacidad de Datos UE-EE. UU. o cláusulas contractuales tipo), Brevo
        (envío de emails, Francia), WhatsApp/Meta (notificaciones por WhatsApp, cuando el propietario elige ese
        canal) y Stripe (solo para el cobro de la suscripción del despacho). Las notificaciones pasan por un flujo
        de automatización (n8n) alojado en nuestro propio servidor. El audio de las intervenciones no se conserva:
        se descarta en cuanto se transcribe.
      </p>

      <h2>Derechos de las personas interesadas</h2>
      <p>
        Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad
        escribiendo a <strong>contacto@nexuraia.com</strong>.
      </p>
    </LegalLayout>
  );
}
