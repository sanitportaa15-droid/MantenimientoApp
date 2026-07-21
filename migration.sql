-- ============================================================================
-- SCRIPT DE MIGRACIÓN COMPLETO E IDEMPOTENTE PARA TRANSICIÓN MULTI-EMPRESA (SaaS)
-- ============================================================================
-- Este script es seguro para ejecutar en una base de datos existente.
-- Preserva el 100% de la información y registros existentes, asignándolos
-- automáticamente a la empresa por defecto "GanPor".
-- ============================================================================

-- 1) TABLA DE IDENTIDAD DE LA EMPRESA (SaaS-READY)
CREATE TABLE IF NOT EXISTS empresa_identidad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL DEFAULT 'GanPor',
  logo_url TEXT,
  color_principal TEXT DEFAULT '#10b981',
  color_secundario TEXT DEFAULT '#06b6d4',
  email TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  sitio_web TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS para la tabla empresa_identidad de forma segura
ALTER TABLE empresa_identidad ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'empresa_identidad' AND policyname = 'Permitir todo empresa_identidad') THEN
        CREATE POLICY "Permitir todo empresa_identidad" ON empresa_identidad FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;


-- 2) CREAR/REGISTRAR LA EMPRESA POR DEFECTO "GanPor"
-- Usamos un UUID estático y predefinido para consistencia absoluta
DO $$
DECLARE
    default_emp_id UUID := 'd1a58a74-9f93-4e8c-8c08-0123456789ab';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM empresa_identidad WHERE id = default_emp_id) THEN
        -- Si ya hay una empresa genérica (por ejecuciones previas), le asignamos nuestro ID y nombre GanPor
        IF EXISTS (SELECT 1 FROM empresa_identidad) THEN
            UPDATE empresa_identidad 
            SET id = default_emp_id, 
                nombre = 'GanPor' 
            WHERE id = (SELECT id FROM empresa_identidad LIMIT 1);
        ELSE
            -- Si la tabla estaba vacía, creamos la empresa GanPor
            INSERT INTO empresa_identidad (id, nombre, logo_url, color_principal, color_secundario, email, telefono, direccion, sitio_web)
            VALUES (default_emp_id, 'GanPor', NULL, '#10b981', '#06b6d4', '', '', '', '');
        END IF;
    ELSE
        -- Si ya existe con ese ID, nos aseguramos que se llame GanPor
        UPDATE empresa_identidad SET nombre = 'GanPor' WHERE id = default_emp_id;
    END IF;
END $$;


-- 3) MIGRACIÓN GRADUAL ADITIVA DE TODAS LAS TABLAS DE LA APLICACIÓN
-- Se agrega la columna 'empresa_id' únicamente donde falte, se migran los
-- datos existentes a "GanPor", se configuran claves foráneas, índices y defaults.
DO $$
DECLARE
    default_emp_id UUID := 'd1a58a74-9f93-4e8c-8c08-0123456789ab';
    t_name TEXT;
    fk_exists BOOLEAN;
    tables_list TEXT[] := ARRAY[
        'clientes',
        'tambos',
        'mantenimientos',
        'configuracion',
        'reclamos',
        'tipos_reparacion',
        'tipos_mantenimiento',
        'insumos',
        'tambo_insumos',
        'componentes',
        'tambo_componentes',
        'ficha_tecnica',
        'relevos',
        'prioridades_reclamo',
        'estados_reclamo',
        'lavado_configuraciones',
        'lavado_historial',
        'pezoneras'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables_list LOOP
        -- Verificar si la tabla existe en la base de datos
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t_name) THEN
            
            -- Agregar la columna 'empresa_id' si no existe
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t_name AND column_name = 'empresa_id') THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN empresa_id UUID', t_name);
            END IF;

            -- Migrar datos de forma segura (asignar GanPor a registros con empresa_id NULL)
            EXECUTE format('UPDATE %I SET empresa_id = %L WHERE empresa_id IS NULL', t_name, default_emp_id);
            
            -- Configurar default para futuras inserciones automáticas
            EXECUTE format('ALTER TABLE %I ALTER COLUMN empresa_id SET DEFAULT %L', t_name, default_emp_id);
            
            -- Configurar la columna como NOT NULL para asegurar integridad referencial
            EXECUTE format('ALTER TABLE %I ALTER COLUMN empresa_id SET NOT NULL', t_name);

            -- Crear clave foránea apuntando a empresa_identidad(id) si no existe
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.table_constraints tc 
                JOIN information_schema.key_column_usage kcu 
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' 
                  AND tc.table_name = t_name 
                  AND kcu.column_name = 'empresa_id'
            ) INTO fk_exists;

            IF NOT fk_exists THEN
                EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (empresa_id) REFERENCES empresa_identidad(id) ON DELETE CASCADE', t_name, 'fk_' || t_name || '_empresa_id');
            END IF;

            -- Crear índice para optimizar las búsquedas y filtros por empresa_id
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (empresa_id)', 'idx_' || t_name || '_empresa_id', t_name);
            
        END IF;
    END LOOP;
END $$;


