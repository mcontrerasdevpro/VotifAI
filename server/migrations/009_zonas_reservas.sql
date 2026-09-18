-- Reservas de zonas comunes: configuración de zonas (piscina, salón,
-- trastero, parking...) y sus reservas, con validación de solape de
-- horarios en el backend (no solo en la UI). Se evita EXCLUDE USING gist
-- para no depender de la extensión btree_gist; el solape se comprueba en
-- el endpoint antes de insertar.

CREATE TABLE IF NOT EXISTS zonas_comunes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  tipo VARCHAR(100),
  capacidad_maxima INT,
  requiere_aprobacion BOOLEAN NOT NULL DEFAULT false,
  horario_apertura TIME NOT NULL DEFAULT '08:00',
  horario_cierre TIME NOT NULL DEFAULT '22:00',
  duracion_maxima_minutos INT NOT NULL DEFAULT 120,
  reglas TEXT,
  activa BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zonas_comunes_entity ON zonas_comunes(entity_id);

CREATE TABLE IF NOT EXISTS reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zona_id UUID NOT NULL REFERENCES zonas_comunes(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  propietario_id UUID NOT NULL REFERENCES propietarios(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE reservas ADD CONSTRAINT reservas_estado_check CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'rechazada'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE reservas ADD CONSTRAINT reservas_horario_valido_check CHECK (hora_fin > hora_inicio);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_reservas_zona_fecha ON reservas(zona_id, fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_entity ON reservas(entity_id);
