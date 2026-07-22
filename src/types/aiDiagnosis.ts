export interface MarcaPulsador {
  id: string;
  nombre: string;
}

export interface PulsadorModel {
  id: string;
  marcaId: string;
  modelo: string;
  frecuenciaNominal: number; // e.g. 60
  frecuenciaMinima: number; // e.g. 55
  frecuenciaMaxima: number; // e.g. 65
  relacionesPermitidas: string; // e.g. "60/40, 70/30"
  vacioRecomendado: string; // e.g. "42 - 50 kPa"
  tolerancias: string; // e.g. "+/- 2 ppm, +/- 2%"
  observaciones?: string;
  manualPdfUrl?: string; // Optional manual
}

export interface DatosCanalPulsador {
  nombreCanal: string; // e.g. "Canal 1", "Canal 2"
  frecuenciaMedida?: number; // e.g. 60.5
  relacionMedida?: string; // e.g. "64.5 : 35.5" or "64.5/35.5"
  vacioMedido?: string | number; // e.g. "46.2 kPa"
  taMedido?: number; // % or ms e.g. 19.0
  tbMedido?: number; // % or ms e.g. 45.5
  tcMedido?: number; // % or ms e.g. 10.0
  tdMedido?: number; // % or ms e.g. 25.5
  unidadFases?: "%" | "ms";
}

export interface DetalleDiferenciaParametro {
  parametro: string;
  valorCanal1: string;
  valorCanal2: string;
  diferencia: string;
  toleranciaISO: string;
  esAceptableISO: boolean;
  observacion: string;
}

export interface AnalisisComparativoCanales {
  diferenciaTa: DetalleDiferenciaParametro;
  diferenciaTb: DetalleDiferenciaParametro;
  diferenciaTc: DetalleDiferenciaParametro;
  diferenciaTd: DetalleDiferenciaParametro;
  diferenciaVacio: DetalleDiferenciaParametro;
  diferenciaFrecuencia: DetalleDiferenciaParametro;
  diferenciaRelacion: DetalleDiferenciaParametro;
  sincronizacion: {
    tipo: string;
    esAceptable: boolean;
    observacion: string;
  };
  balance: {
    relacionBalance: string;
    esAceptable: boolean;
    observacion: string;
  };
  uniformidadFuncionamiento: {
    nivel: "Excelente" | "Aceptable" | "Asimétrico / Deficiente" | "Crítica";
    evaluacion: string;
  };
  conclusionComparativa: string;
  esAceptableISO: boolean;
}

export interface AnalisisCanalIndividual {
  nombreCanal: string;
  evaluaciones: ParametroISOEvaluacion[];
  estadoCanal: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico";
  interpretacionExclusiva: string;
}

export interface DiferenciaCanalesInfo {
  diferenciaRelacion: string; // e.g. "2.0%"
  diferenciaFrecuencia: string; // e.g. "0.5 ppm"
  esAceptableISO: boolean;
  explicacion: string;
  comparacionDetallada?: AnalisisComparativoCanales;
}

export interface ParametroISOEvaluacion {
  canal?: string; // "Canal 1" | "Canal 2" | "Global"
  parametro: string;
  valorMedido: string;
  valorPermitido: string;
  diferencia: string;
  estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico";
  observacion: string;
  interpretacion?: string;
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

export interface ResultadoIA {
  estadoGeneral: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico";
  nivelCriticidad: "Bajo" | "Medio" | "Alto";
  nivelConfianza: number; // 0 - 100
  calidadImagen: "Alta" | "Media" | "Baja";
  datosExtraidos: {
    frecuenciaMedida?: number;
    relacionMedida?: string;
    vacioMedido?: string | number;
    taMedido?: number;
    tbMedido?: number;
    tcMedido?: number;
    tdMedido?: number;
    balanceMedido?: string;
    desbalanceMedido?: number;
    canales?: DatosCanalPulsador[];
    diferenciaCanales?: DiferenciaCanalesInfo;
    otrosParametros?: Array<{ nombre: string; valor: string }>;
    [key: string]: any;
  };
  comparacionEspecificaciones: string;
  hallazgos: string[];
  diagnosticoTecnico: string;
  posiblesCausas: string[];
  posiblesCausasDetalladas?: PosibleCausaDetallada[];
  planInspeccion?: string[];
  impactoPotencial?: string[];
  accionesCorrectivas?: string[];
  recomendaciones: string[];
  evaluacionISO?: ParametroISOEvaluacion[];
  analisisCanal1?: AnalisisCanalIndividual;
  analisisCanal2?: AnalisisCanalIndividual;
  analisisComparativo?: AnalisisComparativoCanales;
  conclusionGlobal?: string;
  informeProductor?: InformeProductor;
}

export interface EvaluacionDiagnosis {
  id: string;
  fecha: string;
  tecnicoNombre: string;
  tecnicoEmail: string;
  tamboId: string;
  tamboNombre: string;
  equipoNombre?: string;
  tipoDiagnostico?: string;
  pulsadorId?: string;
  pulsadorMarca?: string;
  pulsadorModelo?: string;
  imagenUrl: string; // Base64 data URL
  estado: "Pendiente" | "Aprobado" | "Rechazado";
  resultadoIA: ResultadoIA;
  informeSimplificado?: string; // Simplified text for producer
}
