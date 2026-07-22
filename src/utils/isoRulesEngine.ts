import {
  ParametroISOEvaluacion,
  PosibleCausaDetallada,
  InformeProductor,
  ResultadoIA,
  DatosCanalPulsador,
  DiferenciaCanalesInfo
} from "../types/aiDiagnosis";

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
  diferenciaCanales?: DiferenciaCanalesInfo;
}

function parseNumber(val: any): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "number") return val;
  const match = String(val).match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : null;
}

function formatExactNumber(val: any, fallbackDecimals: number = 1): string {
  if (val === undefined || val === null) return "S/D";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") {
    return Number.isInteger(val) ? val.toString() : val.toFixed(fallbackDecimals);
  }
  return String(val);
}

function parseVacuumRange(rangeStr: string): { min: number; max: number } {
  const defaultRange = { min: 40.0, max: 50.0 };
  if (!rangeStr) return defaultRange;
  const numbers = rangeStr.match(/[0-9]+(?:\.[0-9]+)?/g);
  if (numbers && numbers.length >= 2) {
    return {
      min: parseFloat(numbers[0]),
      max: parseFloat(numbers[1]),
    };
  } else if (numbers && numbers.length === 1) {
    const singleVal = parseFloat(numbers[0]);
    return {
      min: singleVal - 4.0,
      max: singleVal + 4.0,
    };
  }
  return defaultRange;
}

