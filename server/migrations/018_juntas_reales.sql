-- Juntas reales: convocatoria con título/tipo/fecha-hora, orden del día
-- persistente y votación real de propietarios (ponderada por coeficiente),
-- sustituyendo el estado abierta/clausurada único por finca por un
-- histórico completo de juntas (programada / en_curso / cerrada / cancelada).

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS titulo VARCHAR(255) NOT NULL DEFAULT 'Junta sin título';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'ordinaria';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS fecha_hora_prevista TIMESTAMPTZ;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS convocada_en TIMESTAMPTZ;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS iniciada_en TIMESTAMPTZ;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS cerrada_en TIMESTAMPTZ;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS censo_total_propietarios INT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS censo_total_coeficiente NUMERIC(8,4);

-- Los estados previos ('abierta'/'clausurada') no encajan con el nuevo
-- ciclo de vida (programada -> en_curso -> cerrada, más cancelada) — se
-- remapean antes de añadir el CHECK para no dejar filas existentes en un
-- estado que la constraint rechazaría.
UPDATE meetings SET estado = 'cerrada' WHERE estado = 'clausurada';
UPDATE meetings SET estado = 'programada' WHERE estado = 'abierta';
ALTER TABLE meetings ALTER COLUMN estado SET DEFAULT 'programada';

DO $$
BEGIN
  ALTER TABLE meetings ADD CONSTRAINT meetings_estado_check CHECK (estado IN ('programada', 'en_curso', 'cerrada', 'cancelada'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE meetings ADD CONSTRAINT meetings_tipo_check CHECK (tipo IN ('ordinaria', 'extraordinaria'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_meetings_entity_fecha ON meetings(entity_id, fecha_hora_prevista DESC);

-- Orden del día persistente: cada junta tiene sus propios puntos, fijados
-- al convocar. Un punto 'informativo' (p.ej. Ruegos y Preguntas) no admite
-- votación, solo se abre/cierra para acotar el tiempo de la sala en vivo.
CREATE TABLE IF NOT EXISTS meeting_puntos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  orden INT NOT NULL,
  texto TEXT NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'votacion',
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  abierto_en TIMESTAMPTZ,
  cerrado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, orden)
);

DO $$
BEGIN
  ALTER TABLE meeting_puntos ADD CONSTRAINT meeting_puntos_tipo_check CHECK (tipo IN ('votacion', 'informativo'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE meeting_puntos ADD CONSTRAINT meeting_puntos_estado_check CHECK (estado IN ('pendiente', 'votando', 'cerrado'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_meeting_puntos_meeting ON meeting_puntos(meeting_id, orden);

-- Voto real de cada propietario por punto. El coeficiente se copia en el
-- momento de votar para que el cómputo de cuórum/resultado de una junta ya
-- cerrada no cambie si el censo se corrige después. UNIQUE(punto_id,
-- propietario_id) es lo que impide un doble voto a nivel de base de datos
-- (el endpoint hace UPSERT sobre esta misma constraint para permitir
-- cambiar el voto mientras el punto siga abierto).
CREATE TABLE IF NOT EXISTS meeting_votos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punto_id UUID NOT NULL REFERENCES meeting_puntos(id) ON DELETE CASCADE,
  propietario_id UUID NOT NULL REFERENCES propietarios(id) ON DELETE CASCADE,
  voto VARCHAR(10) NOT NULL,
  coeficiente_snapshot NUMERIC(8,4) NOT NULL,
  votado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(punto_id, propietario_id)
);

DO $$
BEGIN
  ALTER TABLE meeting_votos ADD CONSTRAINT meeting_votos_voto_check CHECK (voto IN ('si', 'no', 'abstencion'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_meeting_votos_punto ON meeting_votos(punto_id);

-- Log de convocatoria/notificación: notificar() es fire-and-forget contra
-- un webhook externo de n8n sin acuse de recibo por destinatario — esto
-- deja constancia, dentro de nuestra propia transacción, de a quién se
-- intentó convocar/notificar, con qué datos de contacto y cuándo (trazable
-- aunque el propietario se borre después del censo, por eso el FK es SET
-- NULL en vez de CASCADE).
CREATE TABLE IF NOT EXISTS meeting_notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  propietario_id UUID REFERENCES propietarios(id) ON DELETE SET NULL,
  tipo VARCHAR(30) NOT NULL,
  destinatario_nombre VARCHAR(255),
  destinatario_propiedad VARCHAR(255),
  destinatario_email VARCHAR(320),
  destinatario_telefono VARCHAR(40),
  resultado VARCHAR(20) NOT NULL DEFAULT 'enviado',
  enviado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE meeting_notificaciones ADD CONSTRAINT meeting_notificaciones_tipo_check CHECK (tipo IN ('convocatoria', 'acta_cierre', 'reenvio_individual'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE meeting_notificaciones ADD CONSTRAINT meeting_notificaciones_resultado_check CHECK (resultado IN ('enviado', 'simulado', 'error'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_meeting_notificaciones_meeting ON meeting_notificaciones(meeting_id);
