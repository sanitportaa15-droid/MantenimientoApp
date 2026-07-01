import { supabase } from "./supabase";
import { Cliente, Tambo, Mantenimiento, Configuracion, Database, Reclamo, TipoReparacion, TipoMantenimiento, PrioridadReclamo, EstadoReclamo, ReclamoEstado, Insumo, FichaTecnica, Componente, TamboComponente, TamboInsumo, LavadoConfiguracion, LavadoHistorial, EmpresaIdentidad, Perfil } from "../types/supabase";


export function normalizeMaintenanceName(name: string): string {
  if (!name) return "";
  const normalized = name.trim().toLowerCase();
  
  if (normalized.includes("pezonera")) {
    return "Cambio de pezoneras";
  }
  if (normalized.includes("diafragma") && normalized.includes("brazo")) {
    return "Cambio de diafragma de los brazos";
  }
  if (normalized.includes("diafragma de los brazos")) {
    return "Cambio de diafragma de los brazos";
  }
  if (normalized.includes("aceite bomba") || (normalized.includes("bomba") && normalized.includes("vacío")) || (normalized.includes("bomba") && normalized.includes("vacio"))) {
    return "Bomba de vacío";
  }
  if (normalized.includes("centrífuga") || normalized.includes("centrifuga") || normalized.includes("service bomba de leche")) {
    return "Bomba centrífuga de leche";
  }
  if (normalized.includes("pulsador") && (normalized.includes("service") || normalized.includes("mantenimiento") || normalized.includes("pulsadores"))) {
    return "Pulsadores";
  }
  if (normalized === "pulsador" || normalized === "pulsadores") {
    return "Pulsadores";
  }
  if (normalized.includes("colector")) {
    return "Kit de colector de leche";
  }
  if (normalized.includes("soga")) {
    return "Cambio de sogas";
  }
  if (normalized.includes("buje")) {
    return "Cambio de bujes";
  }
  if (normalized.includes("sensor")) {
    return "Sensor de leche";
  }
  if (normalized.includes("diafragma") && normalized.includes("bomba")) {
    return "Bomba diafragma de leche";
  }
  if (normalized.includes("caucho")) {
    return "Caucho línea de leche y lavado";
  }

  const cleanMaintKeys: Record<string, string> = {
    "cambio de pezoneras": "Cambio de pezoneras",
    "mangueras de leche": "Mangueras de leche",
    "mangueras de pulsado": "Mangueras de pulsado",
    "pulsadores": "Pulsadores",
    "cambio de sogas": "Cambio de sogas",
    "cambio de diafragma de los brazos": "Cambio de diafragma de los brazos",
    "cambio de bujes": "Cambio de bujes",
    "sensor de leche": "Sensor de leche",
    "bomba de vacío": "Bomba de vacío",
    "bomba centrífuga de leche": "Bomba centrífuga de leche",
    "bomba diafragma de leche": "Bomba diafragma de leche",
    "kit de colector de leche": "Kit de colector de leche",
    "caucho línea de leche y lavado": "Caucho línea de leche y lavado"
  };

  return cleanMaintKeys[normalized] || name.trim();
}

let activeCompanyId: string | null = null;
let activeUserRole: string | null = null;

export function setActiveCompanyId(id: string) {
  console.log("Paso 26: setActiveCompanyId llamado con id:", id);
  activeCompanyId = id;
}

export function getActiveCompanyId(): string {
  const id = activeCompanyId || "d1a58a74-9f93-4e8c-8c08-0123456789ab";
  console.log("Paso 26b: getActiveCompanyId llamado. Retornando:", id);
  return id;
}

export function setActiveUserRole(role: string) {
  console.log("Paso 27: setActiveUserRole llamado con role:", role);
  activeUserRole = role;
}

export function getActiveUserRole(): string {
  const role = activeUserRole || "Solo lectura";
  console.log("Paso 27b: getActiveUserRole llamado. Retornando:", role);
  return role;
}

export function checkWritePermission() {
  const role = getActiveUserRole();
  if (role === "Solo lectura") {
    throw new Error("Permiso denegado: Su cuenta tiene rol de 'Solo lectura' y no tiene permisos de modificación.");
  }
}

export function checkDeletePermission() {
  const role = getActiveUserRole();
  if (role === "Solo lectura" || role === "Técnico") {
    throw new Error("Permiso denegado: Su cuenta no tiene permisos para eliminar registros.");
  }
}

