-- La tabla `meetings` real en producción se creó en algún momento al
-- margen de este directorio de migraciones (posiblemente a mano o desde
-- otra rama), con columnas que 000_init.sql nunca declaró
-- (titulo_convocatoria, fecha_reunion, cuorum_asistencia, NOT NULL sin
-- default) y sin la columna acta_texto_final que sí usa el código desde
-- siempre (motivo real, además de la defensiva, de por qué
-- /api/meetings/clausurar llevaba un "modo contingencia": la UPDATE
-- fallaba en silencio porque esa columna nunca existió). 018 añadió las
-- columnas nuevas (titulo, tipo, fecha_hora_prevista...) sin tocar esto.
-- La tabla está vacía en producción a fecha de esta migración, así que no
-- hay datos que preservar ni migrar entre columnas duplicadas.

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS acta_texto_final TEXT;

ALTER TABLE meetings DROP COLUMN IF EXISTS titulo_convocatoria;
ALTER TABLE meetings DROP COLUMN IF EXISTS fecha_reunion;
ALTER TABLE meetings DROP COLUMN IF EXISTS cuorum_asistencia;
