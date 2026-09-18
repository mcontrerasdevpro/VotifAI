-- Contabilidad simple de la comunidad: ingresos/gastos, presupuestos
-- anuales y liquidaciones periódicas. Explícitamente NO es contabilidad
-- profesional (sin partida doble, sin conciliación bancaria, sin modelos
-- fiscales) — eso queda fuera de alcance, es nivel gestoría/asesoría.

CREATE TABLE IF NOT EXISTS movimientos_contables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  tipo VARCHAR(10) NOT NULL,
  concepto VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  importe NUMERIC(10,2) NOT NULL,
  fecha DATE NOT NULL,
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE movimientos_contables ADD CONSTRAINT movimientos_contables_tipo_check CHECK (tipo IN ('ingreso', 'gasto'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE movimientos_contables ADD CONSTRAINT movimientos_contables_importe_check CHECK (importe > 0);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_movimientos_contables_entity_fecha ON movimientos_contables(entity_id, fecha);

CREATE TABLE IF NOT EXISTS presupuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  anio INT NOT NULL,
  importe_previsto NUMERIC(10,2) NOT NULL,
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presupuestos_entity ON presupuestos(entity_id);

-- Liquidación = fotografía cerrada de un periodo (totales congelados en el
-- momento de crearla a partir de movimientos_contables), no editable
-- después — igual filosofía que el acta inmutable de una junta.
CREATE TABLE IF NOT EXISTS liquidaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  total_ingresos NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_gastos NUMERIC(10,2) NOT NULL DEFAULT 0,
  saldo NUMERIC(10,2) NOT NULL DEFAULT 0,
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE liquidaciones ADD CONSTRAINT liquidaciones_periodo_check CHECK (periodo_fin >= periodo_inicio);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_liquidaciones_entity ON liquidaciones(entity_id);
