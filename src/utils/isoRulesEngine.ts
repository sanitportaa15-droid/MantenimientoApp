export interface ParametroISOEvaluacion {
  parametro: string;
  valorMedido: string;
  valorPermitido: string;
  diferencia: string;
  estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico";
  observacion: string;
}

export interface PosibleCausaDetallada {
  causa: string;
  probabilidad: "Alta" | "Media" | "Baja";
  justificacion: string;
  justificacionProductor?: string;
}

export interface InformeProductor {
  estadoGeneral: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico";
  queSignifica: string;
  queRiesgosExisten: string;
  queSeRecomiendaHacer: string;
  interpretacion: string;
  conclusionFinal: string;
  posiblesCausasSencillas?: string[];
  planInspeccionSencillo?: string[];
  impactoPotencialSencillo?: string[];
}

export interface ResultadoEvaluacionISO {
  evaluacionISO: ParametroISOEvaluacion[];
  estadoGeneral: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico";
  nivelCriticidad: "Bajo" | "Medio" | "Alto";
  posiblesCausas: string[];
  posiblesCausasDetalladas: PosibleCausaDetallada[];
  planInspeccion: string[];
  impactoPotencial: string[];
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

  // Generate Posibles Causas, Plan de Inspección y Riesgos Operativos
  const causasDetalladas: PosibleCausaDetallada[] = [];
  const planInspeccionStepsSet = new Set<string>();
  const impactoPotencialSet = new Set<string>();
  const accionesCorrectivasSet = new Set<string>();

  let hasFreq = false;
  let hasRatio = false;
  let hasPhaseA = false;
  let hasPhaseB = false;
  let hasPhaseC = false;
  let hasPhaseD = false;
  let hasBalance = false;
  let hasVacuum = false;

  for (const item of evaluations) {
    if (item.estado !== "Conforme") {
      const pName = item.parametro.toLowerCase();
      if (pName.includes("frecuencia")) hasFreq = true;
      if (pName.includes("relación")) hasRatio = true;
      if (pName.includes("fase a") || pName.includes("ta")) hasPhaseA = true;
      if (pName.includes("fase b") || pName.includes("tb")) hasPhaseB = true;
      if (pName.includes("fase c") || pName.includes("tc")) hasPhaseC = true;
      if (pName.includes("fase d") || pName.includes("td")) hasPhaseD = true;
      if (pName.includes("desbalance") || pName.includes("balance")) hasBalance = true;
      if (pName.includes("vacío")) hasVacuum = true;
    }
  }

  if (hasFreq) {
    causasDetalladas.push({
      causa: "Regulador de pulsación descalibrado o desajuste mecánico",
      probabilidad: "Alta",
      justificacion: "La desviación de frecuencia observada respecto del estándar nominal (60 ppm ± 3) es compatible con una descalibración del tornillo o mecanismo regulador de velocidad de conmutación.",
      justificacionProductor: "El pulsador está latiendo fuera del ritmo óptimo (60 golpes por minuto), lo que suele indicar un desajuste en el regulador."
    });
    causasDetalladas.push({
      causa: "Restricción en el filtro de aire o entrada de ventilación parcial",
      probabilidad: "Media",
      justificacion: "La acumulación de polvo o suciedad en el filtro de ventilación incrementa la resistencia neumática, lo cual suele ocasionar variaciones en el ritmo del pulso.",
      justificacionProductor: "Filtros de aire sucios o tapados que le quitan fluidez al movimiento del pulsador."
    });
    planInspeccionStepsSet.add("Verificar la alimentación y señal eléctrica de control si el equipo cuenta con pulsación electrónica.");
    planInspeccionStepsSet.add("Inspeccionar y limpiar el filtro de aire del pulsador o sustituir el elemento filtrante.");
    planInspeccionStepsSet.add("Verificar la calibración de frecuencia y ajustar a 60 ppm con un vacuómetro/pulsógrafo patrón según norma ISO 5707.");
    impactoPotencialSet.add("Variación no deseada en la velocidad de ordeño de los animales.");
    impactoPotencialSet.add("Mayor tiempo total de ordeño por lote y posible sobreestimulación del esfínter.");
    accionesCorrectivasSet.add("Calibrar la frecuencia de pulsación a 60 ppm (± 3 ppm) de acuerdo con la norma ISO 5707.");
    accionesCorrectivasSet.add("Limpiar o sustituir el filtro de aire y verificar la limpieza de los orificios de ventilación.");
  }

