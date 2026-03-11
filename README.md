# GanPor Mantenimiento

Sistema profesional para la gestión de mantenimiento técnico de equipos de ordeñe en tambos.

## 🚀 Configuración del Proyecto

Para configurar este proyecto en otro entorno o repositorio de GitHub, siga estos pasos:

### 1. Variables de Entorno

Cree un archivo `.env` basado en `.env.example` con sus credenciales de Supabase:

```env
VITE_SUPABASE_URL=https://su-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=su-clave-anon
```

### 2. Configuración de la Base de Datos (Supabase)

Ejecute el siguiente script SQL en el **SQL Editor** de su proyecto de Supabase para crear las tablas necesarias y cargar la configuración inicial:

```sql
-- 1. TABLA DE CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    ubicacion TEXT,
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABLA DE TAMBOS
CREATE TABLE IF NOT EXISTS tambos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
    nombre TEXT NOT NULL,
    vacas_en_ordene INTEGER DEFAULT 0,
    bajadas INTEGER DEFAULT 0,
    ordenes_por_dia INTEGER DEFAULT 2,
    marca_pezonera TEXT,
    fecha_ultimo_cambio DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABLA DE MANTENIMIENTOS
CREATE TABLE IF NOT EXISTS mantenimientos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tambo_id UUID REFERENCES tambos(id) ON DELETE CASCADE NOT NULL,
    tipo TEXT NOT NULL,
    fecha DATE NOT NULL,
    observaciones TEXT,
    foto_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABLA DE CONFIGURACIÓN
CREATE TABLE IF NOT EXISTS configuracion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clave TEXT UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. VALORES INICIALES
INSERT INTO configuracion (clave, valor, descripcion) VALUES
('pezonera_max_ordenes', '2500', 'Máximo de ordeñes para pezoneras'),
('mangueras_leche_meses', '12', 'Meses para mangueras de leche'),
('mangueras_pulsado_meses', '12', 'Meses para mangueras de pulsado'),
('pulsadores_meses', '6', 'Meses para pulsadores'),
('sogas_meses', '4', 'Meses para sogas'),
('diafragma_brazos_meses', '12', 'Meses para diafragma de brazos'),
('bujes_meses', '12', 'Meses para bujes'),
('sensor_leche_meses', '6', 'Meses para sensor de leche'),
('aceite_bomba_meses', '6', 'Meses para cambio de aceite bomba'),
('regulador_vacio_meses', '1', 'Meses para limpieza de regulador'),
('filtros_aire_meses', '3', 'Meses para filtros de aire'),
('colectores_meses', '12', 'Meses para revisión de colectores'),
('dias_alerta', '30', 'Días de antelación para alerta amarilla')
ON CONFLICT (clave) DO NOTHING;

-- 6. SEGURIDAD (Opcional: Desactivar RLS para pruebas rápidas)
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE tambos DISABLE ROW LEVEL SECURITY;
ALTER TABLE mantenimientos DISABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion DISABLE ROW LEVEL SECURITY;
```

### 3. Instalación y Ejecución

```bash
# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npm run dev

# Construir para producción
npm run build
```

## 🛠 Tecnologías

- **Frontend:** React + TypeScript + Tailwind CSS
- **Iconos:** Lucide React
- **Base de Datos:** Supabase (PostgreSQL)
- **Despliegue:** Vercel / Cloud Run

## 📋 Funcionalidades

- Gestión de Clientes y Tambos.
- Registro de mantenimientos técnicos.
- Sistema de alertas por semáforo (Verde, Amarillo, Rojo).
- Panel de configuración editable para constantes técnicas.
- Generación de reportes técnicos.
