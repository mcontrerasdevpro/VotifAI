-- Agenda del despacho: calendario único a nivel de tenant (no por finca),
-- para tener visión de conjunto de juntas, vencimientos y tareas de toda
-- la cartera. Cada evento puede enlazar opcionalmente a una finca concreta.

CREATE TABLE IF NOT EXISTS agenda_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  tipo VARCHAR(20) NOT NULL DEFAULT 'otro',
  fecha DATE NOT NULL,
  hora TIME,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE agenda_eventos ADD CONSTRAINT agenda_eventos_tipo_check CHECK (tipo IN ('junta', 'vencimiento', 'tarea', 'recordatorio', 'otro'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_tenant_fecha ON agenda_eventos(tenant_id, fecha);

-- Documental avanzado: plantillas de texto reutilizables a nivel de
-- despacho (mismo patrón que proveedores) y documentos generados a partir
-- de ellas, editables in-app como texto plano/Markdown — igual que el
-- editor de actas que ya existe, sin dependencias nuevas de edición
-- enriquecida.

CREATE TABLE IF NOT EXISTS plantillas_documento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  contenido TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plantillas_documento_tenant ON plantillas_documento(tenant_id);

CREATE TABLE IF NOT EXISTS documentos_editor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  plantilla_id UUID REFERENCES plantillas_documento(id) ON DELETE SET NULL,
  titulo VARCHAR(255) NOT NULL,
  contenido TEXT NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documentos_editor_entity ON documentos_editor(entity_id);
