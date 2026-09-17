-- Primer módulo de negocio real del gestor de comunidad: repositorio de
-- documentos (actas, normativa, escrituras...) y tablón de comunicados.
-- Mismo patrón de almacenamiento que entities.documento_adjunto (base64
-- en columna) para no introducir infraestructura nueva en esta fase.

CREATE TABLE IF NOT EXISTS documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(100) NOT NULL DEFAULT 'general',
  archivo_nombre VARCHAR(255),
  archivo_mime VARCHAR(100),
  archivo_base64 TEXT NOT NULL,
  visibilidad VARCHAR(20) NOT NULL DEFAULT 'publico',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE documentos ADD CONSTRAINT documentos_visibilidad_check CHECK (visibilidad IN ('publico', 'solo_admin'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_documentos_entity ON documentos(entity_id);

CREATE TABLE IF NOT EXISTS comunicados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  cuerpo TEXT NOT NULL,
  fijado BOOLEAN NOT NULL DEFAULT false,
  fecha_publicacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_caducidad TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunicados_entity ON comunicados(entity_id);
