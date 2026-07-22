export interface ParametroISOEvaluacion {
  parametro: string;
  valorMedido: string;
  valorPermitido: string;
  diferencia: string;
  estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico";
  observacion: string;
}

export interface InformeProductor {
  estadoGeneral: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico";
  queSignifica: string;
  queRiesgosExisten: string;
  queSeRecomiendaHacer: string;
}

export interface ResultadoEvaluacionISO {
  evaluacionISO: ParametroISOEvaluacion[];
  estadoGeneral: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico";
  nivelCriticidad: "Bajo" | "Medio" | "Alto";
  posiblesCausas: string[];
  accionesCorrectivas: string[];
  informeProductor: InformeProductor;
}

// Helpers to parse specifications and measured data
function parseNumber(val: any): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "number") return val;
  const match = String(val).match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : null;
}

function parseVacuumRange(rangeStr: string): { min: number; max: number } {
  const defaultRange = { min: 40, max: 50 };
  if (!rangeStr) return defaultRange;
  
  // Try to find numbers in the string
  const numbers = rangeStr.match(/[0-9]+/g);
  if (numbers && numbers.length >= 2) {
    return {
      min: parseFloat(numbers[0]),
      max: parseFloat(numbers[1]),
    };
  } else if (numbers && numbers.length === 1) {
    const singleVal = parseFloat(numbers[0]);
    return {
      min: singleVal - 4,
      max: singleVal + 4,
    };
  }
  return defaultRange;
}

function parseAllowedRatios(ratiosStr: string): number[] {
  if (!ratiosStr) return [60]; // default 60%
  const ratios: number[] = [];
  const parts = ratiosStr.split(/[,;\s]+/);
  for (const part of parts) {
    const match = part.match(/([0-9]+)\s*[\/:-]\s*([0-9]+)/);
    if (match) {
      ratios.push(parseFloat(match[1]));
    } else {
      const num = parseNumber(part);
      if (num !== null && num > 10 && num < 90) {
        ratios.push(num);
      }
    }
  }
  return ratios.length > 0 ? ratios : [60];
}

function parseRatioPercentage(ratioStr: string): number | null {
  if (!ratioStr) return null;
  const match = String(ratioStr).match(/([0-9]+)\s*[\/:-]\s*[0-9]+/);
  if (match) {
    return parseFloat(match[1]);
  }
  const singleNum = parseNumber(ratioStr);
  if (singleNum !== null && singleNum > 0 && singleNum < 100) {
    return singleNum;
  }
  return null;
}

