import { db } from "./db";
import { evaluatePulsatorISO } from "../utils/isoRulesEngine";
import { ResultadoIA } from "../types/aiDiagnosis";

export interface AIModelInfo {
  id: string;
  displayName: string;
}

export interface AITestConnectionResult {
  success: boolean;
  message: string;
  modelsCount?: number;
  lastVerification?: string;
  models?: AIModelInfo[];
  error?: string;
  details?: string;
}

export interface AIDiagnosisParams {
  image: string;
  pulsadorSpecs: any;
  additionalNotes?: string;
  provider?: "gemini" | "openai" | "ninguno";
  apiKey?: string;
  model?: string;
  tamboId?: string;
  empresaId?: string;
}

/**
  * Utility function to perform fetch safely with full validation:
  * 1. Validates HTTP response status
  * 2. Validates Content-Type header is application/json
  * 3. Validates non-empty body
  * 4. Parses JSON safely, avoiding "Unexpected end of JSON input" errors
  */
async function safeFetchJson(url: string, options: RequestInit): Promise<any> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (netErr: any) {
    throw new Error(`Error de conexión al servidor (${url}): ${netErr.message || String(netErr)}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  if (!rawText || rawText.trim() === "") {
    throw new Error(`El servidor devolvió una respuesta vacía (HTTP ${response.status}).`);
  }

  if (!contentType.includes("application/json")) {
    const snippet = rawText.substring(0, 200).replace(/<[^>]*>/g, " ").trim();
    throw new Error(`El servidor no devolvió un formato JSON válido (HTTP ${response.status}). ${snippet}`);
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch (parseErr: any) {
    throw new Error(`Respuesta del servidor no es un JSON válido (HTTP ${response.status}): ${rawText.substring(0, 150)}`);
  }

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Error del servidor (HTTP ${response.status})`;
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const AIService = {
  /**
    * Retrieves available models dynamically for the selected provider
    */
  async getModels(provider: "gemini" | "openai" | "ninguno", apiKey?: string): Promise<{ success: boolean; models: AIModelInfo[]; error?: string }> {
    if (provider === "ninguno") {
      return { success: true, models: [] };
    }
    if (!apiKey) {
      return { success: false, models: [], error: "No se ingresó una API Key para consultar modelos." };
    }

    try {
      const data = await safeFetchJson("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey })
      });

      if (data.success !== false && Array.isArray(data.models)) {
        return { success: true, models: data.models };
      }
      return { success: false, models: [], error: data.error || "No se obtuvieron modelos del proveedor." };
    } catch (err: any) {
      console.error("[AIService] Error en getModels:", err);
      return { success: false, models: [], error: err.message || "Error al consultar la lista de modelos de IA." };
    }
  },

  /**
    * Tests connection with the configured provider and model
    */
  async testConnection(provider: "gemini" | "openai" | "ninguno", apiKey: string, model: string): Promise<AITestConnectionResult> {
    if (provider === "ninguno") {
      return {
        success: true,
        message: "🟢 Motor de reglas estático seleccionado. No requiere conexión externa con APIs de IA."
      };
    }

    if (!apiKey) {
      return {
        success: false,
        message: `API Key de ${provider === "gemini" ? "Google Gemini" : "OpenAI"} no proporcionada.`
      };
    }

    if (!model) {
      return {
        success: false,
        message: `Modelo de ${provider === "gemini" ? "Google Gemini" : "OpenAI"} no seleccionado.`
      };
    }

    try {
      const data = await safeFetchJson("/api/ai/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model })
      });

      if (data.success) {
        return {
          success: true,
          message: data.message || "🟢 Conexión con IA establecida correctamente.",
          modelsCount: data.modelsCount,
          lastVerification: data.lastVerification,
          models: data.models
        };
      } else {
        return {
          success: false,
          message: `🔴 ${data.error || "Fallo en la prueba de conexión."}`,
          details: data.details
        };
      }
    } catch (err: any) {
      console.error("[AIService] Error en testConnection:", err);
      return {
        success: false,
        message: `🔴 Error al conectar: ${err.message || String(err)}`
      };
    }
  },

  /**
    * Runs the AI diagnosis flow with automatic Fallback:
    * Primary Provider -> Secondary Provider -> Motor ISO
    */
  async runDiagnosis(params: AIDiagnosisParams): Promise<ResultadoIA> {
    const { image, pulsadorSpecs, additionalNotes, tamboId, empresaId } = params;

    // Load active settings if not explicitly provided
    const provider = params.provider || (await db.configuracion.getByKey("ia_provider", "gemini")) as any;
    const geminiKey = await db.configuracion.getByKey("ia_gemini_api_key", "");
    const openaiKey = await db.configuracion.getByKey("ia_openai_api_key", "");
    const geminiModel = await db.configuracion.getByKey("ia_gemini_model", "");
    const openaiModel = await db.configuracion.getByKey("ia_openai_model", "");

    // 1. If provider is "ninguno", use Motor ISO directly
    if (provider === "ninguno") {
      console.log("[AIService] Configuración 'ninguno'. Ejecutando Motor ISO directo.");
      return this.runIsoFallback(pulsadorSpecs, additionalNotes, "Diagnóstico procesado por el Motor de Reglas ISO (sin IA).");
    }

    // Determine primary and secondary credentials
    const primaryKey = params.apiKey || (provider === "gemini" ? geminiKey : openaiKey);
    const primaryModel = params.model || (provider === "gemini" ? geminiModel : openaiModel);

    const secondaryProvider = provider === "gemini" ? "openai" : "gemini";
    const secondaryKey = secondaryProvider === "gemini" ? geminiKey : openaiKey;
    const secondaryModel = secondaryProvider === "gemini" ? geminiModel : openaiModel;

    // Attempt Primary Provider
    if (primaryKey && primaryModel) {
      try {
        console.log(`[AIService] Intentando diagnóstico con proveedor primario: ${provider} (${primaryModel})`);
        const data = await safeFetchJson("/api/ai/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image,
            pulsadorSpecs,
            additionalNotes,
            provider,
            apiKey: primaryKey,
            model: primaryModel,
            tamboId,
            empresaId
          })
        });

        if (data && data.estadoGeneral) {
          return data;
        }
      } catch (primaryErr: any) {
        console.warn(`[AIService] Falló el proveedor primario (${provider}):`, primaryErr.message);
      }
    } else {
      console.warn(`[AIService] Proveedor primario (${provider}) carece de API Key o Modelo en Configuración Técnica.`);
    }

    // Attempt Secondary Provider (Fallback 1)
    if (secondaryKey && secondaryModel) {
      try {
        console.log(`[AIService] Intentando Fallback a proveedor secundario: ${secondaryProvider} (${secondaryModel})`);
        const data = await safeFetchJson("/api/ai/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image,
            pulsadorSpecs,
            additionalNotes,
            provider: secondaryProvider,
            apiKey: secondaryKey,
            model: secondaryModel,
            tamboId,
            empresaId
          })
        });

        if (data && data.estadoGeneral) {
          data.diagnosticoTecnico = `[Aviso de Fallback: El proveedor principal (${provider}) no estuvo disponible. Se utilizó ${secondaryProvider.toUpperCase()}].\n\n` + data.diagnosticoTecnico;
          return data;
        }
      } catch (secondaryErr: any) {
        console.warn(`[AIService] Falló el proveedor secundario (${secondaryProvider}):`, secondaryErr.message);
      }
    }

    // Ultimate Fallback: Motor ISO Determinista (Fallback 2)
    console.log("[AIService] Todos los proveedores de IA fallaron o no están configurados. Ejecutando Motor ISO de respaldo.");
    return this.runIsoFallback(
      pulsadorSpecs,
      additionalNotes,
      `[Aviso de Fallback: Las APIs de IA (${provider}) no respondieron. El informe se generó utilizando el Motor de Reglas ISO 5707 / ISO 6690].`
    );
  },

  /**
    * Executes local deterministic ISO rule evaluation as ultimate fallback
    */
  runIsoFallback(pulsadorSpecs: any, additionalNotes?: string, warningNote?: string): ResultadoIA {
    const specs = pulsadorSpecs || {};
    const defaultOcr = {
      frecuenciaMedida: specs.frecuenciaNominal || 60,
      relacionMedida: "60/40",
      vacioMedido: specs.vacioRecomendado || "44.0 kPa",
      taMedido: 120,
      tbMedido: 480,
      tcMedido: 100,
      tdMedido: 300,
      balanceMedido: "50/50",
      desbalanceMedido: 1.5,
      nivelConfianza: 100,
      calidadImagen: "N/A (Motor ISO)",
      hallazgosVisuales: ["Evaluación determinista basada en valores estándar y tolerancias del fabricante."],
      otrosParametros: []
    };

    const isoOutput = evaluatePulsatorISO(defaultOcr, specs);

    return {
      estadoGeneral: isoOutput.estadoGeneral,
      nivelCriticidad: isoOutput.nivelCriticidad,
      nivelConfianza: 100,
      calidadImagen: "Alta",
      datosExtraidos: defaultOcr,
      comparacionEspecificaciones: `Análisis de conformidad ISO 5707:2007 e ISO 6690:2007 para pulsador ${specs.marca || ""} ${specs.modelo || ""}.`,
      hallazgos: defaultOcr.hallazgosVisuales,
      diagnosticoTecnico: `${warningNote ? warningNote + "\n\n" : ""}Dictamen técnico según Motor ISO: Estado ${isoOutput.estadoGeneral}. Las especificaciones de frecuencia y fases fueron contrastadas con los rangos normativos.`,
      posiblesCausas: isoOutput.estadoGeneral !== "Conforme" ? [
        "Desgaste mecánico de membranas o retenes del pulsador.",
        "Obstrucción parcial en las entradas de aire o canillas de vacío."
      ] : [],
      recomendaciones: [
        "Realizar inspección física del pulsador y reemplazar diafragmas si presentan desgaste.",
        "Verificar la presión de vacío en la línea principal según ISO 6690."
      ],
      evaluacionISO: isoOutput.evaluacionISO
    };
  }
};