-- 4) AJUSTE DE RESTRICCIONES ÚNICAS PARA QUE SEAN MULTI-EMPRESA (POR-EMPRESA)
-- Esto flexibiliza las restricciones globales viejas y crea restricciones compuestas
DO $$
BEGIN
    -- Tabla: configuracion
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuracion_clave_key') THEN
        ALTER TABLE configuracion DROP CONSTRAINT configuracion_clave_key;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuracion_clave_empresa_id_key') THEN
        ALTER TABLE configuracion ADD CONSTRAINT configuracion_clave_empresa_id_key UNIQUE (clave, empresa_id);
    END IF;

    -- Tabla: insumos
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insumos_nombre_key') THEN
        ALTER TABLE insumos DROP CONSTRAINT insumos_nombre_key;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insumos_nombre_empresa_id_key') THEN
        ALTER TABLE insumos ADD CONSTRAINT insumos_nombre_empresa_id_key UNIQUE (nombre, empresa_id);
    END IF;

    -- Tabla: componentes
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'componentes_nombre_key') THEN
        ALTER TABLE componentes DROP CONSTRAINT componentes_nombre_key;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'componentes_nombre_empresa_id_key') THEN
        ALTER TABLE componentes ADD CONSTRAINT componentes_nombre_empresa_id_key UNIQUE (nombre, empresa_id);
    END IF;

    -- Tabla: tipos_mantenimiento
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tipos_mantenimiento_nombre_key') THEN
        ALTER TABLE tipos_mantenimiento DROP CONSTRAINT tipos_mantenimiento_nombre_key;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tipos_mantenimiento_nombre_empresa_id_key') THEN
        ALTER TABLE tipos_mantenimiento ADD CONSTRAINT tipos_mantenimiento_nombre_empresa_id_key UNIQUE (nombre, empresa_id);
    END IF;
END $$;


-- 5) ASEGURAR POLÍTICAS RLS PERMISIVAS PARA LA COMPATIBILIDAD CON EL CÓDIGO ACTUAL
-- Habilitamos RLS en todas las tablas y agregamos una política general "Permitir todo"
-- para evitar errores de permisos insuficientes durante la carga del Dashboard.
DO $$
DECLARE
    t_name TEXT;
    policy_name TEXT;
    tables_list TEXT[] := ARRAY[
        'clientes',
        'tambos',
        'mantenimientos',
        'configuracion',
        'reclamos',
        'tipos_reparacion',
        'tipos_mantenimiento',
        'insumos',
        'tambo_insumos',
        'componentes',
        'tambo_componentes',
        'ficha_tecnica',
        'relevos',
        'prioridades_reclamo',
        'estados_reclamo',
        'lavado_configuraciones',
        'lavado_historial',
        'pezoneras'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables_list LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t_name) THEN
            -- Habilitar RLS en la tabla
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t_name);
            
            -- Crear política "Permitir todo" si no existe
            policy_name := 'Permitir todo ' || t_name;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t_name AND policyname = policy_name) THEN
                EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (true) WITH CHECK (true)', policy_name, t_name);
            END IF;
        END IF;
    END LOOP;
END $$;


-- 6) SEEDING O ENREQUECIMIENTO DE CONFIGURACIONES POR DEFECTO PARA NUEVA EMPRESA
-- Esto asegura que si una nueva empresa es creada, tenga las claves de configuración mínimas necesarias.
INSERT INTO configuracion (clave, valor, descripcion, empresa_id) VALUES
('pezoneras_meses', '6', 'Frecuencia recomendada de cambio de pezoneras en meses', 'd1a58a74-9f93-4e8c-8c08-0123456789ab'),
('pulsadores_meses', '12', 'Frecuencia recomendada de servicio de pulsadores en meses', 'd1a58a74-9f93-4e8c-8c08-0123456789ab'),
('colectores_meses', '12', 'Frecuencia recomendada de servicio de colectores de leche en meses', 'd1a58a74-9f93-4e8c-8c08-0123456789ab')
ON CONFLICT (clave, empresa_id) DO NOTHING;


-- 7) REFRESCAR CACHÉ DE POSTGREST (OBLIGATORIO PARA SUPABASE / POSTGREST)
-- Esto notifica a PostgREST que vuelva a cargar el esquema de la base de datos
-- permitiendo que las nuevas columnas e índices estén disponibles de forma inmediata.
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- FASE 2: GESTIÓN DE USUARIOS POR EMPRESA Y ROLES
-- ============================================================================

-- 8) TABLA DE PERFILES DE USUARIO
CREATE TABLE IF NOT EXISTS perfiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE, -- Vinculado a auth.users(id) cuando se registran
  empresa_id UUID DEFAULT 'd1a58a74-9f93-4e8c-8c08-0123456789ab' REFERENCES empresa_identidad(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  rol TEXT NOT NULL DEFAULT 'Solo lectura' CHECK (rol IN ('Superadmin', 'Administrador', 'Supervisor', 'Técnico', 'Solo lectura')),
  activo BOOLEAN NOT NULL DEFAULT true,
  ultimo_acceso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asegurar que la columna ultimo_acceso exista en tablas creadas previamente
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ;

-- Habilitar RLS para la tabla perfiles de forma segura
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'perfiles' AND policyname = 'Permitir todo perfiles') THEN
        CREATE POLICY "Permitir todo perfiles" ON perfiles FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 9) TRIGGER AUTOMÁTICO DE REGISTRO DE USUARIOS PARA VINCULACIÓN CON LA EMPRESA EXISTENTE