export function evaluatePulsatorISO(datos: any, specs?: any): ResultadoEvaluacionISO {
  const evaluations: ParametroISOEvaluacion[] = [];

  // ISO Standard baselines for Milking Machine Pulsators (ISO 5707 / ISO 6690)
  // Compliance is evaluated STRICTLY against ISO limits, independent of brand or model.
  const nomFreq = (specs && parseNumber(specs.frecuenciaNominal)) || 60;
  const vacRange = (specs && parseVacuumRange(specs.vacioRecomendado)) || { min: 40, max: 50 };

  // Cycle duration calculated from actual measured frequency (or nominal 60 ppm -> 1000 ms)
  const measuredFreq = parseNumber(datos.frecuenciaMedida);
  const activeFreqForCycle = measuredFreq && measuredFreq > 0 ? measuredFreq : nomFreq;
  const cycleMs = 60000 / activeFreqForCycle;

  // --- 1. FRECUENCIA DE PULSACIÓN (Norma ISO: +/- 3.0 ppm respecto al valor nominal de trabajo) ---
  if (measuredFreq !== null) {
    const diff = measuredFreq - nomFreq;
    const absDiff = Math.abs(diff);
    let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
    let obs = "";

    if (absDiff <= 3) {
      estado = "Conforme";
      obs = "Frecuencia dentro de la tolerancia estricta ISO (+/- 3 ppm).";
    } else if (absDiff <= 5) {
      estado = "Advertencia";
      obs = `Ligera desviación de frecuencia. Norma ISO especifica +/- 3 ppm respecto al régimen nominal (${nomFreq} ppm).`;
    } else if (absDiff <= 8) {
      estado = "Fuera de tolerancia";
      obs = `Frecuencia fuera del límite normativo ISO (+/- 3 ppm). Requiere ajuste o calibración del pulsador.`;
    } else {
      estado = "Crítico";
      obs = `Frecuencia críticamente fuera de rango ISO (${measuredFreq.toFixed(1)} ppm). Severo riesgo de lesión de esfínter o congestión.`;
    }

    evaluations.push({
      parametro: "Frecuencia de pulsación",
      valorMedido: `${measuredFreq.toFixed(1)} ppm`,
      valorPermitido: `${nomFreq} ppm (+/- 3 ppm según ISO)`,
      diferencia: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} ppm`,
      estado,
      observacion: obs
    });
  }

  // --- 2. TIEMPO DE PULSACIÓN (DURACIÓN TOTAL DEL CICLO EN MS) ---
  const measuredCycleTime = parseNumber(datos.tiempoPulsacionMedido) || (measuredFreq ? 60000 / measuredFreq : null);
  if (measuredCycleTime !== null) {
    const nomCycleMs = 60000 / nomFreq;
    const diffCycle = measuredCycleTime - nomCycleMs;
    const absDiffMs = Math.abs(diffCycle);
    let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
    let obs = "";

    if (measuredCycleTime >= 850 && measuredCycleTime <= 1200) {
      if (absDiffMs <= 50) {
        estado = "Conforme";
        obs = "Tiempo de ciclo de pulsación dentro de parámetros óptimos de la norma ISO.";
      } else {
        estado = "Advertencia";
        obs = `Tiempo de ciclo (${measuredCycleTime.toFixed(0)} ms) levemente desviado del objetivo nominal de ${nomCycleMs.toFixed(0)} ms.`;
      }
    } else if (measuredCycleTime >= 750 && measuredCycleTime <= 1350) {
      estado = "Fuera de tolerancia";
      obs = `Duración de ciclo fuera del estándar ISO (850 - 1200 ms). Impacta la cadencia de ordeño y descanso.`;
    } else {
      estado = "Crítico";
      obs = `Duración de ciclo críticamente anómala (${measuredCycleTime.toFixed(0)} ms). Alteración grave en el ritmo de pulsación.`;
    }

    evaluations.push({
      parametro: "Tiempo de pulsación (Ciclo)",
      valorMedido: `${measuredCycleTime.toFixed(0)} ms`,
      valorPermitido: `${nomCycleMs.toFixed(0)} ms (Rango ISO: 850 - 1200 ms)`,
      diferencia: `${diffCycle >= 0 ? "+" : ""}${diffCycle.toFixed(0)} ms`,
      estado,
      observacion: obs
    });
  }

  // --- 3. RELACIÓN DE PULSACIÓN (Norma ISO: Tolerancia máxima +/- 5% frente al valor nominal de calibración) ---
  const measuredRatioPct = parseRatioPercentage(datos.relacionMedida);
  if (measuredRatioPct !== null) {
    const allowedRatios = (specs && parseAllowedRatios(specs.relacionesPermitidas)) || [60];
    let closestNominal = allowedRatios[0];
    let minDiff = Math.abs(measuredRatioPct - closestNominal);
    for (const r of allowedRatios) {
      const d = Math.abs(measuredRatioPct - r);
      if (d < minDiff) {
        minDiff = d;
        closestNominal = r;
      }
    }

    const diff = measuredRatioPct - closestNominal;
    const absDiff = Math.abs(diff);
    let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
    let obs = "";

    if (absDiff <= 5) {
      estado = "Conforme";
      obs = `Relación de pulsación en conformidad con norma ISO (tolerancia <= +/- 5%).`;
    } else if (absDiff <= 8) {
      estado = "Advertencia";
      obs = `Desviación moderada. La norma ISO exige no superar +/- 5% respecto a la relación nominal (${closestNominal}/${100 - closestNominal}).`;
    } else if (absDiff <= 12) {
      estado = "Fuera de tolerancia";
      obs = `Relación de pulsación fuera del límite ISO. Afecta directamente los tiempos de ordeño y masaje.`;
    } else {
      estado = "Crítico";
      obs = `Relación de pulsación severamente alterada (${datos.relacionMedida}). Riesgo alto de congestión y edema mamario.`;
    }

    evaluations.push({
      parametro: "Relación de pulsación",
      valorMedido: String(datos.relacionMedida).includes("/") ? String(datos.relacionMedida) : `${measuredRatioPct}/${100 - measuredRatioPct}`,
      valorPermitido: `${closestNominal}/${100 - closestNominal} (+/- 5% límite ISO)`,
      diferencia: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`,
      estado,
      observacion: obs
    });
  }

  // Helper to evaluate phases ta, tb, tc, td
  const evaluatePhase = (
    name: string,
    measuredVal: any,
    isMinimum: boolean,
    limitVal: number,
    isPercentage: boolean,
    yellowThreshold: number,
    redThreshold: number,
    criticalThreshold: number
  ) => {
    const val = parseNumber(measuredVal);
    if (val === null) return null;

    let checkedVal = val;
    let unit = isPercentage ? "%" : " ms";
    
    if (isPercentage && !String(measuredVal).includes("%")) {
      checkedVal = (val / cycleMs) * 100;
    }

    let diffVal = 0;
    let diffStr = "";
    let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
    let obs = "";

    if (isMinimum) {
      diffVal = checkedVal - limitVal;
      diffStr = `${diffVal >= 0 ? "+" : ""}${diffVal.toFixed(1)}${unit}`;
      
      if (checkedVal >= limitVal) {
        estado = "Conforme";
        obs = `Fase ${name} conforme con la norma ISO (mínimo ${limitVal}${unit}).`;
      } else if (checkedVal >= yellowThreshold) {
        estado = "Advertencia";
        obs = `Fase ${name} levemente corta. Norma ISO requiere al menos ${limitVal}${unit}.`;
      } else if (checkedVal >= redThreshold) {
        estado = "Fuera de tolerancia";
        obs = `Fase ${name} fuera de tolerancia ISO. Insuficiente tiempo de recuperación o extracción.`;
      } else {
        estado = "Crítico";
        obs = `Fase ${name} críticamente deficiente (${checkedVal.toFixed(1)}${unit}). Riesgo para la salud del pezón.`;
      }
    } else {
      diffVal = checkedVal - limitVal;
      diffStr = `${diffVal >= 0 ? "+" : ""}${diffVal.toFixed(1)}${unit}`;

      if (checkedVal <= limitVal) {
        estado = "Conforme";
        obs = `Fase ${name} conforme con la norma ISO (máximo ${limitVal}${unit}).`;
      } else if (checkedVal <= yellowThreshold) {
        estado = "Advertencia";
        obs = `Fase ${name} ligeramente lenta. Norma ISO establece máximo ${limitVal}${unit}.`;
      } else if (checkedVal <= redThreshold) {
        estado = "Fuera de tolerancia";
        obs = `Fase ${name} lenta fuera de tolerancia. Pérdida de eficiencia en transiciones de vacío.`;
      } else {
        estado = "Crítico";
        obs = `Fase ${name} excesivamente lenta (${checkedVal.toFixed(1)}${unit}). Inestabilidad severa de vacío.`;
      }
    }

    return {
      parametro: `Fase ${name} (t${name})`,
      valorMedido: String(measuredVal).includes("ms") || String(measuredVal).includes("%") ? String(measuredVal) : `${val.toFixed(0)} ms (${checkedVal.toFixed(1)}%)`,
      valorPermitido: `${isMinimum ? "Mínimo" : "Máximo"} ${limitVal}${unit} (Norma ISO)`,
      diferencia: diffStr,
      estado,
      observacion: obs
    };
  };

  // --- 4. FASE a (ta) - Transición de vacío (ISO Máximo 15% del ciclo) ---
  const evalTa = evaluatePhase("a", datos.taMedido, false, 15, true, 18, 22, 25);
  if (evalTa) evaluations.push(evalTa);

  // --- 5. FASE b (tb) - Extracción a máximo vacío (ISO Mínimo 30% del ciclo) ---
  const evalTb = evaluatePhase("b", datos.tbMedido, true, 30, true, 25, 20, 15);
  if (evalTb) evaluations.push(evalTb);

  // --- 6. FASE c (tc) - Transición a aire/colapso (ISO Máximo 10% del ciclo) ---
  const evalTc = evaluatePhase("c", datos.tcMedido, false, 10, true, 13, 16, 20);
  if (evalTc) evaluations.push(evalTc);

  // --- 7. FASE d (td) - Masaje / Presión atmosférica (ISO Mínimo 15% del ciclo y MÍNIMO 150 ms absolutos) ---
  const evalTd = evaluatePhase("d", datos.tdMedido, true, 15, true, 12, 10, 8);
  if (evalTd) {
    const tdMs = parseNumber(datos.tdMedido) || 0;
    if (tdMs > 0 && tdMs < 150) {
      if (evalTd.estado === "Conforme") {
        evalTd.estado = "Advertencia";
        evalTd.observacion = `Fase d es >= 15% en porcentaje pero menor a 150 ms absolutos exigidos por norma ISO para masaje mamario.`;
      }
    }
    evaluations.push(evalTd);
  }

  // --- 8. DESBALANCE ENTRE CANALES (Norma ISO: Máximo 5.0% de diferencia entre canales) ---
  const measuredDesbalance = parseNumber(datos.desbalanceMedido);
  if (measuredDesbalance !== null) {
    let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
    let obs = "";

    if (measuredDesbalance <= 5) {
      estado = "Conforme";
      obs = "Desbalance entre canales en conformidad con la norma ISO (<= 5.0%).";
    } else if (measuredDesbalance <= 8) {
      estado = "Advertencia";
      obs = "Desbalance superior al 5.0% recomendado por norma ISO. Sugiere desgaste asimétrico de cámaras o diafragma.";
    } else if (measuredDesbalance <= 12) {
      estado = "Fuera de tolerancia";
      obs = "Desbalance fuera de tolerancia ISO. Provoca ordeño desigual entre cuartos.";
    } else {
      estado = "Crítico";
      obs = "Desbalance crítico entre canales. Alto riesgo de irritación unilateral y congestión.";
    }

    evaluations.push({
      parametro: "Diferencia / Desbalance de canales",
      valorMedido: `${measuredDesbalance.toFixed(1)}%`,
      valorPermitido: "Máximo 5.0% (Norma ISO)",
      diferencia: `${measuredDesbalance > 5 ? "+" : ""}${(measuredDesbalance).toFixed(1)}%`,
      estado,
      observacion: obs
    });
  }

  // --- 9. BALANCE DE CANALES ---
  if (datos.balanceMedido && measuredDesbalance === null) {
    const balPct = parseRatioPercentage(datos.balanceMedido);
    if (balPct !== null) {
      const dev = Math.abs(balPct - 50);
      const desbalanceCalc = dev * 2;
      let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
      let obs = "";

      if (desbalanceCalc <= 5) {
        estado = "Conforme";
        obs = "Balance conforme a norma ISO (diferencia entre canales <= 5.0%).";
      } else if (desbalanceCalc <= 8) {
        estado = "Advertencia";
        obs = "Diferencia de balance excede el 5.0% ISO. Se aconseja inspección de válvulas o bobinas.";
      } else if (desbalanceCalc <= 12) {
        estado = "Fuera de tolerancia";
        obs = "Diferencia de balance fuera de tolerancia ISO. Afecta el ordeño alternado.";
      } else {
        estado = "Crítico";
        obs = "Balance de canales críticamente descalibrado.";
      }

      evaluations.push({
        parametro: "Balance de canales",
        valorMedido: String(datos.balanceMedido),
        valorPermitido: "50/50 (Diferencia máx 5.0% según ISO)",
        diferencia: `${desbalanceCalc.toFixed(1)}% desvío`,
        estado,
        observacion: obs
      });
    }
  }

  // --- 10. VACÍO DE OPERACIÓN (Norma ISO: 40.0 - 50.0 kPa estándar de ordeño) ---
  const measuredVac = parseNumber(datos.vacioMedido);
  if (measuredVac !== null) {
    let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
    let obs = "";
    let diffStr = "";

    if (measuredVac >= vacRange.min && measuredVac <= vacRange.max) {
      estado = "Conforme";
      obs = "Nivel de vacío en conformidad con el rango operativo estándar ISO.";
      diffStr = "0.0 kPa";
    } else {
      const diffMin = measuredVac - vacRange.min;
      const diffMax = measuredVac - vacRange.max;
      const diff = measuredVac < vacRange.min ? diffMin : diffMax;
      diffStr = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} kPa`;
      const absDiff = Math.abs(diff);

      if (absDiff <= 2) {
        estado = "Advertencia";
        obs = `Vacío levemente fuera de rango ISO (${vacRange.min} - ${vacRange.max} kPa).`;
      } else if (absDiff <= 5) {
        estado = "Fuera de tolerancia";
        obs = `Nivel de vacío fuera de tolerancia ISO. Puede ocasionar deslizamiento de pezoneras o hiperqueratosis.`;
      } else {
        estado = "Crítico";
        obs = `Vacío en nivel crítico. Alto riesgo de lesión tisular severa.`;
      }
    }

    evaluations.push({
      parametro: "Nivel de vacío",
      valorMedido: `${measuredVac.toFixed(1)} kPa`,
      valorPermitido: `${vacRange.min} - ${vacRange.max} kPa (Rango ISO)`,
      diferencia: diffStr,
      estado,
      observacion: obs
    });
  }

  // --- 11. OTROS PARÁMETROS EXTRAÍDOS DEL INFORME ---
  if (Array.isArray(datos.otrosParametros)) {
    for (const item of datos.otrosParametros) {
      if (item && item.nombre && item.valor) {
        evaluations.push({
          parametro: String(item.nombre),
          valorMedido: String(item.valor),
          valorPermitido: "Extraído de reporte ISO",
          diferencia: "0.0",
          estado: "Conforme",
          observacion: "Parámetro complementario extraído del informe del pulsógrafo."
        });
      }
    }
  }

  // Determine overall status based on worst individual status
  let worstStatus: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
  const statusHierarchy: Record<string, number> = {
    "Conforme": 0,
    "Advertencia": 1,
    "Fuera de tolerancia": 2,
    "Crítico": 3
  };

  for (const evalItem of evaluations) {
    if (statusHierarchy[evalItem.estado] > statusHierarchy[worstStatus]) {
      worstStatus = evalItem.estado;
    }
  }

  let nivelCriticidad: "Bajo" | "Medio" | "Alto" = "Bajo";
  if (worstStatus === "Crítico") {
    nivelCriticidad = "Alto";
  } else if (worstStatus === "Fuera de tolerancia") {
    nivelCriticidad = "Medio";
  } else if (worstStatus === "Advertencia") {
    nivelCriticidad = "Bajo";
  }

  // Generate Posibles Causas and Acciones Correctivas based on non-conforming ISO parameters
  const posiblesCausasSet = new Set<string>();
  const accionesCorrectivasSet = new Set<string>();

  for (const item of evaluations) {
    if (item.estado !== "Conforme") {
      const pName = item.parametro.toLowerCase();
      if (pName.includes("frecuencia")) {
        posiblesCausasSet.add("Regulador de pulsación descalibrado o falla electrónica en la tarjeta de control.");
        posiblesCausasSet.add("Filtro de aire del pulsador sucio u obstruido.");
        accionesCorrectivasSet.add("Calibrar o ajustar la frecuencia de pulsación a 60 ppm según norma ISO 5707.");
        accionesCorrectivasSet.add("Limpiar y desobstruir el filtro de aire o cambiar el elemento filtrante.");
      }
      if (pName.includes("relación")) {
        posiblesCausasSet.add("Desgaste de membranas o diafragmas internos del pulsador.");
        posiblesCausasSet.add("Pérdida de vacío o ingreso no deseado de aire en las cámaras de pulsado.");
        accionesCorrectivasSet.add("Reemplazar el kit de membranas/diafragmas de goma por repuestos originales.");
        accionesCorrectivasSet.add("Inspeccionar conexiones y sellos para eliminar fugas de vacío.");
      }
      if (pName.includes("fase a") || pName.includes("ta")) {
        posiblesCausasSet.add("Obstrucción parcial en las canillas o conductos de entrada de aire.");
        posiblesCausasSet.add("Desgaste del distribuidor o restrictor de paso de aire.");
        accionesCorrectivasSet.add("Limpiar conductos y boquillas de entrada de aire.");
        accionesCorrectivasSet.add("Verificar y sustituir válvulas de conmutación del distribuidor.");
      }
      if (pName.includes("fase b") || pName.includes("tb")) {
        posiblesCausasSet.add("Mangueras de pulsado deterioradas, agrietadas o estranguladas.");
        posiblesCausasSet.add("Pérdida de vacío en la línea principal de transporte.");
        accionesCorrectivasSet.add("Reemplazar mangueras de pulsado por nuevas de silicona o hule sintético.");
        accionesCorrectivasSet.add("Restablecer el nivel de vacío regulado según ISO 6690.");
      }
      if (pName.includes("fase c") || pName.includes("tc")) {
        posiblesCausasSet.add("Filtro de aire saturado o suciedad acumulada en el puerto de ventilación.");
        posiblesCausasSet.add("Resortes de retorno o diafragmas rígidos por desgaste de material.");
        accionesCorrectivasSet.add("Limpiar o reemplazar el filtro de aire del pulsador.");
        accionesCorrectivasSet.add("Sustituir resortes y empaques internos del mecanismo.");
      }
      if (pName.includes("fase d") || pName.includes("td")) {
        posiblesCausasSet.add("Desgaste de diafragmas o sellos de hule.");
        posiblesCausasSet.add("Ingreso de aire inadecuado en la fase de descanso / masaje.");
        accionesCorrectivasSet.add("Sustituir diafragmas y calibrar la fase de masaje a un mínimo de 150 ms (ISO 5707).");
        accionesCorrectivasSet.add("Verificar la soltura y tensión mecánica de las cámaras.");
      }
      if (pName.includes("desbalance") || pName.includes("balance")) {
        posiblesCausasSet.add("Desgaste asimétrico en los canales A y B del distribuidor.");
        posiblesCausasSet.add("Manguera de pulsado de un canal parcialmente obstruida o doblada.");
        accionesCorrectivasSet.add("Sustituir el bloque distribuidor de pulsación alternada.");
        accionesCorrectivasSet.add("Alinear y liberar las mangueras de pulsado a las pezoneras.");
      }
      if (pName.includes("vacío")) {
        posiblesCausasSet.add("Regulador mal calibrado o válvula de regulación inestable.");
        posiblesCausasSet.add("Conexiones defectuosas o fugas de vacío en los acoples rápidos.");
        accionesCorrectivasSet.add("Calibrar la válvula reguladora de vacío al rango normativo (40 - 50 kPa).");
        accionesCorrectivasSet.add("Sellar acoples y verificar hermeticidad general del sistema.");
      }
    }
  }

  let posiblesCausas = Array.from(posiblesCausasSet);
  let accionesCorrectivas = Array.from(accionesCorrectivasSet);

  if (posiblesCausas.length === 0) {
    if (worstStatus === "Conforme") {
      posiblesCausas = ["El equipo no presenta anomalías mecánicas o neumáticas visibles. Opera dentro de la norma ISO."];
      accionesCorrectivas = [
        "Continuar con el programa de mantenimiento preventivo rutinario.",
        "Limpieza periódica de filtros de aire del pulsador cada 100 horas de uso."
      ];
    } else {
      posiblesCausas = [
        "Desgaste general de membranas o diafragmas.",
        "Ingreso de aire o suciedad en conductos de pulsado.",
        "Filtro sucio o regulador de vacío mal calibrado."
      ];
      accionesCorrectivas = [
        "Realizar service integral y cambio de kit de reparación.",
        "Verificar calibración con pulsógrafo patrón según norma ISO 6690."
      ];
    }
  }

  // Generate Non-technical Producer Report (Informe para Productor)
  let queSignifica = "";
  let queRiesgosExisten = "";
  let queSeRecomiendaHacer = "";

  if (worstStatus === "Conforme") {
    queSignifica = "El pulsador está funcionando de manera óptima y cumple totalmente con las normas internacionales ISO 5707 y 6690. Las fases de ordeño y masaje son equilibradas.";
    queRiesgosExisten = "No existen riesgos para la salud de las ubres ni para la velocidad de ordeño en este momento.";
    queSeRecomiendaHacer = "Continuar con las rutinas habituales de ordeño y realizar la limpieza periódica de los filtros de aire.";
  } else if (worstStatus === "Advertencia") {
    queSignifica = "El pulsador funciona, pero presenta pequeñas desviaciones respecto a la norma ISO. El ritmo o la fuerza del pulso muestran ligeras variaciones.";
    queRiesgosExisten = "Riesgo de ordeño ligeramente más lento o leve molestia en la punta del pezón si no se corrige a tiempo.";
    queSeRecomiendaHacer = "Programar una revisión técnica preventiva en los próximos días para limpiar filtros o cambiar membranas desgastadas.";
  } else if (worstStatus === "Fuera de tolerancia") {
    queSignifica = "El pulsador no cumple con las tolerancias exigidas por la norma ISO. Las fases de masaje o de ordeño están descompensadas.";
    queRiesgosExisten = "Riesgo alto de sobreordeño, congestión en el pezón, aumento de recuento de células somáticas e irritación del esfínter.";
    queSeRecomiendaHacer = "Realizar mantenimiento técnico a la brevedad. Reemplazar el kit de membranas y calibrar el pulsador.";
  } else {
    queSignifica = "El pulsador presenta una falla crítica severa. El patrón de pulso está interrumpido o descalibrado peligrosamente.";
    queRiesgosExisten = "Riesgo severo de mastitis, daño permanente en el tejido mamario (hiperqueratosis) y pérdida importante de leche.";
    queSeRecomiendaHacer = "Desactivar o reemplazar este pulsador de inmediato antes del próximo ordeño hasta realizar la reparación técnica.";
  }

  const informeProductor: InformeProductor = {
    estadoGeneral: worstStatus,
    queSignifica,
    queRiesgosExisten,
    queSeRecomiendaHacer
  };

  return {
    evaluacionISO: evaluations,
    estadoGeneral: worstStatus,
    nivelCriticidad,
    posiblesCausas,
    accionesCorrectivas,
    informeProductor
  };
}
