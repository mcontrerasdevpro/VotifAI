-- Deja que cada propietario elija por qué canal quiere que le notifiquen
-- (email, WhatsApp, o ambos). Por defecto 'ambos': antes de que exista
-- esta preferencia explícita, es más seguro intentar por todos los
-- canales de los que haya dato de contacto que arriesgarse a que a
-- alguien no le llegue nada.
ALTER TABLE propietarios ADD COLUMN IF NOT EXISTS canal_notificacion VARCHAR(20) NOT NULL DEFAULT 'ambos';

ALTER TABLE propietarios DROP CONSTRAINT IF EXISTS propietarios_canal_notificacion_check;
ALTER TABLE propietarios ADD CONSTRAINT propietarios_canal_notificacion_check
  CHECK (canal_notificacion IN ('email', 'whatsapp', 'ambos'));
