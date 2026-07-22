import {
  ParametroISOEvaluacion,
  PosibleCausaDetallada,
  InformeProductor,
  DatosCanalPulsador,
  DiferenciaCanalesInfo,
  AnalisisCanalIndividual,
  AnalisisComparativoCanales,
  DetalleDiferenciaParametro
} from "../types/aiDiagnosis";

export interface ResultadoEvaluacionISO {
  evaluacionISO: ParametroISOEvaluacion[];
  analisisCanal1: AnalisisCanalIndividual;
  analisisCanal2?: AnalisisCanalIndividual;
  analisisComparativo?: AnalisisComparativoCanales;
  conclusionGlobal: string;
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

function evaluateChannel(ch: DatosCanalPulsador, fallbackData: any, specs?: any): {
  evaluations: ParametroISOEvaluacion[];
  estadoCanal: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico";
  interpretacionExclusiva: string;
  parsedValues: {
    freq: number | null;
    ratio: { first: number; second: number; raw: string } | null;
    ta: { pct: number; ms: number } | null;
    tb: { pct: number; ms: number } | null;
    tc: { pct: number; ms: number } | null;
    td: { pct: number; ms: number } | null;
    vacio: number | null;
  };
} {
  const evaluations: ParametroISOEvaluacion[] = [];
  const chName = ch.nombreCanal || "Canal 1";

  const nomFreq = (specs && parseNumber(specs.frecuenciaNominal)) || 60.0;
  const vacRange = (specs && parseVacuumRange(specs.vacioRecomendado)) || { min: 40.0, max: 50.0 };

  const measuredFreq = parseNumber(ch.frecuenciaMedida ?? fallbackData.frecuenciaMedida);
  const activeCycleMs = measuredFreq && measuredFreq > 0 ? 60000 / measuredFreq : 1000;

  let worstStatus: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
  const statusRank = { "Conforme": 0, "Advertencia": 1, "Fuera de tolerancia": 2, "Crítico": 3 };

  function setStatus(st: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico") {
    if (statusRank[st] > statusRank[worstStatus]) {
      worstStatus = st;
    }
  }

  // 1. FRECUENCIA
  if (measuredFreq !== null) {
    const diff = measuredFreq - nomFreq;
    const absDiff = Math.abs(diff);
    let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
    let obs = "";
    let interp = "";

    if (absDiff <= 3.0) {
      estado = "Conforme";
      obs = `Frecuencia conforme con norma ISO 5707:2007 (±3.0 ppm respecto a nominal ${nomFreq} ppm).`;
      interp = `Asegura la cadencia exacta de conmutación. Mantiene la tasa ideal de estímulo sin sobrecargar el tejido mamario.`;
    } else if (absDiff <= 5.0) {
      estado = "Advertencia";
      obs = `Desviación moderada (${measuredFreq} ppm vs nominal ${nomFreq} ppm). ISO especifica ±3.0 ppm.`;
      interp = `Alteración leve del ritmo de pulsación. Puede prolongar ligeramente el tiempo de ordeño.`;
    } else if (absDiff <= 8.0) {
      estado = "Fuera de tolerancia";
      obs = `Frecuencia fuera del límite ISO (desvío de ${diff > 0 ? "+" : ""}${diff.toFixed(1)} ppm).`;
      interp = `Desviación significativa que altera el estímulo neumático e incrementa la fatiga en el esfínter del pezón.`;
    } else {
      estado = "Crítico";
      obs = `Frecuencia críticamente fuera de norma ISO (${measuredFreq} ppm).`;
      interp = `Ritmo anómalo severo. Riesgo inminente de trauma tisular y congestión vascular.`;
    }
    setStatus(estado);

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

  // 2. RELACIÓN
  const rawRatioStr = ch.relacionMedida || fallbackData.relacionMedida;
  const ratioObj = parseRatioPercentage(rawRatioStr);
  if (ratioObj) {
    const { first, raw } = ratioObj;
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
      obs = `Relación dentro de tolerancia ISO 5707 (≤ ±5.0% respecto a nominal ${closestNominal}/${100 - closestNominal}).`;
      interp = `Proporción equilibrada entre tiempo de extracción (vaciado) y descanso (masaje).`;
    } else if (absDiff <= 8.0) {
      estado = "Advertencia";
      obs = `Desviación moderada (desvío ${diff.toFixed(1)}% vs nominal ${closestNominal}/${100 - closestNominal}).`;
      interp = `Ligero desbalance. Puede ralentizar el ordeño o sobrecargar la punta del pezón.`;
    } else if (absDiff <= 12.0) {
      estado = "Fuera de tolerancia";
      obs = `Relación fuera del límite normativo ISO (desviación de ${diff.toFixed(1)}%).`;
      interp = `Alteración en la conmutación neumática. Riesgo de sobreordeño o vaciado incompleto de la ubre.`;
    } else {
      estado = "Crítico";
      obs = `Relación severamente descompensada (${raw}).`;
      interp = `Falta grave de balance neumático. Produce edematización y dolor durante el ordeño.`;
    }
    setStatus(estado);

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

  // 3. FASE A (ta)
  const taVal = parseNumber(ch.taMedido ?? fallbackData.taMedido);
  let taParsed: { pct: number; ms: number } | null = null;
  if (taVal !== null) {
    const unitIsMs = ch.unidadFases === "ms" || (taVal > 35);
    const taPct = unitIsMs ? (taVal / activeCycleMs) * 100 : taVal;
    const taMs = unitIsMs ? taVal : (taVal / 100) * activeCycleMs;
    taParsed = { pct: taPct, ms: taMs };

    let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
    let obs = "";
    let interp = "";

    if (taPct <= 15.0) {
      estado = "Conforme";
      obs = `Fase a conforme con norma ISO 5707 (≤ 15.0% del ciclo total).`;
      interp = `Apertura ágil de la pezonera. Evita caídas inútiles de vacío durante la transición.`;
    } else if (taPct <= 18.0) {
      estado = "Advertencia";
      obs = `Fase a levemente lenta (${taPct.toFixed(1)}%). ISO fija ≤ 15.0%.`;
      interp = `Conmutación demorada. Puede indicar ligera restricción de aire en los conductos de señal.`;
    } else if (taPct <= 22.0) {
      estado = "Fuera de tolerancia";
      obs = `Fase a fuera de tolerancia ISO (${taPct.toFixed(1)}%). Restricción neumática en apertura.`;
      interp = `Apertura lenta. Disminuye el tiempo efectivo de extracción y la velocidad de flujo de leche.`;
    } else {
      estado = "Crítico";
      obs = `Fase a excesivamente lenta (${taPct.toFixed(1)}%). Severa restricción neumática.`;
      interp = `Obstrucción grave o pérdida masiva de vacío de conmutación.`;
    }
    setStatus(estado);

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

  // 4. FASE B (tb)
  const tbVal = parseNumber(ch.tbMedido ?? fallbackData.tbMedido);
  let tbParsed: { pct: number; ms: number } | null = null;
  if (tbVal !== null) {
    const unitIsMs = ch.unidadFases === "ms" || (tbVal > 50);
    const tbPct = unitIsMs ? (tbVal / activeCycleMs) * 100 : tbVal;
    const tbMs = unitIsMs ? tbVal : (tbVal / 100) * activeCycleMs;
    tbParsed = { pct: tbPct, ms: tbMs };

    let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
    let obs = "";
    let interp = "";

    if (tbPct >= 30.0) {
      estado = "Conforme";
      obs = `Fase b conforme con norma ISO 5707 (≥ 30.0% del ciclo total).`;
      interp = `Tiempo a máximo vacío suficiente para permitir el flujo libre y continuo de leche.`;
    } else if (tbPct >= 25.0) {
      estado = "Advertencia";
      obs = `Fase b levemente reducida (${tbPct.toFixed(1)}%). ISO requiere al menos 30.0%.`;
      interp = `Periodo de ordeño activo acortado. Puede disminuir levemente la tasa de flujo de leche.`;
    } else if (tbPct >= 20.0) {
      estado = "Fuera de tolerancia";
      obs = `Fase b insuficiente (${tbPct.toFixed(1)}%). Incompleta extracción de leche.`;
      interp = `Tiempo de ordeño deficiente. Provoca ordeños prolongados y acumulación de leche residual.`;
    } else {
      estado = "Crítico";
      obs = `Fase b críticamente baja (${tbPct.toFixed(1)}%). Caída drástica de rendimiento.`;
      interp = `Falta de estabilidad neumática grave en la cámara de pulsado.`;
    }
    setStatus(estado);

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

  // 5. FASE C (tc)
  const tcVal = parseNumber(ch.tcMedido ?? fallbackData.tcMedido);
  let tcParsed: { pct: number; ms: number } | null = null;
  if (tcVal !== null) {
    const unitIsMs = ch.unidadFases === "ms" || (tcVal > 30);
    const tcPct = unitIsMs ? (tcVal / activeCycleMs) * 100 : tcVal;
    const tcMs = unitIsMs ? tcVal : (tcVal / 100) * activeCycleMs;
    tcParsed = { pct: tcPct, ms: tcMs };

    let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
    let obs = "";
    let interp = "";

    if (tcPct <= 10.0) {
      estado = "Conforme";
      obs = `Fase c conforme con norma ISO 5707 (≤ 10.0% del ciclo total).`;
      interp = `Colapso inmediato de la pezonera que inicia oportunamente el descanso tisular.`;
    } else if (tcPct <= 13.0) {
      estado = "Advertencia";
      obs = `Fase c levemente lenta (${tcPct.toFixed(1)}%). ISO fija máximo 10.0%.`;
      interp = `Cierre progresivo lento. Sugiere filtro de aire con suciedad acumulada o baja ventilación.`;
    } else if (tcPct <= 16.0) {
      estado = "Fuera de tolerancia";
      obs = `Fase c fuera de tolerancia (${tcPct.toFixed(1)}%). Obstrucción atmosférica.`;
      interp = `Demora en el colapso de la pezonera. Retrasa el alivio de la congestión en la punta del pezón.`;
    } else {
      estado = "Crítico";
      obs = `Fase c excesivamente lenta (${tcPct.toFixed(1)}%). Filtro de aire tapado o desgaste grave.`;
      interp = `Incapacidad para colapsar la pezonera a tiempo. Ocasiona congestión y dolor al animal.`;
    }
    setStatus(estado);

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

  // 6. FASE D (td)
  const tdVal = parseNumber(ch.tdMedido ?? fallbackData.tdMedido);
  let tdParsed: { pct: number; ms: number } | null = null;
  if (tdVal !== null) {
    const unitIsMs = ch.unidadFases === "ms" || (tdVal > 40);
    const tdPct = unitIsMs ? (tdVal / activeCycleMs) * 100 : tdVal;
    const tdMs = unitIsMs ? tdVal : (tdVal / 100) * activeCycleMs;
    tdParsed = { pct: tdPct, ms: tdMs };

    let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
    let obs = "";
    let interp = "";

    if (tdPct >= 15.0 && tdMs >= 150) {
      estado = "Conforme";
      obs = `Fase d conforme con norma ISO 5707 (≥ 15.0% del ciclo y ≥ 150 ms absolutos).`;
      interp = `Masaje mamario efectivo que alivia la congestión sanguínea y mantiene la salud del esfínter.`;
    } else if (tdPct >= 12.0 || tdMs >= 120) {
      estado = "Advertencia";
      obs = `Fase d en límite normativo (${tdPct.toFixed(1)}%, ${tdMs.toFixed(0)} ms). ISO requiere ≥ 15.0% y ≥ 150 ms.`;
      interp = `Tiempo de masaje ajustado. Puede provocar leve congestión en pezones de rodeos de alta producción.`;
    } else if (tdPct >= 10.0 || tdMs >= 100) {
      estado = "Fuera de tolerancia";
      obs = `Fase d insuficiente (${tdPct.toFixed(1)}%, ${tdMs.toFixed(0)} ms). Masaje deficiente.`;
      interp = `Masaje inadecuado. Incrementa el riesgo de hiperemia y edematización de la punta del pezón.`;
    } else {
      estado = "Crítico";
      obs = `Fase d críticamente deficiente (${tdPct.toFixed(1)}%, ${tdMs.toFixed(0)} ms). Riesgo de hiperqueratosis.`;
      interp = `Falta total de masaje mamario efectivo. Causa directa de hiperqueratosis y riesgo severo de mastitis.`;
    }
    setStatus(estado);

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

  // 7. VACÍO DE OPERACIÓN
  const rawVac = ch.vacioMedido ?? fallbackData.vacioMedido;
  const measuredVac = parseNumber(rawVac);
  if (measuredVac !== null) {
    let estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
    let obs = "";
    let interp = "";
    let diffStr = "0.0 kPa";

    if (measuredVac >= vacRange.min && measuredVac <= vacRange.max) {
      estado = "Conforme";
      obs = `Vacío dentro del rango operativo ISO (${vacRange.min} - ${vacRange.max} kPa).`;
      interp = `Presión de vacío estable que permite la succión adecuada sin deslizamientos ni traumas en mucosa.`;
    } else {
      const diffMin = measuredVac - vacRange.min;
      const diffMax = measuredVac - vacRange.max;
      const diff = measuredVac < vacRange.min ? diffMin : diffMax;
      diffStr = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} kPa`;
      const absDiff = Math.abs(diff);

      if (absDiff <= 2.0) {
        estado = "Advertencia";
        obs = `Vacío levemente fuera de rango ISO (${vacRange.min} - ${vacRange.max} kPa).`;
        interp = `Fluctuación leve en la presión principal de este canal.`;
      } else if (absDiff <= 5.0) {
        estado = "Fuera de tolerancia";
        obs = `Vacío fuera de tolerancia ISO (medido: ${formatExactNumber(rawVac)}).`;
        interp = `Desviación marcada de vacío en la línea de pulsado. Provoca caídas de pezonera o edematización.`;
      } else {
        estado = "Crítico";
        obs = `Vacío en nivel crítico. Alto riesgo de daño tisular.`;
        interp = `Presión de vacío peligrosa para la salud mamaria.`;
      }
    }
    setStatus(estado);

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

  // Construct exclusive technical interpretation text for this channel
  let interpText = "";
  if (worstStatus === "Conforme") {
    interpText = `El ${chName} opera en perfecta conformidad técnica con las normas ISO 5707 e ISO 6690. Mantiene una frecuencia estable de ${measuredFreq ?? "S/D"} ppm, fases de conmutación (ta=${taParsed ? taParsed.pct.toFixed(1) + "%" : "S/D"}, tc=${tcParsed ? tcParsed.pct.toFixed(1) + "%" : "S/D"}) limpias y un tiempo de masaje (td=${tdParsed ? tdParsed.pct.toFixed(1) + "% / " + tdParsed.ms.toFixed(0) + " ms" : "S/D"}) adecuado para garantizar el confort y el flujo constante de leche.`;
  } else if (worstStatus === "Advertencia") {
    interpText = `El ${chName} presenta desviaciones leves respecto a los valores óptimos ISO. Se registran fluctuaciones moderadas en fases o frecuencia que sugieren mantenimiento de rutina sin riesgo crítico inmediato.`;
  } else if (worstStatus === "Fuera de tolerancia") {
    interpText = `El ${chName} muestra parámetros fuera de tolerancia ISO 5707. Las anomalías neumáticas en este canal (conmutación lenta o fase de masaje deficiente) comprometen la eficiencia de ordeño e incrementan el estrés vascular en los pezones alimentados por esta línea.`;
  } else {
    interpText = `El ${chName} se encuentra en estado CRÍTICO según norma ISO 5707. Existen fallas severas de vacío o tiempos de conmutación que provocan edema mamario y riesgo inminente de trauma de pezón.`;
  }

  return {
    evaluations,
    estadoCanal: worstStatus,
    interpretacionExclusiva: interpText,
    parsedValues: {
      freq: measuredFreq,
      ratio: ratioObj,
      ta: taParsed,
      tb: tbParsed,
      tc: tcParsed,
      td: tdParsed,
      vacio: measuredVac
    }
  };
}

export function evaluatePulsatorISO(datos: any, specs?: any): ResultadoEvaluacionISO {
  const nomFreq = (specs && parseNumber(specs.frecuenciaNominal)) || 60.0;
  const vacRange = (specs && parseVacuumRange(specs.vacioRecomendado)) || { min: 40.0, max: 50.0 };

  // 1. Normalize channels array
  let channelsInput: DatosCanalPulsador[] = [];
  if (Array.isArray(datos.canales) && datos.canales.length > 0) {
    channelsInput = datos.canales;
  } else {
    channelsInput = [{
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

  // Ensure Canal 1 exists
  const ch1Data = channelsInput[0] || { nombreCanal: "Canal 1" };
  const resCh1 = evaluateChannel(ch1Data, datos, specs);

  const analisisCanal1: AnalisisCanalIndividual = {
    nombreCanal: ch1Data.nombreCanal || "Canal 1",
    evaluaciones: resCh1.evaluations,
    estadoCanal: resCh1.estadoCanal,
    interpretacionExclusiva: resCh1.interpretacionExclusiva
  };

  // Check if Canal 2 exists
  let resCh2: ReturnType<typeof evaluateChannel> | null = null;
  let analisisCanal2: AnalisisCanalIndividual | undefined = undefined;

  if (channelsInput.length >= 2) {
    const ch2Data = channelsInput[1];
    resCh2 = evaluateChannel(ch2Data, datos, specs);
    analisisCanal2 = {
      nombreCanal: ch2Data.nombreCanal || "Canal 2",
      evaluaciones: resCh2.evaluations,
      estadoCanal: resCh2.estadoCanal,
      interpretacionExclusiva: resCh2.interpretacionExclusiva
    };
  }

  // Combine evaluations for global table
  const allEvaluations: ParametroISOEvaluacion[] = [...resCh1.evaluations];
  if (resCh2) {
    allEvaluations.push(...resCh2.evaluations);
  }

  // INTER-CHANNEL COMPARATIVE ANALYSIS (Puntos 7 y 8)
  let analisisComparativo: AnalisisComparativoCanales | undefined = undefined;
  let diferenciaCanales: DiferenciaCanalesInfo | undefined = undefined;

  if (resCh2) {
    const v1 = resCh1.parsedValues;
    const v2 = resCh2.parsedValues;

    // Diferencia Ta
    const ta1 = v1.ta ? v1.ta.pct : 0;
    const ta2 = v2.ta ? v2.ta.pct : 0;
    const diffTaVal = Math.abs(ta1 - ta2);
    const esTaOk = diffTaVal <= 2.0;
    const diffTa: DetalleDiferenciaParametro = {
      parametro: "Diferencia Fase a (Transición a vacío / ta)",
      valorCanal1: v1.ta ? `${v1.ta.pct.toFixed(1)}% (${v1.ta.ms.toFixed(0)} ms)` : "S/D",
      valorCanal2: v2.ta ? `${v2.ta.pct.toFixed(1)}% (${v2.ta.ms.toFixed(0)} ms)` : "S/D",
      diferencia: `${diffTaVal.toFixed(1)}%`,
      toleranciaISO: "Máximo 2.0% de desbalance entre canales",
      esAceptableISO: esTaOk,
      observacion: esTaOk
        ? "Velocidad de conmutación de apertura altamente simétrica entre ambos canales."
        : "Asimetría en la velocidad de apertura de pezoneras entre lados."
    };

    // Diferencia Tb
    const tb1 = v1.tb ? v1.tb.pct : 0;
    const tb2 = v2.tb ? v2.tb.pct : 0;
    const diffTbVal = Math.abs(tb1 - tb2);
    const esTbOk = diffTbVal <= 3.0;
    const diffTb: DetalleDiferenciaParametro = {
      parametro: "Diferencia Fase b (Máximo vacío / tb)",
      valorCanal1: v1.tb ? `${v1.tb.pct.toFixed(1)}% (${v1.tb.ms.toFixed(0)} ms)` : "S/D",
      valorCanal2: v2.tb ? `${v2.tb.pct.toFixed(1)}% (${v2.tb.ms.toFixed(0)} ms)` : "S/D",
      diferencia: `${diffTbVal.toFixed(1)}%`,
      toleranciaISO: "Máximo 3.0% de desbalance entre canales",
      esAceptableISO: esTbOk,
      observacion: esTbOk
        ? "Tiempo de extracción activa equilibrado entre ambos canales."
        : "Un canal ordeña a máximo vacío durante más tiempo que el otro."
    };

    // Diferencia Tc
    const tc1 = v1.tc ? v1.tc.pct : 0;
    const tc2 = v2.tc ? v2.tc.pct : 0;
    const diffTcVal = Math.abs(tc1 - tc2);
    const esTcOk = diffTcVal <= 2.0;
    const diffTc: DetalleDiferenciaParametro = {
      parametro: "Diferencia Fase c (Transición a aire / tc)",
      valorCanal1: v1.tc ? `${v1.tc.pct.toFixed(1)}% (${v1.tc.ms.toFixed(0)} ms)` : "S/D",
      valorCanal2: v2.tc ? `${v2.tc.pct.toFixed(1)}% (${v2.tc.ms.toFixed(0)} ms)` : "S/D",
      diferencia: `${diffTcVal.toFixed(1)}%`,
      toleranciaISO: "Máximo 2.0% de desbalance entre canales",
      esAceptableISO: esTcOk,
      observacion: esTcOk
        ? "Cierre y colapso de pezoneras simétrico."
        : "Retraso de colapso en uno de los canales por suciedad o restricción de aire."
    };

    // Diferencia Td
    const td1 = v1.td ? v1.td.pct : 0;
    const td2 = v2.td ? v2.td.pct : 0;
    const diffTdVal = Math.abs(td1 - td2);
    const esTdOk = diffTdVal <= 3.0;
    const diffTd: DetalleDiferenciaParametro = {
      parametro: "Diferencia Fase d (Masaje / td)",
      valorCanal1: v1.td ? `${v1.td.pct.toFixed(1)}% (${v1.td.ms.toFixed(0)} ms)` : "S/D",
      valorCanal2: v2.td ? `${v2.td.pct.toFixed(1)}% (${v2.td.ms.toFixed(0)} ms)` : "S/D",
      diferencia: `${diffTdVal.toFixed(1)}%`,
      toleranciaISO: "Máximo 3.0% de desbalance entre canales",
      esAceptableISO: esTdOk,
      observacion: esTdOk
        ? "Tiempo de masaje mamario equivalente en ambos pares de cuartos."
        : "Masaje asimétrico: un par de cuartos recibe menor tiempo de descanso tisular."
    };

    // Diferencia Vacío
    const vac1 = v1.vacio ?? 0;
    const vac2 = v2.vacio ?? 0;
    const diffVacVal = Math.abs(vac1 - vac2);
    const esVacOk = diffVacVal <= 1.0;
    const diffVacio: DetalleDiferenciaParametro = {
      parametro: "Diferencia Nivel de Vacío de Operación",
      valorCanal1: v1.vacio ? `${v1.vacio.toFixed(1)} kPa` : "S/D",
      valorCanal2: v2.vacio ? `${v2.vacio.toFixed(1)} kPa` : "S/D",
      diferencia: `${diffVacVal.toFixed(1)} kPa`,
      toleranciaISO: "Máximo 1.0 kPa de diferencia entre canales",
      esAceptableISO: esVacOk,
      observacion: esVacOk
        ? "Presión neumática de trabajo simétrica en ambos canales."
        : "Caída de presión asimétrica entre las salidas del pulsador."
    };

    // Diferencia Frecuencia
    const f1 = v1.freq ?? nomFreq;
    const f2 = v2.freq ?? nomFreq;
    const diffFreqVal = Math.abs(f1 - f2);
    const esFreqOk = diffFreqVal <= 1.0;
    const diffFrecuencia: DetalleDiferenciaParametro = {
      parametro: "Diferencia de Frecuencia de Pulsación",
      valorCanal1: `${f1.toFixed(1)} ppm`,
      valorCanal2: `${f2.toFixed(1)} ppm`,
      diferencia: `${diffFreqVal.toFixed(1)} ppm`,
      toleranciaISO: "Máximo 1.0 ppm de desvío entre canales",
      esAceptableISO: esFreqOk,
      observacion: esFreqOk
        ? "Frecuencia de conmutación idéntica en ambos canales."
        : "Desincronización de ritmo entre las cámaras de pulsado."
    };

    // Diferencia Relación
    const r1First = v1.ratio ? v1.ratio.first : 60;
    const r2First = v2.ratio ? v2.ratio.first : 60;
    const diffRatioVal = Math.abs(r1First - r2First);
    const esRatioOk = diffRatioVal <= 5.0;
    const diffRelacion: DetalleDiferenciaParametro = {
      parametro: "Diferencia de Relación de Pulsación",
      valorCanal1: v1.ratio ? v1.ratio.raw : "S/D",
      valorCanal2: v2.ratio ? v2.ratio.raw : "S/D",
      diferencia: `${diffRatioVal.toFixed(1)}%`,
      toleranciaISO: "Máximo 5.0% de desbalance (ISO 5707)",
      esAceptableISO: esRatioOk,
      observacion: esRatioOk
        ? "Relación de conmutación dentro del rango de simetría recomendado."
        : "Desbalance de relación entre salidas que genera tensión desigual en pezones."
    };

    // Sincronización
    const sincronizacion = {
      tipo: "Pulsado Alternado (Desfase Neumático de 180°)",
      esAceptable: diffFreqVal <= 1.0 && diffTaVal <= 3.0,
      observacion: (diffFreqVal <= 1.0 && diffTaVal <= 3.0)
        ? "Las ondas de pulsación muestran un desfase limpio de 180° sin solapamientos ni retrasos de conmutación."
        : "Existe un retraso de conmutación o solapamiento entre las señales neumáticas de Canal 1 y Canal 2."
    };

    // Balance
    const totalRatioFirst = r1First + r2First;
    const b1 = totalRatioFirst > 0 ? (r1First / totalRatioFirst) * 100 : 50;
    const b2 = 100 - b1;
    const balance = {
      relacionBalance: `${b1.toFixed(1)} / ${b2.toFixed(1)}`,
      esAceptable: Math.abs(b1 - 50) <= 2.5,
      observacion: Math.abs(b1 - 50) <= 2.5
        ? "Reparto neumático 50/50 equilibrado entre los dos pares de pezoneras."
        : `Reparto asimétrico ${b1.toFixed(1)}/${b2.toFixed(1)} que genera sobrecargas de trabajo en una de las salidas.`
    };

    // Uniformidad del funcionamiento
    const allCompOk = esTaOk && esTbOk && esTcOk && esTdOk && esVacOk && esFreqOk && esRatioOk;
    let nivelUniformidad: "Excelente" | "Aceptable" | "Asimétrico / Deficiente" | "Crítica" = "Excelente";
    if (allCompOk) {
      nivelUniformidad = "Excelente";
    } else if (diffRatioVal <= 8.0 && diffFreqVal <= 2.0) {
      nivelUniformidad = "Aceptable";
    } else if (diffRatioVal <= 12.0) {
      nivelUniformidad = "Asimétrico / Deficiente";
    } else {
      nivelUniformidad = "Crítica";
    }

    const evaluacionUniformidad = allCompOk
      ? "Funcionamiento altamente uniforme e idéntico entre ambos canales. No se observan desgastes asimétricos en el mecanismo."
      : "Se detecta asimetría de funcionamiento neumático entre Canal 1 y Canal 2. Indica desgaste irregular de membranas, suciedad en una de las válvulas o restricción neumática en uno de los puertos de salida.";

    const conclusionComparativa = allCompOk
      ? `La comparación técnica directa entre Canal 1 (${v1.ratio?.raw || "S/D"}, ${f1.toFixed(1)} ppm) y Canal 2 (${v2.ratio?.raw || "S/D"}, ${f2.toFixed(1)} ppm) confirma una simetría neumática adecuada. La diferencia de relación (${diffRatioVal.toFixed(1)}%) y de frecuencia (${diffFreqVal.toFixed(1)} ppm) se mantienen dentro de los límites estrictos de la norma ISO 5707 (≤ 5.0% y ≤ 1.0 ppm respectivamente).`
      : `El análisis comparativo entre Canal 1 y Canal 2 evidencia una divergencia de funcionamiento. Se registra un desbalance de relación del ${diffRatioVal.toFixed(1)}% y una diferencia de fase d (masaje) del ${diffTdVal.toFixed(1)}%. Esta asimetría somete a los cuatro cuartos mamarios a condiciones de ordeño desiguales.`;

    analisisComparativo = {
      diferenciaTa: diffTa,
      diferenciaTb: diffTb,
      diferenciaTc: diffTc,
      diferenciaTd: diffTd,
      diferenciaVacio: diffVacio,
      diferenciaFrecuencia: diffFrecuencia,
      diferenciaRelacion: diffRelacion,
      sincronizacion,
      balance,
      uniformidadFuncionamiento: {
        nivel: nivelUniformidad,
        evaluacion: evaluacionUniformidad
      },
      conclusionComparativa,
      esAceptableISO: allCompOk
    };

    diferenciaCanales = {
      diferenciaRelacion: `${diffRatioVal.toFixed(1)}%`,
      diferenciaFrecuencia: `${diffFreqVal.toFixed(1)} ppm`,
      esAceptableISO: allCompOk,
      explicacion: conclusionComparativa,
      comparacionDetallada: analisisComparativo
    };

    allEvaluations.push({
      canal: "Comparación de Canales",
      parametro: "Desbalance de Relación entre Canal 1 y Canal 2",
      valorMedido: `${diffRatioVal.toFixed(1)}% desvío`,
      valorPermitido: "Máximo 5.0% de desbalance (Norma ISO 5707)",
      diferencia: `${diffRatioVal.toFixed(1)}%`,
      estado: esRatioOk ? "Conforme" : (diffRatioVal <= 8.0 ? "Advertencia" : "Fuera de tolerancia"),
      observacion: conclusionComparativa,
      interpretacion: esRatioOk
        ? "Distribución de trabajo uniforme entre los cuatro cuartos mamarios."
        : "Un canal ordeña con mayor agresividad que el otro, generando tensión desigual sobre la ubre."
    });
  }

  // GLOBAL STATUS DETERMINATION (Worst status across all evaluations)
  let worstStatus: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
  const statusRank: Record<string, number> = { "Conforme": 0, "Advertencia": 1, "Fuera de tolerancia": 2, "Crítico": 3 };

  for (const item of allEvaluations) {
    if (statusRank[item.estado] > statusRank[worstStatus]) {
      worstStatus = item.estado;
    }
  }

  let nivelCriticidad: "Bajo" | "Medio" | "Alto" = "Bajo";
  if (worstStatus === "Crítico") nivelCriticidad = "Alto";
  else if (worstStatus === "Fuera de tolerancia") nivelCriticidad = "Medio";
  else if (worstStatus === "Advertencia") nivelCriticidad = "Bajo";

  // POSIBLES CAUSAS Y ACCIONES CORRECTIVAS
  const causasDetalladas: PosibleCausaDetallada[] = [];
  const planInspeccionStepsSet = new Set<string>();
  const impactoPotencialSet = new Set<string>();
  const accionesCorrectivasSet = new Set<string>();

  if (worstStatus === "Conforme") {
    const defaultClean = "Continuar con el programa de mantenimiento preventivo habitual y repetir el control de pulsación según el cronograma establecido.";
    planInspeccionStepsSet.add(defaultClean);
    accionesCorrectivasSet.add(defaultClean);
  } else {
    let hasFreq = false;
    let hasRatio = false;
    let hasPhaseA = false;
    let hasPhaseC = false;
    let hasPhaseD = false;
    let hasVacuum = false;
    let hasCompAsym = false;

    for (const item of allEvaluations) {
      if (item.estado !== "Conforme") {
        const pName = item.parametro.toLowerCase();
        if (pName.includes("frecuencia")) hasFreq = true;
        if (pName.includes("relación")) hasRatio = true;
        if (pName.includes("fase a") || pName.includes("ta")) hasPhaseA = true;
        if (pName.includes("fase c") || pName.includes("tc")) hasPhaseC = true;
        if (pName.includes("fase d") || pName.includes("td")) hasPhaseD = true;
        if (pName.includes("vacío")) hasVacuum = true;
        if (pName.includes("desbalance") || pName.includes("comparación")) hasCompAsym = true;
      }
    }

    if (hasFreq) {
      causasDetalladas.push({
        causa: "Regulador de velocidad de conmutación descalibrado o desajuste neumático",
        probabilidad: "Alta",
        justificacion: "La frecuencia medida en los canales difiere de la frecuencia nominal especificada (tolerancia ISO ±3.0 ppm).",
        justificacionProductor: "El pulsador está funcionando fuera del ritmo óptimo recomendado."
      });
      planInspeccionStepsSet.add("Ajustar y calibrar la frecuencia del pulsador a 60 ppm (± 3.0 ppm) con vacuómetro/pulsógrafo patrón según ISO 5707.");
      accionesCorrectivasSet.add("Calibrar la frecuencia de pulsación a 60 ppm (± 3.0 ppm) de acuerdo con ISO 5707.");
    }

    if (hasRatio || hasCompAsym) {
      causasDetalladas.push({
        causa: "Desgaste asimétrico de membranas/diafragmas internos o fatiga de elastómeros",
        probabilidad: "Alta",
        justificacion: "El desbalance de relación o desviación en las fases de ordeño es compatible con fatiga o desgaste asimétrico en las membranas internas.",
        justificacionProductor: "Las membranas o componentes de goma internos están desgastados o deformados."
      });
      planInspeccionStepsSet.add("Desarmar el pulsador e inspeccionar la elasticidad, flexibilidad y estado físico de las membranas internas.");
      accionesCorrectivasSet.add("Reemplazar el kit completo de membranas internas y empaquetaduras por repuestos originales.");
    }

    if (hasPhaseA || hasPhaseC) {
      causasDetalladas.push({
        causa: "Filtro de aire saturado, suciedad en puertos de ventilación o restreñimiento en válvulas",
        probabilidad: "Alta",
        justificacion: "Tiempos prolongados en la fase a (apertura) o fase c (cierre) indican restricción al ingreso o escape del aire atmosférico.",
        justificacionProductor: "Filtro de aire sucio o conductos obstruidos que frenan la conmutación."
      });
      planInspeccionStepsSet.add("Inspeccionar y limpiar el filtro de entrada de aire del pulsador o reemplazar el elemento filtrante.");
      accionesCorrectivasSet.add("Limpiar o reemplazar el filtro de aire y desobstruir conductos atmosféricos.");
    }

    if (hasPhaseD) {
      causasDetalladas.push({
        causa: "Insuficiente fase de descanso (td) por descalibración neumática",
        probabilidad: "Alta",
        justificacion: "Fase d (masaje) por debajo de los 150 ms o 15% requeridos por ISO 5707 para prevenir edematización tisular.",
        justificacionProductor: "Tiempo de descanso insuficiente para el pezón durante el ordeño."
      });
      planInspeccionStepsSet.add("Verificar la calibración de la fase de masaje (td) y reemplazar membranas para asegurar al menos 150 ms de descanso.");
      accionesCorrectivasSet.add("Recalibrar o reemplazar membranas para restablecer la fase d a un mínimo de 150 ms (ISO 5707).");
    }

    if (hasVacuum) {
      causasDetalladas.push({
        causa: "Regulador de vacío principal descalibrado o fugas neumáticas en la bajada",
        probabilidad: "Alta",
        justificacion: "Nivel de vacío de pulsación fuera de la ventana operativa estandarizada ISO (40.0 - 50.0 kPa).",
        justificacionProductor: "El nivel de vacío de la línea de pulsado se encuentra descalibrado."
      });
      planInspeccionStepsSet.add("Verificar y regular la válvula del regulador de vacío de la sala con vacuómetro de precisión patrón.");
      accionesCorrectivasSet.add("Calibrar la presión de la línea de vacío principal dentro del rango de 40.0 a 50.0 kPa.");
    }
  }

  const planInspeccion = Array.from(planInspeccionStepsSet);
  const impactoPotencial = Array.from(impactoPotencialSet);
  const accionesCorrectivas = Array.from(accionesCorrectivasSet);
  const posiblesCausas = causasDetalladas.map(c => `${c.causa} [${c.probabilidad} probabilidad]: ${c.justificacion}`);

  // GLOBAL SYSTEM CONCLUSION (Punto 9: Fundamentada en Canal 1, Canal 2 y Comparación, NUNCA promediando)
  let conclusionGlobal = "";
  if (worstStatus === "Conforme") {
    conclusionGlobal = `DIAGNÓSTICO GLOBAL DEL SISTEMA (CONFORME ISO 5707 / ISO 6690):
• Canal 1: Conforme (Frecuencia ${resCh1.parsedValues.freq ?? "S/D"} ppm, Relación ${resCh1.parsedValues.ratio?.raw || "S/D"}, Fase d ${resCh1.parsedValues.td ? resCh1.parsedValues.td.pct.toFixed(1) + "% / " + resCh1.parsedValues.td.ms.toFixed(0) + " ms" : "S/D"}).
• Canal 2: ${resCh2 ? "Conforme (Frecuencia " + (resCh2.parsedValues.freq ?? "S/D") + " ppm, Relación " + (resCh2.parsedValues.ratio?.raw || "S/D") + ", Fase d " + (resCh2.parsedValues.td ? resCh2.parsedValues.td.pct.toFixed(1) + "% / " + resCh2.parsedValues.td.ms.toFixed(0) + " ms" : "S/D") + ")" : "No registrado en gráfico monocanal"}.
• Análisis Comparativo Inter-Canal: ${analisisComparativo ? "Simetría neumática perfecta. Desbalance de relación " + analisisComparativo.diferenciaRelacion.diferencia + " (dentro de norma ISO ≤ 5.0%)." : "Medición de un solo canal"}.
• Conclusión Global: El equipo de pulsación opera en estricta conformidad con los requisitos normativos ISO 5707:2007 e ISO 6690:2007. Ambos canales ofrecen condiciones simétricas de succión y descanso, garantizando un ordeño rápido, confortable y seguro para el rodeo.`;
  } else if (worstStatus === "Advertencia") {
    conclusionGlobal = `DIAGNÓSTICO GLOBAL DEL SISTEMA (ADVERTENCIA ISO 5707):
• Canal 1: ${resCh1.estadoCanal} (Frecuencia ${resCh1.parsedValues.freq ?? "S/D"} ppm, Relación ${resCh1.parsedValues.ratio?.raw || "S/D"}).
• Canal 2: ${resCh2 ? resCh2.estadoCanal + " (Frecuencia " + (resCh2.parsedValues.freq ?? "S/D") + " ppm, Relación " + (resCh2.parsedValues.ratio?.raw || "S/D") + ")" : "N/A"}.
• Análisis Comparativo Inter-Canal: ${analisisComparativo ? analisisComparativo.conclusionComparativa : "Monocanal"}.
• Conclusión Global: El pulsador presenta desviaciones leves que no comprometen de forma crítica la salud de la ubre de inmediato, pero que sugieren programar un servicio de mantenimiento preventivo y calibración técnica.`;
  } else {
    conclusionGlobal = `DIAGNÓSTICO GLOBAL DEL SISTEMA (NO CONFORME / FUERA DE TOLERANCIA ISO):
• Canal 1: ${resCh1.estadoCanal} (${resCh1.interpretacionExclusiva}).
• Canal 2: ${resCh2 ? resCh2.estadoCanal + " (" + resCh2.interpretacionExclusiva + ")" : "N/A"}.
• Análisis Comparativo Inter-Canal: ${analisisComparativo ? analisisComparativo.conclusionComparativa : "N/A"}.
• Conclusión Global: El pulsador NO CUMPLE con la norma ISO 5707:2007. El diagnóstico individual de cada canal y su análisis comparativo evidencian anomalías neumáticas y/o asimetría de conmutación. Se requiere intervención técnica inmediata, reemplazo de membranas y recalibración antes de continuar el uso.`;
  }

  // INFORME PRODUTOR
  let queSignifica = "";
  let queRiesgosExisten = "";
  let queSeRecomiendaHacer = "";
  let interpretacionProductor = "";

  if (worstStatus === "Conforme") {
    queSignifica = "Ambos canales del pulsador funcionan de forma perfectamente equilibrada y responden rigurosamente a las normas internacionales de ordeño ISO.";
    queRiesgosExisten = "No existen riesgos para la salud de las ubres ni retrasos en la velocidad de ordeño.";
    queSeRecomiendaHacer = "Continuar con las rutinas normales de limpieza y mantenimiento preventivo estandard.";
    interpretacionProductor = "El equipo de pulsación está funcionando de manera óptima.";
  } else if (worstStatus === "Advertencia") {
    queSignifica = "Se observan pequeñas variaciones en el ritmo de pulsación que sobrepasan ligeramente los valores recomendados.";
    queRiesgosExisten = "Pueden generarse pequeños retrasos en el tiempo de ordeño por vaca.";
    queSeRecomiendaHacer = "Programar una revisión de rutina en el próximo mantenimiento.";
    interpretacionProductor = "Pequeñas desviaciones de rutina a corregir preventivamente.";
  } else {
    queSignifica = "Uno o ambos canales del pulsador funcionan fuera de las tolerancias permitidas por las normas ISO.";
    queRiesgosExisten = "Riesgo de sobreordeño, congestión en los pezones y mayor predisposición a mastitis en el rodeo.";
    queSeRecomiendaHacer = "Realizar un service técnico correctivo, reemplazar las membranas internas y recalibrar antes de continuar ordeñando.";
    interpretacionProductor = "Equipo fuera de norma. Requiere mantenimiento e intervención técnica inmediata.";
  }

  const informeProductor: InformeProductor = {
    estadoGeneral: worstStatus,
    queSignifica,
    queRiesgosExisten,
    queSeRecomiendaHacer,
    interpretacion: interpretacionProductor,
    conclusionFinal: conclusionGlobal,
    posiblesCausasSencillas: causasDetalladas.map(c => c.justificacionProductor || c.causa),
    planInspeccionSencillo: planInspeccion,
    impactoPotencialSencillo: impactoPotencial
  };

  return {
    evaluacionISO: allEvaluations,
    analisisCanal1,
    analisisCanal2,
    analisisComparativo,
    conclusionGlobal,
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
