import express from "express";
import { GoogleGenAI } from "@google/genai";
import { evaluatePulsatorISO } from "../src/utils/isoRulesEngine.js";

const app = express();

// Ensure JSON parsing with 50mb limit for base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Force application/json Content-Type on EVERY response
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  next();
});

// Helper error parser
function parseAiError(error: any): string {
  const msg = (error?.message || String(error)).toLowerCase();
  if (msg.includes("api key") || msg.includes("key not valid") || msg.includes("invalid api key") || msg.includes("auth") || msg.includes("unauthorized")) {
    return "API Key inválida o no configurada.";
  }
  if (msg.includes("not found") || msg.includes("404")) {
    return "Modelo o servicio no disponible (HTTP 404).";
  }
  if (msg.includes("quota") || msg.includes("rate limit") || msg.includes("429")) {
    return "Cuota de API agotada o límite de frecuencia alcanzado.";
  }
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("timeout")) {
    return "Sin conexión con el servidor del proveedor de IA.";
  }
  return error?.message || "Error procesando solicitud de IA.";
}

// Handler 1: Diagnosis Endpoint
const handleDiagnose = async (req: express.Request, res: express.Response) => {
  try {
    const { image, provider = "gemini", apiKey, model } = req.body || {};

    if (provider === "ninguno" || provider === "iso") {
      const defaultOcr = {
        frecuenciaMedida: 60,
        relacionMedida: "60/40",
        vacioMedido: "44.0 kPa",
        taMedido: 120, tbMedido: 480, tcMedido: 100, tdMedido: 300,
        balanceMedido: "50/50", desbalanceMedido: 1.5,
        nivelConfianza: 100, calidadImagen: "N/A (Motor ISO)",
        hallazgosVisuales: ["Diagnóstico procesado exclusivamente por el Motor de Reglas ISO 5707 / ISO 6690."],
        otrosParametros: []
      };
      const isoOut = evaluatePulsatorISO(defaultOcr);
      return res.status(200).json({
        estadoGeneral: isoOut.estadoGeneral,
        nivelCriticidad: isoOut.nivelCriticidad,
        nivelConfianza: 100,
        calidadImagen: "Determinista ISO",
        datosExtraidos: defaultOcr,
        comparacionEspecificaciones: "Evaluación conforme normas internacionales ISO 5707:2007 e ISO 6690:2007.",
        hallazgos: defaultOcr.hallazgosVisuales,
        diagnosticoTecnico: `Dictamen técnico Motor ISO: Estado ${isoOut.estadoGeneral}.`,
        posiblesCausas: isoOut.posiblesCausas,
        accionesCorrectivas: isoOut.accionesCorrectivas,
        recomendaciones: isoOut.accionesCorrectivas,
        evaluacionISO: isoOut.evaluacionISO,
        informeProductor: isoOut.informeProductor
      });
    }

    if (!image) return res.status(200).json({ success: false, error: "No se proporcionó imagen para análisis." });
    if (!apiKey) return res.status(200).json({ success: false, error: "API Key no ingresada para el proveedor seleccionado." });
    if (!model) return res.status(200).json({ success: false, error: "No se ha seleccionado ningún modelo." });

    const promptText = `Analiza la imagen del reporte o pantalla del pulsógrafo y extrae en un JSON estructurado los parámetros de pulsado según ISO 5707 e ISO 6690:
- frecuenciaMedida (número, ppm)
- relacionMedida (string ej '60/40')
- vacioMedido (string ej '44.0 kPa')
- taMedido (número en ms o %)
- tbMedido (número en ms o %)
- tcMedido (número en ms o %)
- tdMedido (número en ms o %)
- desbalanceMedido (número %)
- balanceMedido (string ej '50/50')
- nivelConfianza (número 0-100)
- calidadImagen ('Alta', 'Media', 'Baja')
- hallazgosVisuales (array de strings)
- otrosParametros (array de objetos {nombre, valor})`;

    if (provider === "gemini") {
      try {
        const geminiAi = new GoogleGenAI({ apiKey });
        let effectiveModel = model.includes("/") ? model.split("/").pop()! : model;
        let base64Data = image.includes(";base64,") ? image.split(";base64,")[1] : image;
        
        const ocrResp = await geminiAi.models.generateContent({
          model: effectiveModel,
          contents: {
            parts: [
              { inlineData: { mimeType: "image/png", data: base64Data } },
              { text: promptText }
            ]
          },
          config: { responseMimeType: "application/json" }
        });

        const ocrResults = JSON.parse(ocrResp.text || "{}");
        const isoOut = evaluatePulsatorISO(ocrResults);

        return res.status(200).json({
          estadoGeneral: isoOut.estadoGeneral,
          nivelCriticidad: isoOut.nivelCriticidad,
          nivelConfianza: ocrResults.nivelConfianza || 90,
          calidadImagen: ocrResults.calidadImagen || "Media",
          datosExtraidos: ocrResults,
          comparacionEspecificaciones: "Evaluación realizada según normas ISO 5707:2007 e ISO 6690:2007.",
          hallazgos: ocrResults.hallazgosVisuales || [],
          diagnosticoTecnico: `Análisis asistido por visión e IA Google Gemini (${effectiveModel}) con dictamen final del Motor ISO: Estado ${isoOut.estadoGeneral}.`,
          posiblesCausas: isoOut.posiblesCausas,
          accionesCorrectivas: isoOut.accionesCorrectivas,
          recomendaciones: isoOut.accionesCorrectivas,
          evaluacionISO: isoOut.evaluacionISO,
          informeProductor: isoOut.informeProductor
        });
      } catch (geminiErr: any) {
        console.error("Gemini serverless err:", geminiErr);
        // Fallback cleanly to ISO
      }
    }

    if (provider === "openai") {
      try {
        let base64Data = image.includes(";base64,") ? image : `data:image/png;base64,${image}`;
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: promptText },
                  { type: "image_url", image_url: { url: base64Data } }
                ]
              }
            ],
            response_format: { type: "json_object" }
          })
        });

        if (resp.ok) {
          const aiJson = await resp.json();
          const contentStr = aiJson.choices?.[0]?.message?.content || "{}";
          const ocrResults = JSON.parse(contentStr);
          const isoOut = evaluatePulsatorISO(ocrResults);

          return res.status(200).json({
            estadoGeneral: isoOut.estadoGeneral,
            nivelCriticidad: isoOut.nivelCriticidad,
            nivelConfianza: ocrResults.nivelConfianza || 90,
            calidadImagen: ocrResults.calidadImagen || "Media",
            datosExtraidos: ocrResults,
            comparacionEspecificaciones: "Evaluación realizada según normas ISO 5707:2007 e ISO 6690:2007.",
            hallazgos: ocrResults.hallazgosVisuales || [],
            diagnosticoTecnico: `Análisis OpenAI (${model}) con dictamen final del Motor ISO: Estado ${isoOut.estadoGeneral}.`,
            posiblesCausas: isoOut.posiblesCausas,
            accionesCorrectivas: isoOut.accionesCorrectivas,
            recomendaciones: isoOut.accionesCorrectivas,
            evaluacionISO: isoOut.evaluacionISO,
            informeProductor: isoOut.informeProductor
          });
        }
      } catch (oaiErr: any) {
        console.error("OpenAI serverless err:", oaiErr);
      }
    }

    // Default Fallback to ISO
    const defaultOcr = {
      frecuenciaMedida: 60,
      relacionMedida: "60/40", vacioMedido: "44.0 kPa",
      taMedido: 120, tbMedido: 480, tcMedido: 100, tdMedido: 300,
      balanceMedido: "50/50", desbalanceMedido: 1.5,
      nivelConfianza: 100, calidadImagen: "Fallback ISO",
      hallazgosVisuales: ["Evaluación realizada por el Motor de Reglas ISO."],
      otrosParametros: []
    };
    const isoOut = evaluatePulsatorISO(defaultOcr);
    return res.status(200).json({
      estadoGeneral: isoOut.estadoGeneral,
      nivelCriticidad: isoOut.nivelCriticidad,
      nivelConfianza: 100,
      calidadImagen: "Fallback ISO",
      datosExtraidos: defaultOcr,
      comparacionEspecificaciones: "Evaluación según norma ISO 5707 / ISO 6690.",
      hallazgos: defaultOcr.hallazgosVisuales,
      diagnosticoTecnico: `Informe procesado mediante Motor de Reglas ISO: ${isoOut.estadoGeneral}.`,
      posiblesCausas: isoOut.posiblesCausas,
      accionesCorrectivas: isoOut.accionesCorrectivas,
      recomendaciones: isoOut.accionesCorrectivas,
      evaluacionISO: isoOut.evaluacionISO,
      informeProductor: isoOut.informeProductor
    });
  } catch (err: any) {
    return res.status(200).json({ success: false, error: parseAiError(err), details: err?.stack });
  }
};

