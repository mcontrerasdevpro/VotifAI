-- CRM / Atención al Cliente: solicitudes que un propietario o socio plantea
-- directamente al despacho (consultas, reclamaciones, peticiones de
-- documentación...), separado de "incidencias" que es mantenimiento físico
-- del inmueble. Mismo patrón de timeline unificado que incidencia_eventos.

CREATE TABLE IF NOT EXISTS solicitudes_crm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  propietario_id UUID REFERENCES propietarios(id) ON DELETE SET NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(30) NOT NULL DEFAULT 'consulta',
  canal VARCHAR(20) NOT NULL DEFAULT 'telefono',
  prioridad VARCHAR(20) NOT NULL DEFAULT 'media',
  estado VARCHAR(20) NOT NULL DEFAULT 'abierta',
  fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_cierre TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE solicitudes_crm ADD CONSTRAINT solicitudes_crm_categoria_check CHECK (categoria IN ('consulta', 'reclamacion', 'documentacion', 'facturacion', 'otro'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE solicitudes_crm ADD CONSTRAINT solicitudes_crm_canal_check CHECK (canal IN ('telefono', 'email', 'whatsapp', 'presencial', 'otro'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE solicitudes_crm ADD CONSTRAINT solicitudes_crm_prioridad_check CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE solicitudes_crm ADD CONSTRAINT solicitudes_crm_estado_check CHECK (estado IN ('abierta', 'en_curso', 'resuelta', 'cerrada'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_solicitudes_crm_entity ON solicitudes_crm(entity_id);

CREATE TABLE IF NOT EXISTS solicitud_crm_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id UUID NOT NULL REFERENCES solicitudes_crm(id) ON DELETE CASCADE,
  tipo_evento VARCHAR(20) NOT NULL,
  estado_anterior VARCHAR(20),
  estado_nuevo VARCHAR(20),
  mensaje TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE solicitud_crm_eventos ADD CONSTRAINT solicitud_crm_eventos_tipo_check CHECK (tipo_evento IN ('cambio_estado', 'comentario'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_solicitud_crm_eventos_solicitud ON solicitud_crm_eventos(solicitud_id);