  if (hasRatio) {
    causasDetalladas.push({
      causa: "Desgaste de membranas o diafragmas internos del pulsador",
      probabilidad: "Alta",
      justificacion: "Una alteración en la relación entre la fase de ordeño y la de masaje es compatible con fatiga de material o pérdida de elasticidad en las membranas de goma o silicona.",
      justificacionProductor: "Las membranas internas se van gastando por el uso continuo, alterando los tiempos de apertura y cierre."
    });
    causasDetalladas.push({
      causa: "Microfugas de vacío o estanqueidad deficiente en cámaras de pulsado",
      probabilidad: "Media",
      justificacion: "Pérdidas menores de hermeticidad en los acoples o juntas del bloque de pulsación pueden modificar la proporción efectiva de vacío.",
      justificacionProductor: "Pérdidas chicas de vacío por juntas o acoples flojos que distorsionan el ritmo."
    });
    planInspeccionStepsSet.add("Inspeccionar el estado físico, flexibilidad y estanqueidad de las membranas del pulsador.");
    planInspeccionStepsSet.add("Revisar sellos y juntas tóricas del bloque de pulsación para descarta fugas de aire.");
    planInspeccionStepsSet.add("Verificar que las mangueras de pulsado no presenten fisuras ni porosidades.");
    impactoPotencialSet.add("Riesgo de sobreordeño o vaciado incompleto de los cuartos mamarios.");
    impactoPotencialSet.add("Mayor propensión a congestión y edema en la punta del pezón por desproporción de fases.");
    accionesCorrectivasSet.add("Reemplazar el kit de membranas/diafragmas desgastados por repuestos originales.");
    accionesCorrectivasSet.add("Inspeccionar conexiones y sellos para eliminar fugas de vacío en las cámaras.");
  }

  if (hasPhaseA) {
    causasDetalladas.push({
      causa: "Restricción o reducción de sección en líneas neumáticas o canillas",
      probabilidad: "Alta",
      justificacion: "Una fase 'a' prolongada (transición lenta hacia el vacío) es compatible con obstrucciones parciales, estrangulamientos o sedimentos en los tubos de pulsado.",
      justificacionProductor: "Mangueras o cañerías parcialmente apretadas o sucias que frenan la entrada de vacío."
    });
    causasDetalladas.push({
      causa: "Desgaste en la válvula o distribuidor de aire del pulsador",
      probabilidad: "Media",
      justificacion: "El desgaste en las superficies de conmutación del distribuidor reduce el área de paso de aire, demorando la formación de vacío en la copa.",
      justificacionProductor: "El distribuidor interno del pulsador está desgastado y demora el cambio de fase."
    });
    planInspeccionStepsSet.add("Inspeccionar las mangueras de pulsado buscando pliegues, estrangulamientos o depósitos de suciedad.");
    planInspeccionStepsSet.add("Desarmar y limpiar los orificios del bloque distribuidor de aire.");
    planInspeccionStepsSet.add("Verificar la limpieza y ajuste de las canillas de pulsado.");
    impactoPotencialSet.add("Pérdida de eficiencia en la velocidad de extracción de leche.");
    impactoPotencialSet.add("Incremento en la duración del turno de ordeño.");
    accionesCorrectivasSet.add("Desobstruir conductos de aire y reemplazar mangueras dobladas o deterioradas.");
  }

