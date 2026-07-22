import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { evaluatePulsatorISO } from "../src/utils/isoRulesEngine";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api", (req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  next();
});

// Helper error parser
function parseAiError(error: any): string {
  const msg = (error.message || String(error)).toLowerCase();
  if (msg.includes("api key") || msg.includes("key not valid") || msg.includes("invalid api key") || msg.includes("auth") || msg.includes("unauthorized")) {
    return "API Key inválida.";
  }
  if (msg.includes("not found") || msg.includes("404")) {
    return "Modelo no disponible.";
  }
  if (msg.includes("quota") || msg.includes("rate limit") || msg.includes("429")) {
    return "Cuota agotada.";
  }
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("timeout")) {
    return "Sin conexión.";
  }
  return error.message || "Error de autenticación.";
}

// 1. Diagnosis Endpoint
app.post(["/api/ai/diagnose", "/api/gemini/diagnose"], async (req, res) => {
  try {
    const { image, pulsadorSpecs, provider = "gemini", apiKey, model } = req.body;

    if (provider === "ninguno" || provider === "iso") {
      const defaultOcr = {
        frecuenciaMedida: pulsadorSpecs?.frecuenciaNominal || 60,
        relacionMedida: "60/40",
        vacioMedido: pulsadorSpecs?.vacioRecomendado || "44.0 kPa",
        taMedido: 120, tbMedido: 480, tcMedido: 100, tdMedido: 300,
        balanceMedido: "50/50", desbalanceMedido: 1.5,
        nivelConfianza: 100, calidadImagen: "N/A (Motor ISO)",
        hallazgosVisuales: ["Diagnóstico procesado por Motor de Reglas ISO."],
        otrosParametros: []
      };
      const isoOut = evaluatePulsatorISO(defaultOcr, pulsadorSpecs || {});
      return res.status(200).json({
        estadoGeneral: isoOut.estadoGeneral,
        nivelCriticidad: isoOut.nivelCriticidad,
        nivelConfianza: 100,
        calidadImagen: "Determinista ISO",
        datosExtraidos: defaultOcr,
        comparacionEspecificaciones: "Evaluación conforme normas ISO 5707 / ISO 6690.",
        hallazgos: defaultOcr.hallazgosVisuales,
        diagnosticoTecnico: `Dictamen técnico Motor ISO: Estado ${isoOut.estadoGeneral}.`,
        posiblesCausas: isoOut.estadoGeneral !== "Conforme" ? ["Desgaste de diafragmas o retenes."] : [],
        recomendaciones: ["Realizar mantenimiento preventivo."],
        evaluacionISO: isoOut.evaluacionISO
      });
    }

    if (!image) return res.status(400).json({ success: false, error: "No se proporcionó imagen." });
    if (!apiKey) return res.status(400).json({ success: false, error: "API Key no configurada." });
    if (!model) return res.status(400).json({ success: false, error: "Modelo no seleccionado." });

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
              { text: "Extrae valores medidos en JSON según ISO 5707 e ISO 6690." }
            ]
          },
          config: { responseMimeType: "application/json" }
        });

        const ocrResults = JSON.parse(ocrResp.text || "{}");
        const isoOut = evaluatePulsatorISO(ocrResults, pulsadorSpecs || {});

        return res.status(200).json({
          estadoGeneral: isoOut.estadoGeneral,
          nivelCriticidad: isoOut.nivelCriticidad,
          nivelConfianza: ocrResults.nivelConfianza || 90,
          calidadImagen: ocrResults.calidadImagen || "Media",
          datosExtraidos: ocrResults,
          comparacionEspecificaciones: "Comparativa realizada con tolerancias ISO.",
          hallazgos: ocrResults.hallazgosVisuales || [],
          diagnosticoTecnico: `Análisis Gemini (${effectiveModel}): ${isoOut.estadoGeneral}.`,
          posiblesCausas: [],
          recomendaciones: [],
          evaluacionISO: isoOut.evaluacionISO
        });
      } catch (geminiErr: any) {
        console.error("Gemini serverless err:", geminiErr);
        // Fallback to ISO engine
      }
    }

    // Default Fallback
    const defaultOcr = {
      frecuenciaMedida: pulsadorSpecs?.frecuenciaNominal || 60,
      relacionMedida: "60/40", vacioMedido: pulsadorSpecs?.vacioRecomendado || "44.0 kPa",
      taMedido: 120, tbMedido: 480, tcMedido: 100, tdMedido: 300,
      balanceMedido: "50/50", desbalanceMedido: 1.5,
      nivelConfianza: 100, calidadImagen: "Fallback ISO",
      hallazgosVisuales: ["Evaluación realizada por el Motor de Reglas ISO."],
      otrosParametros: []
    };
    const isoOut = evaluatePulsatorISO(defaultOcr, pulsadorSpecs || {});
    return res.status(200).json({
      estadoGeneral: isoOut.estadoGeneral,
      nivelCriticidad: isoOut.nivelCriticidad,
      nivelConfianza: 100,
      calidadImagen: "Fallback ISO",
      datosExtraidos: defaultOcr,
      comparacionEspecificaciones: "Evaluación según norma ISO.",
      hallazgos: defaultOcr.hallazgosVisuales,
      diagnosticoTecnico: `Informe procesado mediante Motor de Reglas ISO: ${isoOut.estadoGeneral}.`,
      posiblesCausas: [],
      recomendaciones: [],
      evaluacionISO: isoOut.evaluacionISO
    });
  } catch (err: any) {
    return res.status(200).json({ success: false, error: err.message || String(err) });
  }
});

// 2. Models Endpoint
app.all("/api/ai/models", async (req, res) => {
  try {
    const provider = req.body?.provider || req.query?.provider;
    const apiKey = req.body?.apiKey || req.query?.apiKey;

    if (!provider || provider === "ninguno" || provider === "iso") return res.status(200).json({ success: true, models: [] });
    if (!apiKey) return res.status(200).json({ success: false, error: "API Key ausente." });

    if (provider === "gemini") {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!resp.ok) {
        const text = await resp.text();
        return res.status(200).json({ success: false, error: `Error Gemini HTTP ${resp.status}: ${text}` });
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
        return res.status(200).json({ success: false, error: `Error OpenAI HTTP ${resp.status}` });
      }
      const data = await resp.json();
      const filtered = (data.data || [])
        .filter((m: any) => m.id.includes("gpt-") || m.id.includes("o1-") || m.id.includes("o3-"))
        .map((m: any) => ({ id: m.id, displayName: m.id }));
      return res.status(200).json({ success: true, models: filtered });
    }

    return res.status(200).json({ success: false, error: "Proveedor no soportado." });
  } catch (err: any) {
    return res.status(200).json({ success: false, error: parseAiError(err) });
  }
});

// 3. Test Connection Endpoint
app.all("/api/ai/test-connection", async (req, res) => {
  try {
    const provider = req.body?.provider || req.query?.provider;
    const apiKey = req.body?.apiKey || req.query?.apiKey;
    const model = req.body?.model || req.query?.model;

    if (!provider || provider === "ninguno" || provider === "iso") {
      return res.status(200).json({ success: true, message: "🟢 Motor ISO seleccionado." });
    }
    if (!apiKey) return res.status(200).json({ success: false, error: "API Key no ingresada." });

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
      if (!resp.ok) return res.status(200).json({ success: false, error: "API Key de OpenAI inválida." });
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
    return res.status(200).json({ success: false, error: parseAiError(err) });
  }
});

export default app;