-- Este trigger intercepta la creación de cualquier usuario nuevo en auth.users de Supabase
-- y lo vincula automáticamente con la empresa "GanPor" existente (o la primera empresa registrada),
-- asignándole el rol de Administrador de manera segura, idempotente y sin duplicar perfiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    default_emp_id UUID;
    existing_profile_id UUID;
BEGIN
    -- A) Obtener el ID de la empresa GanPor existente o la primera que se encuentre
    SELECT id INTO default_emp_id 
    FROM public.empresa_identidad 
    WHERE nombre ILIKE '%ganpor%' 
    LIMIT 1;

    IF default_emp_id IS NULL THEN
        SELECT id INTO default_emp_id 
        FROM public.empresa_identidad 
        ORDER BY created_at ASC 
        LIMIT 1;
    END IF;

    -- Si de forma extraordinaria no hay ninguna empresa, usar el ID por defecto y crearla
    IF default_emp_id IS NULL THEN
        default_emp_id := 'd1a58a74-9f93-4e8c-8c08-0123456789ab';
        INSERT INTO public.empresa_identidad (id, nombre)
        VALUES (default_emp_id, 'GanPor')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- B) Evitar duplicación: verificar si ya existe un perfil creado con ese correo electrónico
    SELECT id INTO existing_profile_id 
    FROM public.perfiles 
    WHERE email = new.email;

    IF existing_profile_id IS NOT NULL THEN
        -- Si ya existe un perfil con ese email, lo asociamos al nuevo ID de autenticación y asignamos Administrador
        UPDATE public.perfiles 
        SET user_id = new.id,
            rol = 'Administrador',
            activo = true
        WHERE id = existing_profile_id;
    ELSE
        -- Si no existe, creamos el perfil del primer administrador vinculado a la empresa existente
        INSERT INTO public.perfiles (user_id, empresa_id, nombre, email, rol, activo)
        VALUES (
            new.id,
            default_emp_id,
            COALESCE(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
            new.email,
            'Administrador',
            true
        )
        ON CONFLICT (user_id) DO UPDATE 
        SET email = EXCLUDED.email,
            rol = 'Administrador';
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreación del trigger de forma segura e idempotente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 10) VINCULACIÓN MANUAL INMEDIATA DE USUARIOS EXISTENTES
-- Si el usuario ya fue registrado previamente en auth.users antes de correr este script,
-- este bloque anónimo lo asocia inmediatamente con la empresa GanPor y le asigna el rol Administrador.
DO $$
DECLARE
    target_user_id UUID;
    default_emp_id UUID;
    existing_profile_id UUID;
    user_email TEXT := 'santiportaa15@gmail.com'; -- Email del administrador
BEGIN
    -- 1. Buscar si el usuario ya existe en auth.users de Supabase
    SELECT id INTO target_user_id FROM auth.users WHERE email = user_email LIMIT 1;
    
    -- 2. Buscar la empresa GanPor existente
    SELECT id INTO default_emp_id FROM public.empresa_identidad WHERE nombre ILIKE '%ganpor%' LIMIT 1;
    IF default_emp_id IS NULL THEN
        SELECT id INTO default_emp_id FROM public.empresa_identidad ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- 3. Si encontramos al usuario y la empresa, realizar la vinculación o actualización
    IF target_user_id IS NOT NULL AND default_emp_id IS NOT NULL THEN
        -- Buscar si el perfil ya existe por email
        SELECT id INTO existing_profile_id FROM public.perfiles WHERE email = user_email;
        
        IF existing_profile_id IS NOT NULL THEN
            UPDATE public.perfiles 
            SET user_id = target_user_id,
                empresa_id = default_emp_id,
                rol = 'Administrador',
                activo = true
            WHERE id = existing_profile_id;
        ELSE
            -- Buscar si el perfil ya existe por user_id
            SELECT id INTO existing_profile_id FROM public.perfiles WHERE user_id = target_user_id;
            
            IF existing_profile_id IS NOT NULL THEN
                UPDATE public.perfiles 
                SET email = user_email,
                    empresa_id = default_emp_id,
                    rol = 'Administrador',
                    activo = true
                WHERE id = existing_profile_id;
            ELSE
                -- Si no existe ningún perfil para el usuario, se crea uno nuevo
                INSERT INTO public.perfiles (user_id, empresa_id, nombre, email, rol, activo)
                VALUES (target_user_id, default_emp_id, 'Administrador', user_email, 'Administrador', true);
            END IF;
        END IF;
    END IF;
END $$;


-- Volver a refrescar caché para registrar la nueva tabla perfiles y cambios
NOTIFY pgrst, 'reload schema';