  if (hasPhaseB) {
    causasDetalladas.push({
      causa: "Deficiencia o caída de vacío en la línea de pulsación",
      probabilidad: "Alta",
      justificacion: "Un tiempo de extracción (fase b) por debajo del estándar normativo (mínimo 30%) sugiere una presión de vacío de línea reducida o caídas bruscas durante el ordeño.",
      justificacionProductor: "Falta de presión de vacío firme en la línea mientras se ordeña."
    });
    causasDetalladas.push({
      causa: "Mangueras de pulsado deterioradas o con fisuras",
      probabilidad: "Media",
      justificacion: "Entradas parásitas de aire a través de grietas en las mangueras acortan el periodo en que se mantiene el máximo vacío operativo.",
      justificacionProductor: "Mangueras cuarteadas o viejas que dejan pasar aire no deseado."
    });
    planInspeccionStepsSet.add("Medir la presión de vacío efectiva en la línea de pulsación durante el ordeño.");
    planInspeccionStepsSet.add("Revisar mangueras cortas y largas de pulsado en busca de porosidades.");
    planInspeccionStepsSet.add("Comprobar la estanqueidad de las copas y el colector de ordeño.");
    impactoPotencialSet.add("Ordeño incompleto y retención involuntaria de leche en la ubre.");
    impactoPotencialSet.add("Disminución del rendimiento de bajada de leche por unidad de tiempo.");
    accionesCorrectivasSet.add("Restablecer el nivel de vacío regulado según ISO 6690 y sustituir mangueras defectuosas.");
  }

  if (hasPhaseC) {
    causasDetalladas.push({
      causa: "Filtro de aire saturado o suciedad acumulada en el puerto de ventilación",
      probabilidad: "Alta",
      justificacion: "Una fase 'c' prolongada (transición lenta a presión atmosférica) suele asociarse con un filtro de aire tupido que frena el ingreso de aire atmosférico.",
      justificacionProductor: "Filtro de aire tapado de tierra que impide que la pezonera colapse a tiempo."
    });
    causasDetalladas.push({
      causa: "Fatiga o pérdida de tensión en los resortes de retorno del pulsador",
      probabilidad: "Media",
      justificacion: "Resortes mecánicos fatigados demoran el cierre del obturador de vacío hacia la posición de reposo.",
      justificacionProductor: "Resortes del pulsador desgastados que no cierran la válvula con rapidez."
    });
    planInspeccionStepsSet.add("Inspeccionar, limpiar o reemplazar el elemento filtrante de aire del pulsador.");
    planInspeccionStepsSet.add("Limpiar el puerto atmosférico y comprobar que esté libre de grasa o suciedad.");
    planInspeccionStepsSet.add("Revisar la tensión y estado mecánico de los resortes internos.");
    impactoPotencialSet.add("Inestabilidad en la velocidad de colapso de las pezoneras.");
    impactoPotencialSet.add("Estrés mecánico repetitivo sobre la piel y tejido del pezón.");
    accionesCorrectivasSet.add("Limpiar o sustituir el filtro de aire y renovar resortes de retorno fatigados.");
  }

  if (hasPhaseD) {
    causasDetalladas.push({
      causa: "Descalibración del pulsador o desgaste progresivo de membranas",
      probabilidad: "Alta",
      justificacion: "Una reducción del tiempo de la fase d suele asociarse con una disminución del tiempo efectivo de masaje. Este comportamiento puede ser compatible con un pulsador descalibrado o con desgaste de sus membranas.",
      justificacionProductor: "Las membranas desgastadas o la descalibración reducen el tiempo en que la pezonera masajea el pezón."
    });
    causasDetalladas.push({
      causa: "Restricción en la entrada de aire atmosférico al cuerpo del pulsador",
      probabilidad: "Media",
      justificacion: "Paso de aire dificultado que impide mantener la pezonera colapsada el periodo mínimo de 150 ms exigido para el masaje tisular.",
      justificacionProductor: "Ingreso de aire sofocado que acorta el descanso de la punta del pezón."
    });
    planInspeccionStepsSet.add("Verificar el nivel de vacío del sistema.");
    planInspeccionStepsSet.add("Inspeccionar posibles fugas de aire.");
    planInspeccionStepsSet.add("Revisar el regulador de vacío.");
    planInspeccionStepsSet.add("Verificar el funcionamiento del pulsador.");
    planInspeccionStepsSet.add("Inspeccionar el estado de las membranas.");
    planInspeccionStepsSet.add("Revisar mangueras y conexiones.");
    planInspeccionStepsSet.add("Repetir la medición una vez realizada la intervención.");
    impactoPotencialSet.add("Aumento del riesgo de mastitis por falta de alivio a la congestión en la punta del pezón.");
    impactoPotencialSet.add("Riesgo de sobreordeño, congestión e hiperqueratosis del esfínter.");
    impactoPotencialSet.add("Disminución del bienestar animal y malestar durante el ordeño.");
    accionesCorrectivasSet.add("Sustituir membranas y recalibrar la fase de masaje a un mínimo de 150 ms (ISO 5707).");
  }

