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

export interface ParametroISOEvaluacion {
  parametro: string;
  valorMedido: string;
  valorPermitido: string;
  diferencia: string;
  estado: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico";
  observacion: string;
}

export interface ResultadoIA {
  estadoGeneral: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico";
  nivelCriticidad: "Bajo" | "Medio" | "Alto";
  nivelConfianza: number; // 0 - 100
  calidadImagen: "Alta" | "Media" | "Baja";
  datosExtraidos: {
    frecuenciaMedida: number;
    relacionMedida: string;
    vacioMedido: string;
    taMedido?: number;
    tbMedido?: number;
    tcMedido?: number;
    tdMedido?: number;
    balanceMedido?: string;
    desbalanceMedido?: number;
    [key: string]: any;
  };
  comparacionEspecificaciones: string;
  hallazgos: string[];
  diagnosticoTecnico: string;
  posiblesCausas: string[];
  recomendaciones: string[];
  evaluacionISO?: ParametroISOEvaluacion[];
}

export interface EvaluacionDiagnosis {
  id: string;
  fecha: string;
  tecnicoNombre: string;
  tecnicoEmail: string;
  tamboId: string;
  tamboNombre: string;
  equipoNombre: string;
  tipoDiagnostico: string; // e.g. "Pulsógrafo"
  pulsadorId: string;
  pulsadorMarca: string;
  pulsadorModelo: string;
  imagenUrl: string; // Base64 data URL
  estado: "Pendiente" | "Aprobado" | "Rechazado";
  resultadoIA: ResultadoIA;
  informeSimplificado?: string; // Simplified text for producer when approved
}
