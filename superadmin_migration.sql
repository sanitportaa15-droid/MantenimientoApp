-- ====================================================================
-- MIGRACIÓN PARA EL PORTAL MAESTRO Y SUPERADMINISTRADORES
-- ====================================================================

-- 1. Crear la tabla de superadministradores si no existe
CREATE TABLE IF NOT EXISTS super_administradores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE,
    email TEXT UNIQUE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Asegurar que existe una relación (FK) a auth.users de forma opcional (cuando se logueen)
-- Para evitar errores si se ejecuta fuera de Supabase local, se hace compatible
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'users' AND schemaname = 'auth') THEN
        ALTER TABLE super_administradores 
        DROP CONSTRAINT IF EXISTS super_administradores_user_id_fkey,
        ADD CONSTRAINT super_administradores_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Habilitar la seguridad a nivel de filas (Row Level Security - RLS)
ALTER TABLE super_administradores ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas de acceso seguras e idempotentes
DROP POLICY IF EXISTS "Permitir lectura para todos" ON super_administradores;
CREATE POLICY "Permitir lectura para todos" 
    ON super_administradores 
    FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Superusuarios tienen control total" ON super_administradores;
CREATE POLICY "Superusuarios tienen control total"
    ON super_administradores
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. AGREGAR TU PRIMER SUPERADMINISTRADOR (Ajustable por el cliente)
-- Reemplaza 'santiportaa15@gmail.com' con tu correo si es diferente
INSERT INTO super_administradores (email) 
VALUES ('santiportaa15@gmail.com') 
ON CONFLICT (email) DO NOTHING;

-- 6. Agregar columnas del estado de licenciamiento a empresa_identidad si no existen
ALTER TABLE empresa_identidad ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Activa';
ALTER TABLE empresa_identidad ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'Demo';
ALTER TABLE empresa_identidad ADD COLUMN IF NOT EXISTS fecha_inicio TIMESTAMPTZ DEFAULT now();
ALTER TABLE empresa_identidad ADD COLUMN IF NOT EXISTS fecha_vencimiento TIMESTAMPTZ;
ALTER TABLE empresa_identidad ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT true;
