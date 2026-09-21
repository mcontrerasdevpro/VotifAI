# 🛡️ VotifAI

<div align="center">
  <img src="src/components/ShieldCheck.svg" alt="VotifAI Logo" width="80" height="80" style="background: #0f172a; padding: 10px; border-radius: 20px; border: 1px solid #1e293b;" />
  <br />
  <h1>Votif<span style="color: #2563eb;">AI</span></h1>
  <p><strong>Plataforma de Gobernanza Inteligente para Administración de Fincas</strong></p>
  <p>Ecosistema SaaS B2B multi-inquilino para despachos que gestionan comunidades de propietarios bajo la Ley de Propiedad Horizontal (LPH).</p>
</div>

---

## 🚀 Propuesta de Valor

**VotifAI** transforma la gestión de juntas de propietarios en un proceso digital, y añade encima el resto de lo que necesita un despacho de administración de fincas: incidencias, cuotas, documentos, reservas de zonas comunes, atención al cliente, agenda y contabilidad simple — todo bajo el mismo inquilino (tenant) por despacho.

### 🔥 Diferencial: Junta en Vivo con transcripción real

- **🎙️ Manos Alzadas y Transcripción Real:** cada propietario se registra con una cuenta propia (email + contraseña, verificada con el código de acceso de su finca) y graba sus intervenciones desde su propio móvil. La atribución de autoría es exacta — no hay diarización por IA sobre un micrófono de sala, cada persona ya está identificada en su dispositivo. El audio se transcribe con la API de OpenAI y aparece en vivo en el panel del secretario.
- **📊 Escrutinio por Coeficientes:** control en tiempo real de cuórum por cabezas y por cuota de participación durante la votación.
- **🔒 Sellado de Actas:** el acta final se archiva de forma inmutable al clausurar la junta.

### 🧰 Módulos de Gestión del Despacho (tipo ERP)

Una vez dentro de una finca, además de "Junta en Vivo":

| Módulo | Qué hace |
|---|---|
| **Incidencias** | Partes de avería con timeline de estado y catálogo de proveedores del despacho |
| **Cuotas** | Cuotas y pagos, con morosidad real sobre el censo de propietarios |
| **Documentos** | Repositorio de documentos, comunicados, y un editor de texto con plantillas reutilizables |
| **Reservas** | Reserva de zonas comunes con validación de solape de horarios en el servidor |
| **Atención al Cliente** | Solicitudes de propietarios al despacho (consultas, reclamaciones...), con timeline |
| **Agenda** | Calendario único del despacho (no por finca), para juntas y vencimientos de toda la cartera |
| **Contabilidad** | Ingresos/gastos, presupuestos (previsto vs. ejecutado) y liquidaciones cerradas por periodo |

---

## 🗄️ Arquitectura del Software

- **Frontend (React + Tailwind v4 + Framer Motion):** interfaz oscura con tablas de datos en modo "papel" (fondo blanco) para legibilidad; primitivos de UI compartidos en `src/components/ui/`.
- **Gestor de Estado (Context + useReducer en `src/store.jsx`):** flujo de datos centralizado en la raíz para la sesión del despacho.
- **Backend (Node.js + Express):** API en `server/`, con un router por módulo en `server/routes/` montado bajo `/api`.
- **Base de Datos (PostgreSQL / Neon):** identificadores `UUID`, migraciones versionadas en `server/migrations/` (`pnpm run migrate`), aislamiento estricto por `tenant_id` verificado en cada endpoint.

### Autenticación — dos sesiones independientes

| | Despacho (administrador) | Vecino (propietario) |
|---|---|---|
| Credenciales | Email + contraseña | Email + contraseña |
| Verificación inicial | Registro directo (`/register`) | Código de acceso de su finca (`entities.codigo_acceso`, generado al crear la finca) |
| Cookie de sesión | `votifai_session` (7 días) | `votifai_voter_session` (180 días) |
| Alcance | Todas las fincas de su despacho | Solo su propia finca |

Ambas sesiones tienen recuperación de contraseña por email (`/olvide-password/despacho` y `/olvide-password/comunidad`), enviada a través del mismo webhook de n8n que las notificaciones (ver más abajo).

---

## 📲 Notificaciones (WhatsApp / Email vía n8n)

Las convocatorias, los reenvíos de acta y la recuperación de contraseña se envían a través de un único webhook de n8n (`server/lib/notificaciones.js`), configurable con `N8N_WEBHOOK_URL`. Es el flujo de n8n quien decide el canal por destinatario según tenga teléfono, email o ambos. Sin esa variable, el envío se simula con un `console.log` (útil en desarrollo).

---

## 🛠️ Instalación en Entorno Local

### 1. Base de datos (PostgreSQL / Neon)
Crea una base de datos y copia `.env.example` a `server/.env`, rellenando `DATABASE_URL`, `JWT_SECRET` y (opcional, para la transcripción de voz) `OPENAI_API_KEY`.

### 2. Backend
```bash
cd server
pnpm install
pnpm run migrate   # aplica todas las migraciones versionadas
node index.js
```

### 3. Frontend
```bash
pnpm install
pnpm run dev --force
```

## 🚀 Despliegue en Render

El repositorio contiene `render.yaml` para que Render instale las dependencias
del frontend y del backend antes de compilar. Si el servicio ya existe y no usa
Blueprints, configura manualmente:

```text
Build Command: pnpm install --frozen-lockfile && pnpm install --dir server --frozen-lockfile && pnpm build
Start Command: node server/index.js
```

En Render configura como mínimo `DATABASE_URL`, `JWT_SECRET` y `CORS_ORIGIN`.

---

## 🔒 Seguridad y Aislamiento Multi-Tenant

Cada consulta que toca datos de una finca o de un propietario verifica explícitamente que esa fila pertenece al tenant autenticado (`server/middleware/auth.js`) antes de leer o escribir — sin excepciones por conveniencia. El histórico de cambios de titularidad, las actas y las liquidaciones cerradas son inmutables una vez generadas.

---
<div align="center">
  <p><strong>VotifAI © 2026 — Gobernanza de comunidades con IA</strong></p>
</div>
