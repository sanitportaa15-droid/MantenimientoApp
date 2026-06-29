import { addDays, addMonths, differenceInDays, parseISO, startOfDay } from "date-fns";
import { Mantenimiento, Tambo, Configuracion, TipoMantenimiento, TamboComponente, Componente, TamboInsumo, Insumo } from "../types/supabase";
import { normalizeMaintenanceName } from "../services/db";

export type Status = "verde" | "amarillo" | "rojo" | "gris";

export interface MaintenanceStatus {
  tipo: string;
  ultimaFecha: Date | null;
  proximaFecha: Date | null;
  diasRestantes: number | null;
  status: Status;
  frecuenciaLabel?: string;
  ordenosPorPezonera?: number;
  diasEstimados?: number;
}

export interface InsumoCalculado {
  nombre: string;
  cantidad: number;
  tipo: string;
}

export function calculateInsumos(
  tambo: Tambo & { 
    insumos?: Insumo | null,
    bomba_leche_tiene_sello?: boolean | null,
    bomba_leche_tiene_diafragma?: boolean | null,
    bomba_leche_tiene_turbina?: boolean | null,
    usa_sogas?: boolean | null,
    usa_diafragmas_brazos?: boolean | null,
    usa_bujes?: boolean | null,
    usa_colector_leche?: boolean | null,
    colector_marca?: string | null,
    tipo_pulsadores?: string | null,
    bomba_leche_marca?: string | null
  },
  tamboInsumos: (TamboInsumo & { insumos: Insumo })[]
): InsumoCalculado[] {
  const bajadas = tambo.bajadas || 0;
  const tieneBrazos = tambo.tiene_brazos_extractores || false;

  // Combinar insumos de la tabla relacional y la pezonera principal del tambo
  const allInsumos = [...tamboInsumos];
  
  if (tambo.insumos) {
    const isAlreadyInList = tamboInsumos.some(ti => ti.insumo_id === tambo.insumos?.id);
    if (!isAlreadyInList) {
      allInsumos.push({
        id: 'primary-pezonera',
        tambo_id: tambo.id,
        insumo_id: tambo.insumos.id,
        cantidad_manual: 0,
        created_at: new Date().toISOString(),
        insumos: tambo.insumos
      });
    }
  }

  const results = allInsumos.map(ti => {
    const insumo = ti.insumos;
    let cantidad = 0;

    if (insumo.usa_cantidad_manual) {
      cantidad = ti.cantidad_manual || 0;
    } else {
      const nombre = insumo.nombre.toLowerCase();
      
      if (nombre.includes("pezonera")) {
        // REGLA: pezoneras = bajadas * 4
        cantidad = bajadas * 4;
      } else if (nombre.includes("pulsador")) {
        // REGLA: pulsadores = bajadas * (2 si brazos, 1 si no)
        cantidad = tieneBrazos ? bajadas * 2 : bajadas * 1;
      } else {
        // REGLA: otros = bajadas * cantidad_por_bajada
        cantidad = bajadas * (insumo.cantidad_por_bajada || 0);
      }
    }

    return {
      nombre: insumo.nombre,
      cantidad,
      tipo: insumo.tipo
    };
  });

  // Asegurar que Pulsadores estén en la lista si no fueron agregados manualmente
  const hasPulsadores = results.some(r => r.nombre.toLowerCase().includes("pulsador"));
  if (!hasPulsadores) {
    results.push({
      nombre: `Pulsadores ${tambo.tipo_pulsadores || ''}`.trim(),
      cantidad: tieneBrazos ? bajadas * 2 : bajadas,
      tipo: 'equipo'
    });
  }

  // Agregar componentes de bomba de leche si aplica
  if (tambo.bomba_leche_tiene_sello) {
    results.push({ nombre: `Sello bomba de leche ${tambo.bomba_leche_marca || ''}`.trim(), cantidad: 1, tipo: 'repuesto' });
  }
  if (tambo.bomba_leche_tiene_diafragma) {
    results.push({ nombre: `Diafragma bomba de leche ${tambo.bomba_leche_marca || ''}`.trim(), cantidad: 1, tipo: 'repuesto' });
  }
  if (tambo.bomba_leche_tiene_turbina) {
    results.push({ nombre: `Turbina bomba de leche ${tambo.bomba_leche_marca || ''}`.trim(), cantidad: 1, tipo: 'repuesto' });
  }

  // Agregar nuevos insumos automáticos por bajada
  if (tambo.usa_sogas) {
    results.push({ nombre: 'Sogas', cantidad: bajadas, tipo: 'repuesto' });
  }
  if (tambo.usa_diafragmas_brazos) {
    results.push({ nombre: 'Diafragma de brazos', cantidad: bajadas, tipo: 'repuesto' });
  }
  if (tambo.usa_bujes) {
    results.push({ nombre: 'Bujes', cantidad: bajadas, tipo: 'repuesto' });
  }
  if (tambo.usa_colector_leche) {
    const colectorName = tambo.colector_marca ? `Kit colector de leche ${tambo.colector_marca}` : 'Kit colector de leche';
    results.push({ nombre: colectorName, cantidad: bajadas, tipo: 'repuesto' });
  }

  return results;
}

