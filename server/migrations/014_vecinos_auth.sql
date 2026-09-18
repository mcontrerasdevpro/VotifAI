-- Autenticación real de vecinos: registro con email + contraseña,
-- verificado con el código de acceso de la finca (evita que alguien con
-- el enlace de asistencia, pero sin el código que reparte el
-- administrador, pueda crearse una cuenta en nombre de otro propietario).

ALTER TABLE propietarios ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

DO $$
BEGIN
  ALTER TABLE propietarios ADD CONSTRAINT propietarios_email_unico UNIQUE (email);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

ALTER TABLE entities ADD COLUMN IF NOT EXISTS codigo_acceso VARCHAR(20);

DO $$
BEGIN
  ALTER TABLE entities ADD CONSTRAINT entities_codigo_acceso_unico UNIQUE (codigo_acceso);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Backfill: las fincas creadas antes de este cambio no tienen código.
-- Generamos uno determinista a partir de los primeros caracteres del id
-- para no depender de random() en una migración (idempotente si se
-- reejecuta sobre filas que ya tengan código).
UPDATE entities
SET codigo_acceso = 'VAI-' || UPPER(SUBSTRING(id::text, 1, 4)) || '-' || UPPER(SUBSTRING(id::text, 5, 1))
WHERE codigo_acceso IS NULL;
