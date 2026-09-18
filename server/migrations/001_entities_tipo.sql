-- Añade la distinción real comunidad (LPH) / empresa (LSC) a nivel de esquema.
-- Hasta ahora esa distinción solo vivía en la URL del frontend (/admin/:fincaId
-- vs /admin/empresa/:empresaId), no en la base de datos.

ALTER TABLE entities ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'comunidad';

DO $$
BEGIN
  ALTER TABLE entities ADD CONSTRAINT entities_tipo_check CHECK (tipo IN ('comunidad', 'empresa'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Backfill best-effort para entidades ya existentes, usando las claves que
-- /api/auth/register guarda de forma distinta según tipoOrganizacion.
UPDATE entities
SET tipo = 'empresa'
WHERE metadatos_legales IS NOT NULL
  AND metadatos_legales::jsonb ? 'cifEmpresa';

UPDATE entities
SET tipo = 'comunidad'
WHERE metadatos_legales IS NOT NULL
  AND metadatos_legales::jsonb ? 'cifComunidad';
