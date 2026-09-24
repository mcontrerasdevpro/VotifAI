-- Recordatorio de fin de prueba (3 días antes), enviado una sola vez por
-- despacho por la tarea diaria /api/tareas/recordatorios-prueba.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS recordatorio_prueba_enviado_en TIMESTAMPTZ;
