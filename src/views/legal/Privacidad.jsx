import React from 'react';
import LegalLayout from './LegalLayout.jsx';

export default function Privacidad() {
  return (
    <LegalLayout titulo="Política de Privacidad">
      <p>
        Esta política describe cómo VotifAI trata los datos personales de administradores de fincas y de
        propietarios de comunidades, conforme al Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).
      </p>

      <h2>Responsable del tratamiento</h2>
      <p>
        <strong>Miguel Contreras Gallardo</strong> (nombre comercial <strong>NexuraIA</strong>), con NIF{' '}
        <strong>26035618D</strong> y domicilio en <strong>Calle Guanabacoa 2A Bajo, 28907 Getafe, Madrid</strong>,
        contacto: <strong>contacto@nexuraia.com</strong>.
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
        Para la transcripción de voz utilizamos la API de OpenAI como encargado de tratamiento. Para el envío de
        notificaciones por WhatsApp y correo electrónico, los datos de contacto necesarios (nombre, teléfono y/o
        email) se transmiten a través de un flujo de automatización (n8n) hacia el proveedor de mensajería y el
        proveedor de email elegidos por el despacho o por el operador de VotifAI, únicamente para el envío de esa
        comunicación concreta.
      </p>

      <h2>Derechos de las personas interesadas</h2>
      <p>
        Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad
        escribiendo a <strong>contacto@nexuraia.com</strong>.
      </p>
    </LegalLayout>
  );
}
