ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS suscripcion_estado VARCHAR(20) NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS trial_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS trial_fin TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 days'),
  ADD COLUMN IF NOT EXISTS suscripcion_periodo_fin TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proveedor_cliente_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS proveedor_suscripcion_id VARCHAR(255);

UPDATE tenants
SET plan_suscripcion = 'starter'
WHERE plan_suscripcion IS NULL
   OR plan_suscripcion NOT IN ('starter', 'profesional', 'premium', 'enterprise');

DO $$
BEGIN
  ALTER TABLE tenants
    ADD CONSTRAINT tenants_suscripcion_estado_check
    CHECK (suscripcion_estado IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE tenants
    ADD CONSTRAINT tenants_plan_suscripcion_check
    CHECK (plan_suscripcion IN ('starter', 'profesional', 'premium', 'enterprise'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS suscripciones_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proveedor VARCHAR(30) NOT NULL,
  evento_id VARCHAR(255) NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  datos JSONB NOT NULL DEFAULT '{}'::jsonb,
  recibido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proveedor, evento_id)
);

CREATE INDEX IF NOT EXISTS suscripciones_eventos_tenant_idx
  ON suscripciones_eventos (tenant_id, recibido_en DESC);