-- Esquema base necesario para aplicar el resto de migraciones desde una base vacia.
-- Debe ejecutarse antes de 001_entities_tipo.sql.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_entidad VARCHAR(255) NOT NULL,
  email_maestro VARCHAR(320) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  tipo_organizacion VARCHAR(50) NOT NULL DEFAULT 'administrador',
  plan_suscripcion VARCHAR(50) NOT NULL DEFAULT 'trial_15_dias',
  iban_facturacion VARCHAR(34),
  titular_cuenta VARCHAR(255),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_email_maestro_unico
  ON tenants (LOWER(email_maestro));

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  cif VARCHAR(30),
  direccion TEXT,
  metadatos_legales JSONB NOT NULL DEFAULT '{}'::jsonb,
  documento_adjunto TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entities_tenant_idx ON entities (tenant_id);

CREATE TABLE IF NOT EXISTS propietarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  nombre_completo VARCHAR(255) NOT NULL,
  propiedad_detalle VARCHAR(255) NOT NULL DEFAULT 'Vivienda',
  telefono VARCHAR(40),
  email VARCHAR(320),
  coeficiente NUMERIC(8,4) NOT NULL DEFAULT 0,
  es_moroso BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS propietarios_entity_idx ON propietarios (entity_id);

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  estado VARCHAR(30) NOT NULL DEFAULT 'abierta',
  acta_texto_final TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meetings_entity_idx ON meetings (entity_id, creado_en DESC);