function parseAllowedRatios(ratiosStr: string): number[] {
  if (!ratiosStr) return [60];
  const ratios: number[] = [];
  const parts = ratiosStr.split(/[,;\s]+/);
  for (const part of parts) {
    const match = part.match(/([0-9]+(?:\.[0-9]+)?)\s*[\/:-]\s*([0-9]+(?:\.[0-9]+)?)/);
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

function parseRatioPercentage(ratioStr: string): { first: number; second: number; raw: string } | null {
  if (!ratioStr) return null;
  const str = String(ratioStr).trim();
  const match = str.match(/([0-9]+(?:\.[0-9]+)?)\s*[\/:-]\s*([0-9]+(?:\.[0-9]+)?)/);
  if (match) {
    const f = parseFloat(match[1]);
    const s = parseFloat(match[2]);
    return { first: f, second: s, raw: str };
  }
  const singleNum = parseNumber(str);
  if (singleNum !== null && singleNum > 0 && singleNum < 100) {
    return { first: singleNum, second: 100 - singleNum, raw: `${singleNum} : ${100 - singleNum}` };
  }
  return null;
}

export function evaluatePulsatorISO(datos: any, specs?: any): ResultadoEvaluacionISO {
  const evaluations: ParametroISOEvaluacion[] = [];

  const nomFreq = (specs && parseNumber(specs.frecuenciaNominal)) || 60.0;
  const vacRange = (specs && parseVacuumRange(specs.vacioRecomendado)) || { min: 40.0, max: 50.0 };

  // Normalize channels
  let channels: DatosCanalPulsador[] = [];
  if (Array.isArray(datos.canales) && datos.canales.length > 0) {
    channels = datos.canales;
  } else {
    // Single channel fallback
    channels = [{
      nombreCanal: "Canal 1",
      frecuenciaMedida: datos.frecuenciaMedida,
      relacionMedida: datos.relacionMedida,
      vacioMedido: datos.vacioMedido,
      taMedido: datos.taMedido,
      tbMedido: datos.tbMedido,
      tcMedido: datos.tcMedido,
      tdMedido: datos.tdMedido,
      unidadFases: datos.unidadFases || "%"
    }];
  }

  // Evaluate each channel
  for (const ch of channels) {
    const chName = ch.nombreCanal || "Canal 1";
    const measuredFreq = parseNumber(ch.frecuenciaMedida ?? datos.frecuenciaMedida);

    // 1. FRECUENCIA DE PULSACIÓN
    if (measuredFreq !== null) {
      const diff = measuredFreq - nomFreq;
      const absDiff = Math.abs(diff);
      let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
      let obs = "";
      let interp = "";

      if (absDiff <= 3.0) {
        estado = "Conforme";
        obs = `Frecuencia conforme con norma ISO 5707:2007 (tolerancia ±3.0 ppm respecto al nominal ${nomFreq} ppm).`;
        interp = `Asegura la cadencia óptima de conmutación. Mantiene la tasa ideal de estímulo de bajada de leche sin sobrecargar la ubre.`;
      } else if (absDiff <= 5.0) {
        estado = "Advertencia";
        obs = `Ligera desviación de frecuencia (${measuredFreq} ppm vs nominal ${nomFreq} ppm). Norma ISO especifica ±3.0 ppm.`;
        interp = `Alteración moderada del ritmo de pulsación. Puede prolongar ligeramente el tiempo de ordeño por lote.`;
      } else if (absDiff <= 8.0) {
        estado = "Fuera de tolerancia";
        obs = `Frecuencia fuera del límite normativo ISO (desvío de ${diff > 0 ? "+" : ""}${diff.toFixed(1)} ppm). Requiere ajuste del regulador.`;
        interp = `Desviación significativa que altera la frecuencia de estímulo. Afecta la velocidad de flujo de leche e incrementa el estrés mamario.`;
      } else {
        estado = "Crítico";
        obs = `Frecuencia críticamente fuera de rango ISO (${measuredFreq} ppm). Severo riesgo de lesión de esfínter.`;
        interp = `Ritmo anómalo severo. Genera congestión vascular grave y riesgo inminente de trauma tisular.`;
      }

      evaluations.push({
        canal: chName,
        parametro: "Frecuencia de pulsación",
        valorMedido: `${measuredFreq} ppm`,
        valorPermitido: `${nomFreq} ppm (± 3.0 ppm según ISO 5707)`,
        diferencia: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} ppm`,
        estado,
        observacion: obs,
        interpretacion: interp
      });
    }

    // 2. RELACIÓN DE PULSACIÓN
    const rawRatioStr = ch.relacionMedida || datos.relacionMedida;
    const ratioObj = parseRatioPercentage(rawRatioStr);
    if (ratioObj) {
      const { first, second, raw } = ratioObj;
      const allowedRatios = (specs && parseAllowedRatios(specs.relacionesPermitidas)) || [60];
      let closestNominal = allowedRatios[0];
      let minDiff = Math.abs(first - closestNominal);
      for (const r of allowedRatios) {
        const d = Math.abs(first - r);
        if (d < minDiff) {
          minDiff = d;
          closestNominal = r;
        }
      }

      const diff = first - closestNominal;
      const absDiff = Math.abs(diff);
      let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
      let obs = "";
      let interp = "";

      if (absDiff <= 5.0) {
        estado = "Conforme";
        obs = `Relación de pulsación dentro de la tolerancia ISO 5707 (≤ ±5.0% respecto a nominal ${closestNominal}/${100 - closestNominal}).`;
        interp = `Proporción equilibrada entre la fase de ordeño y la de masaje. Garantiza una extracción eficiente protegiendo la punta del pezón.`;
      } else if (absDiff <= 8.0) {
        estado = "Advertencia";
        obs = `Desviación moderada. Exige no superar ±5.0% respecto a la relación nominal (${closestNominal}/${100 - closestNominal}).`;
        interp = `Ligero desbalance entre el tiempo de vaciado y el de descanso. Puede ralentizar el ordeño o congestionar pezones sensibles.`;
      } else if (absDiff <= 12.0) {
        estado = "Fuera de tolerancia";
        obs = `Relación de pulsación fuera del límite normativo ISO (desviación del ${diff.toFixed(1)}%).`;
        interp = `Alteración directa en los tiempos de ordeño y colapso de pezoneras. Riesgo de sobreordeño o vaciado incompleto.`;
      } else {
        estado = "Crítico";
        obs = `Relación severamente descompensada (${raw}). Alto riesgo de sobreordeño y edema mamario.`;
        interp = `Falta grave de balance neumático. Genera edema, congestión y dolor durante el ordeño.`;
      }

      evaluations.push({
        canal: chName,
        parametro: "Relación de pulsación",
        valorMedido: raw,
        valorPermitido: `${closestNominal}/${100 - closestNominal} (± 5.0% límite ISO)`,
        diferencia: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`,
        estado,
        observacion: obs,
        interpretacion: interp
      });
    }

    // 3. FASES A, B, C, D
    const activeCycleMs = measuredFreq && measuredFreq > 0 ? 60000 / measuredFreq : 1000;

    // Fase A (ta) - ISO Máximo 15% del ciclo
    const taVal = parseNumber(ch.taMedido ?? datos.taMedido);
    if (taVal !== null) {
      const unitIsMs = ch.unidadFases === "ms" || (taVal > 35);
      const taPct = unitIsMs ? (taVal / activeCycleMs) * 100 : taVal;
      const taMs = unitIsMs ? taVal : (taVal / 100) * activeCycleMs;

      let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
      let obs = "";
      let interp = "";

      if (taPct <= 15.0) {
        estado = "Conforme";
        obs = `Fase a (ta) conforme con norma ISO 5707 (≤ 15.0% del ciclo total).`;
        interp = `Transición rápida y limpia hacia la apertura completa del pezón. Evita pérdidas de tiempo en la fase de aumento de vacío.`;
      } else if (taPct <= 18.0) {
        estado = "Advertencia";
        obs = `Fase a levemente lenta (${taPct.toFixed(1)}%). ISO requiere ≤ 15.0%.`;
        interp = `Conmutación demorada. Puede deberse a pequeña restricción de aire en la línea o mangueras de pulsado.`;
      } else if (taPct <= 22.0) {
        estado = "Fuera de tolerancia";
        obs = `Fase a fuera de tolerancia ISO (${taPct.toFixed(1)}%). Restricción neumática en apertura.`;
        interp = `Apertura lenta de la pezonera. Disminuye el tiempo efectivo de ordeño y la velocidad de flujo de leche.`;
      } else {
        estado = "Crítico";
        obs = `Fase a excesivamente lenta (${taPct.toFixed(1)}%). Severa restricción neumática.`;
        interp = `Obstrucción grave o pérdida masiva de vacío de conmutación. Impide el correcto funcionamiento del pulsador.`;
      }

      evaluations.push({
        canal: chName,
        parametro: "Fase a (Transición a vacío)",
        valorMedido: `${taPct.toFixed(1)}% (${taMs.toFixed(0)} ms)`,
        valorPermitido: "Máximo 15.0% del ciclo (Norma ISO)",
        diferencia: `${(taPct - 15.0) >= 0 ? "+" : ""}${(taPct - 15.0).toFixed(1)}%`,
        estado,
        observacion: obs,
        interpretacion: interp
      });
    }

    // Fase B (tb) - ISO Mínimo 30% del ciclo
    const tbVal = parseNumber(ch.tbMedido ?? datos.tbMedido);
    if (tbVal !== null) {
      const unitIsMs = ch.unidadFases === "ms" || (tbVal > 50);
      const tbPct = unitIsMs ? (tbVal / activeCycleMs) * 100 : tbVal;
      const tbMs = unitIsMs ? tbVal : (tbVal / 100) * activeCycleMs;

      let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
      let obs = "";
      let interp = "";

      if (tbPct >= 30.0) {
        estado = "Conforme";
        obs = `Fase b (tb) conforme con norma ISO 5707 (≥ 30.0% del ciclo total).`;
        interp = `Tiempo de ordeño a máximo vacío suficiente para permitir el flujo constante y rápido de leche.`;
      } else if (tbPct >= 25.0) {
        estado = "Advertencia";
        obs = `Fase b levemente reducida (${tbPct.toFixed(1)}%). ISO requiere al menos 30.0%.`;
        interp = `Periodo de extracción acortado. Puede reducir levemente la tasa de flujo por minuto.`;
      } else if (tbPct >= 20.0) {
        estado = "Fuera de tolerancia";
        obs = `Fase b insuficiente (${tbPct.toFixed(1)}%). Incompleta extracción de leche.`;
        interp = `Insuficiente tiempo a máximo vacío. Conduce a vaciado incompleto de la ubre y aumento de tiempo en sala.`;
      } else {
        estado = "Crítico";
        obs = `Fase b críticamente baja (${tbPct.toFixed(1)}%). Caída drástica de rendimiento.`;
        interp = `Extracción de leche severamente comprometida por falta de estabilidad en el vacío de la cámara.`;
      }

      evaluations.push({
        canal: chName,
        parametro: "Fase b (Máximo vacío / Ordeño)",
        valorMedido: `${tbPct.toFixed(1)}% (${tbMs.toFixed(0)} ms)`,
        valorPermitido: "Mínimo 30.0% del ciclo (Norma ISO)",
        diferencia: `${(tbPct - 30.0) >= 0 ? "+" : ""}${(tbPct - 30.0).toFixed(1)}%`,
        estado,
        observacion: obs,
        interpretacion: interp
      });
    }

    // Fase C (tc) - ISO Máximo 10% del ciclo
    const tcVal = parseNumber(ch.tcMedido ?? datos.tcMedido);
    if (tcVal !== null) {
      const unitIsMs = ch.unidadFases === "ms" || (tcVal > 30);
      const tcPct = unitIsMs ? (tcVal / activeCycleMs) * 100 : tcVal;
      const tcMs = unitIsMs ? tcVal : (tcVal / 100) * activeCycleMs;

      let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
      let obs = "";
      let interp = "";

      if (tcPct <= 10.0) {
        estado = "Conforme";
        obs = `Fase c (tc) conforme con norma ISO 5707 (≤ 10.0% del ciclo total).`;
        interp = `Colapso ágil de la pezonera que inicia la fase de descanso e interrumpe la succión sin demoras.`;
      } else if (tcPct <= 13.0) {
        estado = "Advertencia";
        obs = `Fase c levemente lenta (${tcPct.toFixed(1)}%). ISO fija máximo 10.0%.`;
        interp = `Cierre progresivo lento. Sugiere filtro de aire sucio o pequeña restricción en el ingreso atmosférico.`;
      } else if (tcPct <= 16.0) {
        estado = "Fuera de tolerancia";
        obs = `Fase c fuera de tolerancia (${tcPct.toFixed(1)}%). Obstrucción atmosférica.`;
        interp = `Demora en el colapso de la pezonera. Retrasa el alivio de la congestión en la punta del pezón.`;
      } else {
        estado = "Crítico";
        obs = `Fase c excesivamente lenta (${tcPct.toFixed(1)}%). Filtro de aire tupido o resortes dañados.`;
        interp = `Incapacidad para colapsar la pezonera a tiempo. Ocasiona congestión continua y dolor al animal.`;
      }

      evaluations.push({
        canal: chName,
        parametro: "Fase c (Transición a aire)",
        valorMedido: `${tcPct.toFixed(1)}% (${tcMs.toFixed(0)} ms)`,
        valorPermitido: "Máximo 10.0% del ciclo (Norma ISO)",
        diferencia: `${(tcPct - 10.0) >= 0 ? "+" : ""}${(tcPct - 10.0).toFixed(1)}%`,
        estado,
        observacion: obs,
        interpretacion: interp
      });
    }

    // Fase D (td) - ISO Mínimo 15% del ciclo y MÍNIMO 150 ms
    const tdVal = parseNumber(ch.tdMedido ?? datos.tdMedido);
    if (tdVal !== null) {
      const unitIsMs = ch.unidadFases === "ms" || (tdVal > 40);
      const tdPct = unitIsMs ? (tdVal / activeCycleMs) * 100 : tdVal;
      const tdMs = unitIsMs ? tdVal : (tdVal / 100) * activeCycleMs;

      let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
      let obs = "";
      let interp = "";

      if (tdPct >= 15.0 && tdMs >= 150) {
        estado = "Conforme";
        obs = `Fase d (td) conforme con norma ISO 5707 (≥ 15.0% del ciclo y ≥ 150 ms absolutos).`;
        interp = `Masaje mamario efectivo que alivia el estancamiento sanguíneo en el esfínter y garantiza el confort.`;
      } else if (tdPct >= 12.0 || tdMs >= 120) {
        estado = "Advertencia";
        obs = `Fase d bordeando el límite normativo (${tdPct.toFixed(1)}%, ${tdMs.toFixed(0)} ms). ISO requiere ≥ 15.0% y ≥ 150 ms.`;
        interp = `Tiempo de masaje ligeramente ajustado. Puede provocar ligera congestión en pezones de rodeos de alta producción.`;
      } else if (tdPct >= 10.0 || tdMs >= 100) {
        estado = "Fuera de tolerancia";
        obs = `Fase d insuficiente (${tdPct.toFixed(1)}%, ${tdMs.toFixed(0)} ms). Inadecuado masaje mamario.`;
        interp = `Masaje inadecuado. Incrementa el riesgo de hipermia y edematización de la punta del pezón.`;
      } else {
        estado = "Crítico";
        obs = `Fase d críticamente deficiente (${tdPct.toFixed(1)}%, ${tdMs.toFixed(0)} ms). Riesgo de hiperqueratosis y mastitis.`;
        interp = `Ausencia de masaje mamario efectivo. Causa directa de hiperqueratosis y predisposición crítica a mastitis.`;
      }

      evaluations.push({
        canal: chName,
        parametro: "Fase d (Masaje / Presión atmosférica)",
        valorMedido: `${tdPct.toFixed(1)}% (${tdMs.toFixed(0)} ms)`,
        valorPermitido: "Mínimo 15.0% del ciclo y ≥ 150 ms (Norma ISO)",
        diferencia: `${(tdPct - 15.0) >= 0 ? "+" : ""}${(tdPct - 15.0).toFixed(1)}%`,
        estado,
        observacion: obs,
        interpretacion: interp
      });
    }

    // VACÍO DE OPERACIÓN POR CANAL
    const rawVac = ch.vacioMedido ?? datos.vacioMedido;
    const measuredVac = parseNumber(rawVac);
    if (measuredVac !== null) {
      let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
      let obs = "";
      let interp = "";
      let diffStr = "0.0 kPa";

      if (measuredVac >= vacRange.min && measuredVac <= vacRange.max) {
        estado = "Conforme";
        obs = `Nivel de vacío en conformidad con el rango operativo ISO (${vacRange.min} - ${vacRange.max} kPa).`;
        interp = `Presión de vacío firme y estable. Permite la succión adecuada sin deslizamientos ni agresividad sobre la mucosa.`;
      } else {
        const diffMin = measuredVac - vacRange.min;
        const diffMax = measuredVac - vacRange.max;
        const diff = measuredVac < vacRange.min ? diffMin : diffMax;
        diffStr = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} kPa`;
        const absDiff = Math.abs(diff);

        if (absDiff <= 2.0) {
          estado = "Advertencia";
          obs = `Vacío levemente fuera del rango ISO (${vacRange.min} - ${vacRange.max} kPa).`;
          interp = `Ligera fluctuación en la presión principal. Verificar el regulador de vacío y sellos de sala.`;
        } else if (absDiff <= 5.0) {
          estado = "Fuera de tolerancia";
          obs = `Vacío fuera de tolerancia ISO (medido: ${formatExactNumber(rawVac)}).`;
          interp = `Desviación marcada de vacío. Provoca desprendimiento de pezoneras (si es bajo) o traumatismos (si es alto).`;
        } else {
          estado = "Crítico";
          obs = `Vacío en nivel crítico. Alto riesgo de daño tisular.`;
          interp = `Presión de vacío peligrosa para la salud mamaria.`;
        }
      }

      evaluations.push({
        canal: chName,
        parametro: "Nivel de vacío",
        valorMedido: formatExactNumber(rawVac),
        valorPermitido: `${vacRange.min} - ${vacRange.max} kPa (Norma ISO)`,
        diferencia: diffStr,
        estado,
        observacion: obs,
        interpretacion: interp
      });
    }
  }

  // CHANNEL COMPARISON & DESBALANCE ANALYSIS
  let diferenciaCanales: DiferenciaCanalesInfo | undefined = undefined;
  if (channels.length >= 2) {
    const ch1 = channels[0];
    const ch2 = channels[1];

    const r1 = parseRatioPercentage(ch1.relacionMedida || datos.relacionMedida);
    const r2 = parseRatioPercentage(ch2.relacionMedida || datos.relacionMedida);

    const f1 = parseNumber(ch1.frecuenciaMedida ?? datos.frecuenciaMedida) || nomFreq;
    const f2 = parseNumber(ch2.frecuenciaMedida ?? datos.frecuenciaMedida) || nomFreq;

    const freqDiff = Math.abs(f1 - f2);

    let ratioDiffPct = 0;
    if (r1 && r2) {
      ratioDiffPct = Math.abs(r1.first - r2.first);
    } else {
      ratioDiffPct = parseNumber(datos.desbalanceMedido) || 0;
    }

    const esAceptableISO = ratioDiffPct <= 5.0 && freqDiff <= 2.0;

    let explicacion = "";
    if (esAceptableISO) {
      explicacion = `La diferencia entre el ${ch1.nombreCanal || "Canal 1"} (${ch1.relacionMedida || "S/D"}) y el ${ch2.nombreCanal || "Canal 2"} (${ch2.relacionMedida || "S/D"}) es de ${ratioDiffPct.toFixed(1)}% en relación y ${freqDiff.toFixed(1)} ppm en frecuencia, la cual es mínima y no representa un desbalance significativo (dentro del límite máximo normativo ISO de ≤ 5.0%).`;
    } else {
      explicacion = `Se observa un desbalance de ${ratioDiffPct.toFixed(1)}% entre ambos canales, el cual supera la tolerancia recomendada por la norma ISO (≤ 5.0%). Esto indica una asimetría funcional entre las cámaras de pulsado que requiere revisión de membranas o tubos.`;
    }

    diferenciaCanales = {
      diferenciaRelacion: `${ratioDiffPct.toFixed(1)}%`,
      diferenciaFrecuencia: `${freqDiff.toFixed(1)} ppm`,
      esAceptableISO,
      explicacion
    };

    evaluations.push({
      canal: "Comparación de Canales",
      parametro: "Desbalance entre Canal 1 y Canal 2",
      valorMedido: `${ratioDiffPct.toFixed(1)}% desvío`,
      valorPermitido: "Máximo 5.0% de desbalance (Norma ISO)",
      diferencia: `${ratioDiffPct.toFixed(1)}%`,
      estado: esAceptableISO ? "Conforme" : (ratioDiffPct <= 8.0 ? "Advertencia" : "Fuera de tolerancia"),
      observacion: explicacion,
      interpretacion: esAceptableISO
        ? "Distribución uniforme del trabajo entre los cuatro cuartos mamarios."
        : "Un canal ordeña más rápido o agresivo que el otro, generando tensión desigual sobre la ubre."
    });
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

  // Build Posibles Causas, Plan de Inspección & Riesgos
  const causasDetalladas: PosibleCausaDetallada[] = [];
  const planInspeccionStepsSet = new Set<string>();
  const impactoPotencialSet = new Set<string>();
  const accionesCorrectivasSet = new Set<string>();

  // STRICT RULE 11: IF ALL CONFORME, DO NOT INVENT PROBLEMS OR UNNECESSARY RECOMMENDATIONS!
  if (worstStatus === "Conforme") {
    const defaultCleanRecommendation = "Continuar con el programa de mantenimiento preventivo habitual y repetir el control de pulsación según el cronograma establecido.";
    planInspeccionStepsSet.add(defaultCleanRecommendation);
    accionesCorrectivasSet.add(defaultCleanRecommendation);
  } else {
    // Collect specific failures if NOT Conforme
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
        justificacion: "La desviación de frecuencia observada respecto del estándar nominal es compatible con una descalibración del mecanismo regulador de velocidad de conmutación.",
        justificacionProductor: "El pulsador está latiendo fuera del ritmo óptimo, indicando desajuste en el regulador."
      });
      planInspeccionStepsSet.add("Verificar la calibración de frecuencia y ajustar a 60 ppm con un vacuómetro/pulsógrafo patrón según norma ISO 5707.");
      accionesCorrectivasSet.add("Calibrar la frecuencia de pulsación a 60 ppm (± 3.0 ppm) de acuerdo con la norma ISO 5707.");
    }

    if (hasRatio || hasBalance) {
      causasDetalladas.push({
        causa: "Desgaste de membranas o diafragmas internos del pulsador",
        probabilidad: "Alta",
        justificacion: "Una alteración en la relación o desbalance entre canales es compatible con fatiga de material o pérdida de elasticidad en las membranas de goma o silicona.",
        justificacionProductor: "Las membranas internas presentan desgaste por uso continuo."
      });
      planInspeccionStepsSet.add("Inspeccionar el estado físico, flexibilidad y estanqueidad de las membranas del pulsador.");
      accionesCorrectivasSet.add("Reemplazar el kit de membranas/diafragmas desgastados por repuestos originales.");
    }

    if (hasPhaseA || hasPhaseC) {
      causasDetalladas.push({
        causa: "Filtro de aire saturado o suciedad acumulada en puertos de ventilación",
        probabilidad: "Alta",
        justificacion: "Transiciones lentas en las fases a o c suelen asociarse a restricciones en los puertos de ventilación atmosférica.",
        justificacionProductor: "Filtro de aire sucio o tapado que frena el movimiento neumático."
      });
      planInspeccionStepsSet.add("Inspeccionar y limpiar el filtro de aire del pulsador o sustituir el elemento filtrante.");
      accionesCorrectivasSet.add("Limpiar o sustituir el filtro de aire y verificar conductos de ventilación.");
    }

    if (hasPhaseD) {
      causasDetalladas.push({
        causa: "Descalibración de fase de masaje o pérdida de flexibilidad neumática",
        probabilidad: "Alta",
        justificacion: "Reducción de la fase d (masaje) por debajo de los 150 ms o 15% requeridos por norma ISO para aliviar la congestión mamaria.",
        justificacionProductor: "Tiempo insuficiente de descanso y masaje para la ubre."
      });
      planInspeccionStepsSet.add("Verificar la calibración de la fase de masaje y revisar la integridad de membranas.");
      accionesCorrectivasSet.add("Sustituir membranas y recalibrar la fase de masaje a un mínimo de 150 ms (ISO 5707).");
    }

    if (hasVacuum) {
      causasDetalladas.push({
        causa: "Regulador de vacío descalibrado o fugas en la red principal",
        probabilidad: "Alta",
        justificacion: "Nivel de vacío fuera del rango normativo ISO (40.0 - 50.0 kPa).",
        justificacionProductor: "El regulador de vacío de la sala requiere calibración."
      });
      planInspeccionStepsSet.add("Verificar y calibrar el regulador de vacío con un vacuómetro patrón.");
      accionesCorrectivasSet.add("Calibrar la válvula del regulador de vacío al rango normativo (40.0 - 50.0 kPa).");
    }
  }

  const planInspeccion = Array.from(planInspeccionStepsSet);
  const impactoPotencial = Array.from(impactoPotencialSet);
  const accionesCorrectivas = Array.from(accionesCorrectivasSet);
  const posiblesCausas = causasDetalladas.map(c => `${c.causa} [${c.probabilidad} probabilidad]: ${c.justificacion}`);

  // Informe Productor & Narrative
  let queSignifica = "";
  let queRiesgosExisten = "";
  let queSeRecomiendaHacer = "";
  let interpretacion = "";
  let conclusionFinal = "";

  if (worstStatus === "Conforme") {
    queSignifica = "Las mediciones obtenidas muestran un funcionamiento uniforme entre ambos canales. Todos los parámetros evaluados se encuentran dentro de las tolerancias establecidas por las normas ISO 6690:2007 e ISO 5707:2007.";
    queRiesgosExisten = "No se detectan desviaciones ni riesgos para la salud de las ubres ni para la velocidad de ordeño.";
    queSeRecomiendaHacer = "Continuar con el programa de mantenimiento preventivo habitual y repetir el control de pulsación según el cronograma establecido.";
    interpretacion = "El sistema de pulsación funciona de manera óptima y responde rigurosamente a las exigencias de la norma ISO. Permite una extracción confortable y completa de la leche.";
    conclusionFinal = "Las mediciones obtenidas muestran un funcionamiento uniforme entre ambos canales. Todos los parámetros evaluados se encuentran dentro de las tolerancias establecidas por las normas ISO 6690:2007 e ISO 5707:2007. No se detectan desviaciones significativas que indiquen problemas de regulación del sistema de pulsación.";
  } else if (worstStatus === "Advertencia") {
    queSignifica = "El pulsador registra pequeñas desviaciones respecto a los rangos óptimos de la norma ISO.";
    queRiesgosExisten = "Ligeros retrasos en la velocidad de ordeño o leve estrés en la punta del pezón.";
    queSeRecomiendaHacer = "Programar un ajuste de rutina y limpieza en el próximo servicio técnico.";
    interpretacion = "Desviaciones moderadas que deben corregirse preventivamente para evitar un desgaste mayor.";
    conclusionFinal = "El equipo presenta desviaciones leves respecto a la norma ISO. Se aconseja una revisión técnica de rutina para restablecer los valores nominales óptimos.";
  } else {
    queSignifica = "El pulsador registra parámetros fuera de las tolerancias de la norma ISO.";
    queRiesgosExisten = "Riesgo de sobreordeño, congestión en el pezón e incremento en la tasa de mastitis.";
    queSeRecomiendaHacer = "Realizar service técnico correctivo, reemplazar el kit de membranas y recalibrar antes de continuar operando.";
    interpretacion = "Funcionamiento fuera de tolerancia que impacta negativamente en la salud mamaria y en la eficiencia de extracción.";
    conclusionFinal = "El equipo evaluado no cumple con las especificaciones normativas ISO. Requiere mantenimiento técnico e intervención inmediata para corregir los desvíos detectados.";
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
    informeProductor,
    diferenciaCanales
  };
}