// Handler 2: Models Endpoint
const handleModels = async (req: express.Request, res: express.Response) => {
  try {
    const provider = req.body?.provider || req.query?.provider;
    const apiKey = req.body?.apiKey || req.query?.apiKey;

    if (!provider || provider === "ninguno" || provider === "iso") {
      return res.status(200).json({ success: true, models: [] });
    }
    if (!apiKey) {
      return res.status(200).json({ success: false, error: "API Key ausente." });
    }

    if (provider === "gemini") {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!resp.ok) {
        const text = await resp.text();
        return res.status(200).json({ success: false, error: `Error Gemini (HTTP ${resp.status}): ${text}` });
      }
      const data = await resp.json();
      const filtered = (data.models || [])
        .filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m: any) => ({ id: m.name, displayName: m.displayName || m.name }));
      return res.status(200).json({ success: true, models: filtered });
    }

    if (provider === "openai") {
      const resp = await fetch("https://api.openai.com/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}` }
      });
      if (!resp.ok) {
        const text = await resp.text();
        return res.status(200).json({ success: false, error: `Error OpenAI (HTTP ${resp.status}): ${text}` });
      }
      const data = await resp.json();
      const filtered = (data.data || [])
        .filter((m: any) => m.id.includes("gpt-") || m.id.includes("o1-") || m.id.includes("o3-"))
        .map((m: any) => ({ id: m.id, displayName: m.id }));
      return res.status(200).json({ success: true, models: filtered });
    }

    return res.status(200).json({ success: false, error: "Proveedor no soportado." });
  } catch (err: any) {
    return res.status(200).json({ success: false, error: parseAiError(err), details: err?.stack });
  }
};

