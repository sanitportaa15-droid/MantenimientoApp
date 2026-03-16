export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      clientes: {
        Row: {
          id: string
          nombre: string
          telefono: string | null
          email: string | null
          ubicacion: string | null
          observaciones: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          telefono?: string | null
          email?: string | null
          ubicacion?: string | null
          observaciones?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          telefono?: string | null
          email?: string | null
          ubicacion?: string | null
          observaciones?: string | null
          created_at?: string
        }
      }
      tambos: {
        Row: {
          id: string
          cliente_id: string
          nombre: string
          vacas_en_ordene: number
          bajadas: number
          ordenes_por_dia: number
          marca_pezonera: string | null
          fecha_ultimo_cambio: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cliente_id: string
          nombre: string
          vacas_en_ordene?: number
          bajadas?: number
          ordenes_por_dia?: number
          marca_pezonera?: string | null
          fecha_ultimo_cambio?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cliente_id?: string
          nombre?: string
          vacas_en_ordene?: number
          bajadas?: number
          ordenes_por_dia?: number
          marca_pezonera?: string | null
          fecha_ultimo_cambio?: string | null
          created_at?: string
        }
      }
      mantenimientos: {
        Row: {
          id: string
          tambo_id: string
          tipo: string
          fecha: string
          observaciones: string | null
          foto_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tambo_id: string
          tipo: string
          fecha: string
          observaciones?: string | null
          foto_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tambo_id?: string
          tipo?: string
          fecha?: string
          observaciones?: string | null
          foto_url?: string | null
          created_at?: string
        }
      }
      configuracion: {
        Row: {
          id: string
          clave: string
          valor: string
          descripcion: string | null
          created_at: string
        }
        Insert: {
          id?: string
          clave: string
          valor: string
          descripcion?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clave?: string
          valor?: string
          descripcion?: string | null
          created_at?: string
        }
      }
      reclamos: {
        Row: {
          id: string
          tambo_id: string
          titulo: string
          descripcion: string | null
          fecha_reclamo: string
          fecha_programada: string | null
          estado: ReclamoEstado
          prioridad: ReclamoPrioridad
          tipo_reparacion_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tambo_id: string
          titulo: string
          descripcion?: string | null
          fecha_reclamo?: string
          fecha_programada?: string | null
          estado?: ReclamoEstado
          prioridad?: ReclamoPrioridad
          tipo_reparacion_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tambo_id?: string
          titulo?: string
          descripcion?: string | null
          fecha_reclamo?: string
          fecha_programada?: string | null
          estado?: ReclamoEstado
          prioridad?: ReclamoPrioridad
          tipo_reparacion_id?: string | null
          created_at?: string
        }
      }
      tipos_reparacion: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          descripcion?: string | null
          created_at?: string
        }
      }
      tipos_mantenimiento: {
        Row: {
          id: string
          nombre: string
          frecuencia_meses: number | null
          descripcion: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          frecuencia_meses?: number | null
          descripcion?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          frecuencia_meses?: number | null
          descripcion?: string | null
          created_at?: string
        }
      }
      prioridades_reclamo: {
        Row: {
          id: string
          nombre: string
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          created_at?: string
        }
      }
      estados_reclamo: {
        Row: {
          id: string
          nombre: string
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          created_at?: string
        }
      }
    }
  }
}

export type Cliente = Database['public']['Tables']['clientes']['Row'];
export type Tambo = Database['public']['Tables']['tambos']['Row'];
export type Mantenimiento = Database['public']['Tables']['mantenimientos']['Row'];
export type Configuracion = Database['public']['Tables']['configuracion']['Row'];
export type Reclamo = Database['public']['Tables']['reclamos']['Row'];
export type TipoReparacion = Database['public']['Tables']['tipos_reparacion']['Row'];
export type TipoMantenimiento = Database['public']['Tables']['tipos_mantenimiento']['Row'];
export type PrioridadReclamo = Database['public']['Tables']['prioridades_reclamo']['Row'];
export type EstadoReclamo = Database['public']['Tables']['estados_reclamo']['Row'];

export enum ReclamoEstado {
  PENDIENTE = "Pendiente",
  PROGRAMADO = "Programado",
  EN_PROCESO = "En proceso",
  RESUELTO = "Resuelto"
}

export enum ReclamoPrioridad {
  BAJA = "Baja",
  MEDIA = "Media",
  ALTA = "Alta",
  URGENTE = "Urgente"
}

export interface TamboMantenimiento {
  id: string;
  tambo_id: string;
  tipo: string;
  fecha_ultimo_mantenimiento: string | null;
}
