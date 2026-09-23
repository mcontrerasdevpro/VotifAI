-- Contador de juntas iniciadas por despacho, guardado en la propia cuenta.
-- El límite de juntas de la prueba gratuita contaba las juntas existentes,
-- así que borrar una finca (y con ella sus juntas) devolvía el contador a
-- cero. Este contador solo sube: no baja al borrar fincas ni juntas.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS juntas_iniciadas INTEGER NOT NULL DEFAULT 0;

UPDATE tenants t
SET juntas_iniciadas = sub.total
FROM (
  SELECT e.tenant_id, COUNT(*)::int AS total
  FROM meetings m JOIN entities e ON e.id = m.entity_id
  WHERE m.iniciada_en IS NOT NULL
  GROUP BY e.tenant_id
) sub
WHERE sub.tenant_id = t.id AND t.juntas_iniciadas < sub.total;