export function calculateSupplies(
  tambo: Tambo,
  tamboComponentes: (TamboComponente & { componentes: Componente })[]
): InsumoCalculado[] {
  const bajadas = tambo.bajadas || 0;
  const tieneBrazos = tambo.tiene_brazos_extractores || false;

  return tamboComponentes.map(tc => {
    const comp = tc.componentes;
    let cantidad = 0;

    if (comp.usa_cantidad_manual) {
      cantidad = tc.cantidad_manual || 0;
    } else {
      const nombre = comp.nombre.toLowerCase();

      if (nombre.includes("pezonera")) {
        cantidad = bajadas * 4;
      } else if (nombre.includes("pulsador")) {
        cantidad = tieneBrazos ? bajadas * 2 : bajadas * 1;
      } else {
        cantidad = bajadas * (comp.cantidad_por_bajada || 0);
      }
    }

    return {
      nombre: comp.nombre,
      cantidad,
      tipo: comp.tipo
    };
  });
}

export function getMaintConfigKey(normalizedName: string): string | null {
  const lower = normalizedName.toLowerCase().trim();
  
  if (lower.includes("pezonera")) {
    return "pezonera_max_ordenes";
  }
  if (lower.includes("manguera") && lower.includes("leche")) {
    return "mangueras_leche_meses";
  }
  if (lower.includes("manguera") && lower.includes("pulsado")) {
    return "mangueras_pulsado_meses";
  }
  if (lower.includes("pulsador")) {
    return "pulsadores_meses";
  }
  if (lower.includes("soga")) {
    return "sogas_meses";
  }
  if (lower.includes("diafragma") && lower.includes("brazo")) {
    return "diafragma_brazos_meses";
  }
  if (lower.includes("buje")) {
    return "bujes_meses";
  }
  if (lower.includes("sensor")) {
    return "sensor_leche_meses";
  }
  if (lower.includes("vacio") || lower.includes("vacío")) {
    return "bomba_vacio_meses";
  }
  if (lower.includes("centrifuga") || lower.includes("centrífuga")) {
    return "bomba_centrifuga_leche_meses";
  }
  if (lower.includes("diafragma") && lower.includes("bomba")) {
    return "bomba_diafragma_leche_meses";
  }
  if (lower.includes("colector")) {
    return "kit_colector_leche_meses";
  }
  if (lower.includes("caucho")) {
    return "caucho_linea_leche_y_lavado_meses";
  }
  return null;
}

