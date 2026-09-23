-- Presupuesto por partidas y fondo de reserva.
--  - presupuestos.tipo: ordinario / extraordinario. El fondo de reserva se
--    mide contra el último presupuesto ORDINARIO (art. 9.1.f LPH: no puede
--    ser inferior al 10 %).
--  - presupuesto_partidas: el desglose (limpieza, luz, ascensor…). La
--    ejecución compara cada partida con los gastos del año de la misma
--    categoría.
--  - fondo_reserva_movimientos: aportaciones y disposiciones del fondo,
--    separado de la contabilidad corriente.

ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'ordinario';

DO $$
BEGIN
  ALTER TABLE presupuestos ADD CONSTRAINT presupuestos_tipo_check CHECK (tipo IN ('ordinario', 'extraordinario'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS presupuesto_partidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id UUID NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  importe_previsto NUMERIC(12,2) NOT NULL CHECK (importe_previsto >= 0),
  orden INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_presupuesto_partidas ON presupuesto_partidas(presupuesto_id, orden);

CREATE TABLE IF NOT EXISTS fondo_reserva_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL,
  concepto VARCHAR(255) NOT NULL,
  importe NUMERIC(12,2) NOT NULL CHECK (importe > 0),
  fecha DATE NOT NULL,
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE fondo_reserva_movimientos ADD CONSTRAINT fondo_reserva_tipo_check CHECK (tipo IN ('aportacion', 'disposicion'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_fondo_reserva_entity ON fondo_reserva_movimientos(entity_id, fecha);
