-- Recuperación de contraseña por email (despacho y vecino), vía el
-- mismo webhook de n8n que ya se usa para convocatorias (server/lib/notificaciones.js).

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reset_token_expira TIMESTAMPTZ;

ALTER TABLE propietarios ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64);
ALTER TABLE propietarios ADD COLUMN IF NOT EXISTS reset_token_expira TIMESTAMPTZ;
