-- Buzones de correo propios de cada despacho. Los emails a sus vecinos
-- (convocatorias, actas, accesos) salen desde su propia cuenta por SMTP,
-- no desde VotifAI. Un despacho puede tener varios buzones por área
-- (convocatorias@, administracion@...): `areas` dice qué emails salen de
-- cada uno y el `principal` cubre las áreas sin buzón asignado.
-- La contraseña se guarda cifrada (AES-256-GCM, clave CORREOS_CLAVE_CIFRADO).
CREATE TABLE IF NOT EXISTS correos_despacho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  etiqueta VARCHAR(80) NOT NULL,
  email VARCHAR(320) NOT NULL,
  nombre_remitente VARCHAR(160) NOT NULL,
  proveedor VARCHAR(30) NOT NULL DEFAULT 'otro',
  smtp_host VARCHAR(255) NOT NULL,
  smtp_puerto INTEGER NOT NULL,
  smtp_seguro BOOLEAN NOT NULL DEFAULT true,
  smtp_usuario VARCHAR(320) NOT NULL,
  smtp_password_cifrada TEXT NOT NULL,
  areas TEXT[] NOT NULL DEFAULT '{}',
  principal BOOLEAN NOT NULL DEFAULT false,
  verificado_en TIMESTAMPTZ,
  ultimo_error TEXT,
  ultimo_error_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS correos_despacho_tenant_idx ON correos_despacho (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS correos_despacho_email_unico ON correos_despacho (tenant_id, LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS correos_despacho_un_principal ON correos_despacho (tenant_id) WHERE principal;
