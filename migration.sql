-- 1) CATÁLOGO DE PEZONERAS
CREATE TABLE IF NOT EXISTS pezoneras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT UNIQUE NOT NULL,
    marca TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2) TABLA TAMBOS (MEJORADA)
ALTER TABLE tambos ADD COLUMN IF NOT EXISTS pezonera_id UUID REFERENCES pezoneras(id);
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

-- 4) RELACIÓN TAMBO - COMPONENTES
CREATE TABLE IF NOT EXISTS tambo_componentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tambo_id UUID REFERENCES tambos(id) ON DELETE CASCADE,
    componente_id UUID REFERENCES componentes(id) ON DELETE CASCADE,
    cantidad_manual INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5) TABLA INSUMOS (CATÁLOGO)
CREATE TABLE IF NOT EXISTS insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT UNIQUE NOT NULL,
  tipo TEXT NOT NULL,
  usa_brazos BOOLEAN DEFAULT false,
  cantidad_por_brazo INTEGER DEFAULT 0,
  usa_cantidad_manual BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6) RELACIÓN TAMBO - INSUMOS
CREATE TABLE IF NOT EXISTS tambo_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tambo_id UUID REFERENCES tambos(id) ON DELETE CASCADE,
  insumo_id UUID REFERENCES insumos(id) ON DELETE CASCADE,
  cantidad_manual INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7) FICHA TÉCNICA (MEJORADA)
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS tipo_equipo TEXT;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS tipo_bomba_vacio TEXT;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS tipo_bomba_leche TEXT;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE ficha_tecnica ADD COLUMN IF NOT EXISTS datos_extra JSONB DEFAULT '{}';

-- 8) RLS (PERMISIVO)
ALTER TABLE pezoneras ENABLE ROW LEVEL SECURITY;
ALTER TABLE componentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tambo_componentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tambo_insumos ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir todo pezoneras') THEN
        CREATE POLICY "Permitir todo pezoneras" ON pezoneras FOR ALL USING (true) WITH CHECK (true);
    END IF;
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

-- 9) SEED DATA
INSERT INTO pezoneras (nombre, marca) VALUES 
('Pezonera Estándar', 'Genérica'),
('Pezonera Silicona', 'Delaval'),
('Pezonera Caucho', 'Westfalia')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO componentes (nombre, tipo, usa_bajadas, cantidad_por_bajada, usa_cantidad_manual) VALUES 
('Pezoneras', 'Insumo', true, 4, false),
('Kit colector', 'Insumo', true, 1, false),
('Mangueras', 'Insumo', true, 1, false),
('Sogas', 'Insumo', true, 1, false),
('Bujes', 'Insumo', true, 1, false),
('Diafragma', 'Insumo', true, 1, false),
('Pulsadores', 'Equipo', false, 0, true)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO insumos (nombre, tipo, usa_brazos, cantidad_por_brazo) VALUES
('Pezoneras', 'consumible', true, 2),
('Pulsadores', 'equipo', true, 1),
('Kit colector de leche', 'repuesto', true, 1),
('Mangueras de leche', 'repuesto', true, 1),
('Sogas', 'repuesto', true, 1),
('Bujes', 'repuesto', true, 1),
('Diafragma de brazos', 'repuesto', true, 1)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO tipos_mantenimiento (nombre, frecuencia_meses, descripcion) VALUES 
('Cambio de Pezoneras', 6, 'Reemplazo preventivo de pezoneras'),
('Service Pulsadores', 12, 'Mantenimiento anual de pulsadores'),
('Cambio de Aceite Bomba', 3, 'Mantenimiento de bomba de vacío')
ON CONFLICT (nombre) DO NOTHING;
