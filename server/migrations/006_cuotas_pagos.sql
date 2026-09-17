-- Cuotas y morosidad: da uso real a propietarios.es_moroso, que existe
-- desde el esquema original pero nunca tuvo ningún endpoint que lo
-- modificara (solo se leía en /api/propietarios/lista).

CREATE TABLE IF NOT EXISTS cuotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  propietario_id UUID NOT NULL REFERENCES propietarios(id) ON DELETE CASCADE,
  concepto VARCHAR(255) NOT NULL,
  periodo VARCHAR(50),
  importe NUMERIC(10,2) NOT NULL,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE cuotas ADD CONSTRAINT cuotas_estado_check CHECK (estado IN ('pendiente', 'parcial', 'pagada', 'impagada', 'anulada'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_cuotas_entity ON cuotas(entity_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_propietario ON cuotas(propietario_id);

CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuota_id UUID NOT NULL REFERENCES cuotas(id) ON DELETE CASCADE,
  importe NUMERIC(10,2) NOT NULL,
  metodo_pago VARCHAR(50),
  fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
  referencia VARCHAR(255),
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_cuota ON pagos(cuota_id);
