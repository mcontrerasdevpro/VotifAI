CREATE TABLE IF NOT EXISTS demo_solicitudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(320) NOT NULL,
  telefono VARCHAR(40),
  comunidades VARCHAR(40),
  mensaje TEXT,
  consentimiento_privacidad BOOLEAN NOT NULL DEFAULT false,
  consentimiento_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  atendida_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS demo_solicitudes_creado_idx
  ON demo_solicitudes (creado_en DESC);