-- Conservar el historial en lugar de borrarlo:
--  - Una cuota se ANULA (queda visible, con motivo y fecha) en vez de
--    borrarse; solo se puede borrar si no tiene cobros.
--  - Una liquidación se anula en vez de borrarse. Mientras está vigente,
--    su periodo queda cerrado: no se pueden añadir ni quitar movimientos
--    (ni cobros) con fecha dentro de él, para que la liquidación presentada
--    siga cuadrando con la contabilidad.

ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS anulada_en TIMESTAMPTZ;
ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;

ALTER TABLE liquidaciones ADD COLUMN IF NOT EXISTS anulada_en TIMESTAMPTZ;
ALTER TABLE liquidaciones ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;
