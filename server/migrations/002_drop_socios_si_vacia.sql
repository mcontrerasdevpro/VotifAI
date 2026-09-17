-- La tabla "socios" es vestigial: ningún endpoint hace INSERT/SELECT real sobre
-- ella (solo aparece en DELETEs de purga por si acaso, y /api/socios/lista en
-- realidad lee de "propietarios" con alias). Se elimina solo si está vacía,
-- para no perder datos reales si alguna fila llegó a insertarse a mano.

DO $$
DECLARE
  filas BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'socios') THEN
    EXECUTE 'SELECT COUNT(*) FROM socios' INTO filas;
    IF filas = 0 THEN
      EXECUTE 'DROP TABLE socios';
      RAISE NOTICE 'Tabla socios eliminada (estaba vacía).';
    ELSE
      RAISE NOTICE 'Tabla socios NO eliminada: contiene % fila(s). Revisar manualmente.', filas;
    END IF;
  ELSE
    RAISE NOTICE 'Tabla socios no existe, nada que hacer.';
  END IF;
END $$;
