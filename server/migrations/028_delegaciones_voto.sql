-- Delegación de voto entre vecinos desde la app (art. 15.1 LPH), con
-- consentimiento de las dos partes: el representado la solicita y el
-- representante tiene que aceptarla desde su propia cuenta. Hasta que no
-- la acepta no hay representación, así nadie puede ser nombrado
-- representante sin saberlo ni votar por otro sin su permiso.
--
-- Al aceptarse, el representado pasa a constar en meeting_asistencia como
-- 'representado' (con delegacion_id), igual que las representaciones que
-- registra el despacho en sala.

CREATE TABLE IF NOT EXISTS meeting_delegaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  representado_id UUID NOT NULL REFERENCES propietarios(id) ON DELETE CASCADE,
  representante_id UUID NOT NULL REFERENCES propietarios(id) ON DELETE CASCADE,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  solicitada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondida_en TIMESTAMPTZ,
  revocada_en TIMESTAMPTZ,
  CHECK (representado_id <> representante_id)
);

DO $$
BEGIN
  ALTER TABLE meeting_delegaciones ADD CONSTRAINT meeting_delegaciones_estado_check CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'revocada'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Una sola delegación viva (pendiente o aceptada) por propietario y junta.
CREATE UNIQUE INDEX IF NOT EXISTS uq_delegacion_viva
  ON meeting_delegaciones (meeting_id, representado_id)
  WHERE estado IN ('pendiente', 'aceptada');

CREATE INDEX IF NOT EXISTS idx_delegaciones_representante ON meeting_delegaciones (meeting_id, representante_id);

ALTER TABLE meeting_asistencia ADD COLUMN IF NOT EXISTS delegacion_id UUID REFERENCES meeting_delegaciones(id) ON DELETE SET NULL;
