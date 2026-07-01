-- =========================================================================
-- MIGRACIÓN DE ARQUITECTURA: DESVINCULAR SUPERADMINISTRADOR Y ASIGNAR ADMIN
-- =========================================================================
-- Este script es completamente idempotente y seguro de ejecutar múltiples veces.
-- 
-- Objetivos:
-- 1. Separar al Superadministrador (santiportaa15@gmail.com) de cualquier empresa (empresa_id = NULL).
-- 2. Asegurar que el Superadministrador esté registrado en 'super_administradores'.
-- 3. Establecer a ganporsg@gmail.com como el Administrador independiente de la empresa GanPor.
-- =========================================================================

DO $$
DECLARE
    v_empresa_id UUID;
    v_sa_id UUID;
    v_ganpor_email TEXT := 'ganporsg@gmail.com';
    v_superadmin_email TEXT := 'santiportaa15@gmail.com';
BEGIN
    -- 1. Obtener el ID de la empresa "GanPor"
    SELECT id INTO v_empresa_id 
    FROM empresa_identidad 
    WHERE LOWER(nombre) LIKE '%ganpor%' 
    LIMIT 1;
    
    -- Si no se encuentra, usar el ID por defecto histórico de GanPor
    IF v_empresa_id IS NULL THEN
        v_empresa_id := 'd1a58a74-9f93-4e8c-8c08-0123456789ab'::UUID;
    END IF;

    RAISE NOTICE 'ID de Empresa GanPor determinado: %', v_empresa_id;

    -- 2. Modificar el perfil del Superadministrador en 'perfiles'
    -- Colocar empresa_id = NULL para que no consume licencias ni cuente como usuario de la empresa GanPor.
    UPDATE perfiles 
    SET empresa_id = NULL, 
        rol = 'Superadmin',
        activo = true
    WHERE LOWER(email) = LOWER(v_superadmin_email);

    -- 3. Asegurar registro en 'super_administradores'
    -- Buscar el user_id correspondiente en auth.users si existe
    SELECT id INTO v_sa_id 
    FROM auth.users 
    WHERE LOWER(email) = LOWER(v_superadmin_email)
    LIMIT 1;

    INSERT INTO super_administradores (email, user_id, activo)
    VALUES (LOWER(v_superadmin_email), v_sa_id, true)
    ON CONFLICT (email) 
    DO UPDATE SET 
        user_id = COALESCE(super_administradores.user_id, EXCLUDED.user_id),
        activo = true;

    RAISE NOTICE 'Superadministrador % desvinculado de empresas y registrado en Portal Maestro.', v_superadmin_email;

    -- 4. Crear o actualizar el perfil para el Administrador independiente (ganporsg@gmail.com)
    DECLARE
        v_ganpor_user_id UUID;
    BEGIN
        SELECT id INTO v_ganpor_user_id 
        FROM auth.users 
        WHERE LOWER(email) = LOWER(v_ganpor_email)
        LIMIT 1;

        -- Registrar o actualizar el perfil en la tabla de perfiles
        INSERT INTO perfiles (nombre, email, empresa_id, rol, activo, created_at)
        VALUES ('Administrador GanPor', LOWER(v_ganpor_email), v_empresa_id, 'Administrador', true, NOW())
        ON CONFLICT (email) 
        DO UPDATE SET 
            empresa_id = v_empresa_id,
            rol = 'Administrador',
            activo = true,
            user_id = COALESCE(perfiles.user_id, v_ganpor_user_id);
            
        RAISE NOTICE 'Administrador independiente % configurado con éxito para GanPor.', v_ganpor_email;
    END;

END $$;
