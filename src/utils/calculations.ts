import { addMonths, differenceInDays, parseISO } from "date-fns";
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

  return activeTypes.map(tipoObj => {
    const tipo = tipoObj.nombre;
    const ultimo = mantenimientos
      .filter(m => m.tipo === tipo)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];

    let ultimaFecha = ultimo ? parseISO(ultimo.fecha) : null;
    
    // Fallback for pezoneras using the tambo's specific field if no maintenance record exists
    if (!ultimaFecha && tipo.toLowerCase().includes("pezonera") && tambo.fecha_ultimo_cambio) {
      ultimaFecha = parseISO(tambo.fecha_ultimo_cambio);
    }

    let proximaFecha: Date | null = null;
    let diasRestantes: number | null = null;
    let status: Status = "rojo";

    // Handle "Never performed" or special initial date
    if ((!ultimo && !ultimaFecha) || (ultimo?.fecha === '1900-01-01') || (tambo.fecha_ultimo_cambio === '1900-01-01' && !ultimo)) {
      return {
        tipo,
        ultimaFecha: null,
        proximaFecha: null,
        diasRestantes: null,
        status: "gris"
      };
    }

    if (tipo.toLowerCase().includes("pezonera")) {
      const maxOrdenes = getConfig("pezonera_max_ordenes", 2500);
      if (ultimaFecha) {
        // Cálculo basado en ordeñes
        const ordenesPorDiaTotal = (tambo.vacas_en_ordene * tambo.ordenes_por_dia) / tambo.bajadas;
        const diasVidaUtil = maxOrdenes / (ordenesPorDiaTotal || 1);
        proximaFecha = addMonths(ultimaFecha, 0); // Reset base
        proximaFecha.setDate(ultimaFecha.getDate() + Math.floor(diasVidaUtil));
      }
    } else {
      const meses = tipoObj.frecuencia_meses || 12;
      if (ultimaFecha) {
        proximaFecha = addMonths(ultimaFecha, meses);
      }
    }

    if (proximaFecha) {
      diasRestantes = differenceInDays(proximaFecha, new Date());
      if (diasRestantes > diasAlerta) status = "verde";
      else if (diasRestantes > 0) status = "amarillo";
      else status = "rojo";
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
