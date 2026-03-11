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
    }
  }
}

export type Cliente = Database['public']['Tables']['clientes']['Row'];
export type Tambo = Database['public']['Tables']['tambos']['Row'];
export type Mantenimiento = Database['public']['Tables']['mantenimientos']['Row'];
export type Configuracion = Database['public']['Tables']['configuracion']['Row'];

export enum MantenimientoTipo {
  PEZONERAS = "Cambio de pezoneras",
  MANGUERAS_LECHE = "Mangueras de leche",
  MANGUERAS_PULSADO = "Mangueras de pulsado",
  PULSADORES = "Pulsadores",
  SOGAS = "Cambio de sogas",
  DIAFRAGMA_BRAZOS = "Cambio de diafragma de los brazos",
  BUJES = "Cambio de bujes",
  SENSOR_LECHE = "Sensor de leche"
}
