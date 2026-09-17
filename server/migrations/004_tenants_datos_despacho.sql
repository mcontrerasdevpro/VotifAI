-- El registro ("Registrar mi Despacho Profesional") pedía datos de una
-- comunidad/empresa concreta en vez de datos del propio despacho. Al
-- separar ambos flujos, el despacho (tenant) necesita sus propios datos
-- de identificación y contacto, que hasta ahora no existían en el esquema.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cif VARCHAR(20);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS telefono VARCHAR(30);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nombre_responsable VARCHAR(255);
