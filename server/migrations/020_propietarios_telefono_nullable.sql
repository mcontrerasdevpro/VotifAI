-- Mismo caso que 007_propietarios_email_nullable.sql pero para el otro lado
-- de la regla "teléfono O email" (no exige ambos): la columna telefono en
-- la base real seguía con NOT NULL, así que dar de alta un propietario solo
-- con email fallaba con un error de base de datos aunque el código (frontend
-- y backend) lo permite explícitamente.

ALTER TABLE propietarios ALTER COLUMN telefono DROP NOT NULL;
