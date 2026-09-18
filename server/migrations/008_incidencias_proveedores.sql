-- Incidencias y mantenimiento: partes de avería con timeline de estado y
-- un catálogo de proveedores compartido a nivel de despacho (un mismo
-- fontanero puede atender a varias fincas del mismo tenant).

CREATE TABLE IF NOT EXISTS proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  telefono VARCHAR(30),
  email VARCHAR(255),
  cif VARCHAR(20),
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_tenant ON proveedores(tenant_id);

CREATE TABLE IF NOT EXISTS incidencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  propietario_id UUID REFERENCES propietarios(id) ON DELETE SET NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(100) NOT NULL DEFAULT 'general',
  ubicacion VARCHAR(255),
  prioridad VARCHAR(20) NOT NULL DEFAULT 'media',
  estado VARCHAR(20) NOT NULL DEFAULT 'abierta',
  proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  coste_estimado NUMERIC(10,2),
  coste_final NUMERIC(10,2),
  fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_cierre TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE incidencias ADD CONSTRAINT incidencias_prioridad_check CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE incidencias ADD CONSTRAINT incidencias_estado_check CHECK (estado IN ('abierta', 'en_curso', 'resuelta', 'cerrada'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_incidencias_entity ON incidencias(entity_id);

-- Timeline unificado: cada cambio de estado o comentario queda como una
-- fila, en vez de tener historial y comentarios en tablas paralelas.
CREATE TABLE IF NOT EXISTS incidencia_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incidencia_id UUID NOT NULL REFERENCES incidencias(id) ON DELETE CASCADE,
  tipo_evento VARCHAR(20) NOT NULL,
  estado_anterior VARCHAR(20),
  estado_nuevo VARCHAR(20),
  mensaje TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE incidencia_eventos ADD CONSTRAINT incidencia_eventos_tipo_check CHECK (tipo_evento IN ('cambio_estado', 'comentario', 'asignacion'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_incidencia_eventos_incidencia ON incidencia_eventos(incidencia_id);