export function calculateMaintenanceStatus(
  tambo: Tambo,
  mantenimientos: Mantenimiento[],
  configs: Configuracion[],
  activeTypes: TipoMantenimiento[],
  activeNamesOverride?: string[]
): MaintenanceStatus[] {
  const getConfig = (clave: string, defaultValue: number) => {
    const config = configs.find(c => c.clave === clave);
    return config ? parseInt(config.valor) : defaultValue;
  };

  const diasAlerta = getConfig("dias_alerta", 30);
  const today = startOfDay(new Date());

  // Get active maintenance names for this tambo to filter results at the end
  let activeNames = activeNamesOverride;
  if (!activeNames) {
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
    ].map(normalizeMaintenanceName);

    const configRow = configs.find(c => c.clave === `tambo_mantenimientos_${tambo.id}`);
    activeNames = defaultMaintNames;
    if (configRow) {
      try {
        const parsed = JSON.parse(configRow.valor);
        if (Array.isArray(parsed)) {
          activeNames = parsed.map(normalizeMaintenanceName);
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // Dynamically include any maintenance type names present in historical records that are not in activeTypes
  const existingNames = new Set(activeTypes.map(t => t.nombre.toLowerCase().trim()));
  const mergedTypes = [...activeTypes];

  mantenimientos.forEach(m => {
    const norm = m.tipo?.trim() || "";
    if (norm && !existingNames.has(norm.toLowerCase())) {
      mergedTypes.push({
        id: `dynamic-${norm.replace(/\s+/g, '-').toLowerCase()}`,
        nombre: norm,
        frecuencia_meses: 12,
        descripcion: `Mantenimiento de ${norm}`,
        created_at: ""
      });
      existingNames.add(norm.toLowerCase());
    }
  });

  const calculated = mergedTypes.map((tipoObj): MaintenanceStatus => {
    const tipo = tipoObj.nombre;
    const normTipo = normalizeMaintenanceName(tipo).toLowerCase().trim();
    
    // Filter records for this maintenance type with case-insensitive, normalized comparison
    const matchingRecords = mantenimientos.filter(
      m => m.tipo && normalizeMaintenanceName(m.tipo).toLowerCase().trim() === normTipo
    );

    // If there are multiple records, and at least one is NOT '1900-01-01', we exclude the '1900-01-01' ones
    const validRecords = matchingRecords.filter(m => m.fecha !== '1900-01-01');
    const recordsToSort = validRecords.length > 0 ? validRecords : matchingRecords;

    // Get the latest maintenance record using robust ISO date parsing
    const ultimoRecord = recordsToSort.sort((a, b) => parseISO(b.fecha).getTime() - parseISO(a.fecha).getTime())[0];

    let ultimaFecha: Date | null = null;
    let isNeverPerformed = false;
    
    if (ultimoRecord) {
      if (ultimoRecord.fecha === '1900-01-01') {
        isNeverPerformed = true;
      } else {
        ultimaFecha = parseISO(ultimoRecord.fecha);
      }
    }

    const pezoneraMaxOrdenes = getConfig("pezonera_max_ordenes", 1200);
    const isPezoneraType = tipo.toLowerCase().includes("pezonera");

    // Si el mantenimiento está marcado como "nunca realizado" o no hay fecha -> NEUTRO (gris)
    if (!ultimaFecha || isNeverPerformed) {
      let label: string;
      if (isPezoneraType) {
        label = `Cada ${pezoneraMaxOrdenes} ordeños`;
      } else {
        let meses = tipoObj.frecuencia_meses || 12;
        const configKey = getMaintConfigKey(normTipo);
        if (configKey) {
          const configObj = configs.find(c => c.clave === configKey);
          if (configObj) {
            meses = parseInt(configObj.valor) || meses;
          }
        }
        label = `Cada ${meses} meses`;
      }

      return {
        tipo,
        ultimaFecha: null,
        proximaFecha: null,
        diasRestantes: null,
        status: "gris",
        frecuenciaLabel: label
      };
    }

    let proximaFecha: Date;
    let frecuenciaLabel: string;
    let ordenosPorPezonera: number | undefined;
    let diasEstimados: number | undefined;

    if (isPezoneraType) {
      // FÓRMULA OFICIAL:
      // 1. ordeños_por_pezonera = (vacas_en_ordeñe × ordeños_por_día) / bajadas
      // 2. dias_hasta_cambio = pezoneraMaxOrdenes / ordeños_por_pezonera
      
      const vacas = tambo.vacas_en_ordene || 0;
      const ordenes = tambo.ordenes_por_dia || 0;
      const bajadas = tambo.bajadas || 1; // Evitar división por cero
      
      ordenosPorPezonera = (vacas * ordenes) / bajadas;
      
      // Evitar división por cero si ordenosPorPezonera es 0
      diasEstimados = ordenosPorPezonera > 0 ? Math.floor(pezoneraMaxOrdenes / ordenosPorPezonera) : 365;
      
      proximaFecha = addDays(ultimaFecha, diasEstimados);
      frecuenciaLabel = `Frecuencia calculada: ${pezoneraMaxOrdenes} ordeños`;
    } else {
      // Cálculo por meses (resto de mantenimientos)
      let meses = tipoObj.frecuencia_meses || 12;
      const configKey = getMaintConfigKey(normTipo);
      if (configKey) {
        const configObj = configs.find(c => c.clave === configKey);
        if (configObj) {
          meses = parseInt(configObj.valor) || meses;
        }
      }

      proximaFecha = addMonths(ultimaFecha, meses);
      frecuenciaLabel = `Cada ${meses} meses`;
    }

    const proximaFechaStart = startOfDay(proximaFecha);

    // 4. Calcular: dias_restantes = fecha_proximo - fecha_actual
    const diasRestantes = differenceInDays(proximaFechaStart, today);

    // 5. Determinar estado:
    let status: Status = "verde";
    if (diasRestantes < 0) {
      status = "rojo"; // VENCIDO
    } else if (diasRestantes <= diasAlerta) {
      status = "amarillo"; // PRÓXIMO
    } else {
      status = "verde"; // AL DÍA
    }

    return {
      tipo,
      ultimaFecha,
      proximaFecha,
      diasRestantes,
      status,
      frecuenciaLabel,
      ordenosPorPezonera,
      diasEstimados
    };
  });

  // Filter to only include active configured maintenance types for this tambo
  return calculated.filter(s => {
    return activeNames && activeNames.some(name => name.toLowerCase().trim() === s.tipo.toLowerCase().trim());
  });
}

export function getGeneralStatus(statuses: MaintenanceStatus[]): Status {
  if (statuses.some(s => s.status === "rojo")) return "rojo";
  if (statuses.some(s => s.status === "amarillo")) return "amarillo";
  if (statuses.every(s => s.status === "gris")) return "gris";
  return "verde";
}

export function calculateReliability(
  reclamos: any[],
  mantenimientos: any[],
  statuses: MaintenanceStatus[],
  configs: Configuracion[]
): number {
  const getConfig = (clave: string, defaultValue: number) => {
    const config = configs.find(c => c.clave === clave);
    return config ? parseInt(config.valor) : defaultValue;
  };

  const reclamoDeduccion = getConfig("reclamo_deduccion", 7);
  const vencidoDeduccion = getConfig("vencido_deduccion", 10);
  const mantenimientoAdicion = getConfig("mantenimiento_adicion", 3);

  let score = 100;

  // Restar por cada reclamo
  score -= reclamos.length * reclamoDeduccion;

  // Restar por cada mantenimiento vencido
  const vencidos = statuses.filter(s => s.status === "rojo").length;
  score -= vencidos * vencidoDeduccion;

  // Sumar por cada mantenimiento realizado
  const realizados = mantenimientos.filter(m => m.fecha !== '1900-01-01').length;
  score += realizados * mantenimientoAdicion;

  return Math.min(100, Math.max(0, score));
}

export function getReliabilityStatus(score: number): { label: string, color: string } {
  if (score >= 85) return { label: "Excelente", color: "text-emerald-400" };
  if (score >= 70) return { label: "Atención", color: "text-amber-400" };
  return { label: "Crítico", color: "text-red-400" };
}