  if (hasBalance) {
    causasDetalladas.push({
      causa: "Desgaste asimétrico en membranas o bloque distribuidor",
      probabilidad: "Alta",
      justificacion: "Un desbalance superior al 5% entre los canales A y B suele indicar un desgaste desigual en las membranas o en los asientos del distribuidor.",
      justificacionProductor: "El pulsador trabaja de forma dispareja entre un par de copas y el otro por desgaste asimétrico."
    });
    causasDetalladas.push({
      causa: "Manguera de pulsado de un canal parcialmente obstruida o estrangulada",
      probabilidad: "Media",
      justificacion: "Diferencias en la longitud o deformidad del tubo de un solo canal provocan una conmutación neumática asimétrica.",
      justificacionProductor: "Manguera doblada o apretada en uno solo de los canales del pulsador."
    });
    planInspeccionStepsSet.add("Inspeccionar y comparar el desgaste de las membranas del canal A y canal B.");
    planInspeccionStepsSet.add("Comprobar que las mangueras de ambos canales tengan la misma longitud e integridad.");
    planInspeccionStepsSet.add("Limpiar los conductos de salida del bloque distribuidor.");
    impactoPotencialSet.add("Ordeño desigual entre cuartos mamarios.");
    impactoPotencialSet.add("Congestión y riesgo de mastitis focalizada en los cuartos afectados.");
    accionesCorrectivasSet.add("Sustituir el bloque distribuidor y nivelar mangueras de pulsado.");
  }

  if (hasVacuum) {
    causasDetalladas.push({
      causa: "Regulador de vacío descalibrado o con suciedad en la válvula de alivio",
      probabilidad: "Alta",
      justificacion: "Un nivel de vacío fuera del rango normativo ISO (40-50 kPa) se asocia frecuentemente a una mala calibración del regulador o acumulación de suciedad en su asiento.",
      justificacionProductor: "El regulador de vacío está desajustado o sucio, desestabilizando la presión de ordeño."
    });
    causasDetalladas.push({
      causa: "Ingreso de aire o fugas de vacío en la red principal y acoples",
      probabilidad: "Media",
      justificacion: "Entradas parásitas de aire reducen la presión de vacío disponible en los puntos de ordeño.",
      justificacionProductor: "Fugas de aire en las uniones de caño o mangueras de la sala."
    });
    causasDetalladas.push({
      causa: "Falta de mantenimiento preventivo en la bomba de vacío o correa floja",
      probabilidad: "Baja",
      justificacion: "Rendimiento insuficiente de la bomba de vacío debido a descompresión o patinamiento de la correa de mando.",
      justificacionProductor: "La bomba de vacío no rinde adecuadamente por falta de mantenimiento."
    });
    planInspeccionStepsSet.add("Verificar y calibrar el regulador de vacío con un vacuómetro patrón.");
    planInspeccionStepsSet.add("Inspeccionar la red principal y acoples rápidos en busca de fugas de aire.");
    planInspeccionStepsSet.add("Verificar el funcionamiento de la bomba de vacío y tensión de correas.");
    impactoPotencialSet.add("Deslizamiento o caída de pezoneras si el vacío es insuficiente.");
    impactoPotencialSet.add("Lesión tisular severa e hiperqueratosis si el vacío es excesivo.");
    impactoPotencialSet.add("Incremento general del desgaste de componentes del equipo.");
    accionesCorrectivasSet.add("Calibrar la válvula del regulador de vacío al rango normativo (40 - 50 kPa).");
    accionesCorrectivasSet.add("Sellar acoples y verificar hermeticidad general del sistema.");
  }

