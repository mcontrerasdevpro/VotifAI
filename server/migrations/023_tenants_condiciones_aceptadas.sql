-- Prueba de que cada despacho aceptó Términos, Privacidad y el Contrato de
-- Encargo del Tratamiento (art. 28 RGPD), y de qué versión de los textos.
-- Los despachos dados de alta antes quedan en NULL.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS condiciones_aceptadas_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS condiciones_version VARCHAR(20);
