import React from 'react';
import LegalLayout from './LegalLayout.jsx';

export default function AvisoLegal() {
  return (
    <LegalLayout titulo="Aviso Legal">
      <p>
        En cumplimiento de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y
        Comercio Electrónico (LSSI-CE), se informa de los siguientes datos: VotifAI es un servicio operado por{' '}
        <strong>Miguel Contreras Gallardo</strong>, autónomo bajo el nombre comercial{' '}
        <strong>NexuraIA</strong> (<a href="https://www.nexuraia.com" target="_blank" rel="noreferrer">www.nexuraia.com</a>),
        con NIF <strong>26035618D</strong> y domicilio en{' '}
        <strong>Calle Guanabacoa 2A Bajo, 28907 Getafe, Madrid</strong>. Para cualquier consulta, puede contactar en{' '}
        <strong>contacto@nexuraia.com</strong>.
      </p>

      <h2>Objeto</h2>
      <p>
        VotifAI es una plataforma SaaS de gestión para despachos de administración de fincas, que da servicio a
        comunidades de propietarios bajo la Ley de Propiedad Horizontal (LPH): convocatoria y celebración de
        juntas, transcripción de intervenciones, gestión documental, incidencias, cuotas, reservas y contabilidad.
      </p>

      <h2>Condiciones de acceso y uso</h2>
      <p>
        El acceso a VotifAI requiere una cuenta de despacho administrador o de propietario, con credenciales
        personales e intransferibles. El usuario se compromete a hacer un uso lícito del servicio, a no suplantar
        la identidad de terceros y a mantener la confidencialidad de sus credenciales.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        El software, diseño, marca y contenidos de VotifAI son propiedad de su operador o de terceros que han
        autorizado su uso, quedando reservados todos los derechos no cedidos expresamente.
      </p>

      <h2>Limitación de responsabilidad</h2>
      <p>
        VotifAI actúa como herramienta de soporte a la gestión y no sustituye la responsabilidad legal del
        despacho de administración de fincas ni del secretario/a de la junta en cuanto a la validez, contenido y
        custodia de las actas conforme al artículo 15 de la LPH.
      </p>
    </LegalLayout>
  );
}
