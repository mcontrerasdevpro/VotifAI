-- Cada cobro de una cuota genera su ingreso en la contabilidad de la
-- comunidad (antes había que apuntarlo dos veces y, si se olvidaba, la
-- liquidación salía incompleta). El movimiento queda ligado al pago: si el
-- pago se anula, el ingreso desaparece con él (ON DELETE CASCADE), y desde
-- Contabilidad no se puede borrar suelto.

ALTER TABLE movimientos_contables ADD COLUMN IF NOT EXISTS pago_id UUID REFERENCES pagos(id) ON DELETE CASCADE;
ALTER TABLE movimientos_contables ADD COLUMN IF NOT EXISTS origen VARCHAR(20) NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  ALTER TABLE movimientos_contables ADD CONSTRAINT movimientos_contables_origen_check CHECK (origen IN ('manual', 'cuota'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_movimiento_por_pago ON movimientos_contables (pago_id) WHERE pago_id IS NOT NULL;
