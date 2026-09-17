# 🛡️ VotifAI

<div align="center">
  <img src="src/components/ShieldCheck.svg" alt="VotifAI Logo" width="80" height="80" style="background: #0f172a; padding: 10px; border-radius: 20px; border: 1px solid #1e293b;" />
  <br />
  <h1>Votif<span style="color: #2563eb;">AI</span></h1>
  <p><strong>Plataforma de Gobernanza Inteligente y Votaciones con Certificación Legal Automatizada</strong></p>
  <p>Ecosistema SaaS B2B Multi-Inquilino diseñado bajo el marco de la Ley de Propiedad Horizontal (LPH) y la Ley de Sociedades de Capital (LSC) en España.</p>
</div>

---

## 🚀 Propuesta de Valor Comercial
**VotifAI** transforma la gestión caótica de las juntas de propietarios y asambleas generales en un proceso fluido, digital y blindado jurídicamente. El sistema automatiza las tareas más pesadas de los administradores y secretarios, **ahorrando más de 12 horas de trabajo burocrático por sesión** y eliminando de raíz el riesgo de impugnaciones ante tribunales.

### 🔥 Pilares Tecnológicos Centrales
1. **🎙️ Separación y Diarización de Voz por IA:** Captura el audio de la sala en vivo, aísla las intervenciones de forma asíncrona e identifica a los ponentes asociándolos de forma automática a su propiedad (ej. Vecino 3ºA, Presidente).
2. **🤖 Redacción de Actas en 2 Minutos:** Un motor cognitivo entrenado en la legislación actual procesa las transcripciones conversacionales ordinarias y redacta un borrador formal de acta adaptado fielmente al orden del día.
3. **📊 Escrutinio por Coeficientes Cruzados:** Control analítico en tiempo real del cuórum en sala, dobles mayorías simultáneas (voto por cabezas y cuotas de participación) y filtrado de propietarios morosos (Art. 15.2 LPH).
4. **📲 Estación de Notificación Multicanal:** Envío automatizado instantáneo de la convocatoria oficial o del acta final con su PDF certificado a los correos y terminales móviles de los propietarios vía **WhatsApp API**.

---

## 🗄️ Arquitectura del Software y Flujo de Datos

La aplicación está diseñada bajo un patrón desacoplado y panorámico optimizado para monitores de escritorio:

*   **Frontend (React + Tailwind v4 + Framer Motion):** Interfaz fluida a pantalla partida (*Split Screen*) para el Onboarding y diseño de tipo "Sala de Control" panorámica a tres columnas para la monitorización en vivo del cuórum y los temporizadores regresivos de votos.
*   **Gestor de Estado (Zustand / Reducer Maestro en Raíz):** Flujo de datos unidireccional y centralizado en `src/store.jsx` para blindar el aislamiento relacional del inquilino activo.
*   **Backend (Node.js + Express):** API Gateway optimizada para entornos en la nube (`0.0.0.0`) con bypass de ciberseguridad para CORS y proxies de red.
*   **Base de Datos (PostgreSQL):** Motor relacional con identificadores seguros `UUID` e indexación cruzada para garantizar que los datos de un despacho jamás se mezclen con los de otro (*Multi-tenant Isolation*).

---

## 📂 Mapa de la Base de Datos Relacional (pgAdmin)

La persistencia local se asienta sobre 6 tablas maestras optimizadas:
*   `tenants`: Cuentas maestras de los despachos profesionales, facturación SEPA y planes de prueba de 15 días gratuitos.
*   `entities`: Catálogo privado de fincas, comunidades de vecinos o sociedades mercantiles.
*   `propietarios`: Censo legal estructurado de los vecinos (nombre, email, teléfono de España y coeficientes exactos).
*   `meetings`: Historial y estados de las juntas programadas y activas.
*   `agenda_points`: Puntos del orden del día con contadores dinámicos para congelar el escrutinio de votos.
*   `minutes`: Archivo inmutable de actas con sellado digital mediante **HASH criptográfico SHA-256** para evitar modificaciones posteriores.

---

## 🛠️ Instrucciones de Instalación en Entorno Local

### 1. Clonar y configurar la Base de Datos (pgAdmin)
1. Abre tu **pgAdmin** local.
2. Crea una base de datos exclusiva llamada `VOTIFAI`.
3. Abre el *Query Tool* en esa base de datos y ejecuta el script del mapa de tablas SQL proporcionado en el proyecto.

### 2. Levantar el Servidor Backend (Node.js)
```bash
cd server
pnpm install
node index.js
```

### 3. Levantar la Interfaz de Usuario (React)
```bash

pnpm install
pnpm run dev --force
```

---

## 🔒 Certificación de Seguridad de Datos
El entorno opera bajo encriptación de grado bancario para la custodia de los IBAN de domiciliación, logs de auditoría inmutables y absoluto aislamiento de logs cumpliendo rigurosamente con el **RGPD de la Unión Europea**.

---
<div align="center">
  <p><strong>VotifAI Inc. © 2026 — Sistema de voto electrónico con automatización con IA</strong></p>
</div>