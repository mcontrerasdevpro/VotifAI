-- Junta de gobierno de cada comunidad (art. 13 LPH): presidente,
-- vicepresidentes, secretario, tesorero y vocales, vinculados a
-- propietarios del censo, con fecha de nombramiento, fin de mandato y
-- cese. Los cargos cesados se conservan como historial. El nombre y la
-- vivienda se copian al nombrar: si luego cambia el titular de la
-- vivienda, el historial sigue diciendo quién ocupó el cargo.
CREATE TABLE IF NOT EXISTS cargos_comunidad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  propietario_id UUID REFERENCES propietarios(id) ON DELETE SET NULL,
  cargo VARCHAR(20) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  propiedad VARCHAR(255),
  desde DATE NOT NULL DEFAULT CURRENT_DATE,
  hasta DATE,
  cesado_en DATE,
  motivo_cese VARCHAR(255),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE cargos_comunidad ADD CONSTRAINT cargos_comunidad_cargo_check
    CHECK (cargo IN ('presidente', 'vicepresidente', 'secretario', 'tesorero', 'vocal'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS cargos_comunidad_entity_idx ON cargos_comunidad (entity_id);
-- Un solo presidente, secretario y tesorero vigentes por comunidad.
CREATE UNIQUE INDEX IF NOT EXISTS cargos_comunidad_unico_vigente ON cargos_comunidad (entity_id, cargo)
  WHERE cesado_en IS NULL AND cargo IN ('presidente', 'secretario', 'tesorero');
-- Y la misma persona no puede tener dos veces el mismo cargo vigente.
CREATE UNIQUE INDEX IF NOT EXISTS cargos_comunidad_persona_vigente ON cargos_comunidad (entity_id, cargo, propietario_id)
  WHERE cesado_en IS NULL;

-- Presidente y tesorero que ya estaban como texto en el expediente de la
-- finca: se vinculan al propietario del censo con el mismo nombre.
INSERT INTO cargos_comunidad (entity_id, propietario_id, cargo, nombre, propiedad, desde, hasta)
SELECT e.id, p.id, c.cargo, p.nombre_completo, p.propiedad_detalle, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year'
FROM entities e
CROSS JOIN (VALUES ('presidente'), ('tesorero')) AS c(cargo)
JOIN LATERAL (
  SELECT id, nombre_completo, propiedad_detalle FROM propietarios
  WHERE entity_id = e.id AND LOWER(TRIM(nombre_completo)) = LOWER(TRIM(e.metadatos_legales->>c.cargo))
  ORDER BY creado_en LIMIT 1
) p ON true
WHERE COALESCE(TRIM(e.metadatos_legales->>c.cargo), '') <> ''
  AND NOT EXISTS (SELECT 1 FROM cargos_comunidad x WHERE x.entity_id = e.id AND x.cargo = c.cargo AND x.cesado_en IS NULL);
