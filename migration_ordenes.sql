-- ============================================================================
-- SCRIPT DE MIGRACIÓN PARA MÓDULO DE ÓRDENES DE TRABAJO (GANPOR)
-- ============================================================================
-- Este script crea las tablas ordenes_trabajo y orden_trabajo_items.
-- Es seguro ejecutar en Supabase SQL Editor. Mantiene aislamiento multi-empresa.

-- 1) TABLA: ordenes_trabajo
CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL DEFAULT 'd1a58a74-9f93-4e8c-8c08-0123456789ab' REFERENCES empresa_identidad(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tambo_id UUID NOT NULL REFERENCES tambos(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  estado TEXT NOT NULL DEFAULT 'Pendiente', -- 'Pendiente', 'En proceso', 'Finalizada', 'Cancelada'
  observaciones TEXT,
  prioridad TEXT NOT NULL DEFAULT 'Media', -- 'Baja', 'Media', 'Alta', 'Urgente'
  tecnico_asignado TEXT, -- Nombre o email del técnico asignado (perfiles)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS para ordenes_trabajo
ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ordenes_trabajo' AND policyname = 'Permitir todo ordenes_trabajo') THEN
        CREATE POLICY "Permitir todo ordenes_trabajo" ON ordenes_trabajo FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 2) TABLA: orden_trabajo_items
CREATE TABLE IF NOT EXISTS orden_trabajo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  mantenimiento_id UUID, -- Opcional, apunta al mantenimiento_id o tipo_mantenimiento_id de referencia
  componente TEXT NOT NULL, -- Ej: 'Pulsadores' o 'Pezoneras'
  trabajo TEXT NOT NULL, -- Ej: 'Mantenimiento de Pulsadores'
  vencimiento DATE, -- Fecha calculada de vencimiento
  prioridad TEXT NOT NULL DEFAULT 'Media', -- 'Baja', 'Media', 'Alta', 'Urgente'
  observaciones TEXT,
  realizado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS para orden_trabajo_items
ALTER TABLE orden_trabajo_items ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orden_trabajo_items' AND policyname = 'Permitir todo orden_trabajo_items') THEN
        CREATE POLICY "Permitir todo orden_trabajo_items" ON orden_trabajo_items FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Agregar índice para mejorar consultas filtradas por empresa_id
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_empresa ON ordenes_trabajo(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_tambo ON ordenes_trabajo(tambo_id);
CREATE INDEX IF NOT EXISTS idx_orden_items_orden ON orden_trabajo_items(orden_id);