export const db = {
  clientes: {
    async getAll() {
      const { data, error } = await supabase.from("clientes")
        .select("*")
        .eq("empresa_id", getActiveCompanyId())
        .order("nombre");
      if (error) {
        console.error("Error al obtener clientes:", error);
        throw error;
      }
      return data as Cliente[];
    },
    async getById(id: string) {
      const { data, error } = await supabase.from("clientes")
        .select("*")
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId())
        .single();
      if (error) {
        console.error("Error al obtener cliente por ID:", error);
        throw error;
      }
      return data as Cliente;
    },
    async create(cliente: Database['public']['Tables']['clientes']['Insert']) {
      const { data, error } = await (supabase.from("clientes") as any)
        .insert({ ...cliente, empresa_id: getActiveCompanyId() })
        .select()
        .single();
      
      if (error) {
        console.error("Error guardando cliente:", error);
        throw error;
      }
      return data as Cliente;
    },
    async delete(id: string) {
      const { error } = await supabase.from("clientes")
        .delete()
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId());
      if (error) {
        console.error("Error eliminando cliente:", error);
        throw error;
      }
    },
    async update(id: string, cliente: Partial<Database['public']['Tables']['clientes']['Update']>) {
      const { data, error } = await (supabase.from("clientes") as any)
        .update(cliente)
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId())
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
      const { data, error } = await (supabase.from("tambos") as any)
        .select("*, clientes(nombre), ficha_tecnica(*), insumos:pezonera_id(*)")
        .eq("empresa_id", getActiveCompanyId())
        .order("nombre");
      if (error) {
        console.error("Error al obtener tambos:", error);
        throw error;
      }
      return data as any[];
    },
    async getByCliente(clienteId: string) {
      const { data, error } = await (supabase.from("tambos") as any)
        .select("*")
        .eq("cliente_id", clienteId)
        .eq("empresa_id", getActiveCompanyId());
      if (error) {
        console.error("Error al obtener tambos por cliente:", error);
        throw error;
      }
      return data as Tambo[];
    },
    async getById(id: string) {
      const { data, error } = await (supabase.from("tambos") as any)
        .select("*, clientes(*), ficha_tecnica(*), insumos:pezonera_id(*)")
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId())
        .single();
      if (error) {
        console.error("Error al obtener tambo por ID:", error);
        throw error;
      }
      return data as (Tambo & { clientes: Cliente, ficha_tecnica: FichaTecnica | null, insumos: Insumo | null });
    },
    async create(tambo: Database['public']['Tables']['tambos']['Insert']) {
      const { data, error } = await (supabase.from("tambos") as any)
        .insert({ ...tambo, empresa_id: getActiveCompanyId() })
        .select()
        .single();
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
        .eq("empresa_id", getActiveCompanyId())
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
        .eq("empresa_id", getActiveCompanyId())
        .maybeSingle();
      
      const defaultMaintNames = [
        "Bomba centrífuga de leche",
        "Bomba de vacío",
        "Bomba diafragma de leche",
        "Cambio de bujes",
        "Cambio de diafragma de los brazos",
        "Cambio de pezoneras",
        "Cambio de sogas",
        "Caucho línea de leche y lavado",
        "Kit de colector de leche",
        "Mangueras de leche",
        "Mangueras de pulsado",
        "Pulsadores",
        "Sensor de leche"
      ];

      if (error || !data) {
        return defaultMaintNames;
      }
      try {
        const parsed = JSON.parse(data.valor);
        if (Array.isArray(parsed)) {
          const mapped = parsed.map(normalizeMaintenanceName);
          return Array.from(new Set(mapped));
        }
        return defaultMaintNames;
      } catch (e) {
        return defaultMaintNames;
      }
    },
    async setMantenimientosActivos(tamboId: string, tipos: string[]) {
      const clave = `tambo_mantenimientos_${tamboId}`;
      const valor = JSON.stringify(tipos);
      const activeEmpId = getActiveCompanyId();
      
      const { data: existing } = await (supabase.from("configuracion") as any)
        .select("id")
        .eq("clave", clave)
        .eq("empresa_id", activeEmpId)
        .maybeSingle();
      
      if (existing) {
        await (supabase.from("configuracion") as any)
          .update({ valor })
          .eq("clave", clave)
          .eq("empresa_id", activeEmpId);
      } else {
        await (supabase.from("configuracion") as any).insert({ 
          clave, 
          valor, 
          descripcion: `Mantenimientos activos para tambo ${tamboId}`,
          empresa_id: activeEmpId
        });
      }
    },
    async delete(id: string) {
      const activeEmpId = getActiveCompanyId();
      // 1. Delete associated configuracion (e.g., custom active maintenance keys)
      try {
        const key = `tambo_mantenimientos_${id}`;
        await supabase.from("configuracion")
          .delete()
          .eq("clave", key)
          .eq("empresa_id", activeEmpId);
      } catch (e) {
        console.warn("Error deleting tambo maintenance configuracion:", e);
      }

      // 2. Delete from ficha_tecnica
      try {
        await supabase.from("ficha_tecnica")
          .delete()
          .eq("tambo_id", id)
          .eq("empresa_id", activeEmpId);
      } catch (e) {
        console.warn("Error deleting ficha_tecnica for tambo:", e);
      }

      // 3. Delete from tambo_insumos
      try {
        await supabase.from("tambo_insumos")
          .delete()
          .eq("tambo_id", id)
          .eq("empresa_id", activeEmpId);
      } catch (e) {
        console.warn("Error deleting tambo_insumos for tambo:", e);
      }

      // 4. Delete from tambo_componentes
      try {
        await supabase.from("tambo_componentes")
          .delete()
          .eq("tambo_id", id)
          .eq("empresa_id", activeEmpId);
      } catch (e) {
        console.warn("Error deleting tambo_componentes for tambo:", e);
      }

      // 5. Delete from lavado_configuraciones (local and supabase)
      try {
        await supabase.from("lavado_configuraciones")
          .delete()
          .eq("tambo_id", id)
          .eq("empresa_id", activeEmpId);
      } catch (e) {
        console.warn("Error deleting lavado_configuraciones for tambo:", e);
      }
      try {
        const locals = getLocalConfigs();
        const filtered = locals.filter(c => c.tambo_id !== id);
        saveLocalConfigs(filtered);
      } catch (e) {
        console.warn("Error deleting local lavado_configuraciones for tambo:", e);
      }

      // 6. Delete from lavado_historial (local and supabase)
      try {
        await supabase.from("lavado_historial")
          .delete()
          .eq("tambo_id", id)
          .eq("empresa_id", activeEmpId);
      } catch (e) {
        console.warn("Error deleting lavado_historial for tambo:", e);
      }
      try {
        const locals = getLocalHistorial();
        const filtered = locals.filter(h => h.tambo_id !== id);
        saveLocalHistorial(filtered);
      } catch (e) {
        console.warn("Error deleting local lavado_historial for tambo:", e);
      }

      // 7. Delete from reclamos
      try {
        await supabase.from("reclamos")
          .delete()
          .eq("tambo_id", id)
          .eq("empresa_id", activeEmpId);
      } catch (e) {
        console.warn("Error deleting reclamos for tambo:", e);
      }

      // 8. Delete from mantenimientos
      try {
        await supabase.from("mantenimientos")
          .delete()
          .eq("tambo_id", id)
          .eq("empresa_id", activeEmpId);
      } catch (e) {
        console.warn("Error deleting mantenimientos for tambo:", e);
      }

      // 9. Delete the tambo itself
      const { error } = await supabase.from("tambos")
        .delete()
        .eq("id", id)
        .eq("empresa_id", activeEmpId);
      if (error) {
        console.error("Error al eliminar el tambo:", error);
        throw error;
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
      const { data, error } = await (supabase.from("mantenimientos") as any)
        .select("*")
        .eq("tambo_id", tamboId)
        .eq("empresa_id", getActiveCompanyId())
        .order("fecha", { ascending: false });
      if (error) {
        console.error("Error al obtener mantenimientos:", error);
        throw error;
      }
      if (!data) return [];
      return data.map((m: any) => ({
        ...m,
        tipo: m.tipo ? normalizeMaintenanceName(m.tipo) : null
      })) as Mantenimiento[];
    },
    async getAll() {
      const { data, error } = await (supabase.from("mantenimientos") as any)
        .select("*, tambos(nombre)")
        .eq("empresa_id", getActiveCompanyId())
        .order("fecha", { ascending: false });
      if (error) {
        console.error("Error al obtener todos los mantenimientos:", error);
        throw error;
      }
      if (!data) return [];
      return data.map((m: any) => ({
        ...m,
        tipo: m.tipo ? normalizeMaintenanceName(m.tipo) : null
      })) as any[];
    },
    async create(mantenimiento: Database['public']['Tables']['mantenimientos']['Insert']) {
      const normalizedMantenimiento = {
        ...mantenimiento,
        tipo: mantenimiento.tipo ? normalizeMaintenanceName(mantenimiento.tipo) : mantenimiento.tipo,
        empresa_id: getActiveCompanyId()
      };
      const { data, error } = await (supabase.from("mantenimientos") as any).insert(normalizedMantenimiento).select().single();
      if (error) {
        console.error("Error guardando mantenimiento:", error);
        throw error;
      }
      return {
        ...data,
        tipo: data.tipo ? normalizeMaintenanceName(data.tipo) : null
      } as Mantenimiento;
    },
    async createMany(mantenimientos: Database['public']['Tables']['mantenimientos']['Insert'][]) {
      const activeEmpId = getActiveCompanyId();
      const normalizedMantenimientos = mantenimientos.map(m => ({
        ...m,
        tipo: m.tipo ? normalizeMaintenanceName(m.tipo) : m.tipo,
        empresa_id: activeEmpId
      }));
      const { data, error } = await (supabase.from("mantenimientos") as any).insert(normalizedMantenimientos).select();
      if (error) {
        console.error("Error guardando múltiples mantenimientos:", error);
        throw error;
      }
      if (!data) return [];
      return data.map((m: any) => ({
        ...m,
        tipo: m.tipo ? normalizeMaintenanceName(m.tipo) : null
      })) as Mantenimiento[];
    },
    async update(id: string, mantenimiento: Partial<Database['public']['Tables']['mantenimientos']['Update']>) {
      const normalizedUpdate = {
        ...mantenimiento,
        tipo: mantenimiento.tipo ? normalizeMaintenanceName(mantenimiento.tipo) : mantenimiento.tipo
      };
      const { data, error } = await (supabase.from("mantenimientos") as any)
        .update(normalizedUpdate)
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId())
        .select()
        .single();
      
      if (error) {
        console.error("Error actualizando mantenimiento:", error);
        throw error;
      }
      return {
        ...data,
        tipo: data.tipo ? normalizeMaintenanceName(data.tipo) : null
      } as Mantenimiento;
    },
    async deleteByType(tamboId: string, tipo: string) {
      const cleanTipo = normalizeMaintenanceName(tipo);
      const { error } = await supabase.from("mantenimientos")
        .delete()
        .eq("tambo_id", tamboId)
        .eq("empresa_id", getActiveCompanyId())
        .or(`tipo.eq."${tipo}",tipo.eq."${cleanTipo}"`);
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
        .eq("empresa_id", getActiveCompanyId())
        .not("clave", "ilike", "tambo_mantenimientos_%");
      if (error) {
        console.error("Error al obtener configuraciones:", error);
        throw error;
      }
      return data as Configuracion[];
    },
    async getAllWithHidden() {
      const { data, error } = await (supabase.from("configuracion") as any)
        .select("*")
        .eq("empresa_id", getActiveCompanyId());
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
        .eq("empresa_id", getActiveCompanyId())
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
        { clave: "pezonera_max_ordenes", valor: "1200", descripcion: "Máximo de ordeñes para pezoneras" },
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
        { clave: "caucho_linea_leche_y_lavado_meses", valor: "12", descripcion: "Meses para caucho línea de leche y lavado" },
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

      const activeEmpId = getActiveCompanyId();
      // Remove old keys
      await (supabase.from("configuracion") as any)
        .delete()
        .eq("empresa_id", activeEmpId)
        .in("clave", oldKeys);
      
      const configsWithEmpresa = defaultConfigs.map(c => ({ ...c, empresa_id: activeEmpId }));
      const { error } = await (supabase.from("configuracion") as any).upsert(
        configsWithEmpresa,
        { onConflict: 'clave,empresa_id', ignoreDuplicates: true }
      );
      if (error) console.error("Error al sembrar configuraciones por defecto:", error);
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
        .eq("empresa_id", getActiveCompanyId())
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
        .eq("empresa_id", getActiveCompanyId())
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
        .eq("empresa_id", getActiveCompanyId())
        .single();
      if (error) {
        console.error("Error al obtener reclamo por ID:", error);
        throw error;
      }
      return data as any;
    },
    async create(reclamo: Database['public']['Tables']['reclamos']['Insert']) {
      const { data, error } = await (supabase.from("reclamos") as any)
        .insert({ ...reclamo, empresa_id: getActiveCompanyId() })
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
        .eq("empresa_id", getActiveCompanyId())
        .select()
        .single();
      if (error) {
        console.error("Error actualizando reclamo:", error);
        throw error;
      }
      return data as Reclamo;
    },
    async delete(id: string) {
      const { error } = await supabase.from("reclamos")
        .delete()
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId());
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
      const { data, error } = await supabase.from("tipos_reparacion")
        .select("*")
        .eq("empresa_id", getActiveCompanyId())
        .order("nombre");
      if (error) {
        console.error("Error al obtener tipos de reparación:", error);
        throw error;
      }
      return data as TipoReparacion[];
    },
    async create(tipo: Database['public']['Tables']['tipos_reparacion']['Insert']) {
      const { data, error } = await (supabase.from("tipos_reparacion") as any)
        .insert({ ...tipo, empresa_id: getActiveCompanyId() })
        .select()
        .single();
      if (error) {
        console.error("Error guardando tipo de reparación:", error);
        throw error;
      }
      return data as TipoReparacion;
    },
    async update(id: string, tipo: Partial<Database['public']['Tables']['tipos_reparacion']['Update']>) {
      const { data, error } = await (supabase.from("tipos_reparacion") as any)
        .update(tipo)
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId())
        .select()
        .single();
      if (error) {
        console.error("Error actualizando tipo de reparación:", error);
        throw error;
      }
      return data as TipoReparacion;
    },
    async delete(id: string) {
      const { error } = await supabase.from("tipos_reparacion")
        .delete()
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId());
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
      
      const activeEmpId = getActiveCompanyId();
      const { data: existing } = await supabase.from("tipos_reparacion")
        .select("nombre")
        .eq("empresa_id", activeEmpId);
      if (existing && existing.length === 0) {
        const typesWithEmpresa = defaultTypes.map(t => ({ ...t, empresa_id: activeEmpId }));
        const { error } = await (supabase.from("tipos_reparacion") as any).insert(typesWithEmpresa);
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
      const { data, error } = await supabase.from("tipos_mantenimiento")
        .select("*")
        .eq("empresa_id", getActiveCompanyId())
        .order("nombre");
      if (error) {
        console.error("Error al obtener tipos de mantenimiento:", error);
        throw error;
      }
      
      const baseList: TipoMantenimiento[] = [
        { id: "tm-pezoneras", nombre: "Cambio de pezoneras", frecuencia_meses: 4, descripcion: "Cambio periódico de pezoneras", created_at: "" },
        { id: "tm-mangueras-leche", nombre: "Mangueras de leche", frecuencia_meses: 12, descripcion: "Cambio de mangueras de leche", created_at: "" },
        { id: "tm-mangueras-pulsado", nombre: "Mangueras de pulsado", frecuencia_meses: 12, descripcion: "Cambio de mangueras de pulsado", created_at: "" },
        { id: "tm-pulsadores", nombre: "Pulsadores", frecuencia_meses: 6, descripcion: "Mantenimiento de pulsadores", created_at: "" },
        { id: "tm-sogas", nombre: "Cambio de sogas", frecuencia_meses: 4, descripcion: "Cambio de sogas de retiro", created_at: "" },
        { id: "tm-diafragmas", nombre: "Cambio de diafragma de los brazos", frecuencia_meses: 12, descripcion: "Mantenimiento de brazos", created_at: "" },
        { id: "tm-bujes", nombre: "Cambio de bujes", frecuencia_meses: 12, descripcion: "Cambio de bujes generales", created_at: "" },
        { id: "tm-sensor", nombre: "Sensor de leche", frecuencia_meses: 6, descripcion: "Limpieza y calibración de sensores", created_at: "" },
        { id: "tm-vacio", nombre: "Bomba de vacío", frecuencia_meses: 12, descripcion: "Mantenimiento preventivo de bomba", created_at: "" },
        { id: "tm-centrifuga", nombre: "Bomba centrífuga de leche", frecuencia_meses: 6, descripcion: "Revisión de sellos y motor", created_at: "" },
        { id: "tm-diafragma-leche", nombre: "Bomba diafragma de leche", frecuencia_meses: 4, descripcion: "Cambio de diafragmas", created_at: "" },
        { id: "tm-colector", nombre: "Kit de colector de leche", frecuencia_meses: 12, descripcion: "Mantenimiento de colectores", created_at: "" },
        { id: "tm-linea-lavado", nombre: "Caucho línea de leche y lavado", frecuencia_meses: 12, descripcion: "Reemplazo de gomas de línea de leche y lavado", created_at: "" }
      ] as TipoMantenimiento[];

      const existingNamesLower = new Set(baseList.map(b => b.nombre.toLowerCase().trim()));

      if (data && data.length > 0) {
        data.forEach((item: any) => {
          const canonicalName = normalizeMaintenanceName(item.nombre);
          const canonicalLower = canonicalName.toLowerCase().trim();
          
          if (!existingNamesLower.has(canonicalLower)) {
            baseList.push(item as TipoMantenimiento);
            existingNamesLower.add(canonicalLower);
          } else {
            const idx = baseList.findIndex(b => b.nombre.toLowerCase().trim() === canonicalLower);
            if (idx !== -1) {
              baseList[idx].frecuencia_meses = item.frecuencia_meses ?? baseList[idx].frecuencia_meses;
              baseList[idx].descripcion = item.descripcion ?? baseList[idx].descripcion;
            }
          }
        });
      }

      baseList.sort((a, b) => a.nombre.localeCompare(b.nombre));
      return baseList;
    },
    async create(tipo: Database['public']['Tables']['tipos_mantenimiento']['Insert']) {
      const { data, error } = await (supabase.from("tipos_mantenimiento") as any)
        .insert({ ...tipo, empresa_id: getActiveCompanyId() })
        .select()
        .single();
      if (error) {
        console.error("Error guardando tipo de mantenimiento:", error);
        throw error;
      }
      return data as TipoMantenimiento;
    },
    async update(id: string, tipo: Partial<Database['public']['Tables']['tipos_mantenimiento']['Update']>) {
      const { data, error } = await (supabase.from("tipos_mantenimiento") as any)
        .update(tipo)
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId())
        .select()
        .single();
      if (error) {
        console.error("Error actualizando tipo de mantenimiento:", error);
        throw error;
      }
      return data as TipoMantenimiento;
    },
    async delete(id: string) {
      const { error } = await supabase.from("tipos_mantenimiento")
        .delete()
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId());
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
      
      const activeEmpId = getActiveCompanyId();
      const { data: existing } = await supabase.from("tipos_mantenimiento")
        .select("nombre")
        .eq("empresa_id", activeEmpId);
      if (existing && existing.length === 0) {
        const typesWithEmpresa = defaultTypes.map(t => ({ ...t, empresa_id: activeEmpId }));
        const { error } = await (supabase.from("tipos_mantenimiento") as any).insert(typesWithEmpresa);
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
      const { data, error } = await supabase.from("prioridades_reclamo")
        .select("*")
        .eq("empresa_id", getActiveCompanyId())
        .order("nombre");
      if (error) {
        console.error("Error al obtener prioridades:", error);
        throw error;
      }
      return data as PrioridadReclamo[];
    },
    async create(prioridad: Database['public']['Tables']['prioridades_reclamo']['Insert']) {
      const { data, error } = await (supabase.from("prioridades_reclamo") as any)
        .insert({ ...prioridad, empresa_id: getActiveCompanyId() })
        .select()
        .single();
      if (error) {
        console.error("Error guardando prioridad:", error);
        throw error;
      }
      return data as PrioridadReclamo;
    },
    async update(id: string, prioridad: Partial<Database['public']['Tables']['prioridades_reclamo']['Update']>) {
      const { data, error } = await (supabase.from("prioridades_reclamo") as any)
        .update(prioridad)
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId())
        .select()
        .single();
      if (error) {
        console.error("Error actualizando prioridad:", error);
        throw error;
      }
      return data as PrioridadReclamo;
    },
    async delete(id: string) {
      const { error } = await supabase.from("prioridades_reclamo")
        .delete()
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId());
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
      const activeEmpId = getActiveCompanyId();
      const { data: existing } = await supabase.from("prioridades_reclamo")
        .select("nombre")
        .eq("empresa_id", activeEmpId);
      if (existing && existing.length === 0) {
        const prioritiesWithEmpresa = defaults.map(p => ({ ...p, empresa_id: activeEmpId }));
        const { error } = await (supabase.from("prioridades_reclamo") as any).insert(prioritiesWithEmpresa);
        if (error) console.error("Error al sembrar prioridades por defecto:", error);
      }
    }
  },
  estados_reclamo: {
    async getAll() {
      const { data, error } = await supabase.from("estados_reclamo")
        .select("*")
        .eq("empresa_id", getActiveCompanyId())
        .order("nombre");
      if (error) {
        console.error("Error al obtener estados:", error);
        throw error;
      }
      return data as EstadoReclamo[];
    },
    async create(estado: Database['public']['Tables']['estados_reclamo']['Insert']) {
      const { data, error } = await (supabase.from("estados_reclamo") as any)
        .insert({ ...estado, empresa_id: getActiveCompanyId() })
        .select()
        .single();
      if (error) {
        console.error("Error guardando estado:", error);
        throw error;
      }
      return data as EstadoReclamo;
    },
    async update(id: string, estado: Partial<Database['public']['Tables']['estados_reclamo']['Update']>) {
      const { data, error } = await (supabase.from("estados_reclamo") as any)
        .update(estado)
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId())
        .select()
        .single();
      if (error) {
        console.error("Error actualizando estado:", error);
        throw error;
      }
      return data as EstadoReclamo;
    },
    async delete(id: string) {
      const { error } = await supabase.from("estados_reclamo")
        .delete()
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId());
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
      const activeEmpId = getActiveCompanyId();
      const { data: existing } = await supabase.from("estados_reclamo")
        .select("nombre")
        .eq("empresa_id", activeEmpId);
      if (existing && existing.length === 0) {
        const statesWithEmpresa = defaults.map(e => ({ ...e, empresa_id: activeEmpId }));
        const { error } = await (supabase.from("estados_reclamo") as any).insert(statesWithEmpresa);
        if (error) console.error("Error al sembrar estados por defecto:", error);
      }
    }
  },
  insumos: {
    async getAll() {
      const { data, error } = await supabase.from("insumos")
        .select("*")
        .eq("empresa_id", getActiveCompanyId())
        .order("nombre");
      if (error) {
        console.error("Error al obtener insumos:", error);
        throw error;
      }
      return data as Insumo[];
    },
    async getPezoneras() {
      const { data, error } = await supabase.from("insumos")
        .select("*")
        .eq("tipo", "consumible")
        .eq("empresa_id", getActiveCompanyId())
        .order("nombre");
      
      if (error) {
        console.error("Error al obtener pezoneras de insumos:", error);
        throw error;
      }
      
      // Filter out duplicates by name in JS to be safe, though we should clean DB
      const unique = data.reduce((acc: Insumo[], current: Insumo) => {
        const x = acc.find(item => item.nombre.toLowerCase() === current.nombre.toLowerCase());
        if (!x) {
          return acc.concat([current]);
        } else {
          return acc;
        }
      }, []);

      return unique;
    },
    async create(insumo: Database['public']['Tables']['insumos']['Insert']) {
      const { data, error } = await (supabase.from("insumos") as any)
        .insert({ ...insumo, empresa_id: getActiveCompanyId() })
        .select()
        .single();
      if (error) {
        console.error("Error guardando insumo:", error);
        throw error;
      }
      return data as Insumo;
    },
    async update(id: string, insumo: Partial<Database['public']['Tables']['insumos']['Update']>) {
      const { data, error } = await (supabase.from("insumos") as any)
        .update(insumo)
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId())
        .select()
        .single();
      if (error) {
        console.error("Error actualizando insumo:", error);
        throw error;
      }
      return data as Insumo;
    },
    async delete(id: string) {
      const { error } = await supabase.from("insumos")
        .delete()
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId());
      if (error) {
        console.error("Error eliminando insumo:", error);
        throw error;
      }
    },
    async seed() {
      const defaultInsumos = [
        { nombre: "Pezoneras Irlanda", tipo: "consumible", usa_brazos: true, cantidad_por_bajada: 4 },
        { nombre: "Pezoneras PZ3", tipo: "consumible", usa_brazos: true, cantidad_por_bajada: 4 },
        { nombre: "Pezoneras Millennium", tipo: "consumible", usa_brazos: true, cantidad_por_bajada: 4 },
        { nombre: "Pulsadores", tipo: "equipo", usa_brazos: true, cantidad_por_bajada: 1 },
        { nombre: "Kit colector de leche", tipo: "repuesto", usa_brazos: true, cantidad_por_bajada: 1 },
        { nombre: "Mangueras de leche", tipo: "repuesto", usa_brazos: true, cantidad_por_bajada: 1 },
        { nombre: "Sogas", tipo: "repuesto", usa_brazos: true, cantidad_por_bajada: 1 },
        { nombre: "Bujes", tipo: "repuesto", usa_brazos: true, cantidad_por_bajada: 1 },
        { nombre: "Diafragma de brazos", tipo: "repuesto", usa_brazos: true, cantidad_por_bajada: 1 }
      ];
      const activeEmpId = getActiveCompanyId();
      const { data: existing } = await supabase.from("insumos")
        .select("nombre")
        .eq("empresa_id", activeEmpId);
      if (existing && existing.length === 0) {
        const insumosWithEmpresa = defaultInsumos.map(i => ({ ...i, empresa_id: activeEmpId }));
        const { error } = await (supabase.from("insumos") as any).insert(insumosWithEmpresa);
        if (error) console.error("Error al sembrar insumos por defecto:", error);
      }
    },
    async migratePezoneras() {
      try {
        // Check if pezoneras table exists first
        const { error: tableCheckError } = await supabase.from("pezoneras").select("id").limit(1);
        if (tableCheckError && tableCheckError.message.includes("does not exist")) {
          console.log("Tabla pezoneras no existe, saltando migración");
          return;
        }

        const activeEmpId = getActiveCompanyId();

        // 1. Get all from pezoneras table
        const { data: oldPezoneras } = await supabase.from("pezoneras").select("*");
        if (!oldPezoneras || oldPezoneras.length === 0) return;

        // 2. Insert into insumos if not exists
        for (const p of (oldPezoneras as any[])) {
          const nombre = p.nombre.startsWith("Pezonera") ? p.nombre : `Pezonera ${p.nombre}`;
          const { data: existing } = await supabase.from("insumos")
            .select("id")
            .eq("nombre", nombre)
            .eq("empresa_id", activeEmpId)
            .maybeSingle();
          
          if (!existing) {
            await (supabase.from("insumos") as any).insert({
              nombre,
              tipo: "consumible",
              usa_brazos: true,
              cantidad_por_bajada: 4,
              empresa_id: activeEmpId
            });
          }
        }

        // 3. Update tambos pezonera_id to point to insumos
        const { data: tambos } = await supabase.from("tambos")
          .select("id, pezonera_id")
          .eq("empresa_id", activeEmpId);
        if (tambos) {
          for (const t of (tambos as any[])) {
            if (t.pezonera_id) {
              // Find the old pezonera name
              const { data: oldP } = await supabase.from("pezoneras").select("nombre").eq("id", t.pezonera_id).maybeSingle();
              if (oldP) {
                const nombre = (oldP as any).nombre.startsWith("Pezonera") ? (oldP as any).nombre : `Pezonera ${(oldP as any).nombre}`;
                const { data: newI } = await supabase.from("insumos")
                  .select("id")
                  .eq("nombre", nombre)
                  .eq("empresa_id", activeEmpId)
                  .maybeSingle();
                if (newI) {
                  await (supabase.from("tambos") as any)
                    .update({ pezonera_id: (newI as any).id })
                    .eq("id", t.id)
                    .eq("empresa_id", activeEmpId);
                }
              }
            }
          }
        }
        console.log("Migración de pezoneras completada");
      } catch (e) {
        console.error("Error en migración:", e);
      }
    }
  },
  tambo_insumos: {
    async getByTambo(tamboId: string) {
      const { data, error } = await supabase.from("tambo_insumos")
        .select("*, insumos(*)")
        .eq("tambo_id", tamboId)
        .eq("empresa_id", getActiveCompanyId());
      if (error) {
        console.error("Error al obtener insumos del tambo:", error);
        throw error;
      }
      return data as (TamboInsumo & { insumos: Insumo })[];
    },
    async createMany(tamboInsumos: Database['public']['Tables']['tambo_insumos']['Insert'][]) {
      const activeEmpId = getActiveCompanyId();
      const mapped = tamboInsumos.map(item => ({ ...item, empresa_id: activeEmpId }));
      const { data, error } = await (supabase.from("tambo_insumos") as any).insert(mapped).select();
      if (error) {
        console.error("Error guardando insumos del tambo:", error);
        throw error;
      }
      return data as TamboInsumo[];
    },
    async deleteByTambo(tamboId: string) {
      const { error } = await supabase.from("tambo_insumos")
        .delete()
        .eq("tambo_id", tamboId)
        .eq("empresa_id", getActiveCompanyId());
      if (error) {
        console.error("Error eliminando insumos del tambo:", error);
        throw error;
      }
    }
  },
  ficha_tecnica: {
    async getByTambo(tamboId: string) {
      const { data, error } = await (supabase.from("ficha_tecnica") as any)
        .select("*")
        .eq("tambo_id", tamboId)
        .eq("empresa_id", getActiveCompanyId())
        .maybeSingle();
      if (error) {
        console.error("Error al obtener ficha técnica:", error);
        throw error;
      }
      return data as FichaTecnica | null;
    },
    async create(ficha: Database['public']['Tables']['ficha_tecnica']['Insert']) {
      try {
        const activeEmpId = getActiveCompanyId();
        const { data: existing } = await supabase.from("ficha_tecnica")
          .select("*")
          .eq("tambo_id", ficha.tambo_id)
          .eq("empresa_id", activeEmpId)
          .maybeSingle();
        
        if (existing) {
          return existing as FichaTecnica;
        }

        const fichaWithEmp = { ...ficha, empresa_id: activeEmpId };
        const { data, error } = await (supabase.from("ficha_tecnica") as any)
          .insert(fichaWithEmp)
          .select()
          .single();
        if (error) {
          // If insert failed due to concurrent race, retry as upsert
          const { data: upsertData, error: upsertError } = await (supabase.from("ficha_tecnica") as any)
            .upsert(fichaWithEmp, { onConflict: "tambo_id" })
            .select()
            .single();
          if (upsertError) throw upsertError;
          return upsertData as FichaTecnica;
        }
        return data as FichaTecnica;
      } catch (err) {
        console.error("Error guardando ficha técnica con blindaje 409:", err);
        throw err;
      }
    },
    async update(id: string, ficha: Partial<Database['public']['Tables']['ficha_tecnica']['Update']>) {
      const { data, error } = await (supabase.from("ficha_tecnica") as any)
        .update(ficha)
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId())
        .select()
        .single();
      if (error) {
        console.error("Error actualizando ficha técnica:", error);
        throw error;
      }
      return data as FichaTecnica;
    },
    async upsert(ficha: Database['public']['Tables']['ficha_tecnica']['Insert']) {
      const fichaWithEmp = { ...ficha, empresa_id: getActiveCompanyId() };
      const { data, error } = await (supabase.from("ficha_tecnica") as any)
        .upsert(fichaWithEmp, { onConflict: "tambo_id" })
        .select()
        .single();
      if (error) {
        console.error("Error upserting ficha técnica:", error);
        throw error;
      }
      return data as FichaTecnica;
    },
    async getAll() {
      const { data, error } = await supabase.from("ficha_tecnica")
        .select("*")
        .eq("empresa_id", getActiveCompanyId());
      if (error) {
        console.error("Error al obtener todas las fichas técnicas:", error);
        throw error;
      }
      return data as FichaTecnica[];
    }
  },
  componentes: {
    async getAll() {
      const { data, error } = await supabase.from("componentes")
        .select("*")
        .eq("empresa_id", getActiveCompanyId())
        .order("nombre");
      if (error) {
        console.error("Error al obtener catálogo de componentes:", error);
        throw error;
      }
      return data as Componente[];
    },
    async create(componente: Database['public']['Tables']['componentes']['Insert']) {
      const { data, error } = await (supabase.from("componentes") as any)
        .insert({ ...componente, empresa_id: getActiveCompanyId() })
        .select()
        .single();
      if (error) {
        console.error("Error guardando componente en catálogo:", error);
        throw error;
      }
      return data as Componente;
    },
    async delete(id: string) {
      const { error } = await supabase.from("componentes")
        .delete()
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId());
      if (error) {
        console.error("Error eliminando componente del catálogo:", error);
        throw error;
      }
    }
  },
  tambo_componentes: {
    async getAll() {
      const { data, error } = await supabase.from("tambo_componentes")
        .select("*, componentes(*)")
        .eq("empresa_id", getActiveCompanyId());
      if (error) {
        console.error("Error al obtener todos los componentes de tambos:", error);
        throw error;
      }
      return data as (TamboComponente & { componentes: Componente })[];
    },
    async getByTambo(tamboId: string) {
      const { data, error } = await supabase.from("tambo_componentes")
        .select("*, componentes(*)")
        .eq("tambo_id", tamboId)
        .eq("empresa_id", getActiveCompanyId());
      if (error) {
        console.error("Error al obtener componentes del tambo:", error);
        throw error;
      }
      return data as (TamboComponente & { componentes: Componente })[];
    },
    async createMany(tamboComponentes: Database['public']['Tables']['tambo_componentes']['Insert'][]) {
      const activeEmpId = getActiveCompanyId();
      const mapped = tamboComponentes.map(item => ({ ...item, empresa_id: activeEmpId }));
      const { data, error } = await (supabase.from("tambo_componentes") as any).insert(mapped).select();
      if (error) {
        console.error("Error guardando componentes del tambo:", error);
        throw error;
      }
      return data as TamboComponente[];
    },
    async deleteByTambo(tamboId: string) {
      const { error } = await supabase.from("tambo_componentes")
        .delete()
        .eq("tambo_id", tamboId)
        .eq("empresa_id", getActiveCompanyId());
      if (error) {
        console.error("Error eliminando componentes del tambo:", error);
        throw error;
      }
    }
  },
  // Keep old componentes for backward compatibility if needed, but we should migrate
  old_componentes: {
    async getByTambo(tamboId: string) {
      const { data, error } = await supabase.from("componentes")
        .select("*")
        .eq("tambo_id", tamboId)
        .eq("empresa_id", getActiveCompanyId());
      if (error) {
        console.error("Error al obtener componentes:", error);
        throw error;
      }
      return data as any[];
    },
    async createMany(componentes: any[]) {
      const activeEmpId = getActiveCompanyId();
      const mapped = componentes.map(item => ({ ...item, empresa_id: activeEmpId }));
      const { data, error } = await (supabase.from("componentes") as any).insert(mapped).select();
      if (error) {
        console.error("Error guardando componentes:", error);
        throw error;
      }
      return data as any[];
    },
    async deleteByTambo(tamboId: string) {
      const { error } = await supabase.from("componentes")
        .delete()
        .eq("tambo_id", tamboId)
        .eq("empresa_id", getActiveCompanyId());
      if (error) {
        console.error("Error eliminando componentes:", error);
        throw error;
      }
    },
    async deleteById(id: string) {
      const { error } = await supabase.from("componentes")
        .delete()
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId());
      if (error) {
        console.error("Error eliminando componente:", error);
        throw error;
      }
    },
    async getAll() {
      const { data, error } = await supabase.from("componentes")
        .select("*")
        .eq("empresa_id", getActiveCompanyId());
      if (error) {
        console.error("Error al obtener todos los componentes:", error);
        throw error;
      }
      return data as any[];
    }
  },
  lavado_configuraciones: {
    async getAll() {
      try {
        const { data, error } = await supabase.from("lavado_configuraciones")
          .select("*")
          .eq("empresa_id", getActiveCompanyId());
        if (error) throw error;
        return data as LavadoConfiguracion[];
      } catch (err) {
        console.warn("Error o Tabla de lavado_configuraciones ausente en Supabase. Usando Local Storage como respaldo.", err);
        return getLocalConfigs();
      }
    },
    async getByTambo(tamboId: string) {
      try {
        const { data, error } = await supabase.from("lavado_configuraciones")
          .select("*")
          .eq("tambo_id", tamboId)
          .eq("empresa_id", getActiveCompanyId())
          .maybeSingle();
        if (error) throw error;
        if (data) return data as LavadoConfiguracion;
        
        const locals = getLocalConfigs();
        return locals.find(c => c.tambo_id === tamboId) || null;
      } catch (err) {
        console.warn("Utilizando Local Storage para búsqueda por tambo.", err);
        const locals = getLocalConfigs();
        return locals.find(c => c.tambo_id === tamboId) || null;
      }
    },
    async create(config: Omit<LavadoConfiguracion, 'id' | 'created_at'>) {
      try {
        const activeEmpId = getActiveCompanyId();
        const { data: existing } = await supabase.from("lavado_configuraciones")
          .select("*")
          .eq("tambo_id", config.tambo_id)
          .eq("empresa_id", activeEmpId)
          .maybeSingle();

        if (existing) {
          const { data, error } = await (supabase.from("lavado_configuraciones") as any)
            .update(config)
            .eq("id", (existing as any).id)
            .eq("empresa_id", activeEmpId)
            .select()
            .single();
          if (error) throw error;
          return data as LavadoConfiguracion;
        }

        const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36));
        const createdAt = new Date().toISOString();
        const newConfigRecord = { id: newId, created_at: createdAt, ...config, empresa_id: activeEmpId };

        const { data, error } = await (supabase.from("lavado_configuraciones") as any)
          .insert(newConfigRecord)
          .select()
          .single();
        if (error) throw error;
        return data as LavadoConfiguracion;
      } catch (err) {
        console.warn("Utilizando Local Storage para inserción/actualización de lavado_configuraciones.", err);
        const locals = getLocalConfigs();
        const existingLocalIndex = locals.findIndex(c => c.tambo_id === config.tambo_id);
        
        if (existingLocalIndex !== -1) {
          locals[existingLocalIndex] = { ...locals[existingLocalIndex], ...config };
          saveLocalConfigs(locals);
          return locals[existingLocalIndex] as LavadoConfiguracion;
        }

        const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36));
        const createdAt = new Date().toISOString();
        const newConfigRecord = { id: newId, created_at: createdAt, ...config };
        locals.push(newConfigRecord);
        saveLocalConfigs(locals);
        return newConfigRecord as LavadoConfiguracion;
      }
    },
    async update(id: string, config: Partial<Omit<LavadoConfiguracion, 'id' | 'created_at'>>) {
      try {
        const { data, error } = await (supabase.from("lavado_configuraciones") as any)
          .update(config)
          .eq("id", id)
          .eq("empresa_id", getActiveCompanyId())
          .select()
          .single();
        if (error) throw error;
        return data as LavadoConfiguracion;
      } catch (err) {
        console.warn("Utilizando Local Storage para actualización de lavado_configuraciones.", err);
        const locals = getLocalConfigs();
        const index = locals.findIndex(c => c.id === id);
        if (index !== -1) {
          locals[index] = { ...locals[index], ...config };
          saveLocalConfigs(locals);
          return locals[index] as LavadoConfiguracion;
        }
        throw new Error("Configuración no encontrada para actualizar.");
      }
    },
    async delete(id: string) {
      try {
        const { error } = await supabase.from("lavado_configuraciones")
          .delete()
          .eq("id", id)
          .eq("empresa_id", getActiveCompanyId());
        if (error) throw error;
      } catch (err) {
        console.warn("Utilizando Local Storage para eliminación de lavado_configuraciones.", err);
        const locals = getLocalConfigs();
        const filtered = locals.filter(c => c.id !== id);
        saveLocalConfigs(filtered);
      }
    }
  },
  lavado_historial: {
    async getAll() {
      try {
        const { data, error } = await supabase.from("lavado_historial")
          .select("*")
          .eq("empresa_id", getActiveCompanyId())
          .order("fecha", { ascending: false });
        if (error) throw error;
        return data as LavadoHistorial[];
      } catch (err) {
        console.warn("Error o Tabla de lavado_historial ausente en Supabase. Usando Local Storage como respaldo.", err);
        const locals = getLocalHistorial();
        return locals.sort((a,b) => b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora));
      }
    },
    async create(hist: Omit<LavadoHistorial, 'id' | 'created_at'>) {
      const activeEmpId = getActiveCompanyId();
      const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36));
      const createdAt = new Date().toISOString();
      const newHistRecord = { id: newId, created_at: createdAt, ...hist, empresa_id: activeEmpId };
      try {
        const { data, error } = await (supabase.from("lavado_historial") as any).insert(newHistRecord).select().single();
        if (error) throw error;
        return data as LavadoHistorial;
      } catch (err) {
        console.warn("Utilizando Local Storage para inserción de lavado_historial.", err);
        const locals = getLocalHistorial();
        const { empresa_id, ...localRecord } = newHistRecord as any;
        locals.push(localRecord);
        saveLocalHistorial(locals);
        return newHistRecord as LavadoHistorial;
      }
    },
    async delete(id: string) {
      try {
        const { error } = await supabase.from("lavado_historial")
          .delete()
          .eq("id", id)
          .eq("empresa_id", getActiveCompanyId());
        if (error) throw error;
      } catch (err) {
        console.warn("Utilizando Local Storage para eliminación en historial.", err);
        const locals = getLocalHistorial();
        const filtered = locals.filter(h => h.id !== id);
        saveLocalHistorial(filtered);
      }
    }
  },
  empresa_identidad: {
    async get() {
      try {
        console.log("Paso 19: Iniciando db.empresa_identidad.get()");
        console.time("Supabase: db.empresa_identidad.get");
        let query = (supabase.from("empresa_identidad") as any).select("*");
        const activeId = getActiveCompanyId();
        if (activeId && activeId !== "default") {
          query = query.eq("id", activeId);
        }
        const { data, error } = await query;
        console.timeEnd("Supabase: db.empresa_identidad.get");
        if (error) {
          console.log("Paso 20 - ERROR: db.empresa_identidad.get() falló con:", error);
          throw error;
        }
        console.log("Paso 20: db.empresa_identidad.get() consulta principal resuelta con:", data);
        if (data && data.length > 0) {
          return data[0] as EmpresaIdentidad;
        }
        if (activeId && activeId !== "default") {
          console.log("Paso 21: Iniciando db.empresa_identidad.get() fallback query");
          console.time("Supabase: db.empresa_identidad.get (fallback)");
          const { data: fallbackData, error: fallbackError } = await (supabase.from("empresa_identidad") as any).select("*");
          console.timeEnd("Supabase: db.empresa_identidad.get (fallback)");
          if (fallbackError) {
            console.log("Paso 22 - ERROR: db.empresa_identidad.get() fallback falló con:", fallbackError);
          } else {
            console.log("Paso 22: db.empresa_identidad.get() fallback resuelto con:", fallbackData);
          }
          if (fallbackData && fallbackData.length > 0) {
            return fallbackData[0] as EmpresaIdentidad;
          }
        }
        return defaultEmpresa;
      } catch (err) {
        console.error("Error loading company identity from Supabase:", err);
        return defaultEmpresa;
      }
    },
    async save(empresa: Omit<EmpresaIdentidad, 'id' | 'created_at'> & { id?: string }) {
      const defaultId = empresa.id || "default-empresa-id";
      const record = {
        id: defaultId,
        nombre: empresa.nombre || 'Sistema de Mantenimiento',
        logo_url: empresa.logo_url || null,
        color_principal: empresa.color_principal || '#10b981',
        color_secundario: empresa.color_secundario || '#06b6d4',
        email: empresa.email || '',
        telefono: empresa.telefono || '',
        direccion: empresa.direccion || '',
        sitio_web: empresa.sitio_web || '',
        estado: empresa.estado || 'Activa',
        plan: empresa.plan || 'Gratuito',
        fecha_inicio: empresa.fecha_inicio || new Date().toISOString(),
        fecha_vencimiento: empresa.fecha_vencimiento || null,
        activa: empresa.activa !== undefined ? empresa.activa : true
      };
      
      try {
        console.log("Paso 23: Iniciando db.empresa_identidad.save() con record:", record);
        console.time("Supabase: db.empresa_identidad.save");
        const { data: existing, error: existingError } = await (supabase.from("empresa_identidad") as any).select("id").maybeSingle();
        if (existingError) {
          console.log("Paso 24 - ERROR: db.empresa_identidad.save() buscando existente falló con:", existingError);
        } else {
          console.log("Paso 24: db.empresa_identidad.save() comprobación existente resuelta con:", existing);
        }
        let result;
        if (existing) {
          const { data, error } = await (supabase.from("empresa_identidad") as any)
            .update(record)
            .eq("id", existing.id)
            .select()
            .single();
          if (error) throw error;
          result = data;
        } else {
          const { data, error } = await (supabase.from("empresa_identidad") as any)
            .insert({ ...record, id: undefined })
            .select()
            .single();
          if (error) throw error;
          result = data;
        }
        console.log("Paso 25: db.empresa_identidad.save() guardado resuelto con:", result);
        console.timeEnd("Supabase: db.empresa_identidad.save");
        return result as EmpresaIdentidad;
      } catch (err) {
        console.timeEnd("Supabase: db.empresa_identidad.save");
        console.error("Error saving company identity to Supabase:", err);
        throw err;
      }
    },
    async getAll() {
      const { data, error } = await supabase.from("empresa_identidad").select("*").order("nombre");
      if (error) throw error;
      return data as EmpresaIdentidad[];
    },
    async create(empresa: Partial<EmpresaIdentidad>) {
      const { data, error } = await (supabase.from("empresa_identidad") as any)
        .insert({
          nombre: empresa.nombre || 'Nueva Empresa',
          logo_url: empresa.logo_url || null,
          color_principal: empresa.color_principal || '#10b981',
          color_secundario: empresa.color_secundario || '#06b6d4',
          email: empresa.email || '',
          telefono: empresa.telefono || '',
          direccion: empresa.direccion || '',
          sitio_web: empresa.sitio_web || '',
          estado: empresa.estado || 'Activa',
          plan: empresa.plan || 'Demo',
          fecha_inicio: empresa.fecha_inicio || new Date().toISOString(),
          fecha_vencimiento: empresa.fecha_vencimiento || null,
          activa: empresa.activa !== undefined ? empresa.activa : true
        })
        .select()
        .single();
      if (error) throw error;
      return data as EmpresaIdentidad;
    },
    async update(id: string, empresa: Partial<EmpresaIdentidad>) {
      const { data, error } = await (supabase.from("empresa_identidad") as any)
        .update(empresa)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as EmpresaIdentidad;
    }
  },
  perfiles: {
    async getByEmpresaId(empresaId: string) {
      const { data, error } = await supabase.from("perfiles")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("nombre");
      if (error) throw error;
      return data as Perfil[];
    },
    async createGlobal(perfil: Omit<Perfil, 'id' | 'created_at'> & { id?: string }) {
      const { data, error } = await (supabase.from("perfiles") as any)
        .insert({
          ...perfil,
          email: perfil.email.trim().toLowerCase()
        })
        .select()
        .single();
      if (error) throw error;
      return data as Perfil;
    },
    async getAll() {
      try {
        console.log("Inside db.ts: getAll perfiles");
        console.time("Supabase - Query: getAll perfiles");
        const { data, error } = await supabase.from("perfiles")
          .select("*")
          .eq("empresa_id", getActiveCompanyId())
          .order("nombre");
        console.timeEnd("Supabase - Query: getAll perfiles");
        if (error) {
          console.log("Inside db.ts: getAll perfiles ERROR:", error);
          throw error;
        }
        console.log("Inside db.ts: getAll perfiles resultado:", data);
        return data as Perfil[];
      } catch (err) {
        console.error("Error al obtener perfiles:", err);
        return [];
      }
    },
    async getByUserId(userId: string) {
      try {
        console.log("Inside db.ts: getByUserId para userId:", userId);
        console.time("Supabase - Query: getByUserId");
        const { data, error } = await supabase.from("perfiles")
          .select("*")
          .eq("user_id", userId)
          .limit(1);
        console.timeEnd("Supabase - Query: getByUserId");
        if (error) {
          console.log("Inside db.ts: getByUserId ERROR:", error);
          throw error;
        }
        console.log("Inside db.ts: getByUserId resultado:", data);
        return (data && data.length > 0 ? data[0] : null) as Perfil | null;
      } catch (err) {
        console.error("Error al obtener perfil por user_id:", err);
        return null;
      }
    },
    async getByEmail(email: string) {
      try {
        console.log("Inside db.ts: getByEmail para email:", email);
        console.time("Supabase - Query: getByEmail");
        const { data, error } = await supabase.from("perfiles")
          .select("*")
          .eq("email", email.trim().toLowerCase())
          .limit(1);
        console.timeEnd("Supabase - Query: getByEmail");
        if (error) {
          console.log("Inside db.ts: getByEmail ERROR:", error);
          throw error;
        }
        console.log("Inside db.ts: getByEmail resultado:", data);
        return (data && data.length > 0 ? data[0] : null) as Perfil | null;
      } catch (err) {
        console.error("Error al obtener perfil por email:", err);
        return null;
      }
    },
    async create(perfil: Omit<Perfil, 'id' | 'created_at'> & { id?: string }) {
      try {
        console.log("Inside db.ts: create perfil:", perfil);
        console.time("Supabase - Query: create perfil");
        const { data, error } = await (supabase.from("perfiles") as any)
          .insert({
            ...perfil,
            email: perfil.email.trim().toLowerCase(),
            empresa_id: perfil.empresa_id || getActiveCompanyId()
          })
          .select()
          .single();
        console.timeEnd("Supabase - Query: create perfil");
        if (error) {
          console.log("Inside db.ts: create perfil ERROR:", error);
          throw error;
        }
        console.log("Inside db.ts: create perfil resultado:", data);
        return data as Perfil;
      } catch (err) {
        console.error("Error al crear perfil:", err);
        throw err;
      }
    },
    async update(id: string, perfil: Partial<Omit<Perfil, 'id' | 'created_at'>>) {
      try {
        console.log("Inside db.ts: update perfil id:", id, "con datos:", perfil);
        console.time("Supabase - Query: update perfil");
        const updateData = { ...perfil };
        if (updateData.email) {
          updateData.email = updateData.email.trim().toLowerCase();
        }
        const { data, error } = await (supabase.from("perfiles") as any)
          .update(updateData)
          .eq("id", id)
          .select()
          .single();
        console.timeEnd("Supabase - Query: update perfil");
        if (error) {
          console.log("Inside db.ts: update perfil ERROR:", error);
          throw error;
        }
        console.log("Inside db.ts: update perfil resultado:", data);
        return data as Perfil;
      } catch (err) {
        console.error("Error al actualizar perfil:", err);
        throw err;
      }
    },
    async delete(id: string) {
      try {
        const { error } = await (supabase.from("perfiles") as any)
          .delete()
          .eq("id", id);
        if (error) throw error;
      } catch (err) {
        console.error("Error al eliminar perfil:", err);
        throw err;
      }
    }
  },
  ordenesTrabajo: {
    async getAll() {
      const { data, error } = await (supabase as any).from("ordenes_trabajo")
        .select("*, clientes(nombre), tambos(nombre)")
        .eq("empresa_id", getActiveCompanyId())
        .order("numero", { ascending: false });
      if (error) {
        console.error("Error al obtener ordenes de trabajo:", error);
        throw error;
      }
      return data as any[];
    },
    async getById(id: string) {
      const { data, error } = await (supabase as any).from("ordenes_trabajo")
        .select("*, clientes(*), tambos(*)")
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId())
        .single();
      if (error) {
        console.error("Error al obtener orden de trabajo por ID:", error);
        throw error;
      }
      return data as any;
    },
    async getItems(ordenId: string) {
      const { data, error } = await (supabase as any).from("orden_trabajo_items")
        .select("*")
        .eq("orden_id", ordenId)
        .order("componente");
      if (error) {
        console.error("Error al obtener items de orden de trabajo:", error);
        throw error;
      }
      return data as any[];
    },
    async create(orden: any, items: any[]) {
      checkWritePermission();
      // 1. Get next sequence number
      const { data: existing, error: countError } = await (supabase as any).from("ordenes_trabajo")
        .select("numero")
        .eq("empresa_id", getActiveCompanyId());
      
      let nextNum = 1;
      if (existing && existing.length > 0) {
        // Find highest number
        const numbers = (existing as any[]).map(o => {
          const m = o.numero.match(/\d+/);
          return m ? parseInt(m[0], 10) : 0;
        });
        nextNum = Math.max(...numbers, 0) + 1;
      }
      
      const numero = `OT-${String(nextNum).padStart(4, "0")}`;

      // 2. Insert order
      const { data: createdOrden, error: ordenError } = await (supabase as any).from("ordenes_trabajo")
        .insert({
          ...orden,
          numero,
          empresa_id: getActiveCompanyId(),
          estado: orden.estado || "Pendiente"
        })
        .select()
        .single();

      if (ordenError) {
        console.error("Error al crear orden de trabajo:", ordenError);
        throw ordenError;
      }

      if (!createdOrden) {
        throw new Error("No se pudo crear la orden de trabajo");
      }

      // 3. Insert items
      if (items && items.length > 0) {
        const itemsToInsert = items.map(item => ({
          ...item,
          orden_id: (createdOrden as any).id
        }));
        const { error: itemsError } = await (supabase as any).from("orden_trabajo_items")
          .insert(itemsToInsert);
        if (itemsError) {
          console.error("Error al crear items de orden de trabajo:", itemsError);
          // try to clean up order to avoid orphan records
          await (supabase as any).from("ordenes_trabajo").delete().eq("id", (createdOrden as any).id);
          throw itemsError;
        }
      }

      return createdOrden as any;
    },
    async update(id: string, updates: any) {
      checkWritePermission();
      const { data, error } = await (supabase as any).from("ordenes_trabajo")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId())
        .select()
        .single();
      if (error) {
        console.error("Error al actualizar orden de trabajo:", error);
        throw error;
      }
      return data;
    },
    async updateItem(itemId: string, updates: any) {
      checkWritePermission();
      const { data, error } = await (supabase as any).from("orden_trabajo_items")
        .update(updates)
        .eq("id", itemId)
        .select()
        .single();
      if (error) {
        console.error("Error al actualizar item de orden de trabajo:", error);
        throw error;
      }
      return data;
    },
    async delete(id: string) {
      checkDeletePermission();
      const { error } = await (supabase as any).from("ordenes_trabajo")
        .delete()
        .eq("id", id)
        .eq("empresa_id", getActiveCompanyId());
      if (error) {
        console.error("Error al eliminar orden de trabajo:", error);
        throw error;
      }
      return true;
    },
    async finalize(ordenId: string, itemsUpdates: { id: string, realizado: boolean, observaciones: string }[]) {
      checkWritePermission();
      
      // Update each item first
      for (const item of itemsUpdates) {
        const { error: itemErr } = await (supabase as any).from("orden_trabajo_items")
          .update({ realizado: item.realizado, observaciones: item.observaciones })
          .eq("id", item.id);
        if (itemErr) {
          console.error("Error al actualizar item para finalización:", itemErr);
          throw itemErr;
        }
      }

      // Update order status to Finalizada
      const { data: updatedOrden, error: ordenErr } = await (supabase as any).from("ordenes_trabajo")
        .update({ estado: "Finalizada", updated_at: new Date().toISOString() })
        .eq("id", ordenId)
        .eq("empresa_id", getActiveCompanyId())
        .select()
        .single();

      if (ordenErr) {
        console.error("Error al finalizar orden:", ordenErr);
        throw ordenErr;
      }

      return updatedOrden;
    }
  }
};

