-- El código en /api/propietarios/cambio-titular y /api/propietarios/lista
-- asume esta tabla, pero no existía en la base real: el cambio de
-- titularidad estaba roto (500) y el borrado de una entidad con propietarios
-- fallaba al intentar limpiar su historial.

CREATE TABLE IF NOT EXISTS historial_titularidad (
  historial_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propietario_id UUID NOT NULL REFERENCES propietarios(id) ON DELETE CASCADE,
  anterior_titular VARCHAR(255),
  nuevo_titular VARCHAR(255),
  motivo_cambio VARCHAR(255),
  detalles TEXT,
  fecha_cambio TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_titularidad_propietario ON historial_titularidad(propietario_id);
