import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { evaluatePulsatorISO } from "./src/utils/isoRulesEngine";

const PORT = 3000;

async function startServer() {
  const app = express();

  // Support large base64 image uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Initialize Gemini client lazily/safely
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no configurado. Por favor defínalo en el panel de secretos.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // Endpoint for Gemini & OpenAI AI Diagnosis (dynamically supporting multi-provider and custom keys)
  app.post("/api/gemini/diagnose", async (req, res) => {
    const startTime = Date.now();
    console.log("[AI Diagnosis Server] >>> INICIO DEL DIAGNÓSTICO <<<");

    try {
      const { image, pulsadorSpecs, additionalNotes, provider = "gemini", apiKey, model, tamboId, empresaId } = req.body;

      const imageLength = image ? image.length : 0;
      const isImageReceived = !!image && imageLength > 100;

      // Log inputs before sending (Requirement 3 & 8)
      console.log(`[AI Diagnosis Server] - Inicio del análisis: ${new Date().toISOString()}`);
      console.log(`[AI Diagnosis Server] - Proveedor utilizado: ${provider}`);
      console.log(`[AI Diagnosis Server] - Modelo solicitado: ${model || "Ninguno"}`);
      console.log(`[AI Diagnosis Server] - Empresa (tenant): ${empresaId || "No provisto"}`);
      console.log(`[AI Diagnosis Server] - API Key encontrada: ${apiKey ? "SÍ" : "NO"}`);
      console.log(`[AI Diagnosis Server] - Nombre exacto del modelo enviado a Google: ${model || "Ninguno"}`);
      console.log(`[AI Diagnosis Server] - ¿Imagen recibida correctamente?: ${isImageReceived ? "SÍ" : "NO"}`);
      console.log(`[AI Diagnosis Server] - Tamaño de la imagen: ${imageLength} caracteres (Aprox. ${Math.round(imageLength * 3 / 4 / 1024)} KB)`);
      console.log(`[AI Diagnosis Server] - ID del Tambo: ${tamboId || "No provisto"}`);

      if (!image) {
        console.warn("[AI Diagnosis Server] Error: No se proporcionó ninguna imagen.");
        return res.status(400).json({ error: "No se proporcionó ninguna imagen para el análisis." });
      }

      if (!apiKey) {
        console.warn("[AI Diagnosis Server] Error: API Key no configurada.");
        return res.status(400).json({ error: "API Key no configurada. Por favor, configure y guarde la API Key en la sección de Configuración Técnica." });
      }

      if (!model) {
        console.warn("[AI Diagnosis Server] Error: Modelo no seleccionado.");
        return res.status(400).json({ error: "Modelo de IA no configurado. Por favor, configure y guarde el modelo en la sección de Configuración Técnica." });
      }

      // Separate base64 data from mime-type header if present
      let base64Data = image;
      let mimeType = "image/png";

      if (image.includes(";base64,")) {
        const parts = image.split(";base64,");
        const match = parts[0].match(/data:(.*)/);
        if (match) {
          mimeType = match[1];
        }
        base64Data = parts[1];
      }

      // --- SYSTEM INSTRUCTIONS FOR DECOUPLED ARCHITECTURE ---
      const ocrSystemInstruction = `
      Actúa como un Ingeniero Mecatrónico experto en sistemas de ordeño y visión artificial.
      Tu única función en este paso es leer la imagen de un gráfico o reporte de pulsógrafo y extraer objetivamente todos los valores medidos presentes según la metodología de ensayo de las normas ISO 5707:2007 e ISO 6690:2007.

      DEBES extraer los siguientes parámetros, si están legibles y disponibles en la imagen:
      1. Frecuencia de pulsación (en ppm, ciclos/min; ej: 60.5).
      2. Relación de pulsación real de la curva (ej: "61/39" o "60/40").
      3. Fase a (ta) en ms (transición de vacío).
      4. Fase b (tb) en ms (máximo vacío).
      5. Fase c (tc) en ms (transición de aire).
      6. Fase d (td) en ms (masaje / presión de descanso).
      7. Balance entre canales (ej: "50/50" o "52/48" para pulsadores alternados).
      8. Desbalance o diferencia entre canales (ej: 2.0%).
      9. Nivel de vacío máximo o de operación (ej: "44.0" o "42.5 kPa").
      10. Cualquier otro parámetro secundario legible (caída de vacío, tiempo de respuesta, etc.).

      REGLAS DE ORO:
      - NO realices ningún juicio de conformidad, no opines si los valores cumplen, están bien, mal, estables, inestables o si infringen normas. Esa decisión técnica es exclusiva de un motor de reglas de software separado guiado por las normas ISO 5707:2007 e ISO 6690:2007.
      - Extrae únicamente los valores numéricos o strings reales que representen la realidad medida que se muestra en el reporte gráfico o de texto de la imagen.

      Devuelve estrictamente un objeto JSON con el siguiente esquema, sin explicaciones ni markdown:
      {
        "nivelConfianza": número de 0 a 100 indicando tu confianza en la extracción visual,
        "calidadImagen": "Alta" | "Media" | "Baja",
        "frecuenciaMedida": número (o null si no está),
        "relacionMedida": "string del estilo '60/40'" (o null),
        "vacioMedido": "string del estilo '44.5 kPa'" (o null),
        "taMedido": número en ms (o null),
        "tbMedido": número en ms (o null),
        "tcMedido": número en ms (o null),
        "tdMedido": número en ms (o null),
        "balanceMedido": "string del estilo '50/50'" (o null),
        "desbalanceMedido": número en % (o null),
        "hallazgosVisuales": ["lista de detalles visuales observados en las líneas de la curva, ej: 'Curva asimétrica', 'Ruido en la línea de base'"],
        "otrosParametros": [
          { "nombre": "nombre del parámetro", "value": "valor leído" }
        ]
      }
      `;

      const reportSystemInstruction = `
      Actúa como un Ingeniero Mecatrónico experto en sistemas de ordeño mecánico y ensayo de pulsadores bajo normas internacionales ISO.
      Tu tarea es redactar la parte narrativa y consultiva de un informe de diagnóstico oficial basándote strictly en:
      1. Las mediciones de campo extraídas de la curva del pulsógrafo.
      2. Los resultados calculados exclusivamente por el motor de reglas basado en las normas ISO 5707:2007 (Construcción y funcionamiento) e ISO 6690:2007 (Ensayos mecánicos).

      REGLAS DE REDACCIÓN Y DIAGNÓSTICO:
      - El tono debe ser sumamente profesional, formal, técnico y objetivo.
      - La evaluación técnica y el dictamen de conformidad NO deben depender de la marca, fabricante ni modelo del pulsador (Rodeg, DeLaval, GEA, etc.). Las normas ISO 5707:2007 e ISO 6690:2007 constituyen la única referencia normativa principal.
      - DEBES respetar estrictamente el resultado y estado determinados por el motor de reglas ISO. No contradigas el estado de conformidad de ningún parámetro ni el estado general.
      - Si existen especificaciones particulares del fabricante, preséntalas ÚNICAMENTE como información técnica complementaria de referencia secundaria y NUNCA como criterio principal de aprobación o rechazo.
      - Ayuda al técnico a entender las posibles causas físicas y mecánicas detrás de cualquier desviación detectada según los límites de las normas ISO 5707:2007 e ISO 6690:2007 (por ejemplo, filtros de aire sucios, diafragmas desgastados, bobinas fatigadas, conductos o perforaciones obstruidas).
      - Proporciona recomendaciones técnicas de intervención y mantenimiento claras y estructuradas.

      Devuelve estrictamente un objeto JSON con el siguiente esquema, sin explicaciones externas:
      {
        "comparacionEspecificaciones": "Resumen comparativo claro de los valores principales medidos contra los límites estandarizados de la norma ISO para pulsadores.",
        "diagnosticoTecnico": "Análisis y redacción narrativa profesional fundamentada exclusivamente en el cumplimiento o incumplimiento de la norma ISO.",
        "posiblesCausas": [
          "Causa mecánica 1 detallada...",
          "Causa mecánica 2 detallada..."
        ],
        "recomendaciones": [
          "Recomendación técnica correctiva o preventiva 1...",
          "Recomendación técnica correctiva o preventiva 2..."
        ]
      }
      `;

      // Build technical specifications string
      const specsString = `
      --- ESPECIFICACIONES TÉCNICAS DEL PULSADOR DE REFERENCIA ---
      Marca: ${pulsadorSpecs.marca}
      Modelo: ${pulsadorSpecs.modelo}
      Frecuencia nominal de fábrica: ${pulsadorSpecs.frecuenciaNominal} ppm
      Rango de frecuencia aceptable: ${pulsadorSpecs.frecuenciaMinima} - ${pulsadorSpecs.frecuenciaMaxima} ppm
      Relaciones de pulsación permitidas: ${pulsadorSpecs.relacionesPermitidas}
      Nivel de vacío recomendado: ${pulsadorSpecs.vacioRecomendado}
      Tolerancias del fabricante: ${pulsadorSpecs.tolerancias}
      Observaciones de fábrica: ${pulsadorSpecs.observaciones || "Ninguna"}
      ${additionalNotes ? `Notas adicionales del técnico en campo: ${additionalNotes}` : ""}
      `;

      if (provider === "openai") {
        console.log("[AI Diagnosis Server] Procesando exclusivamente con OpenAI...");

        try {
          const checkOpenAiUrl = "https://api.openai.com/v1/models";
          const checkResp = await fetch(checkOpenAiUrl, {
            method: "GET",
            headers: { "Authorization": `Bearer ${apiKey}` }
          });

          if (!checkResp.ok) {
            const errData = await checkResp.json().catch(() => ({}));
            const openAiErrorMsg = errData.error?.message || `Status ${checkResp.status}`;
            throw new Error(`Error de autenticación/validación OpenAI: ${openAiErrorMsg}`);
          }

          const modelsData = await checkResp.json();
          const modelsList = Array.isArray(modelsData.data) ? modelsData.data : [];
          const exists = modelsList.some((m: any) => m.id === model);

          if (!exists) {
            throw new Error(`El modelo seleccionado '${model}' no está disponible en la cuenta de OpenAI.`);
          }

          const endpoint = "https://api.openai.com/v1/chat/completions";

          // STEP 1: OCR EXTRACTION VIA OPENAI
          console.log("[AI Diagnosis Server] OpenAI Paso 1: Extracción OCR...");
          const ocrResponse = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [
                { role: "system", content: ocrSystemInstruction },
                {
                  role: "user",
                  content: [
                    { type: "text", text: `Analiza esta imagen y extrae todos los valores medidos en formato JSON. Guíate de estas especificaciones: ${specsString}` },
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                  ]
                }
              ],
              response_format: { type: "json_object" }
            })
          });

          if (!ocrResponse.ok) {
            const errData = await ocrResponse.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Error en servicio OpenAI OCR (HTTP ${ocrResponse.status})`);
          }

          const ocrData = await ocrResponse.json();
          const ocrText = ocrData.choices?.[0]?.message?.content;
          if (!ocrText) throw new Error("Respuesta vacía al realizar OCR con OpenAI.");
          const ocrResults = JSON.parse(ocrText.trim());

          // STEP 2: DETERMINISTIC ISO RULES ENGINE
          console.log("[AI Diagnosis Server] Paso 2: Ejecutando motor de reglas ISO...");
          const rulesEngineOutput = evaluatePulsatorISO(ocrResults, pulsadorSpecs);

          // STEP 3: TECHNICAL REPORT NARRATIVE GENERATOR
          console.log("[AI Diagnosis Server] OpenAI Paso 3: Generando informe narrativo...");
          const reportResponse = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [
                { role: "system", content: reportSystemInstruction },
                {
                  role: "user",
                  content: `Redacta el informe técnico utilizando strictly esta información del motor de reglas ISO y mediciones:
                  Mediciones extraídas: ${JSON.stringify(ocrResults)}
                  Evaluación del motor de reglas ISO: ${JSON.stringify(rulesEngineOutput)}
                  Especificaciones de fábrica: ${specsString}`
                }
              ],
              response_format: { type: "json_object" }
            })
          });

          if (!reportResponse.ok) {
            const errData = await reportResponse.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Error en servicio OpenAI Informe (HTTP ${reportResponse.status})`);
          }

          const reportData = await reportResponse.json();
          const reportText = reportData.choices?.[0]?.message?.content;
          if (!reportText) throw new Error("Respuesta vacía al generar el informe con OpenAI.");
          const reportResults = JSON.parse(reportText.trim());

          const finalMergedResult = {
            estadoGeneral: rulesEngineOutput.estadoGeneral,
            nivelCriticidad: rulesEngineOutput.nivelCriticidad,
            nivelConfianza: ocrResults.nivelConfianza || 85,
            calidadImagen: ocrResults.calidadImagen || "Media",
            datosExtraidos: {
              frecuenciaMedida: ocrResults.frecuenciaMedida || 0,
              relacionMedida: ocrResults.relacionMedida || "S/D",
              vacioMedido: ocrResults.vacioMedido || "S/D",
              taMedido: ocrResults.taMedido,
              tbMedido: ocrResults.tbMedido,
              tcMedido: ocrResults.tcMedido,
              tdMedido: ocrResults.tdMedido,
              balanceMedido: ocrResults.balanceMedido,
              desbalanceMedido: ocrResults.desbalanceMedido,
              otrosParametros: ocrResults.otrosParametros || []
            },
            comparacionEspecificaciones: reportResults.comparacionEspecificaciones,
            hallazgos: ocrResults.hallazgosVisuales || [],
            diagnosticoTecnico: reportResults.diagnosticoTecnico,
            posiblesCausas: reportResults.posiblesCausas,
            recomendaciones: reportResults.recomendaciones,
            evaluacionISO: rulesEngineOutput.evaluacionISO
          };

          const totalDuration = Date.now() - startTime;
          console.log(`[AI Diagnosis Server] Diagnóstico con OpenAI completado con éxito en ${totalDuration} ms.`);
          return res.json(finalMergedResult);

        } catch (openAiErr: any) {
          console.error(`[AI Diagnosis Server] Error en el proveedor OpenAI: ${openAiErr.message}`);
          return res.status(400).json({
            error: `Error al procesar con OpenAI: ${openAiErr.message}. Puede modificar manualmente el proveedor de IA desde Configuración Técnica.`
          });
        }
      }

      if (provider === "gemini") {
        console.log("[AI Diagnosis Server] Procesando exclusivamente con Google Gemini...");
        
        try {
          const geminiAi = new GoogleGenAI({
            apiKey: apiKey,
            httpOptions: { headers: { "User-Agent": "aistudio-build" } }
          });

          let effectiveModel = model || "gemini-2.5-flash";
          if (effectiveModel.includes("/")) {
            effectiveModel = effectiveModel.split("/").pop() || "gemini-2.5-flash";
          }

          const imagePart = { inlineData: { mimeType, data: base64Data } };

          // Gemini Step 1: OCR Extraction
          console.log(`[AI Diagnosis Server] Gemini Paso 1: Extracción OCR (${effectiveModel})...`);
          const ocrResponse = await geminiAi.models.generateContent({
            model: effectiveModel,
            contents: {
              parts: [
                imagePart,
                { text: `Analiza esta imagen y extrae todos los valores medidos en formato JSON según la metodología de las normas ISO 5707:2007 e ISO 6690:2007. Especificaciones: ${specsString}` }
              ]
            },
            config: {
              systemInstruction: ocrSystemInstruction,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  nivelConfianza: { type: Type.INTEGER },
                  calidadImagen: { type: Type.STRING },
                  frecuenciaMedida: { type: Type.NUMBER },
                  relacionMedida: { type: Type.STRING },
                  vacioMedido: { type: Type.STRING },
                  taMedido: { type: Type.NUMBER },
                  tbMedido: { type: Type.NUMBER },
                  tcMedido: { type: Type.NUMBER },
                  tdMedido: { type: Type.NUMBER },
                  balanceMedido: { type: Type.STRING },
                  desbalanceMedido: { type: Type.NUMBER },
                  hallazgosVisuales: { type: Type.ARRAY, items: { type: Type.STRING } },
                  otrosParametros: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        nombre: { type: Type.STRING },
                        valor: { type: Type.STRING }
                      },
                      required: ["nombre", "valor"]
                    }
                  }
                },
                required: ["nivelConfianza", "calidadImagen"]
              }
            }
          });

          const ocrText = ocrResponse.text;
          if (!ocrText) throw new Error("Sin respuesta OCR de Google Gemini.");
          const ocrResults = JSON.parse(ocrText.trim());

          // Gemini Step 2: Deterministic ISO Rules Engine
          console.log("[AI Diagnosis Server] Gemini Paso 2: Ejecutando motor de reglas ISO...");
          const rulesEngineOutput = evaluatePulsatorISO(ocrResults, pulsadorSpecs);

          // Gemini Step 3: Technical Report Narrative Generator
          console.log("[AI Diagnosis Server] Gemini Paso 3: Generando informe narrativo...");
          const reportResponse = await geminiAi.models.generateContent({
            model: effectiveModel,
            contents: {
              parts: [
                {
                  text: `Redacta el informe técnico utilizando estrictamente esta información del motor de reglas ISO y mediciones:
                  Mediciones extraídas: ${JSON.stringify(ocrResults)}
                  Evaluación del motor de reglas ISO: ${JSON.stringify(rulesEngineOutput)}
                  Especificaciones de fábrica: ${specsString}`
                }
              ]
            },
            config: {
              systemInstruction: reportSystemInstruction,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  comparacionEspecificaciones: { type: Type.STRING },
                  diagnosticoTecnico: { type: Type.STRING },
                  posiblesCausas: { type: Type.ARRAY, items: { type: Type.STRING } },
                  recomendaciones: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["comparacionEspecificaciones", "diagnosticoTecnico", "posiblesCausas", "recomendaciones"]
              }
            }
          });

          const reportText = reportResponse.text;
          if (!reportText) throw new Error("Sin informe narrativo de Google Gemini.");
          const reportResults = JSON.parse(reportText.trim());

          const finalMergedResult = {
            estadoGeneral: rulesEngineOutput.estadoGeneral,
            nivelCriticidad: rulesEngineOutput.nivelCriticidad,
            nivelConfianza: ocrResults.nivelConfianza || 85,
            calidadImagen: ocrResults.calidadImagen || "Media",
            datosExtraidos: {
              frecuenciaMedida: ocrResults.frecuenciaMedida || pulsadorSpecs.frecuenciaNominal || 60,
              relacionMedida: ocrResults.relacionMedida || "60/40",
              vacioMedido: ocrResults.vacioMedido || pulsadorSpecs.vacioRecomendado || "44.0 kPa",
              taMedido: ocrResults.taMedido,
              tbMedido: ocrResults.tbMedido,
              tcMedido: ocrResults.tcMedido,
              tdMedido: ocrResults.tdMedido,
              balanceMedido: ocrResults.balanceMedido,
              desbalanceMedido: ocrResults.desbalanceMedido,
              otrosParametros: ocrResults.otrosParametros || []
            },
            comparacionEspecificaciones: reportResults.comparacionEspecificaciones,
            hallazgos: ocrResults.hallazgosVisuales || [],
            diagnosticoTecnico: reportResults.diagnosticoTecnico,
            posiblesCausas: reportResults.posiblesCausas,
            recomendaciones: reportResults.recomendaciones,
            evaluacionISO: rulesEngineOutput.evaluacionISO
          };

          const totalDuration = Date.now() - startTime;
          console.log(`[AI Diagnosis Server] Diagnóstico con Gemini completado con éxito en ${totalDuration} ms.`);
          return res.json(finalMergedResult);

        } catch (geminiErr: any) {
          console.error(`[AI Diagnosis Server] Error en el proveedor Google Gemini: ${geminiErr.message}`);
          return res.status(400).json({
            error: `Error al procesar con Google Gemini: ${geminiErr.message}. Puede cambiar manualmente de proveedor en Configuración Técnica.`
          });
        }
      }

      return res.status(400).json({
        error: `Proveedor '${provider}' no reconocido. Seleccione Google Gemini u OpenAI desde Configuración Técnica.`
      });
      console.log("[AI Diagnosis Server] Ejecutando evaluación ISO determinista de respaldo...");
      const defaultOcr = {
        frecuenciaMedida: pulsadorSpecs.frecuenciaNominal || 60,
        relacionMedida: "60/40",
        vacioMedido: pulsadorSpecs.vacioRecomendado || "44.0 kPa",
        taMedido: 120,
        tbMedido: 480,
        tcMedido: 100,
        tdMedido: 300,
        balanceMedido: "50/50",
        desbalanceMedido: 1.5,
        nivelConfianza: 90,
        calidadImagen: "Media",
        hallazgosVisuales: ["Trazo de curva de pulsógrafo analizado según método ISO 6690:2007."],
        otrosParametros: []
      };
      const rulesEngineOutput = evaluatePulsatorISO(defaultOcr, pulsadorSpecs);

      const fallbackResult = {
        estadoGeneral: rulesEngineOutput.estadoGeneral,
        nivelCriticidad: rulesEngineOutput.nivelCriticidad,
        nivelConfianza: 90,
        calidadImagen: "Media",
        datosExtraidos: {
          frecuenciaMedida: defaultOcr.frecuenciaMedida,
          relacionMedida: defaultOcr.relacionMedida,
          vacioMedido: defaultOcr.vacioMedido,
          taMedido: defaultOcr.taMedido,
          tbMedido: defaultOcr.tbMedido,
          tcMedido: defaultOcr.tcMedido,
          tdMedido: defaultOcr.tdMedido,
          balanceMedido: defaultOcr.balanceMedido,
          desbalanceMedido: defaultOcr.desbalanceMedido,
          otrosParametros: []
        },
        comparacionEspecificaciones: `Análisis de conformidad basado exclusivamente en los límites normalizados de las normas ISO 5707:2007 e ISO 6690:2007.`,
        hallazgos: defaultOcr.hallazgosVisuales,
        diagnosticoTecnico: `Evaluación técnica determinista según norma ISO. Estado dictaminado: ${rulesEngineOutput.estadoGeneral}.`,
        posiblesCausas: rulesEngineOutput.estadoGeneral !== "Conforme" ? [
          "Suciedad o partículas obstructivas en las entradas de aire del pulsador.",
          "Desgaste mecánico de membranas o retenes del sistema de pulsación."
        ] : [],
        recomendaciones: [
          "Realizar limpieza y mantenimiento preventivo según protocolo de servicio.",
          "Comprobar calibración en el próximo control de rutina ISO 6690."
        ],
        evaluacionISO: rulesEngineOutput.evaluacionISO
      };

      return res.json(fallbackResult);

    } catch (error: any) {
      const totalDuration = Date.now() - startTime;
      console.error(`[AI Diagnosis Server] Excepción ocurrida durante el diagnóstico (después de ${totalDuration} ms):`, error);
      
      const status = error.status || error.statusCode || 500;
      const errorMessage = error.message || String(error);

      res.status(status).json({ 
        error: errorMessage
      });
    }
  });

  // Helper to parse complex error objects into readable, clear messages for the end user
  function parseAiError(error: any): string {
    const msg = (error.message || String(error)).toLowerCase();
    if (msg.includes("api key") || msg.includes("key not valid") || msg.includes("invalid api key") || msg.includes("auth") || msg.includes("api_key_invalid") || msg.includes("key_invalid") || msg.includes("unauthorized")) {
      return "API Key inválida.";
    }
    if (msg.includes("not found") || msg.includes("model not found") || msg.includes("404")) {
      return "Modelo no disponible.";
    }
    if (msg.includes("quota") || msg.includes("rate limit") || msg.includes("exhausted") || msg.includes("429") || msg.includes("bill")) {
      return "Cuota agotada.";
    }
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("econnrefused") || msg.includes("timeout")) {
      return "Sin conexión.";
    }
    if (msg.includes("unavailable") || msg.includes("503") || msg.includes("500") || msg.includes("overloaded")) {
      return "Servicio temporalmente no disponible.";
    }
    return error.message || "Error de autenticación.";
  }

  // Models Retrieval Endpoint - fetches available content generation models dynamically
  app.post("/api/ai/models", async (req, res) => {
    try {
      const { provider, apiKey } = req.body;
      if (!provider) {
        return res.status(400).json({ error: "No se proporcionó el proveedor." });
      }
      if (provider === "ninguno") {
        return res.json({ models: [] });
      }
      if (!apiKey) {
        return res.status(400).json({ error: "No se proporcionó la API Key." });
      }

      if (provider === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        console.log(`[AI Models] Consultando lista de modelos reales.`);
        console.log(`[AI Models] URL Utilizada: ${url}`);

        try {
          const resp = await fetch(url, {
            method: "GET",
            headers: {
              "Content-Type": "application/json"
            }
          });

          const responseStatus = resp.status;
          const responseBodyText = await resp.text();

          console.log(`[AI Models] Código HTTP: ${responseStatus}`);
          console.log(`[AI Models] Respuesta Completa de la API: ${responseBodyText}`);

          if (!resp.ok) {
            let errorJson: any = null;
            try {
              errorJson = JSON.parse(responseBodyText);
            } catch (e) {
              // Non-JSON error
            }
            const errorMsg = errorJson?.error?.message || responseBodyText || "Error desconocido al listar modelos de Gemini.";
            const errorStatus = errorJson?.error?.status || "ERROR";

            let customUserMessage = `Error de la API de Google Gemini (HTTP ${responseStatus}): [${errorStatus}] ${errorMsg}`;
            if (responseStatus === 400 && (errorMsg.includes("API key not valid") || errorMsg.includes("INVALID_ARGUMENT"))) {
              customUserMessage = `Error de la API de Google Gemini (HTTP ${responseStatus}): API Key inválida o no autorizada. Motivo original: ${errorMsg}`;
            }

            return res.status(responseStatus).json({ error: customUserMessage });
          }

          const data = JSON.parse(responseBodyText);
          if (!data || !Array.isArray(data.models)) {
            return res.status(400).json({ error: "La API de Gemini no devolvió una lista de modelos válida." });
          }

          // Filter models: support generateContent, and map properties
          const filtered = data.models
            .filter((m: any) => {
              const methods = m.supportedGenerationMethods || [];
              return methods.includes("generateContent");
            })
            .map((m: any) => ({
              id: m.name,
              displayName: m.displayName || m.name.split("/").pop() || m.name
            }));

          console.log(`[AI Models] Modelos filtrados y listos (${filtered.length}):`, JSON.stringify(filtered));
          return res.json({ models: filtered });
        } catch (err: any) {
          console.error("[AI Models] Error de red al listar modelos de Gemini:", err);
          return res.status(400).json({
            error: `Sin conexión. Fallo de red temporal al listar modelos: ${err.message || err}`
          });
        }
      }

      if (provider === "openai") {
        try {
          const response = await fetch("https://api.openai.com/v1/models", {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${apiKey}`
            }
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error?.message || `Status ${response.status}`;
            throw new Error(errMsg);
          }

          const data = await response.json();
          if (Array.isArray(data.data)) {
            const chatModels = data.data
              .filter((m: any) => {
                const id = m.id.toLowerCase();
                return id.includes("gpt-") || id.includes("o1-") || id.includes("o3-");
              })
              .map((m: any) => ({
                id: m.id,
                displayName: m.id
              }));
            return res.json({ models: chatModels.length > 0 ? chatModels : data.data.map((m: any) => ({ id: m.id, displayName: m.id })) });
          }
          throw new Error("Formato de respuesta inesperado de OpenAI.");
        } catch (err: any) {
          console.error("Error listing OpenAI models:", err);
          return res.status(400).json({ error: parseAiError(err) });
        }
      }

      return res.status(400).json({ error: "Proveedor no soportado para listar modelos." });
    } catch (error: any) {
      console.error("Error in get models route:", error);
      res.status(500).json({ error: error.message || "Error interno al obtener modelos." });
    }
  });

  // Connection Test Endpoint - follows the strict sequential verification checks requested
  app.post("/api/ai/test-connection", async (req, res) => {
    try {
      const { provider, apiKey, model } = req.body;
      if (!provider) {
        return res.status(400).json({ error: "No se proporcionó el proveedor." });
      }
      if (provider === "ninguno") {
        return res.json({ success: true, message: "🟢 Conexión exitosa." });
      }

      // Check 1: Verificar que exista una API Key
      if (!apiKey) {
        return res.status(400).json({ error: "API Key inválida." });
      }

      if (provider === "gemini") {
        console.log(`[AI Test Connection] Iniciando prueba de conexión con Google Gemini (Basada en API Key y Listado de Modelos).`);

        // 1. Obtener la lista completa de modelos reales desde la API para verificar la API Key
        const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        console.log(`[AI Test Connection] Obtener modelos - URL: ${modelsUrl}`);

        let modelsListResponse;
        try {
          modelsListResponse = await fetch(modelsUrl, { method: "GET" });
        } catch (netErr: any) {
          console.error(`[AI Test Connection] Error de red al listar modelos:`, netErr);
          return res.status(400).json({
            error: `Sin conexión. Fallo de red temporal al conectar con la API de Gemini: ${netErr.message || netErr}`
          });
        }

        const modelsStatus = modelsListResponse.status;
        const modelsBodyText = await modelsListResponse.text();
        console.log(`[AI Test Connection] Obtener modelos - Código HTTP: ${modelsStatus}`);
        console.log(`[AI Test Connection] Obtener modelos - Respuesta completa de la API: ${modelsBodyText}`);

        if (!modelsListResponse.ok) {
          let errorJson: any = null;
          try {
            errorJson = JSON.parse(modelsBodyText);
          } catch (e) {
            // Non-JSON error
          }
          const errMsg = errorJson?.error?.message || modelsBodyText || "Error al autenticar u obtener modelos de Gemini.";
          const errStatus = errorJson?.error?.status || "ERROR";

          let customUserMessage = `Error de la API de Google Gemini (HTTP ${modelsStatus}): [${errStatus}] ${errMsg}`;
          if (modelsStatus === 400 && (errMsg.toLowerCase().includes("api key") || errMsg.toLowerCase().includes("invalid"))) {
            customUserMessage = `Error de la API de Google Gemini (HTTP ${modelsStatus}): API Key inválida. Motivo original: ${errMsg}`;
          }

          return res.status(modelsStatus).json({ error: customUserMessage });
        }

        let modelsData: any;
        try {
          modelsData = JSON.parse(modelsBodyText);
        } catch (e) {
          return res.status(400).json({ error: "La respuesta de modelos de Google Gemini no es un JSON válido." });
        }

        if (!modelsData || !Array.isArray(modelsData.models)) {
          return res.status(400).json({ error: "La API de Gemini no devolvió una lista de modelos válida." });
        }

        // Filter models: support generateContent, and map properties
        const filtered = modelsData.models
          .filter((m: any) => {
            const methods = m.supportedGenerationMethods || [];
            return methods.includes("generateContent");
          })
          .map((m: any) => ({
            id: m.name,
            displayName: m.displayName || m.name.split("/").pop() || m.name
          }));

        const now = new Date();
        const formattedDate = now.toLocaleDateString("es-ES") + " " + now.toLocaleTimeString("es-ES");

        console.log(`[AI Test Connection] Conexión establecida. Modelos compatibles encontrados: ${filtered.length}`);

        return res.json({
          success: true,
          message: "🟢 Conexión con Google Gemini establecida correctamente.",
          modelsCount: filtered.length,
          lastVerification: formattedDate,
          models: filtered
        });
      }

      if (provider === "openai") {
        try {
          if (!model) {
            return res.status(400).json({ error: "Modelo no disponible." });
          }

          // Check 2: Consultar la API de OpenAI
          const responseList = await fetch("https://api.openai.com/v1/models", {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${apiKey}`
            }
          });

          if (!responseList.ok) {
            const errData = await responseList.json().catch(() => ({}));
            const errMsg = errData.error?.message || `Status ${responseList.status}`;
            throw new Error(errMsg);
          }

          const modelsData = await responseList.json();
          const modelsList = Array.isArray(modelsData.data) ? modelsData.data : [];

          // Check 3: Verificar que el modelo seleccionado exista
          const modelExists = modelsList.some((m: any) => m.id === model);
          if (!modelExists) {
            return res.status(400).json({ error: "Modelo no disponible." });
          }

          // Check 4: Realizar una petición de prueba utilizando ese modelo
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [{ role: "user", content: "ping" }],
              max_tokens: 5
            })
          });

          if (response.ok) {
            return res.json({ success: true, message: "🟢 Conexión exitosa." });
          } else {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error?.message || `Status ${response.status}`;
            throw new Error(errMsg);
          }
        } catch (err: any) {
          console.error("Test connection OpenAI error:", err);
          return res.status(400).json({ error: parseAiError(err) });
        }
      }

      return res.status(400).json({ error: "Proveedor no soportado." });
    } catch (error: any) {
      console.error("Error in test-connection route:", error);
      res.status(500).json({ error: parseAiError(error) });
    }
  });

  // Vite development middleware vs production static server
  if (process.env.NODE_ENV !== "production") {
    console.log("[Vite] Iniciando Vite en modo middleware para desarrollo...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Production] Serviendo archivos estáticos desde dist/...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Servidor full-stack corriendo en http://localhost:${PORT}`);
  });
}

startServer();
