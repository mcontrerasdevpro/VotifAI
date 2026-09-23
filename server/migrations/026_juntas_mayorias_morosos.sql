-- Validez legal de las votaciones (LPH):
--  - Cada punto con votación lleva su mayoría exigida (art. 17).
--  - La junta registra si se celebra en 1ª o 2ª convocatoria (cambia la
--    mayoría simple, art. 17.7).
--  - Foto de los propietarios privados de voto por deudas vencidas al
--    iniciar la junta (art. 15.2): no votan ni computan para las mayorías,
--    y el acta debe reflejarlos. El despacho puede habilitar a uno si paga
--    en la sala o acredita impugnación o consignación de la deuda.

ALTER TABLE meeting_puntos ADD COLUMN IF NOT EXISTS mayoria VARCHAR(20) NOT NULL DEFAULT 'simple';

DO $$
BEGIN
  ALTER TABLE meeting_puntos ADD CONSTRAINT meeting_puntos_mayoria_check CHECK (mayoria IN ('simple', 'un_tercio', 'tres_quintos', 'unanimidad'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS convocatoria VARCHAR(10);

DO $$
BEGIN
  ALTER TABLE meetings ADD CONSTRAINT meetings_convocatoria_check CHECK (convocatoria IS NULL OR convocatoria IN ('primera', 'segunda'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS meeting_privados_voto (
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  propietario_id UUID NOT NULL REFERENCES propietarios(id) ON DELETE CASCADE,
  nombre_completo VARCHAR(255) NOT NULL,
  propiedad_detalle VARCHAR(255),
  coeficiente NUMERIC(8,4) NOT NULL DEFAULT 0,
  deuda NUMERIC(10,2) NOT NULL DEFAULT 0,
  habilitado BOOLEAN NOT NULL DEFAULT false,
  habilitado_motivo TEXT,
  habilitado_en TIMESTAMPTZ,
  PRIMARY KEY (meeting_id, propietario_id)
);
