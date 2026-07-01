-- ============================================================================
-- SCRIPT DE MIGRACIÓN PARA CONTROL DE LICENCIAS DE EMPRESA Y SUPERADMINISTRADOR
-- ============================================================================
-- Este script es seguro para ejecutar en una base de datos existente.
-- Agrega columnas de licenciamiento a 'empresa_identidad' y actualiza roles de 'perfiles'.
-- ============================================================================

-- 1) AGREGAR COLUMNAS DE LICENCIAMIENTO A LA TABLA empresa_identidad
ALTER TABLE empresa_identidad ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Activa' CHECK (estado IN ('Activa', 'Demo', 'Suspendida', 'Cancelada'));
ALTER TABLE empresa_identidad ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'Básico';
ALTER TABLE empresa_identidad ADD COLUMN IF NOT EXISTS fecha_inicio TIMESTAMPTZ DEFAULT now();
ALTER TABLE empresa_identidad ADD COLUMN IF NOT EXISTS fecha_vencimiento TIMESTAMPTZ;
ALTER TABLE empresa_identidad ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true;

-- Asegurar valores predeterminados para los registros existentes de empresas
UPDATE empresa_identidad SET estado = 'Activa' WHERE estado IS NULL;
UPDATE empresa_identidad SET plan = 'Básico' WHERE plan IS NULL;
UPDATE empresa_identidad SET fecha_inicio = now() WHERE fecha_inicio IS NULL;
UPDATE empresa_identidad SET activa = true WHERE activa IS NULL;

-- 2) ACTUALIZAR RESTRICCIÓN DE ROLES EN LA TABLA perfiles PARA ADMITIR 'Superadmin'
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Buscar el nombre de la restricción CHECK que valida los roles en la tabla 'perfiles'
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'perfiles'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%rol%';

    -- Si se encuentra la restricción, la eliminamos de forma dinámica
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE perfiles DROP CONSTRAINT %I', constraint_name);
    END IF;

    -- Agregar la nueva restricción CHECK que incluye 'Superadmin'
    ALTER TABLE perfiles ADD CONSTRAINT perfiles_rol_check CHECK (rol IN ('Superadmin', 'Administrador', 'Supervisor', 'Técnico', 'Solo lectura'));
END $$;

-- Permitir que empresa_id sea nullable para que el Superadministrador no tenga que pertenecer a una empresa
ALTER TABLE perfiles ALTER COLUMN empresa_id DROP NOT NULL;

-- 3) AGREGAR COLUMNA DE ÚLTIMO ACCESO A LA TABLA perfiles
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ;

-- 4) REFRESCAR CACHÉ DE POSTGREST (OBLIGATORIO PARA SUPABASE)
NOTIFY pgrst, 'reload schema';
