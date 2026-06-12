# Patrones del Sistema y Arquitectura

## Stack Tecnológico
- **Frontend:** React, Tailwind CSS v4, Framer Motion
- **Gestión de Estado:** Zustand / Reducer Maestro (`src/store.jsx`)
- **Backend:** Node.js, Express (API Gateway, Host 0.0.0.0, Bypass CORS)
- **Base de Datos:** PostgreSQL (UUIDs, Aislamiento Multi-tenant)
- **Gestor de Paquetes:** pnpm

## Estructura del Proyecto
El sistema utiliza una arquitectura desacoplada dentro de un único repositorio:
- `/server`: API REST en Express y configuración de base de datos (`db.js`).
- `/src`: Aplicación Cliente (React).
  - `/components`: Componentes UI reutilizables (Sala de control a 3 columnas, Split Screen).
  - `/views`: Vistas de la aplicación organizadas por módulos de negocio.

## Enrutamiento y Módulos de Interfaz (`/src/views`)
- **`auth/`** (Autenticación y Onboarding)
  - `Login.jsx`: Inicio de sesión seguro.
  - `Register.jsx`: Registro de nuevos despachos.
  - `Welcome.jsx`: Pantalla de bienvenida post-registro.
- **`clients/`** (Gestión de Inquilinos)
  - `ClientSelector.jsx`: Selector del despacho profesional activo (`tenants`).
- **`dashboard/`** (Módulo Central)
  - `Dashboard.jsx`: Panel principal con vista panorámica multi-columna.
- **`minutes/`** (Copiloto de IA)
  - `MinutesAI.jsx`: Interfaz de procesamiento de audio y generación de actas.
- **`voter/`** (Sala de Juntas)
  - `VoterScreen.jsx`: Monitorización del cuórum y escrutinio en tiempo real.

## Modelo de Datos (PostgreSQL)
1. `tenants`: Cuentas maestras de despachos profesionales y facturación SEPA.
2. `entities`: Catálogo de fincas administradas o sociedades mercantiles.
3. `propietarios`: Censo legal de vecinos (contactos y coeficientes de participación).
4. `meetings`: Historial, estados y control de las juntas de propietarios.
5. `agenda_points`: Puntos del orden del día con contadores dinámicos de votos.
6. `minutes`: Historial inmutable de actas selladas mediante HASH SHA-256.