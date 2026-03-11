import { supabase } from "./supabase";
import { Cliente, Tambo, Mantenimiento, Configuracion, Database } from "../types/supabase";

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
    }
  },
  tambos: {
    async getAll() {
      const { data, error } = await (supabase.from("tambos") as any).select("*, clientes(nombre)").order("nombre");
      if (error) {
        console.error("Error al obtener tambos:", error);
        throw error;
      }
      return data as any[];
    },
    async getByCliente(clienteId: string) {
      const { data, error } = await (supabase.from("tambos") as any).select("*").eq("cliente_id", clienteId);
      if (error) {
        console.error("Error al obtener tambos por cliente:", error);
        throw error;
      }
      return data as Tambo[];
    },
    async getById(id: string) {
      const { data, error } = await (supabase.from("tambos") as any).select("*, clientes(*)").eq("id", id).single();
      if (error) {
        console.error("Error al obtener tambo por ID:", error);
        throw error;
      }
      return data as (Tambo & { clientes: Cliente });
    },
    async create(tambo: Database['public']['Tables']['tambos']['Insert']) {
      const { data, error } = await (supabase.from("tambos") as any).insert(tambo).select().single();
      if (error) {
        console.error("Error guardando tambo:", error);
        throw error;
      }
      return data as Tambo;
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
    }
  },
  configuracion: {
    async getAll() {
      const { data, error } = await (supabase.from("configuracion") as any).select("*");
      if (error) {
        console.error("Error al obtener configuraciones:", error);
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
        { clave: "aceite_bomba_meses", valor: "6", descripcion: "Meses para cambio de aceite bomba" },
        { clave: "regulador_vacio_meses", valor: "1", descripcion: "Meses para limpieza de regulador" },
        { clave: "filtros_aire_meses", valor: "3", descripcion: "Meses para filtros de aire" },
        { clave: "colectores_meses", valor: "12", descripcion: "Meses para revisión de colectores" },
        { clave: "dias_alerta", valor: "30", descripcion: "Días de antelación para alerta amarilla" },
      ];
      
      const { data: existing } = await (supabase.from("configuracion") as any).select("clave");
      const existingKeys = new Set((existing as any[])?.map(c => c.clave) || []);
      
      const toInsert = defaultConfigs.filter(c => !existingKeys.has(c.clave));
      if (toInsert.length > 0) {
        const { error } = await (supabase.from("configuracion") as any).insert(toInsert);
        if (error) console.error("Error al sembrar configuraciones por defecto:", error);
      }
    }
  }
};
