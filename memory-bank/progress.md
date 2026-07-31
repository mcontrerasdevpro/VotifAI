# Progreso del Proyecto

## Estado Actual
El core arquitectónico, el ruteo protegido, la base de datos relacional y la estructura visual de la interfaz panorámica de la app están implementados.

## Qué está listo
- [x] Estructura inicial del monorepo (`server/` y `src/`).
- [x] Base de datos en PostgreSQL con las 6 tablas principales.
- [x] Gestión de estado centralizada con Zustand en `src/store.jsx`.
- [x] Vistas base del flujo del software (`auth`, `dashboard`, `voter`, etc.).
- [x] Componentes visuales clave (`PanelEscrutinio.jsx`, `ColumnaMonitorCentral.jsx`, `ColumnaOrdenDia.jsx`).

## Pendiente (Roadmap Proóximo)
- [ ] Integración del motor de diarización de voz por IA.
- [ ] Configuración del backend para el sellado criptográfico SHA-256 de actas.
- [ ] Conexión e integración con la API de WhatsApp para notificaciones.