-- /api/propietarios/create ya validaba "teléfono O email" (no exige ambos),
-- pero la columna email en la base real tenía NOT NULL, así que dar de
-- alta un propietario solo con teléfono fallaba con un error de base de
-- datos. Se alinea el esquema con la validación que el código ya hacía.

ALTER TABLE propietarios ALTER COLUMN email DROP NOT NULL;
