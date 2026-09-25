import React from 'react';
import LegalLayout from './LegalLayout.jsx';

export default function EncargoTratamiento() {
  return (
    <LegalLayout titulo="Contrato de Encargo del Tratamiento (art. 28 RGPD)">
      <p>
        Este contrato regula el tratamiento de datos personales que NexuraIA realiza por cuenta del despacho al
        prestarle el servicio VotifAI, conforme al artículo 28 del Reglamento (UE) 2016/679 (RGPD) y a la Ley
        Orgánica 3/2018 (LOPDGDD). Forma parte de los Términos y Condiciones y se acepta al registrar la cuenta del
        despacho. Versión de 25 de septiembre de 2026.
      </p>

      <h2>1. Partes</h2>
      <p>
        <strong>Responsable del tratamiento:</strong> el despacho de administración de fincas que se registra en
        VotifAI (&quot;el Despacho&quot;), con los datos identificativos facilitados en su alta.
      </p>
      <p>
        <strong>Encargado del tratamiento:</strong> Miguel Contreras Gallardo (nombre comercial NexuraIA), NIF
        26035618D, Calle Guanabacoa 2A Bajo, 28907 Getafe, Madrid, contacto@nexuraia.com (&quot;NexuraIA&quot;).
      </p>

      <h2>2. Objeto y duración</h2>
      <p>
        NexuraIA trata los datos personales estrictamente necesarios para prestar al Despacho el servicio VotifAI:
        gestión del censo de propietarios, convocatoria y celebración de juntas (incluidas votaciones y
        transcripción de intervenciones), actas, notificaciones, incidencias, cuotas, documentos, reservas y
        contabilidad de las comunidades que el Despacho administra. El encargo dura lo mismo que la relación
        contractual del Despacho con VotifAI.
      </p>

      <h2>3. Datos y personas afectadas</h2>
      <p>
        <strong>Personas interesadas:</strong> propietarios y titulares de las comunidades gestionadas por el
        Despacho, cargos de la comunidad (presidente, tesorero), proveedores y, en su caso, personal del Despacho.
      </p>
      <p>
        <strong>Datos:</strong> identificativos y de contacto (nombre, propiedad, email, teléfono, dirección
        postal), coeficiente de participación, cuotas y pagos, votos emitidos en juntas, intervenciones de voz
        transcritas a texto, incidencias, reservas y documentos que el Despacho suba a la plataforma. El audio de
        las intervenciones no se conserva: se descarta en cuanto se transcribe y solo se guarda el texto. VotifAI no
        está diseñado para tratar categorías especiales de datos (art. 9 RGPD); el Despacho se compromete a no
        introducirlas salvo que sea imprescindible y esté legitimado para ello.
      </p>

      <h2>4. Obligaciones de NexuraIA</h2>
      <p>NexuraIA se compromete a:</p>
      <p>
        a) Tratar los datos únicamente siguiendo las instrucciones documentadas del Despacho, que son las que se
        derivan de este contrato y del uso que el Despacho haga de la plataforma. Si considera que una instrucción
        infringe la normativa, lo comunicará al Despacho de inmediato.
        <br />b) No utilizar los datos para fines propios ni comunicarlos a terceros, salvo a los subencargados
        indicados en el apartado 6 o por obligación legal.
        <br />c) Garantizar que las personas autorizadas a acceder a los datos se han comprometido a respetar su
        confidencialidad.
        <br />d) Aplicar las medidas de seguridad del apartado 5, apropiadas al riesgo (art. 32 RGPD).
        <br />e) Ayudar al Despacho a atender las solicitudes de ejercicio de derechos de las personas interesadas
        (acceso, rectificación, supresión, oposición, limitación y portabilidad). Si una persona interesada se
        dirige directamente a NexuraIA, se trasladará la solicitud al Despacho en un plazo máximo de cinco días
        hábiles.
        <br />f) Ayudar al Despacho a cumplir sus obligaciones de seguridad, notificación de brechas, evaluaciones
        de impacto y consulta previa (arts. 32 a 36 RGPD), teniendo en cuenta la información de que disponga.
        <br />g) Notificar al Despacho, sin dilación indebida y en todo caso en un plazo máximo de 48 horas desde que
        tenga constancia, cualquier violación de la seguridad de los datos, con la información necesaria para que el
        Despacho pueda notificarla a la autoridad de control y, en su caso, a las personas afectadas.
        <br />h) Poner a disposición del Despacho la información necesaria para demostrar el cumplimiento de este
        contrato y permitir auditorías razonables, con preaviso de al menos 30 días, a cargo del Despacho y sin
        comprometer la seguridad ni los datos de otros clientes.
      </p>

      <h2>5. Medidas de seguridad</h2>
      <p>
        Entre otras: cifrado en tránsito (HTTPS/TLS) en todas las comunicaciones; contraseñas almacenadas solo como
        hash (bcrypt), nunca en claro; aislamiento lógico estricto de los datos de cada despacho, comprobado en
        cada operación; sesiones con cookies seguras y limitación de intentos de acceso; acceso a la
        infraestructura restringido al titular del servicio; credenciales del buzón de correo que el Despacho conecte para enviar sus comunicaciones guardadas cifradas (AES-256), usadas solo para enviar los emails del propio Despacho y nunca mostradas; y copias de seguridad diarias en almacenamiento
        privado, con una retención de 30 días.
      </p>

      <h2>6. Subencargados</h2>
      <p>
        El Despacho autoriza de forma general a NexuraIA a recurrir a los siguientes subencargados, con los que
        NexuraIA mantiene contratos que imponen obligaciones de protección de datos equivalentes a las de este
        contrato:
      </p>
      <p>
        <strong>Hostinger</strong> — alojamiento del servidor y de la base de datos.
        <br /><strong>Backblaze</strong> — copias de seguridad, en centro de datos de la Unión Europea.
        <br /><strong>OpenAI</strong> — transcripción de las intervenciones de voz (EE. UU.; ver apartado 7). Según
        las condiciones de su API, los datos enviados no se usan para entrenar modelos.
        <br /><strong>Brevo (Sendinblue SAS, Francia)</strong> — envío de notificaciones por correo electrónico cuando el Despacho no ha conectado su propio buzón. Si lo conecta, los emails a sus propietarios salen directamente desde el proveedor de correo que el Despacho haya elegido, que no es subencargado de NexuraIA.
        <br /><strong>WhatsApp / Meta</strong> — envío de notificaciones por WhatsApp, solo a los propietarios que
        hayan elegido ese canal y cuando esté activado.
      </p>
      <p>
        NexuraIA informará al Despacho, con al menos 15 días de antelación, de cualquier incorporación o sustitución
        de subencargados, a través de la plataforma o por email. El Despacho podrá oponerse por motivos
        justificados de protección de datos; si no se alcanza una solución, podrá resolver el contrato sin
        penalización.
      </p>

      <h2>7. Transferencias internacionales</h2>
      <p>
        Cuando un subencargado trate datos fuera del Espacio Económico Europeo (como OpenAI, en EE. UU.), la
        transferencia se ampara en el Marco de Privacidad de Datos UE-EE. UU. o, en su defecto, en las cláusulas
        contractuales tipo aprobadas por la Comisión Europea.
      </p>

      <h2>8. Obligaciones del Despacho</h2>
      <p>
        El Despacho garantiza que dispone de base jurídica para tratar los datos que introduce en VotifAI y que ha
        informado a las personas interesadas conforme a los artículos 13 y 14 del RGPD; es responsable de la
        exactitud del censo y del contenido que gestiona; y supervisa el tratamiento, incluidas las auditorías
        previstas en el apartado 4.
      </p>

      <h2>9. Fin del encargo</h2>
      <p>
        Cuando termine la relación, el Despacho dispondrá de 30 días para consultar y descargar sus datos desde la
        plataforma o pedir a NexuraIA una exportación. Pasado ese plazo, NexuraIA suprimirá los datos de sus
        sistemas; las copias de seguridad se eliminan por rotación en un máximo de 30 días adicionales. Solo se
        conservarán, debidamente bloqueados, los datos que la ley obligue a guardar y durante el plazo que marque.
      </p>

      <h2>10. Responsabilidad</h2>
      <p>
        Si NexuraIA trata los datos para fines propios o incumple este contrato o la normativa, será considerada
        responsable del tratamiento respecto de ese tratamiento y responderá de las infracciones en que haya
        incurrido personalmente.
      </p>

      <h2>Contacto</h2>
      <p>
        Para cualquier cuestión sobre este contrato o sobre protección de datos:{' '}
        <strong>contacto@nexuraia.com</strong>.
      </p>
    </LegalLayout>
  );
}