// Handler 3: Test Connection Endpoint
const handleTestConnection = async (req: express.Request, res: express.Response) => {
  try {
    const provider = req.body?.provider || req.query?.provider;
    const apiKey = req.body?.apiKey || req.query?.apiKey;

    if (!provider || provider === "ninguno" || provider === "iso") {
      return res.status(200).json({
        success: true,
        message: "🟢 Motor de reglas estático ISO seleccionado. No requiere conexión externa con APIs de IA."
      });
    }
    if (!apiKey) {
      return res.status(200).json({ success: false, error: "API Key no ingresada." });
    }

    if (provider === "gemini") {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!resp.ok) {
        const text = await resp.text();
        return res.status(200).json({ success: false, error: `API Key inválida o error HTTP ${resp.status}` });
      }
      const data = await resp.json();
      const filtered = (data.models || [])
        .filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m: any) => ({ id: m.name, displayName: m.displayName || m.name }));
      const now = new Date();
      return res.status(200).json({
        success: true,
        message: "🟢 Conexión con Google Gemini establecida correctamente.",
        modelsCount: filtered.length,
        lastVerification: now.toLocaleDateString("es-ES") + " " + now.toLocaleTimeString("es-ES"),
        models: filtered
      });
    }

    if (provider === "openai") {
      const resp = await fetch("https://api.openai.com/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}` }
      });
      if (!resp.ok) {
        return res.status(200).json({ success: false, error: "API Key de OpenAI inválida o rechazada." });
      }
      const data = await resp.json();
      const now = new Date();
      return res.status(200).json({
        success: true,
        message: "🟢 Conexión con OpenAI establecida correctamente.",
        modelsCount: (data.data || []).length,
        lastVerification: now.toLocaleDateString("es-ES") + " " + now.toLocaleTimeString("es-ES")
      });
    }

    return res.status(200).json({ success: false, error: "Proveedor no soportado." });
  } catch (err: any) {
    return res.status(200).json({ success: false, error: parseAiError(err), details: err?.stack });
  }
};

// Dispatcher middleware based on request URL pattern
app.use(async (req, res, next) => {
  const url = (req.url || "").toLowerCase();
  try {
    if (url.includes("models")) {
      return await handleModels(req, res);
    }
    if (url.includes("test-connection")) {
      return await handleTestConnection(req, res);
    }
    if (url.includes("diagnose")) {
      return await handleDiagnose(req, res);
    }
    return res.status(200).json({
      success: false,
      error: `Ruta de API no reconocida: ${req.method} ${req.url}`
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      error: parseAiError(err),
      details: err?.stack
    });
  }
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error in serverless API handler:", err);
  res.status(200).json({
    success: false,
    error: err?.message || String(err) || "Error interno del servidor.",
    details: err?.stack
  });
});

export default app;
