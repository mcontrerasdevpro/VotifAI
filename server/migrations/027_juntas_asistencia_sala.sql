-- Voto presencial y representaciones (art. 15.1 y 19 LPH).
--  - meeting_asistencia: quién está en la sala (presencial) o representado
--    por otra persona, con si la representación consta por escrito. El
--    acta debe relacionar asistentes y representados con sus cuotas.
--  - meeting_votos.origen: de dónde viene cada voto (app del vecino,
--    registrado por el despacho en sala, o por representación). Los votos
--    de todos los orígenes se suman igual; un propietario solo tiene un
--    voto por punto (UNIQUE(punto_id, propietario_id)), cuenta el último.

ALTER TABLE meeting_votos ADD COLUMN IF NOT EXISTS origen VARCHAR(20) NOT NULL DEFAULT 'app';

DO $$
BEGIN
  ALTER TABLE meeting_votos ADD CONSTRAINT meeting_votos_origen_check CHECK (origen IN ('app', 'sala', 'representacion'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS meeting_asistencia (
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  propietario_id UUID NOT NULL REFERENCES propietarios(id) ON DELETE CASCADE,
  modo VARCHAR(20) NOT NULL,
  representante_nombre VARCHAR(255),
  representacion_escrita BOOLEAN NOT NULL DEFAULT false,
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, propietario_id)
);

DO $$
BEGIN
  ALTER TABLE meeting_asistencia ADD CONSTRAINT meeting_asistencia_modo_check CHECK (modo IN ('presencial', 'representado'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
