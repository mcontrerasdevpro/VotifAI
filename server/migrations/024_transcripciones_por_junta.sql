-- Cada intervención de voz pertenece a una junta concreta (y, si había un
-- punto del orden del día abierto, a ese punto). Antes solo colgaba de la
-- finca: el panel de la segunda junta mostraba también las intervenciones
-- de la primera, y el acta no podía recogerlas.

ALTER TABLE transcripciones
  ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS punto_id UUID REFERENCES meeting_puntos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transcripciones_meeting ON transcripciones(meeting_id, creado_en);

-- Las ya existentes se asignan a la junta de esa finca que estaba en curso
-- cuando se grabaron (entre su inicio y su cierre). Las grabadas fuera de
-- cualquier junta se quedan sin junta y ya no aparecen en ningún panel.
UPDATE transcripciones t
SET meeting_id = m.id
FROM meetings m
WHERE t.meeting_id IS NULL
  AND m.entity_id = t.entity_id
  AND m.iniciada_en IS NOT NULL
  AND t.creado_en >= m.iniciada_en
  AND t.creado_en <= COALESCE(m.cerrada_en, now());
