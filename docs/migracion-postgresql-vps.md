# Migracion de PostgreSQL a un VPS

Este procedimiento mantiene la base actual disponible hasta validar la nueva.
No cambiar `DATABASE_URL` en Render hasta completar la restauracion y las comprobaciones.

## 1. Preparar el VPS

- Crear una base y un usuario exclusivos para VotifAI.
- Actualizar PostgreSQL y habilitar backups automaticos.
- Restringir el puerto 5432 con firewall.
- Permitir acceso desde Render mediante VPN/red privada o una regla de red estrictamente limitada.
- Activar TLS. Si se usa una CA propia, conservar su certificado para `DATABASE_SSL_CA`.
- Probar una restauracion de backup antes de migrar datos reales.

## 2. Crear el backup de la base actual

Ejecutar desde un equipo con acceso a la base actual. No guardar el archivo en Git:

```powershell
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL_ACTUAL" --file votifai-pre-vps.dump
```

Verificar que el archivo existe y conservarlo en una ubicacion segura.

## 3. Restaurar en el VPS

```powershell
createdb "$DATABASE_URL_VPS"
pg_restore --no-owner --no-acl --dbname="$DATABASE_URL_VPS" votifai-pre-vps.dump
```

Si la base del VPS ya tiene objetos, restaurar primero en una base vacia para evitar mezclar esquemas.

## 4. Comprobar la copia

En la base del VPS:

```sql
SELECT COUNT(*) FROM tenants;
SELECT COUNT(*) FROM entities;
SELECT COUNT(*) FROM propietarios;
SELECT COUNT(*) FROM schema_migrations;
```

Comparar los recuentos con la base actual. Ejecutar tambien:

```powershell
cd server
pnpm migrate
```

El resultado esperado es que no haya migraciones pendientes o que solo aplique migraciones conocidas y revisadas.

## 5. Probar la conexion desde el backend

Configurar temporalmente en un entorno de staging:

```env
DATABASE_URL=postgresql://usuario:password@host-vps:5432/votifai?sslmode=require
DATABASE_SSL_REJECT_UNAUTHORIZED=true
DATABASE_SSL_CA=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
```

Si el VPS esta protegido por una VPN sin TLS publico, usar solo en esa red:

```env
DATABASE_SSL=false
```

Probar registro, login, aislamiento entre tenants, documentos, cuotas y lectura de fechas antes de cambiar produccion.

## 6. Cambiar Render

1. Mantener un backup final de la base actual.
2. Cambiar unicamente `DATABASE_URL` y las variables SSL necesarias en Render.
3. Reiniciar el servicio.
4. Ejecutar smoke tests: `/`, `/api/billing/planes`, registro controlado, login y `/api/billing/estado`.
5. Revisar logs y conexiones PostgreSQL durante al menos una hora.

## Rollback

Si falla cualquier smoke test, restaurar en Render la `DATABASE_URL` anterior y reiniciar el servicio. No borrar la base anterior hasta validar varios dias de operacion y backups del VPS.

## Checklist de cierre

- [ ] Backup actual descargado y probado.
- [ ] Restauracion del backup probada en una base vacia.
- [ ] Backups automaticos del VPS configurados.
- [ ] Restauracion de un backup del VPS probada.
- [ ] TLS/firewall/VPN comprobados.
- [ ] Migraciones al dia.
- [ ] Smoke tests ejecutados.
- [ ] Rollback documentado y posible.