  // Default fallback if CONFORME
  if (worstStatus === "Conforme") {
    causasDetalladas.push({
      causa: "Comportamiento mecánico y neumático dentro de tolerancias ISO",
      probabilidad: "Baja",
      justificacion: "Las mediciones no muestran desvíos de frecuencia, tiempos de fase ni vacío. Los resultados son compatibles con un pulsador adecuadamente calibrado y en correcto estado de mantenimiento.",
      justificacionProductor: "El equipo no presenta anomalías. Funciona perfectamente de acuerdo a las normas internacionales."
    });
    planInspeccionStepsSet.add("Continuar con el plan de mantenimiento preventivo programado.");
    planInspeccionStepsSet.add("Realizar limpieza periódica del filtro de aire atmosférico.");
    planInspeccionStepsSet.add("Programar el próximo control periódico con pulsógrafo según protocolo.");
    impactoPotencialSet.add("Preservación de la salud de la ubre y óptima eficiencia de ordeño.");
    impactoPotencialSet.add("Garantía de confort y bienestar animal durante el proceso de extracción.");
    accionesCorrectivasSet.add("Continuar con el mantenimiento preventivo rutinario del sistema de ordeño.");
  }

  const planInspeccion = Array.from(planInspeccionStepsSet);
  const impactoPotencial = Array.from(impactoPotencialSet);
  const accionesCorrectivas = Array.from(accionesCorrectivasSet);

  // String array version for backward compatibility
  const posiblesCausas = causasDetalladas.map(c => `${c.causa} [${c.probabilidad} probabilidad]: ${c.justificacion}`);

  // Generate Non-technical Producer Report (Informe para Productor)
  let queSignifica = "";
  let queRiesgosExisten = "";
  let queSeRecomiendaHacer = "";
  let interpretacion = "";
  let conclusionFinal = "";

