-- Transcripción real de intervenciones en Junta en Vivo. Cada propietario
-- graba su propia intervención desde su móvil (pantalla /asistencia), ya
-- identificado porque eligió su nombre del censo real de la finca — la
-- atribución de "quién habló" es exacta sin necesitar diarización por
-- huella de voz ni enrolar micrófonos de sala.

CREATE TABLE IF NOT EXISTS transcripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  propietario_id UUID REFERENCES propietarios(id) ON DELETE SET NULL,
  texto TEXT NOT NULL,
  duracion_segundos NUMERIC(6,2),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transcripciones_entity ON transcripciones(entity_id, creado_en);