const LOCAL_STORAGE_CONFIG_KEY = "mantenimiento_lavado_configuraciones";
const LOCAL_STORAGE_HISTORIAL_KEY = "mantenimiento_lavado_historial";

const defaultEmpresa: EmpresaIdentidad = {
  id: "default",
  nombre: "Sistema de Mantenimiento",
  logo_url: null,
  color_principal: "#10b981",
  color_secundario: "#06b6d4",
  email: "",
  telefono: "",
  direccion: "",
  sitio_web: ""
};

function getLocalConfigs(): any[] {
  try {
    let data = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
    if (!data) {
      data = localStorage.getItem("ganpor_lavado_configuraciones");
      if (data) {
        localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, data);
      }
    }
    return JSON.parse(data || "[]");
  } catch {
    return [];
  }
}

function saveLocalConfigs(configs: any[]) {
  localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(configs));
}

function getLocalHistorial(): any[] {
  try {
    let data = localStorage.getItem(LOCAL_STORAGE_HISTORIAL_KEY);
    if (!data) {
      data = localStorage.getItem("ganpor_lavado_historial");
      if (data) {
        localStorage.setItem(LOCAL_STORAGE_HISTORIAL_KEY, data);
      }
    }
    return JSON.parse(data || "[]");
  } catch {
    return [];
  }
}

function saveLocalHistorial(historial: any[]) {
  localStorage.setItem(LOCAL_STORAGE_HISTORIAL_KEY, JSON.stringify(historial));
}

