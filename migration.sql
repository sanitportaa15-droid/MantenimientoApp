-- 1) TABLA INSUMOS (CATÁLOGO)
CREATE TABLE IF NOT EXISTS insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT UNIQUE NOT NULL,
  tipo TEXT NOT NULL,
  usa_brazos BOOLEAN DEFAULT false,
  cantidad_por_bajada INTEGER DEFAULT 0,
  usa_cantidad_manual BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Asegurar que las columnas existen si la tabla ya fue creada previamente
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS usa_brazos BOOLEAN DEFAULT false;
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS cantidad_por_bajada INTEGER DEFAULT 0;
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS usa_cantidad_manual BOOLEAN DEFAULT false;

-- Si existía la columna vieja, migramos los datos y la eliminamos
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='insumos' AND column_name='cantidad_por_brazo') THEN
    -- Migrar datos si la nueva columna está en 0 y la vieja tiene valores
    UPDATE insumos SET cantidad_por_bajada = cantidad_por_brazo WHERE cantidad_por_bajada = 0;
    -- Eliminar la columna vieja
    ALTER TABLE insumos DROP COLUMN cantidad_por_brazo;
  END IF;
END $$;

-- 2) TABLA TAMBOS (MEJORADA)
ALTER TABLE tambos ADD COLUMN IF NOT EXISTS pezonera_id UUID REFERENCES insumos(id);
ALTER TABLE tambos ADD COLUMN IF NOT EXISTS tiene_brazos_extractores BOOLEAN DEFAULT false;

-- 3) COMPONENTES DEL EQUIPO (CATÁLOGO)
CREATE TABLE IF NOT EXISTS componentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT UNIQUE NOT NULL,
    tipo TEXT,
    usa_bajadas BOOLEAN DEFAULT false,
    cantidad_por_bajada INTEGER DEFAULT 0,
    usa_cantidad_manual BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE componentes ADD COLUMN IF NOT EXISTS usa_bajadas BOOLEAN DEFAULT false;
ALTER TABLE componentes ADD COLUMN IF NOT EXISTS cantidad_por_bajada INTEGER DEFAULT 0;
ALTER TABLE componentes ADD COLUMN IF NOT EXISTS usa_cantidad_manual BOOLEAN DEFAULT false;

DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='componentes' AND column_name='cantidad_por_brazo') THEN
    -- Migrar datos
    UPDATE componentes SET cantidad_por_bajada = cantidad_por_brazo WHERE cantidad_por_bajada = 0;
    -- Eliminar la vieja
    ALTER TABLE componentes DROP COLUMN cantidad_por_brazo;
  END IF;
END $$;

-- 4) RELACIÓN TAMBO - COMPONENTES
CREATE TABLE IF NOT EXISTS tambo_componentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tambo_id UUID REFERENCES tambos(id) ON DELETE CASCADE,
    componente_id UUID REFERENCES componentes(id) ON DELETE CASCADE,
    cantidad_manual INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5) RELACIÓN TAMBO - INSUMOS
CREATE TABLE IF NOT EXISTS tambo_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tambo_id UUID REFERENCES tambos(id) ON DELETE CASCADE,
  insumo_id UUID REFERENCES insumos(id) ON DELETE CASCADE,
  cantidad_manual INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6) FICHA TÉCNICA (MEJORADA)
ALTER TABLE ficha_tecnica DROP COLUMN IF EXISTS tipo_pezoneras;
ALTER TABLE ficha_tecnica DROP COLUMN IF EXISTS marca_pezoneras;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS tipo_equipo TEXT;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS tipo_bomba_vacio TEXT;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS tipo_bomba_leche TEXT;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS datos_extra JSONB DEFAULT '{}';

-- 7) RLS (PERMISIVO)
ALTER TABLE componentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tambo_componentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tambo_insumos ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir todo componentes') THEN
        CREATE POLICY "Permitir todo componentes" ON componentes FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir todo tambo_componentes') THEN
        CREATE POLICY "Permitir todo tambo_componentes" ON tambo_componentes FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir todo insumos') THEN
        CREATE POLICY "Permitir todo insumos" ON insumos FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir todo tambo_insumos') THEN
        CREATE POLICY "Permitir todo tambo_insumos" ON tambo_insumos FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 8) SEED DATA
INSERT INTO insumos (nombre, tipo, usa_brazos, cantidad_por_bajada) VALUES
('Pezoneras Irlanda', 'consumible', true, 4),
('Pezoneras PZ3', 'consumible', true, 4),
('Pezoneras Millennium', 'consumible', true, 4),
('Pulsadores', 'equipo', true, 1),
('Kit colector de leche', 'repuesto', true, 1),
('Mangueras de leche', 'repuesto', true, 1),
('Sogas', 'repuesto', true, 1),
('Bujes', 'repuesto', true, 1),
('Diafragma de brazos', 'repuesto', true, 1)
ON CONFLICT (nombre) DO NOTHING;

-- 9) Asegurar que ficha_tecnica tenga un índice único por tambo_id para el upsert
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ficha_tecnica_tambo_id_key') THEN
        ALTER TABLE ficha_tecnica ADD CONSTRAINT ficha_tecnica_tambo_id_key UNIQUE (tambo_id);
    END IF;
END $$;

-- 10) Campos adicionales para Ficha Técnica (Bomba de Leche y Vacío)
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS bomba_leche_marca TEXT;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS bomba_leche_tiene_sello BOOLEAN DEFAULT FALSE;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS bomba_leche_tiene_diafragma BOOLEAN DEFAULT FALSE;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS bomba_leche_tiene_turbina BOOLEAN DEFAULT FALSE;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS bomba_vacio_marca TEXT;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS bomba_vacio_polea TEXT;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS bomba_vacio_vueltas TEXT;

-- 11) Campos para Insumos Automáticos por Bajada
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS usa_sogas BOOLEAN DEFAULT FALSE;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS usa_diafragmas_brazos BOOLEAN DEFAULT FALSE;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS usa_bujes BOOLEAN DEFAULT FALSE;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS usa_colector_leche BOOLEAN DEFAULT FALSE;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS colector_marca TEXT;

-- 12) Seed data para componentes y nuevos insumos
INSERT INTO insumos (nombre, tipo, usa_brazos, cantidad_por_bajada) VALUES
('Sello bomba de leche', 'repuesto', false, 0),
('Diafragma bomba de leche', 'repuesto', false, 0),
('Turbina bomba de leche', 'repuesto', false, 0),
('Sogas', 'repuesto', false, 1),
('Diafragma de brazos', 'repuesto', true, 1),
('Bujes', 'repuesto', false, 1),
('Kit colector de leche', 'repuesto', false, 1)
ON CONFLICT (nombre) DO UPDATE SET 
  cantidad_por_bajada = EXCLUDED.cantidad_por_bajada,
  usa_brazos = EXCLUDED.usa_brazos;

INSERT INTO tipos_mantenimiento (nombre, frecuencia_meses, descripcion) VALUES 
('Cambio de Pezoneras', 6, 'Reemplazo preventivo de pezoneras'),
('Service Pulsadores', 12, 'Mantenimiento anual de pulsadores'),
('Cambio de Aceite Bomba', 3, 'Mantenimiento de bomba de vacío'),
('Service Bomba de Leche', 12, 'Mantenimiento anual de bomba de leche')
ON CONFLICT (nombre) DO NOTHING;
