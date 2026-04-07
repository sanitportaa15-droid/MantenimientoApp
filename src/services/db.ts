import { supabase } from "./supabase";
import { Cliente, Tambo, Mantenimiento, Configuracion, Database, Reclamo, TipoReparacion, TipoMantenimiento, PrioridadReclamo, EstadoReclamo, ReclamoEstado, Insumo, FichaTecnica, Componente, Pezonera, TamboComponente } from "../types/supabase";

export const db = {
  clientes: {
    async getAll() {
      const { data, error } = await supabase.from("clientes").select("*").order("nombre");
      if (error) {
        console.error("Error al obtener clientes:", error);
        throw error;
      }
      return data as Cliente[];
    },
    async getById(id: string) {
      const { data, error } = await supabase.from("clientes").select("*").eq("id", id).single();
      if (error) {
        console.error("Error al obtener cliente por ID:", error);
        throw error;
      }
      return data as Cliente;
    },
    async create(cliente: Database['public']['Tables']['clientes']['Insert']) {
      const { data, error } = await (supabase.from("clientes") as any)
        .insert(cliente)
        .select()
        .single();
      
      if (error) {
        console.error("Error guardando cliente:", error);
        throw error;
      }
      return data as Cliente;
    },
    async delete(id: string) {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) {
        console.error("Error eliminando cliente:", error);
        throw error;
      }
    },
    async update(id: string, cliente: Partial<Database['public']['Tables']['clientes']['Update']>) {
      const { data, error } = await (supabase.from("clientes") as any)
        .update(cliente)
        .eq("id", id)
        .select()
        .single();
      
      if (error) {
        console.error("Error actualizando cliente:", error);
        throw error;
      }
      return data as Cliente;
    }
  },
  tambos: {
    async getAll() {
      const { data, error } = await (supabase.from("tambos") as any).select("*, clientes(nombre), pezoneras(nombre), tambo_componentes(id, cantidad_manual, componentes(*))").order("nombre");
      if (error) {
        console.error("Error al obtener tambos:", error);
        throw error;
      }
      return data as any[];
    },
    async getByCliente(clienteId: string) {
      const { data, error } = await (supabase.from("tambos") as any).select("*, pezoneras(nombre)").eq("cliente_id", clienteId);
      if (error) {
        console.error("Error al obtener tambos por cliente:", error);
        throw error;
      }
      return data as Tambo[];
    },
    async getById(id: string) {
      const { data, error } = await (supabase.from("tambos") as any).select("*, clientes(*), pezoneras(nombre), tambo_componentes(id, cantidad_manual, componentes(*))").eq("id", id).single();
      if (error) {
        console.error("Error al obtener tambo por ID:", error);
        throw error;
      }
      return data as any;
    },
    async create(tambo: Database['public']['Tables']['tambos']['Insert']) {
      const { data, error } = await (supabase.from("tambos") as any).insert(tambo).select().single();
      if (error) {
        console.error("Error guardando tambo:", error);
        throw error;
      }
      return data as Tambo;
    },
    async update(id: string, tambo: Partial<Database['public']['Tables']['tambos']['Update']>) {
      const { data, error } = await (supabase.from("tambos") as any)
        .update(tambo)
        .eq("id", id)
        .select()
        .single();
      
      if (error) {
        console.error("Error actualizando tambo:", error);
        throw error;
      }
      return data as Tambo;
    },
    async getMantenimientosActivos(tamboId: string): Promise<string[]> {
      const { data, error } = await (supabase.from("configuracion") as any)
        .select("valor")
        .eq("clave", `tambo_mantenimientos_${tamboId}`)
        .maybeSingle();
      
      if (error || !data) {
        const { data: allTypes } = await (supabase.from("tipos_mantenimiento") as any).select("nombre");
        return allTypes?.map((t: any) => t.nombre) || [];
      }
      try {
        return JSON.parse(data.valor);
      } catch (e) {
        const { data: allTypes } = await (supabase.from("tipos_mantenimiento") as any).select("nombre");
        return allTypes?.map((t: any) => t.nombre) || [];
      }
    },
    async setMantenimientosActivos(tamboId: string, tipos: string[]) {
      const clave = `tambo_mantenimientos_${tamboId}`;
      const valor = JSON.stringify(tipos);
      
      const { data: existing } = await (supabase.from("configuracion") as any)
        .select("id")
        .eq("clave", clave)
        .maybeSingle();
      
      if (existing) {
        await (supabase.from("configuracion") as any).update({ valor }).eq("clave", clave);
      } else {
        await (supabase.from("configuracion") as any).insert({ 
          clave, 
          valor, 
          descripcion: `Mantenimientos activos para tambo ${tamboId}` 
        });
      }
    },
    subscribeToChanges(callback: () => void) {
      const subscription = supabase
        .channel('tambos-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tambos' }, callback)
        .subscribe();
      return subscription;
    }
  },
  mantenimientos: {
    async getByTambo(tamboId: string) {
      const { data, error } = await (supabase.from("mantenimientos") as any).select("*").eq("tambo_id", tamboId).order("fecha", { ascending: false });
      if (error) {
        console.error("Error al obtener mantenimientos:", error);
        throw error;
      }
      return data as Mantenimiento[];
    },
    async getAll() {
      const { data, error } = await (supabase.from("mantenimientos") as any).select("*, tambos(nombre)").order("fecha", { ascending: false });
      if (error) {
        console.error("Error al obtener todos los mantenimientos:", error);
        throw error;
      }
      return data as any[];
    },
    async create(mantenimiento: Database['public']['Tables']['mantenimientos']['Insert']) {
      const { data, error } = await (supabase.from("mantenimientos") as any).insert(mantenimiento).select().single();
      if (error) {
        console.error("Error guardando mantenimiento:", error);
        throw error;
      }
      return data as Mantenimiento;
    },
    async createMany(mantenimientos: Database['public']['Tables']['mantenimientos']['Insert'][]) {
      const { data, error } = await (supabase.from("mantenimientos") as any).insert(mantenimientos).select();
      if (error) {
        console.error("Error guardando múltiples mantenimientos:", error);
        throw error;
      }
      return data as Mantenimiento[];
    },
    async update(id: string, mantenimiento: Partial<Database['public']['Tables']['mantenimientos']['Update']>) {
      const { data, error } = await (supabase.from("mantenimientos") as any)
        .update(mantenimiento)
        .eq("id", id)
        .select()
        .single();
      
      if (error) {
        console.error("Error actualizando mantenimiento:", error);
        throw error;
      }
      return data as Mantenimiento;
    },
    async deleteByType(tamboId: string, tipo: string) {
      const { error } = await supabase.from("mantenimientos").delete().eq("tambo_id", tamboId).eq("tipo", tipo);
      if (error) {
        console.error("Error eliminando mantenimientos por tipo:", error);
        throw error;
      }
    },
    subscribeToChanges(callback: () => void) {
      const subscription = supabase
        .channel('mantenimientos-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mantenimientos' }, callback)
        .subscribe();
      return subscription;
    }
  },
  configuracion: {
    async getAll() {
      const { data, error } = await (supabase.from("configuracion") as any)
        .select("*")
        .not("clave", "ilike", "tambo_mantenimientos_%");
      if (error) {
        console.error("Error al obtener configuraciones:", error);
        throw error;
      }
      return data as Configuracion[];
    },
    async getAllWithHidden() {
      const { data, error } = await (supabase.from("configuracion") as any).select("*");
      if (error) {
        console.error("Error al obtener todas las configuraciones:", error);
        throw error;
      }
      return data as Configuracion[];
    },
    async update(clave: string, valor: string) {
      const { data, error } = await (supabase.from("configuracion") as any)
        .update({ valor })
        .eq("clave", clave)
        .select()
        .single();
      
      if (error) {
        console.error("Error actualizando configuración:", error);
        throw error;
      }
      return data as Configuracion;
    },
    async seed() {
      const defaultConfigs = [
        { clave: "pezonera_max_ordenes", valor: "2500", descripcion: "Máximo de ordeñes para pezoneras" },
        { clave: "mangueras_leche_meses", valor: "12", descripcion: "Meses para mangueras de leche" },
        { clave: "mangueras_pulsado_meses", valor: "12", descripcion: "Meses para mangueras de pulsado" },
        { clave: "pulsadores_meses", valor: "6", descripcion: "Meses para pulsadores" },
        { clave: "sogas_meses", valor: "4", descripcion: "Meses para sogas" },
        { clave: "diafragma_brazos_meses", valor: "12", descripcion: "Meses para diafragma de brazos" },
        { clave: "bujes_meses", valor: "12", descripcion: "Meses para bujes" },
        { clave: "sensor_leche_meses", valor: "6", descripcion: "Meses para sensor de leche" },
        { clave: "bomba_vacio_meses", valor: "12", descripcion: "Meses para bomba de vacío" },
        { clave: "bomba_centrifuga_leche_meses", valor: "6", descripcion: "Meses para bomba centrífuga de leche" },
        { clave: "bomba_diafragma_leche_meses", valor: "4", descripcion: "Meses para bomba diafragma de leche" },
        { clave: "kit_colector_leche_meses", valor: "12", descripcion: "Meses para kit de colector de leche" },
        { clave: "dias_alerta", valor: "30", descripcion: "Días de antelación para alerta amarilla" },
        { clave: "reclamo_deduccion", valor: "7", descripcion: "Puntos a restar por cada reclamo" },
        { clave: "vencido_deduccion", valor: "10", descripcion: "Puntos a restar por mantenimiento vencido" },
        { clave: "mantenimiento_adicion", valor: "3", descripcion: "Puntos a sumar por mantenimiento realizado" },
      ];
      
      const oldKeys = [
        "aceite_bomba_meses",
        "regulador_vacio_meses",
        "filtros_aire_meses",
        "colectores_meses"
      ];

      // Remove old keys
      await (supabase.from("configuracion") as any).delete().in("clave", oldKeys);
      
      const { data: existing } = await (supabase.from("configuracion") as any).select("clave");
      const existingKeys = new Set((existing as any[])?.map(c => c.clave) || []);
      
      const toInsert = defaultConfigs.filter(c => !existingKeys.has(c.clave));
      if (toInsert.length > 0) {
        const { error } = await (supabase.from("configuracion") as any).insert(toInsert);
        if (error) console.error("Error al sembrar configuraciones por defecto:", error);
      }
    },
    subscribeToChanges(callback: () => void) {
      const subscription = supabase
        .channel('configuracion-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion' }, callback)
        .subscribe();
      return subscription;
    }
  },
  reclamos: {
    async getAll(activeOnly = false) {
      let query = (supabase.from("reclamos") as any)
        .select("*, tambos(nombre, clientes(nombre))")
        .order("fecha_reclamo", { ascending: false });
      
      if (activeOnly) {
        query = query.neq("estado", ReclamoEstado.RESUELTO);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error al obtener reclamos:", error);
        throw error;
      }
      return data as any[];
    },
    async getByTambo(tamboId: string, activeOnly = false) {
      let query = (supabase.from("reclamos") as any)
        .select("*")
        .eq("tambo_id", tamboId)
        .order("fecha_reclamo", { ascending: false });
      
      if (activeOnly) {
        query = query.neq("estado", ReclamoEstado.RESUELTO);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error al obtener reclamos por tambo:", error);
        throw error;
      }
      return data as Reclamo[];
    },
    async getById(id: string) {
      const { data, error } = await (supabase.from("reclamos") as any)
        .select("*, tambos(*, clientes(*))")
        .eq("id", id)
        .single();
      if (error) {
        console.error("Error al obtener reclamo por ID:", error);
        throw error;
      }
      return data as any;
    },
    async create(reclamo: Database['public']['Tables']['reclamos']['Insert']) {
      const { data, error } = await (supabase.from("reclamos") as any)
        .insert(reclamo)
        .select()
        .single();
      if (error) {
        console.error("Error guardando reclamo:", error);
        throw error;
      }
      return data as Reclamo;
    },
    async update(id: string, reclamo: Partial<Database['public']['Tables']['reclamos']['Update']>) {
      const { data, error } = await (supabase.from("reclamos") as any)
        .update(reclamo)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        console.error("Error actualizando reclamo:", error);
        throw error;
      }
      return data as Reclamo;
    },
    async delete(id: string) {
      const { error } = await supabase.from("reclamos").delete().eq("id", id);
      if (error) {
        console.error("Error eliminando reclamo:", error);
        throw error;
      }
    },
    subscribeToChanges(callback: () => void) {
      const subscription = supabase
        .channel('reclamos-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reclamos' }, callback)
        .subscribe();
      return subscription;
    }
  },
  tipos_reparacion: {
    async getAll() {
      const { data, error } = await supabase.from("tipos_reparacion").select("*").order("nombre");
      if (error) {
        console.error("Error al obtener tipos de reparación:", error);
        throw error;
      }
      return data as TipoReparacion[];
    },
    async create(tipo: Database['public']['Tables']['tipos_reparacion']['Insert']) {
      const { data, error } = await (supabase.from("tipos_reparacion") as any).insert(tipo).select().single();
      if (error) {
        console.error("Error guardando tipo de reparación:", error);
        throw error;
      }
      return data as TipoReparacion;
    },
    async update(id: string, tipo: Partial<Database['public']['Tables']['tipos_reparacion']['Update']>) {
      const { data, error } = await (supabase.from("tipos_reparacion") as any).update(tipo).eq("id", id).select().single();
      if (error) {
        console.error("Error actualizando tipo de reparación:", error);
        throw error;
      }
      return data as TipoReparacion;
    },
    async delete(id: string) {
      const { error } = await supabase.from("tipos_reparacion").delete().eq("id", id);
      if (error) {
        console.error("Error eliminando tipo de reparación:", error);
        throw error;
      }
    },
    async seed() {
      const defaultTypes = [
        { nombre: 'Falla eléctrica', descripcion: 'Problema eléctrico en el sistema' },
        { nombre: 'Falla energética', descripcion: 'Problema relacionado con energía o tensión' },
        { nombre: 'Pérdida de vacío', descripcion: 'Caída de vacío en la línea' },
        { nombre: 'Fuga de aire', descripcion: 'Entrada de aire en el sistema' },
        { nombre: 'Problema de lavado', descripcion: 'Problema en sistema de lavado' },
        { nombre: 'Ajuste de regulador', descripcion: 'Ajuste del regulador de vacío' },
        { nombre: 'Revisión general', descripcion: 'Chequeo general del sistema' },
      ];
      
      const { data: existing } = await supabase.from("tipos_reparacion").select("nombre");
      if (existing && existing.length === 0) {
        const { error } = await (supabase.from("tipos_reparacion") as any).insert(defaultTypes);
        if (error) console.error("Error al sembrar tipos de reparación por defecto:", error);
      }
    },
    subscribeToChanges(callback: () => void) {
      const subscription = supabase
        .channel('tipos-reparacion-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tipos_reparacion' }, callback)
        .subscribe();
      return subscription;
    }
  },
  tipos_mantenimiento: {
    async getAll() {
      const { data, error } = await supabase.from("tipos_mantenimiento").select("*").order("nombre");
      if (error) {
        console.error("Error al obtener tipos de mantenimiento:", error);
        throw error;
      }
      return data as TipoMantenimiento[];
    },
    async create(tipo: Database['public']['Tables']['tipos_mantenimiento']['Insert']) {
      const { data, error } = await (supabase.from("tipos_mantenimiento") as any).insert(tipo).select().single();
      if (error) {
        console.error("Error guardando tipo de mantenimiento:", error);
        throw error;
      }
      return data as TipoMantenimiento;
    },
    async update(id: string, tipo: Partial<Database['public']['Tables']['tipos_mantenimiento']['Update']>) {
      const { data, error } = await (supabase.from("tipos_mantenimiento") as any).update(tipo).eq("id", id).select().single();
      if (error) {
        console.error("Error actualizando tipo de mantenimiento:", error);
        throw error;
      }
      return data as TipoMantenimiento;
    },
    async delete(id: string) {
      const { error } = await supabase.from("tipos_mantenimiento").delete().eq("id", id);
      if (error) {
        console.error("Error eliminando tipo de mantenimiento:", error);
        throw error;
      }
    },
    async seed() {
      const defaultTypes = [
        { nombre: "Cambio de pezoneras", frecuencia_meses: 4, descripcion: "Cambio periódico de pezoneras" },
        { nombre: "Mangueras de leche", frecuencia_meses: 12, descripcion: "Cambio de mangueras de leche" },
        { nombre: "Mangueras de pulsado", frecuencia_meses: 12, descripcion: "Cambio de mangueras de pulsado" },
        { nombre: "Pulsadores", frecuencia_meses: 6, descripcion: "Mantenimiento de pulsadores" },
        { nombre: "Cambio de sogas", frecuencia_meses: 4, descripcion: "Cambio de sogas de retiro" },
        { nombre: "Cambio de diafragma de los brazos", frecuencia_meses: 12, descripcion: "Mantenimiento de brazos" },
        { nombre: "Cambio de bujes", frecuencia_meses: 12, descripcion: "Cambio de bujes generales" },
        { nombre: "Sensor de leche", frecuencia_meses: 6, descripcion: "Limpieza y calibración de sensores" },
        { nombre: "Bomba de vacío", frecuencia_meses: 12, descripcion: "Mantenimiento preventivo de bomba" },
        { nombre: "Bomba centrífuga de leche", frecuencia_meses: 6, descripcion: "Revisión de sellos y motor" },
        { nombre: "Bomba diafragma de leche", frecuencia_meses: 4, descripcion: "Cambio de diafragmas" },
        { nombre: "Kit de colector de leche", frecuencia_meses: 12, descripcion: "Mantenimiento de colectores" }
      ];
      
      const { data: existing } = await supabase.from("tipos_mantenimiento").select("nombre");
      if (existing && existing.length === 0) {
        const { error } = await (supabase.from("tipos_mantenimiento") as any).insert(defaultTypes);
        if (error) console.error("Error al sembrar tipos de mantenimiento por defecto:", error);
      }
    },
    subscribeToChanges(callback: () => void) {
      const subscription = supabase
        .channel('tipos-mantenimiento-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tipos_mantenimiento' }, callback)
        .subscribe();
      return subscription;
    }
  },
  prioridades_reclamo: {
    async getAll() {
      const { data, error } = await supabase.from("prioridades_reclamo").select("*").order("nombre");
      if (error) {
        console.error("Error al obtener prioridades:", error);
        throw error;
      }
      return data as PrioridadReclamo[];
    },
    async create(prioridad: Database['public']['Tables']['prioridades_reclamo']['Insert']) {
      const { data, error } = await (supabase.from("prioridades_reclamo") as any).insert(prioridad).select().single();
      if (error) {
        console.error("Error guardando prioridad:", error);
        throw error;
      }
      return data as PrioridadReclamo;
    },
    async update(id: string, prioridad: Partial<Database['public']['Tables']['prioridades_reclamo']['Update']>) {
      const { data, error } = await (supabase.from("prioridades_reclamo") as any).update(prioridad).eq("id", id).select().single();
      if (error) {
        console.error("Error actualizando prioridad:", error);
        throw error;
      }
      return data as PrioridadReclamo;
    },
    async delete(id: string) {
      const { error } = await supabase.from("prioridades_reclamo").delete().eq("id", id);
      if (error) {
        console.error("Error eliminando prioridad:", error);
        throw error;
      }
    },
    async seed() {
      const defaults = [
        { nombre: "Baja" },
        { nombre: "Media" },
        { nombre: "Alta" },
        { nombre: "Urgente" }
      ];
      const { data: existing } = await supabase.from("prioridades_reclamo").select("nombre");
      if (existing && existing.length === 0) {
        const { error } = await (supabase.from("prioridades_reclamo") as any).insert(defaults);
        if (error) console.error("Error al sembrar prioridades por defecto:", error);
      }
    }
  },
  estados_reclamo: {
    async getAll() {
      const { data, error } = await supabase.from("estados_reclamo").select("*").order("nombre");
      if (error) {
        console.error("Error al obtener estados:", error);
        throw error;
      }
      return data as EstadoReclamo[];
    },
    async create(estado: Database['public']['Tables']['estados_reclamo']['Insert']) {
      const { data, error } = await (supabase.from("estados_reclamo") as any).insert(estado).select().single();
      if (error) {
        console.error("Error guardando estado:", error);
        throw error;
      }
      return data as EstadoReclamo;
    },
    async update(id: string, estado: Partial<Database['public']['Tables']['estados_reclamo']['Update']>) {
      const { data, error } = await (supabase.from("estados_reclamo") as any).update(estado).eq("id", id).select().single();
      if (error) {
        console.error("Error actualizando estado:", error);
        throw error;
      }
      return data as EstadoReclamo;
    },
    async delete(id: string) {
      const { error } = await supabase.from("estados_reclamo").delete().eq("id", id);
      if (error) {
        console.error("Error eliminando estado:", error);
        throw error;
      }
    },
    async seed() {
      const defaults = [
        { nombre: "Pendiente" },
        { nombre: "Programado" },
        { nombre: "En proceso" },
        { nombre: "Resuelto" }
      ];
      const { data: existing } = await supabase.from("estados_reclamo").select("nombre");
      if (existing && existing.length === 0) {
        const { error } = await (supabase.from("estados_reclamo") as any).insert(defaults);
        if (error) console.error("Error al sembrar estados por defecto:", error);
      }
    }
  },
  insumos: {
    async getAll() {
      const { data, error } = await supabase.from("insumos").select("*").order("nombre");
      if (error) {
        console.error("Error al obtener insumos:", error);
        throw error;
      }
      return data as Insumo[];
    },
    async create(insumo: Database['public']['Tables']['insumos']['Insert']) {
      const { data, error } = await (supabase.from("insumos") as any).insert(insumo).select().single();
      if (error) {
        console.error("Error guardando insumo:", error);
        throw error;
      }
      return data as Insumo;
    },
    async update(id: string, insumo: Partial<Database['public']['Tables']['insumos']['Update']>) {
      const { data, error } = await (supabase.from("insumos") as any).update(insumo).eq("id", id).select().single();
      if (error) {
        console.error("Error actualizando insumo:", error);
        throw error;
      }
      return data as Insumo;
    },
    async delete(id: string) {
      const { error } = await supabase.from("insumos").delete().eq("id", id);
      if (error) {
        console.error("Error eliminando insumo:", error);
        throw error;
      }
    },
    async seed() {
      const defaultInsumos = [
        { nombre: "Pezonera Irlanda", tipo: "Pezonera", precio_unitario: 1200 },
        { nombre: "Pezonera PZ3", tipo: "Pezonera", precio_unitario: 1000 },
        { nombre: "Pezonera Millennium", tipo: "Pezonera", precio_unitario: 1100 },
      ];
      const { data: existing } = await supabase.from("insumos").select("nombre");
      if (existing && existing.length === 0) {
        const { error } = await (supabase.from("insumos") as any).insert(defaultInsumos);
        if (error) console.error("Error al sembrar insumos por defecto:", error);
      }
    }
  },
  ficha_tecnica: {
    async getByTambo(tamboId: string) {
      const { data, error } = await (supabase.from("ficha_tecnica") as any)
        .select("*, pezoneras(nombre)")
        .eq("tambo_id", tamboId)
        .maybeSingle();
      if (error) {
        console.error("Error al obtener ficha técnica:", error);
        throw error;
      }
      return data as (FichaTecnica & { pezoneras: { nombre: string } | null }) | null;
    },
    async create(ficha: Database['public']['Tables']['ficha_tecnica']['Insert']) {
      const { data, error } = await (supabase.from("ficha_tecnica") as any)
        .insert(ficha)
        .select()
        .single();
      if (error) {
        console.error("Error guardando ficha técnica:", error);
        throw error;
      }
      return data as FichaTecnica;
    },
    async update(id: string, ficha: Partial<Database['public']['Tables']['ficha_tecnica']['Update']>) {
      const { data, error } = await (supabase.from("ficha_tecnica") as any)
        .update(ficha)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        console.error("Error actualizando ficha técnica:", error);
        throw error;
      }
      return data as FichaTecnica;
    },
    async upsert(ficha: Database['public']['Tables']['ficha_tecnica']['Insert']) {
      const { data, error } = await (supabase.from("ficha_tecnica") as any)
        .upsert(ficha)
        .select()
        .single();
      if (error) {
        console.error("Error upserting ficha técnica:", error);
        throw error;
      }
      return data as FichaTecnica;
    },
    async getAll() {
      const { data, error } = await supabase.from("ficha_tecnica").select("*, pezoneras(nombre)");
      if (error) {
        console.error("Error al obtener todas las fichas técnicas:", error);
        throw error;
      }
      return data as any[];
    }
  },
  pezoneras: {
    async getAll() {
      const { data, error } = await supabase.from("pezoneras").select("*").order("nombre");
      if (error) {
        console.error("Error al obtener pezoneras:", error);
        throw error;
      }
      return data as Pezonera[];
    },
    async create(pezonera: Database['public']['Tables']['pezoneras']['Insert']) {
      const { data, error } = await (supabase.from("pezoneras") as any).insert(pezonera).select().single();
      if (error) {
        console.error("Error guardando pezonera:", error);
        throw error;
      }
      return data as Pezonera;
    },
    async update(id: string, pezonera: Partial<Database['public']['Tables']['pezoneras']['Update']>) {
      const { data, error } = await (supabase.from("pezoneras") as any).update(pezonera).eq("id", id).select().single();
      if (error) {
        console.error("Error actualizando pezonera:", error);
        throw error;
      }
      return data as Pezonera;
    },
    async delete(id: string) {
      const { error } = await supabase.from("pezoneras").delete().eq("id", id);
      if (error) {
        console.error("Error eliminando pezonera:", error);
        throw error;
      }
    },
    async seed() {
      const defaultPezoneras = [
        { nombre: "Irlanda", marca: "Milkrite" },
        { nombre: "Millennium", marca: "Milkrite" },
        { nombre: "PZ3", marca: "Generic" },
        { nombre: "DeLaval Clover", marca: "DeLaval" },
        { nombre: "Westfalia", marca: "GEA" }
      ];
      const { data: existing } = await supabase.from("pezoneras").select("nombre");
      if (existing && existing.length === 0) {
        const { error } = await (supabase.from("pezoneras") as any).insert(defaultPezoneras);
        if (error) console.error("Error al sembrar pezoneras por defecto:", error);
      }
    }
  },
  componentes: {
    async getAll() {
      const { data, error } = await supabase.from("componentes").select("*").order("nombre");
      if (error) {
        console.error("Error al obtener componentes:", error);
        throw error;
      }
      return data as Componente[];
    },
    async create(componente: Database['public']['Tables']['componentes']['Insert']) {
      const { data, error } = await (supabase.from("componentes") as any).insert(componente).select().single();
      if (error) {
        console.error("Error guardando componente:", error);
        throw error;
      }
      return data as Componente;
    },
    async update(id: string, componente: Partial<Database['public']['Tables']['componentes']['Update']>) {
      const { data, error } = await (supabase.from("componentes") as any).update(componente).eq("id", id).select().single();
      if (error) {
        console.error("Error actualizando componente:", error);
        throw error;
      }
      return data as Componente;
    },
    async delete(id: string) {
      const { error } = await supabase.from("componentes").delete().eq("id", id);
      if (error) {
        console.error("Error eliminando componente:", error);
        throw error;
      }
    },
    async seed() {
      const defaultComponents = [
        { nombre: "Pezoneras", tipo: "Insumo", usa_bajadas: true, cantidad_por_bajada: 4, usa_cantidad_manual: false },
        { nombre: "Kit colector", tipo: "Repuesto", usa_bajadas: true, cantidad_por_bajada: 1, usa_cantidad_manual: false },
        { nombre: "Mangueras de leche", tipo: "Insumo", usa_bajadas: true, cantidad_por_bajada: 1, usa_cantidad_manual: false },
        { nombre: "Mangueras de pulsado", tipo: "Insumo", usa_bajadas: true, cantidad_por_bajada: 2, usa_cantidad_manual: false },
        { nombre: "Sogas", tipo: "Insumo", usa_bajadas: true, cantidad_por_bajada: 1, usa_cantidad_manual: false },
        { nombre: "Bujes", tipo: "Repuesto", usa_bajadas: true, cantidad_por_bajada: 2, usa_cantidad_manual: false },
        { nombre: "Diafragma", tipo: "Repuesto", usa_bajadas: true, cantidad_por_bajada: 1, usa_cantidad_manual: false },
        { nombre: "Pulsadores", tipo: "Equipo", usa_bajadas: false, cantidad_por_bajada: 0, usa_cantidad_manual: true },
        { nombre: "Bomba de vacío", tipo: "Equipo", usa_bajadas: false, cantidad_por_bajada: 0, usa_cantidad_manual: true },
        { nombre: "Bomba de leche", tipo: "Equipo", usa_bajadas: false, cantidad_por_bajada: 0, usa_cantidad_manual: true },
      ];
      
      const { data: existing } = await supabase.from("componentes").select("nombre");
      const existingNames = new Set((existing as any[])?.map(c => c.nombre) || []);
      
      const toInsert = defaultComponents.filter(c => !existingNames.has(c.nombre));
      if (toInsert.length > 0) {
        const { error } = await (supabase.from("componentes") as any).insert(toInsert);
        if (error) console.error("Error al sembrar componentes por defecto:", error);
      }
    }
  },
  tambo_componentes: {
    async getByTambo(tamboId: string) {
      const { data, error } = await (supabase.from("tambo_componentes") as any)
        .select("*, componentes(*)")
        .eq("tambo_id", tamboId);
      if (error) {
        console.error("Error al obtener componentes del tambo:", error);
        throw error;
      }
      return data as any[];
    },
    async createMany(items: Database['public']['Tables']['tambo_componentes']['Insert'][]) {
      const { data, error } = await (supabase.from("tambo_componentes") as any).insert(items).select();
      if (error) {
        console.error("Error guardando componentes del tambo:", error);
        throw error;
      }
      return data as TamboComponente[];
    },
    async deleteByTambo(tamboId: string) {
      const { error } = await supabase.from("tambo_componentes").delete().eq("tambo_id", tamboId);
      if (error) {
        console.error("Error eliminando componentes del tambo:", error);
        throw error;
      }
    }
  }
};