  if (worstStatus === "Conforme") {
    queSignifica = "El sistema de pulsación funciona de manera óptima y cumple totalmente con los parámetros establecidos por las normas internacionales ISO 5707 e ISO 6690. Las fases de ordeño y masaje se encuentran perfectamente equilibradas.";
    queRiesgosExisten = "No existen riesgos para la salud de las ubres ni para la velocidad del ordeño en las condiciones actuales.";
    queSeRecomiendaHacer = "Continuar con el mantenimiento preventivo rutinario del sistema de ordeño, respetando el plan de mantenimiento establecido para el establecimiento.";
    interpretacion = "El sistema de pulsación se encuentra funcionando dentro de los parámetros establecidos por las normas ISO, lo que favorece un ordeño eficiente, permite una extracción completa de la leche y contribuye de manera directa al bienestar animal y a la preservación de los pezones.";
    conclusionFinal = "En conclusión, el equipo evaluado presenta un desempeño totalmente satisfactorio y conforme con la normativa técnica vigente. No se requieren intervenciones correctivas de urgencia. Se recomienda continuar con los controles periódicos programados para asegurar la constancia y calidad del ordeño en la sala.";
  } else if (worstStatus === "Advertencia") {
    queSignifica = "El pulsador se encuentra operativo, pero registra pequeñas desviaciones respecto a los rangos óptimos de la norma ISO. El ritmo o la fuerza de conmutación muestran ligeras variaciones.";
    queRiesgosExisten = "Existe riesgo de ordeños ligeramente más lentos o congestión inicial en la punta del pezón si los desvíos se profundizan.";
    queSeRecomiendaHacer = "Programar una revisión técnica preventiva en los próximos días para limpiar conductos, verificar juntas o reemplazar componentes desgastados antes de que la falla avance.";
    interpretacion = "Aunque el pulsador continúa trabajando, las ligeras alteraciones en los tiempos de fase de pulso disminuyen la eficiencia general de la bajada de leche y pueden generar estrés mecánico innecesario en los esfínteres de la ubre. Corregir estos pequeños desvíos de forma oportuna evita fallas mayores.";
    conclusionFinal = "En conclusión, el equipo requiere una atención preventiva moderada a corto plazo. Si bien no se trata de una falla crítica inminente, ajustar y calibrar los valores fuera de rango garantizará la salud mamaria del rodeo y mantendrá el máximo rendimiento del ordeño diario.";
  } else if (worstStatus === "Fuera de tolerancia") {
    queSignifica = "El pulsador no cumple con las tolerancias exigidas por las normas ISO. Las fases de masaje o de ordeño se encuentran notablemente descompensadas.";
    queRiesgosExisten = "Riesgo alto de sobreordeño, congestión en el pezón, lesiones en la piel, aumento del recuento de células somáticas (RCS) y predisposición a contraer mastitis.";
    queSeRecomiendaHacer = "Realizar mantenimiento técnico a la brevedad. Reemplazar el kit de membranas/diafragmas y recalibrar los tiempos de pulso a los valores normativos.";
    interpretacion = "El funcionamiento fuera de tolerancia altera el vaciado de las mamellas e interrumpe la fase de descanso necesaria para la correcta circulación sanguínea en la punta del pezón. Esta alteración daña progresivamente los tejidos e incrementa la tasa de infecciones mamarias.";
    conclusionFinal = "En conclusión, el estado del pulsador representa un riesgo concreto para la salud de las vacas y la calidad del producto. Se recomienda efectuar el service técnico e higiénico a la brevedad antes de que la alteración repercuta en pérdidas productivas o inflamación en el rodeo.";
  } else {
    queSignifica = "El pulsador presenta una falla técnica crítica severa. El patrón de pulso se encuentra interrumpido o descalibrado a niveles peligrosos.";
    queRiesgosExisten = "Riesgo crítico de mastitis clínica, trauma severo en el tejido mamario (hiperqueratosis), dolor manifiesto durante el ordeño y caída del volumen producido.";
    queSeRecomiendaHacer = "Desactivar o reemplazar este pulsador de inmediato antes del próximo turno de ordeño hasta ejecutar la reparación técnica integral.";
    interpretacion = "La falla crítica suprime la fase de masaje imprescindible para liberar la congestión del pezón, sometiendo a las vacas a una succión de vacío continua y agresiva. Esta situación genera dolor en los animales, comportamiento inquieto durante la bajada y daños tisulares permanentes.";
    conclusionFinal = "En conclusión, el equipo evaluado no se encuentra apto para el ordeño y debe ser excluido de servicio inmediatamente. Su uso contraviene las pautas básicas de sanidad animal. Se insta a sustituir o reparar integralmente el componente antes de reiniciar las labores de ordeño.";
  }

  const informeProductor: InformeProductor = {
    estadoGeneral: worstStatus,
    queSignifica,
    queRiesgosExisten,
    queSeRecomiendaHacer,
    interpretacion,
    conclusionFinal,
    posiblesCausasSencillas: causasDetalladas.map(c => c.justificacionProductor || c.causa),
    planInspeccionSencillo: planInspeccion,
    impactoPotencialSencillo: impactoPotencial
  };

  return {
    evaluacionISO: evaluations,
    estadoGeneral: worstStatus,
    nivelCriticidad,
    posiblesCausas,
    posiblesCausasDetalladas: causasDetalladas,
    planInspeccion,
    impactoPotencial,
    accionesCorrectivas,
    informeProductor
  };
}
