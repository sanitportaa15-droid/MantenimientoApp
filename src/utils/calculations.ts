import { addMonths, differenceInDays, parseISO } from "date-fns";
import { Mantenimiento, MantenimientoTipo, Tambo, Configuracion } from "../types/supabase";

export type Status = "verde" | "amarillo" | "rojo";

export interface MaintenanceStatus {
  tipo: MantenimientoTipo;
  ultimaFecha: Date | null;
  proximaFecha: Date | null;
  diasRestantes: number | null;
  status: Status;
}

export function calculateMaintenanceStatus(
  tambo: Tambo,
  mantenimientos: Mantenimiento[],
  configs: Configuracion[]
): MaintenanceStatus[] {
  const getConfig = (clave: string, defaultValue: number) => {
    const config = configs.find(c => c.clave === clave);
    return config ? parseInt(config.valor) : defaultValue;
  };

  const diasAlerta = getConfig("dias_alerta", 30);

  return Object.values(MantenimientoTipo).map(tipo => {
    const ultimo = mantenimientos
      .filter(m => m.tipo === tipo)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];

    const ultimaFecha = ultimo ? parseISO(ultimo.fecha) : null;
    let proximaFecha: Date | null = null;
    let diasRestantes: number | null = null;
    let status: Status = "rojo";

    if (tipo === MantenimientoTipo.PEZONERAS) {
      const maxOrdenes = getConfig("pezonera_max_ordenes", 2500);
      if (ultimaFecha) {
        // Cálculo basado en ordeñes
        // Días = maxOrdenes / (vacas * ordenes_por_dia / bajadas)
        const ordenesPorDiaTotal = (tambo.vacas_en_ordene * tambo.ordenes_por_dia) / tambo.bajadas;
        const diasVidaUtil = maxOrdenes / ordenesPorDiaTotal;
        proximaFecha = addMonths(ultimaFecha, 0); // Reset base
        proximaFecha.setDate(ultimaFecha.getDate() + Math.floor(diasVidaUtil));
      }
    } else {
      const mesesMap: Record<string, string> = {
        [MantenimientoTipo.MANGUERAS_LECHE]: "mangueras_leche_meses",
        [MantenimientoTipo.MANGUERAS_PULSADO]: "mangueras_pulsado_meses",
        [MantenimientoTipo.PULSADORES]: "pulsadores_meses",
        [MantenimientoTipo.SOGAS]: "sogas_meses",
        [MantenimientoTipo.DIAFRAGMA_BRAZOS]: "diafragma_brazos_meses",
        [MantenimientoTipo.BUJES]: "bujes_meses",
        [MantenimientoTipo.SENSOR_LECHE]: "sensor_leche_meses",
        [MantenimientoTipo.BOMBA_VACIO]: "bomba_vacio_meses",
        [MantenimientoTipo.BOMBA_CENTRIFUGA_LECHE]: "bomba_centrifuga_leche_meses",
        [MantenimientoTipo.BOMBA_DIAFRAGMA_LECHE]: "bomba_diafragma_leche_meses",
        [MantenimientoTipo.KIT_COLECTOR_LECHE]: "kit_colector_leche_meses",
      };

      const configClave = mesesMap[tipo];
      if (configClave && ultimaFecha) {
        const meses = getConfig(configClave, 12);
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
  return "verde";
}
