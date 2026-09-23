-- Emisión masiva de cuotas: una cuota ordinaria o una derrama se emite a
-- toda la comunidad de una vez, repartida por coeficiente (o a partes
-- iguales), y puede cubrir varios periodos (p. ej. las 12 mensualidades del
-- año). Cada emisión queda registrada con su importe y criterio, y cada
-- cuota apunta a la emisión de la que sale.

CREATE TABLE IF NOT EXISTS cuotas_emisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  concepto VARCHAR(255) NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'ordinaria',
  reparto VARCHAR(20) NOT NULL DEFAULT 'coeficiente',
  importe_por_periodo NUMERIC(12,2) NOT NULL,
  frecuencia VARCHAR(20) NOT NULL DEFAULT 'unica',
  numero_periodos INT NOT NULL DEFAULT 1,
  primer_vencimiento DATE NOT NULL,
  excluidos UUID[] NOT NULL DEFAULT '{}',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE cuotas_emisiones ADD CONSTRAINT cuotas_emisiones_tipo_check CHECK (tipo IN ('ordinaria', 'derrama'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE cuotas_emisiones ADD CONSTRAINT cuotas_emisiones_reparto_check CHECK (reparto IN ('coeficiente', 'partes_iguales'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_cuotas_emisiones_entity ON cuotas_emisiones(entity_id, creado_en);

ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS emision_id UUID REFERENCES cuotas_emisiones(id) ON DELETE SET NULL;
ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'ordinaria';
