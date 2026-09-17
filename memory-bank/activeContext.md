# Contexto Activo

## Foco Actual
Establecer la navegación y el flujo de estados lógicos entre el Login, la selección de Inquilino/Despacho (`ClientSelector`), y la redirección segura al `Dashboard`.

## Próximos pasos inmediatos
- [ ] Conectar `Login.jsx` y `Register.jsx` con el endpoint de autenticación del `/server`.
- [ ] Implementar la persistencia en `src/store.jsx` al pasar por `ClientSelector.jsx` para inyectar el ID del inquilino seleccionado en todas las peticiones HTTP.
- [ ] Diseñar la lógica del temporizador regresivo y la sincronización de las columnas en `Dashboard.jsx`.
- [ ] Validar que `ProtectedRoute.jsx` bloquee el acceso a `Dashboard.jsx` si no hay un token de sesión o un cliente activo seleccionado.