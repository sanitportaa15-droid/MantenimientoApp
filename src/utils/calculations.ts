import { addMonths, differenceInDays, parseISO, startOfDay } from "date-fns";
import { Mantenimiento, Tambo, Configuracion, TipoMantenimiento } from "../types/supabase";

export type Status = "verde" | "amarillo" | "rojo" | "gris";

export interface MaintenanceStatus {
  tipo: string;
  ultimaFecha: Date | null;
  proximaFecha: Date | null;
  diasRestantes: number | null;
  status: Status;
}

export function calculateMaintenanceStatus(
  tambo: Tambo,
  mantenimientos: Mantenimiento[],
  configs: Configuracion[],
  activeTypes: TipoMantenimiento[]
): MaintenanceStatus[] {
  const getConfig = (clave: string, defaultValue: number) => {
    const config = configs.find(c => c.clave === clave);
    return config ? parseInt(config.valor) : defaultValue;
  };

  const diasAlerta = getConfig("dias_alerta", 30);
  const today = startOfDay(new Date());

  return activeTypes.map(tipoObj => {
    const tipo = tipoObj.nombre;
    
    // 1. Obtener la fecha del último mantenimiento (fecha_ultimo)
    const ultimoRecord = mantenimientos
      .filter(m => m.tipo === tipo)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];

    let ultimaFecha: Date | null = null;
    let isNeverPerformed = false;
    
    if (ultimoRecord) {
      if (ultimoRecord.fecha === '1900-01-01') {
        isNeverPerformed = true;
      } else {
        ultimaFecha = parseISO(ultimoRecord.fecha);
      }
    }

    // Si el mantenimiento está marcado como "nunca realizado" o no hay fecha -> NEUTRO (gris)
    if (!ultimaFecha || isNeverPerformed) {
      return {
        tipo,
        ultimaFecha: null,
        proximaFecha: null,
        diasRestantes: null,
        status: "gris"
      };
    }

    // 2. Obtener la frecuencia en meses del mantenimiento
    const meses = tipoObj.frecuencia_meses || 12;

    // 3. Calcular: fecha_proximo = fecha_ultimo + frecuencia_meses
    const proximaFecha = addMonths(ultimaFecha, meses);
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
      status
    };
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
