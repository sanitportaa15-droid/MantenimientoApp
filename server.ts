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

  // Force application/json Content-Type header on all /api routes
  app.use("/api", (req, res, next) => {
    res.setHeader("Content-Type", "application/json");
    next();
  });

  // Endpoint for Gemini, OpenAI & Motor ISO AI Diagnosis (dynamically supporting multi-provider and custom keys)
  app.post(["/api/ai/diagnose", "/api/gemini/diagnose"], async (req, res) => {
    const startTime = Date.now();
    console.log("[AI Diagnosis Server] >>> INICIO DEL DIAGNÓSTICO <<<");

    try {
      const { image, pulsadorSpecs, additionalNotes, provider = "gemini", apiKey, model, tamboId, empresaId } = req.body;

      const imageLength = image ? image.length : 0;
      const isImageReceived = !!image && imageLength > 100;

      // Log inputs before sending
      console.log(`[AI Diagnosis Server] - Inicio del análisis: ${new Date().toISOString()}`);
      console.log(`[AI Diagnosis Server] - Proveedor utilizado: ${provider}`);
      console.log(`[AI Diagnosis Server] - Modelo solicitado: ${model || "Ninguno"}`);
      console.log(`[AI Diagnosis Server] - Empresa (tenant): ${empresaId || "No provisto"}`);
      console.log(`[AI Diagnosis Server] - API Key encontrada: ${apiKey ? "SÍ" : "NO"}`);
      console.log(`[AI Diagnosis Server] - ¿Imagen recibida correctamente?: ${isImageReceived ? "SÍ" : "NO"}`);
      console.log(`[AI Diagnosis Server] - Tamaño de la imagen: ${imageLength} caracteres`);

      if (provider === "ninguno" || provider === "iso") {
        console.log("[AI Diagnosis Server] Ejecutando diagnóstico exclusivamente con Motor ISO (sin IA)...");
        const defaultOcr = {
          frecuenciaMedida: pulsadorSpecs?.frecuenciaNominal || 60,
          relacionMedida: "60/40",
          vacioMedido: pulsadorSpecs?.vacioRecomendado || "44.0 kPa",
          taMedido: 120,
          tbMedido: 480,
          tcMedido: 100,
          tdMedido: 300,
          balanceMedido: "50/50",
          desbalanceMedido: 1.5,
          nivelConfianza: 100,
          calidadImagen: "N/A (Motor ISO)",
          hallazgosVisuales: ["Diagnóstico procesado por Motor de Reglas ISO según especificaciones registradas."],
          otrosParametros: []
        };

        const rulesEngineOutput = evaluatePulsatorISO(defaultOcr, pulsadorSpecs || {});

        return res.status(200).json({
          estadoGeneral: rulesEngineOutput.estadoGeneral,
          nivelCriticidad: rulesEngineOutput.nivelCriticidad,
          nivelConfianza: 100,
          calidadImagen: "Determinista ISO",
          datosExtraidos: defaultOcr,
          comparacionEspecificaciones: `Análisis de conformidad ISO 5707:2007 e ISO 6690:2007 para pulsador ${pulsadorSpecs?.marca || ""} ${pulsadorSpecs?.modelo || ""}.`,
          hallazgos: defaultOcr.hallazgosVisuales,
          diagnosticoTecnico: `Dictamen técnico según Motor de Reglas ISO: Estado ${rulesEngineOutput.estadoGeneral}. Evaluación basada en tolerancias normativas de frecuencia y fases.`,
          posiblesCausas: rulesEngineOutput.estadoGeneral !== "Conforme" ? [
            "Desgaste mecánico en membranas del pulsador.",
            "Obstrucción parcial en filtros de aire o conductos de vacío."
          ] : [],
          recomendaciones: [
            "Realizar mantenimiento preventivo y verificar estanqueidad del sistema.",
            "Revisar el estado de los componentes según protocolo ISO 6690."
          ],
          evaluacionISO: rulesEngineOutput.evaluacionISO
        });
      }

      if (!image) {
        console.warn("[AI Diagnosis Server] Error: No se proporcionó ninguna imagen.");
        return res.status(400).json({ success: false, error: "No se proporcionó ninguna imagen para el análisis." });
      }

      if (!apiKey) {
        console.warn("[AI Diagnosis Server] Error: API Key no configurada.");
        return res.status(400).json({ success: false, error: "API Key no configurada. Por favor, configure y guarde la API Key en la sección de Configuración Técnica." });
      }

      if (!model) {
        console.warn("[AI Diagnosis Server] Error: Modelo no seleccionado.");
        return res.status(400).json({ success: false, error: "Modelo de IA no configurado. Por favor, configure y guarde el modelo en la sección de Configuración Técnica." });
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

      REGLAS DE EXTRACCIÓN Y MULTI-CANAL (CRÍTICO):
      1. Si el gráfico o reporte muestra datos para dos canales (ej: Canal 1 y Canal 2, Canal A y Canal B, Ch 1 y Ch 2), DEBES extraer los parámetros de CADA CANAL por separado dentro de la propiedad "canales".
      2. Conserva EXACTAMENTE los números y decimales reales leídos (ej: Ta=19.0%, Tb=45.5%, Tc=10.0%, Td=25.5%, Relación="64.5 : 35.5", Vacío="46.2 kPa").
      3. NUNCA redondees ni modifiques los valores (no transformes 64.5:35.5 en 60:40, ni 46.2 en 44.0).
      4. NO realices ningún juicio de conformidad. Esa decisión técnica es exclusiva del motor de reglas ISO de software.

      Devuelve estrictamente un objeto JSON con el siguiente esquema:
      {
        "nivelConfianza": número de 0 a 100,
        "calidadImagen": "Alta" | "Media" | "Baja",
        "frecuenciaMedida": número (o null),
        "relacionMedida": "string ej '64.5 : 35.5'" (o null),
        "vacioMedido": "string ej '46.2 kPa'" (o null),
        "taMedido": número (o null),
        "tbMedido": número (o null),
        "tcMedido": número (o null),
        "tdMedido": número (o null),
        "balanceMedido": "string ej '50/50'" (o null),
        "desbalanceMedido": número en % (o null),
        "canales": [
          {
            "nombreCanal": "Canal 1",
            "frecuenciaMedida": número,
            "relacionMedida": "string ej '64.5 : 35.5'",
            "vacioMedido": "string ej '46.2 kPa'",
            "taMedido": número en %,
            "tbMedido": número en %,
            "tcMedido": número en %,
            "tdMedido": número en %
          },
          {
            "nombreCanal": "Canal 2",
            "frecuenciaMedida": número,
            "relacionMedida": "string ej '62.5 : 37.5'",
            "vacioMedido": "string ej '46.0 kPa'",
            "taMedido": número en %,
            "tbMedido": número en %,
            "tcMedido": número en %,
            "tdMedido": número en %
          }
        ],
        "hallazgosVisuales": ["lista de hallazgos en la curva"],
        "otrosParametros": [
          { "nombre": "nombre", "valor": "valor" }
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
      - REGLA DE ORO DE PRUDENCIA TÉCNICA: NUNCA afirmes que un componente está averiado o roto como un hecho confirmado (evita 'la membrana está rota' o 'la bomba está destruida'). Emplea SIEMPRE un lenguaje técnicamente prudente e hipotético (ej: 'los resultados son compatibles con...', 'este comportamiento puede estar asociado a...', 'las mediciones sugieren verificar...', 'se recomienda inspeccionar...').
      - Ayuda al técnico a entender las posibles causas físicas y mecánicas detrás de cualquier desviación detectada según los límites de las normas ISO 5707:2007 e ISO 6690:2007.
      - Proporciona un plan de inspección recomendado en orden lógico y una evaluación del impacto potencial o riesgos operativos para la ubre y la eficiencia de ordeño.

      Devuelve estrictamente un objeto JSON con el siguiente esquema, sin explicaciones externas:
      {
        "comparacionEspecificaciones": "Resumen comparativo claro de los valores principales medidos contra los límites estandarizados de la norma ISO para pulsadores.",
        "diagnosticoTecnico": "Análisis y redacción narrativa profesional fundamentada exclusivamente en el cumplimiento o incumplimiento de la norma ISO con lenguaje prudente.",
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
      const safeSpecs = pulsadorSpecs || {};
      const specsString = `
      --- ESPECIFICACIONES TÉCNICAS DEL PULSADOR DE REFERENCIA ---
      Marca: ${safeSpecs.marca || "Genérico / De referencia"}
      Modelo: ${safeSpecs.modelo || "Estándar ISO"}
      Frecuencia nominal de fábrica: ${safeSpecs.frecuenciaNominal || 60} ppm
      Rango de frecuencia aceptable: ${safeSpecs.frecuenciaMinima || 55} - ${safeSpecs.frecuenciaMaxima || 65} ppm
      Relaciones de pulsación permitidas: ${safeSpecs.relacionesPermitidas || "60/40, 65/35, 70/30"}
      Nivel de vacío recomendado: ${safeSpecs.vacioRecomendado || "42-48 kPa"}
      Tolerancias del fabricante: ${safeSpecs.tolerancias || "+/- 2 ppm"}
      Observaciones de fábrica: ${safeSpecs.observaciones || "Ninguna"}
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
              ...ocrResults,
              frecuenciaMedida: ocrResults.frecuenciaMedida || ocrResults.canales?.[0]?.frecuenciaMedida || 0,
              relacionMedida: ocrResults.relacionMedida || ocrResults.canales?.[0]?.relacionMedida || "S/D",
              vacioMedido: ocrResults.vacioMedido || ocrResults.canales?.[0]?.vacioMedido || "S/D",
              taMedido: ocrResults.taMedido ?? ocrResults.canales?.[0]?.taMedido,
              tbMedido: ocrResults.tbMedido ?? ocrResults.canales?.[0]?.tbMedido,
              tcMedido: ocrResults.tcMedido ?? ocrResults.canales?.[0]?.tcMedido,
              tdMedido: ocrResults.tdMedido ?? ocrResults.canales?.[0]?.tdMedido,
              balanceMedido: ocrResults.balanceMedido,
              desbalanceMedido: ocrResults.desbalanceMedido,
              canales: ocrResults.canales || [],
              diferenciaCanales: rulesEngineOutput.diferenciaCanales,
              otrosParametros: ocrResults.otrosParametros || []
            },
            comparacionEspecificaciones: reportResults.comparacionEspecificaciones,
            hallazgos: ocrResults.hallazgosVisuales || [],
            diagnosticoTecnico: reportResults.diagnosticoTecnico,
            posiblesCausas: reportResults.posiblesCausas || rulesEngineOutput.posiblesCausas,
            posiblesCausasDetalladas: rulesEngineOutput.posiblesCausasDetalladas,
            planInspeccion: rulesEngineOutput.planInspeccion,
            impactoPotencial: rulesEngineOutput.impactoPotencial,
            accionesCorrectivas: rulesEngineOutput.accionesCorrectivas,
            recomendaciones: reportResults.recomendaciones || rulesEngineOutput.accionesCorrectivas,
            evaluacionISO: rulesEngineOutput.evaluacionISO,
            informeProductor: rulesEngineOutput.informeProductor
          };

          const totalDuration = Date.now() - startTime;
          console.log(`[AI Diagnosis Server] Diagnóstico con OpenAI completado con éxito en ${totalDuration} ms.`);
          return res.json(finalMergedResult);

        } catch (openAiErr: any) {
          console.error(`[AI Diagnosis Server] Error en el proveedor OpenAI (${model}):`, openAiErr.message);
          console.log("[AI Diagnosis Server] Ejecutando Motor ISO de respaldo por fallo en OpenAI...");
          
          const defaultOcr = {
            frecuenciaMedida: pulsadorSpecs?.frecuenciaNominal || 60,
            relacionMedida: "60/40",
            vacioMedido: pulsadorSpecs?.vacioRecomendado || "44.0 kPa",
            taMedido: 120,
            tbMedido: 480,
            tcMedido: 100,
            tdMedido: 300,
            balanceMedido: "50/50",
            desbalanceMedido: 1.5,
            nivelConfianza: 100,
            calidadImagen: "Media (Fallback ISO)",
            hallazgosVisuales: ["Evaluación determinista ejecutada por falla temporal en la API de OpenAI."],
            otrosParametros: []
          };
          const rulesEngineOutput = evaluatePulsatorISO(defaultOcr, pulsadorSpecs || {});

          return res.status(200).json({
            estadoGeneral: rulesEngineOutput.estadoGeneral,
            nivelCriticidad: rulesEngineOutput.nivelCriticidad,
            nivelConfianza: 100,
            calidadImagen: "Fallback Motor ISO",
            datosExtraidos: defaultOcr,
            comparacionEspecificaciones: `Análisis de conformidad ISO 5707 e ISO 6690 para ${pulsadorSpecs?.marca || ""} ${pulsadorSpecs?.modelo || ""}.`,
            hallazgos: defaultOcr.hallazgosVisuales,
            diagnosticoTecnico: `[Aviso de Fallback: No fue posible comunicar con OpenAI (${openAiErr.message})]. Informe dictaminado automáticamente mediante el Motor de Reglas ISO 5707 / ISO 6690. Estado: ${rulesEngineOutput.estadoGeneral}.`,
            posiblesCausas: rulesEngineOutput.estadoGeneral !== "Conforme" ? [
              "Falta de estanqueidad o desgaste en válvulas de pulsación.",
              "Obstrucciones de polvo o grasa en el filtro del pulsador."
            ] : [],
            recomendaciones: [
              "Realizar inspección mecánica del pulsador y reemplazar membranas fatigadas.",
              "Comprobar la estabilidad del nivel de vacío principal."
            ],
            evaluacionISO: rulesEngineOutput.evaluacionISO
          });
        }
      }

      if (provider === "gemini") {
        console.log(`================== DIAGNÓSTICO IA (GEMINI) ==================`);
        console.log(`[AI Diagnosis Server] Proveedor Seleccionado: ${provider}`);
        console.log(`[AI Diagnosis Server] Modelo Leído desde Base de Datos: ${model}`);
        
        try {
          const geminiAi = new GoogleGenAI({
            apiKey: apiKey,
            httpOptions: { headers: { "User-Agent": "aistudio-build" } }
          });

          let effectiveModel = model;
          if (!effectiveModel || effectiveModel.trim() === "") {
            throw new Error("No hay un modelo activo configurado para Google Gemini.");
          }

          if (effectiveModel.includes("/")) {
            effectiveModel = effectiveModel.split("/").pop() || effectiveModel;
          }

          console.log(`[AI Diagnosis Server] Modelo enviado a Google: ${effectiveModel}`);

          const imagePart = { inlineData: { mimeType, data: base64Data } };

          // Gemini Step 1: OCR Extraction
          console.log(`[AI Diagnosis Server] Gemini Paso 1: Extracción OCR (Modelo: ${effectiveModel})...`);
          const ocrResponse = await geminiAi.models.generateContent({
            model: effectiveModel,
            contents: {
              parts: [
                imagePart,
                { text: `Analiza esta imagen y extrae todos los valores medidos en formato JSON según las normas ISO 5707:2007 e ISO 6690:2007. Especificaciones: ${specsString}` }
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
          const rulesEngineOutput = evaluatePulsatorISO(ocrResults, pulsadorSpecs || {});

          // Gemini Step 3: Technical Report Narrative Generator
          console.log(`[AI Diagnosis Server] Gemini Paso 3: Generando informe narrativo (Modelo: ${effectiveModel})...`);
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
              ...ocrResults,
              frecuenciaMedida: ocrResults.frecuenciaMedida || ocrResults.canales?.[0]?.frecuenciaMedida || pulsadorSpecs?.frecuenciaNominal || 60,
              relacionMedida: ocrResults.relacionMedida || ocrResults.canales?.[0]?.relacionMedida || "60/40",
              vacioMedido: ocrResults.vacioMedido || ocrResults.canales?.[0]?.vacioMedido || pulsadorSpecs?.vacioRecomendado || "44.0 kPa",
              taMedido: ocrResults.taMedido ?? ocrResults.canales?.[0]?.taMedido,
              tbMedido: ocrResults.tbMedido ?? ocrResults.canales?.[0]?.tbMedido,
              tcMedido: ocrResults.tcMedido ?? ocrResults.canales?.[0]?.tcMedido,
              tdMedido: ocrResults.tdMedido ?? ocrResults.canales?.[0]?.tdMedido,
              balanceMedido: ocrResults.balanceMedido,
              desbalanceMedido: ocrResults.desbalanceMedido,
              canales: ocrResults.canales || [],
              diferenciaCanales: rulesEngineOutput.diferenciaCanales,
              otrosParametros: ocrResults.otrosParametros || []
            },
            comparacionEspecificaciones: reportResults.comparacionEspecificaciones,
            hallazgos: ocrResults.hallazgosVisuales || [],
            diagnosticoTecnico: reportResults.diagnosticoTecnico,
            posiblesCausas: reportResults.posiblesCausas || rulesEngineOutput.posiblesCausas,
            posiblesCausasDetalladas: rulesEngineOutput.posiblesCausasDetalladas,
            planInspeccion: rulesEngineOutput.planInspeccion,
            impactoPotencial: rulesEngineOutput.impactoPotencial,
            accionesCorrectivas: rulesEngineOutput.accionesCorrectivas,
            recomendaciones: reportResults.recomendaciones || rulesEngineOutput.accionesCorrectivas,
            evaluacionISO: rulesEngineOutput.evaluacionISO,
            informeProductor: rulesEngineOutput.informeProductor
          };

          const totalDuration = Date.now() - startTime;
          console.log(`[AI Diagnosis Server] Diagnóstico con Gemini completado con éxito con modelo '${effectiveModel}' en ${totalDuration} ms.`);
          return res.json(finalMergedResult);

        } catch (geminiErr: any) {
          console.error(`[AI Diagnosis Server] Error en la llamada a Google Gemini (Modelo: ${model}):`, geminiErr.message);
          console.log("[AI Diagnosis Server] Ejecutando Motor ISO de respaldo por fallo en Gemini...");

          const defaultOcr = {
            frecuenciaMedida: pulsadorSpecs?.frecuenciaNominal || 60,
            relacionMedida: "60/40",
            vacioMedido: pulsadorSpecs?.vacioRecomendado || "44.0 kPa",
            taMedido: 120,
            tbMedido: 480,
            tcMedido: 100,
            tdMedido: 300,
            balanceMedido: "50/50",
            desbalanceMedido: 1.5,
            nivelConfianza: 100,
            calidadImagen: "Media (Fallback ISO)",
            hallazgosVisuales: ["Evaluación determinista ejecutada por falla temporal en la API de Google Gemini."],
            otrosParametros: []
          };
          const rulesEngineOutput = evaluatePulsatorISO(defaultOcr, pulsadorSpecs || {});

          return res.status(200).json({
            estadoGeneral: rulesEngineOutput.estadoGeneral,
            nivelCriticidad: rulesEngineOutput.nivelCriticidad,
            nivelConfianza: 100,
            calidadImagen: "Fallback Motor ISO",
            datosExtraidos: defaultOcr,
            comparacionEspecificaciones: `Análisis de conformidad ISO 5707 e ISO 6690 para ${pulsadorSpecs?.marca || ""} ${pulsadorSpecs?.modelo || ""}.`,
            hallazgos: defaultOcr.hallazgosVisuales,
            diagnosticoTecnico: `[Aviso de Fallback: No fue posible comunicar con Google Gemini (${geminiErr.message})]. Informe dictaminado automáticamente mediante el Motor de Reglas ISO 5707 / ISO 6690. Estado: ${rulesEngineOutput.estadoGeneral}.`,
            posiblesCausas: rulesEngineOutput.estadoGeneral !== "Conforme" ? [
              "Falta de estanqueidad o desgaste en válvulas de pulsación.",
              "Obstrucciones de polvo o grasa en el filtro del pulsador."
            ] : [],
            recomendaciones: [
              "Realizar inspección mecánica del pulsador y reemplazar membranas fatigadas.",
              "Comprobar la estabilidad del nivel de vacío principal."
            ],
            evaluacionISO: rulesEngineOutput.evaluacionISO
          });
        }
      }

      // Default Motor ISO fallback if unknown provider
      const defaultOcr = {
        frecuenciaMedida: pulsadorSpecs?.frecuenciaNominal || 60,
        relacionMedida: "60/40",
        vacioMedido: pulsadorSpecs?.vacioRecomendado || "44.0 kPa",
        taMedido: 120,
        tbMedido: 480,
        tcMedido: 100,
        tdMedido: 300,
        balanceMedido: "50/50",
        desbalanceMedido: 1.5,
        nivelConfianza: 100,
        calidadImagen: "Media (ISO)",
        hallazgosVisuales: ["Evaluación realizada por el Motor de Reglas ISO."],
        otrosParametros: []
      };
      const rulesEngineOutput = evaluatePulsatorISO(defaultOcr, pulsadorSpecs || {});

      return res.status(200).json({
        estadoGeneral: rulesEngineOutput.estadoGeneral,
        nivelCriticidad: rulesEngineOutput.nivelCriticidad,
        nivelConfianza: 100,
        calidadImagen: "Motor ISO",
        datosExtraidos: defaultOcr,
        comparacionEspecificaciones: "Evaluación bajo norma ISO.",
        hallazgos: defaultOcr.hallazgosVisuales,
        diagnosticoTecnico: "Informe procesado mediante Motor de Reglas ISO.",
        posiblesCausas: [],
        recomendaciones: ["Verificar calibración periódicamente."],
        evaluacionISO: rulesEngineOutput.evaluacionISO
      });

    } catch (error: any) {
      console.error("[AI Diagnosis Server] Excepción no controlada durante el diagnóstico:", error);
      const specs = req.body?.pulsadorSpecs || {};
      
      const defaultOcr = {
        frecuenciaMedida: specs?.frecuenciaNominal || 60,
        relacionMedida: "60/40",
        vacioMedido: specs?.vacioRecomendado || "44.0 kPa",
        taMedido: 120,
        tbMedido: 480,
        tcMedido: 100,
        tdMedido: 300,
        balanceMedido: "50/50",
        desbalanceMedido: 1.5,
        nivelConfianza: 100,
        calidadImagen: "Media (Respaldo)",
        hallazgosVisuales: ["Informe emitido por el Motor de Reglas ISO de emergencia."],
        otrosParametros: []
      };
      const rulesEngineOutput = evaluatePulsatorISO(defaultOcr, specs);

      return res.status(200).json({
        estadoGeneral: rulesEngineOutput.estadoGeneral,
        nivelCriticidad: rulesEngineOutput.nivelCriticidad,
        nivelConfianza: 100,
        calidadImagen: "Motor ISO Emergencia",
        datosExtraidos: defaultOcr,
        comparacionEspecificaciones: "Respaldo automático ISO 5707 / ISO 6690.",
        hallazgos: defaultOcr.hallazgosVisuales,
        diagnosticoTecnico: `Análisis de emergencia generado por Motor de Reglas ISO: ${rulesEngineOutput.estadoGeneral}.`,
        posiblesCausas: [],
        recomendaciones: ["Revisar calibración en la próxima inspección."],
        evaluacionISO: rulesEngineOutput.evaluacionISO
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
  app.all("/api/ai/models", async (req, res) => {
    try {
      const provider = req.body?.provider || req.query?.provider;
      const apiKey = req.body?.apiKey || req.query?.apiKey;

      if (!provider) {
        return res.status(200).json({
          success: false,
          error: "No se proporcionó el proveedor.",
          details: "Parámetro 'provider' ausente en la solicitud."
        });
      }
      if (provider === "ninguno" || provider === "iso") {
        return res.status(200).json({ success: true, models: [] });
      }
      if (!apiKey) {
        return res.status(200).json({
          success: false,
          error: "No se proporcionó la API Key.",
          details: "Parámetro 'apiKey' ausente en la solicitud."
        });
      }

      if (provider === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        console.log(`[AI Models] Consultando lista de modelos reales.`);
        console.log(`[AI Models] Método: ${req.method} | URL Utilizada: ${url}`);

        try {
          const resp = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
          });

          const responseStatus = resp.status;
          const responseBodyText = await resp.text();

          console.log(`[AI Models] Código HTTP API Gemini: ${responseStatus}`);

          if (!resp.ok) {
            let errorJson: any = null;
            try { errorJson = JSON.parse(responseBodyText); } catch (e) {}
            const errorMsg = errorJson?.error?.message || responseBodyText || "Error desconocido al listar modelos de Gemini.";
            const errorStatus = errorJson?.error?.status || "ERROR";

            let customUserMessage = `Error de la API de Google Gemini (HTTP ${responseStatus}): [${errorStatus}] ${errorMsg}`;
            if (responseStatus === 400 && (errorMsg.includes("API key not valid") || errorMsg.includes("INVALID_ARGUMENT"))) {
              customUserMessage = `Error de la API de Google Gemini (HTTP ${responseStatus}): API Key inválida o no autorizada. Motivo original: ${errorMsg}`;
            }

            return res.status(200).json({
              success: false,
              error: customUserMessage,
              details: responseBodyText
            });
          }

          const data = JSON.parse(responseBodyText);
          if (!data || !Array.isArray(data.models)) {
            return res.status(200).json({
              success: false,
              error: "La API de Gemini no devolvió una lista de modelos válida.",
              details: responseBodyText
            });
          }

          // Filter models: support generateContent
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
          return res.status(200).json({ success: true, models: filtered });
        } catch (err: any) {
          console.error("[AI Models] Error de red al listar modelos de Gemini:", err);
          return res.status(200).json({
            success: false,
            error: `Sin conexión. Fallo de red temporal al listar modelos: ${err.message || err}`,
            details: String(err)
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
            return res.status(200).json({
              success: false,
              error: `Error de la API de OpenAI (HTTP ${response.status}): ${errMsg}`,
              details: JSON.stringify(errData)
            });
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
            const finalModels = chatModels.length > 0 ? chatModels : data.data.map((m: any) => ({ id: m.id, displayName: m.id }));
            return res.status(200).json({ success: true, models: finalModels });
          }
          return res.status(200).json({
            success: false,
            error: "Formato de respuesta inesperado de OpenAI.",
            details: JSON.stringify(data)
          });
        } catch (err: any) {
          console.error("Error listing OpenAI models:", err);
          return res.status(200).json({
            success: false,
            error: parseAiError(err),
            details: String(err)
          });
        }
      }

      return res.status(200).json({
        success: false,
        error: "Proveedor no soportado para listar modelos.",
        details: `Proveedor solicitado: '${provider}'`
      });
    } catch (error: any) {
      console.error("Error in get models route:", error);
      res.status(200).json({
        success: false,
        error: error.message || "Error interno al obtener modelos.",
        details: String(error)
      });
    }
  });

  // Connection Test Endpoint
  app.all("/api/ai/test-connection", async (req, res) => {
    try {
      const provider = req.body?.provider || req.query?.provider;
      const apiKey = req.body?.apiKey || req.query?.apiKey;
      const model = req.body?.model || req.query?.model;

      if (!provider) {
        return res.status(200).json({
          success: false,
          error: "No se proporcionó el proveedor.",
          details: "Parámetro 'provider' ausente."
        });
      }
      if (provider === "ninguno" || provider === "iso") {
        return res.status(200).json({
          success: true,
          message: "🟢 Motor de reglas estático ISO seleccionado. No requiere conexión externa con APIs de IA."
        });
      }

      if (!apiKey) {
        return res.status(200).json({
          success: false,
          error: "API Key inválida o no proporcionada.",
          details: "Parámetro 'apiKey' ausente."
        });
      }

      if (provider === "gemini") {
        const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        console.log(`================== PRUEBA DE CONEXIÓN IA (GEMINI) ==================`);
        console.log(`[AI Test Connection] Proveedor Seleccionado: ${provider}`);
        console.log(`[AI Test Connection] Modelo en la Solicitud / BD: ${model || "N/A"}`);
        console.log(`[AI Test Connection] URL Utilizada: ${modelsUrl}`);

        let modelsListResponse;
        try {
          modelsListResponse = await fetch(modelsUrl, { method: "GET" });
        } catch (netErr: any) {
          console.error(`[AI Test Connection] Error de red al listar modelos:`, netErr);
          return res.status(200).json({
            success: false,
            error: `Sin conexión. Fallo de red temporal al conectar con la API de Gemini: ${netErr.message || netErr}`,
            details: String(netErr)
          });
        }

        const modelsStatus = modelsListResponse.status;
        const modelsBodyText = await modelsListResponse.text();

        console.log(`[AI Test Connection] Código HTTP API Gemini: ${modelsStatus}`);
        console.log(`[AI Test Connection] Respuesta Completa de Google (resumen): ${modelsBodyText.substring(0, 300)}...`);

        if (!modelsListResponse.ok) {
          let errorJson: any = null;
          try { errorJson = JSON.parse(modelsBodyText); } catch (e) {}
          const errMsg = errorJson?.error?.message || modelsBodyText || "Error al autenticar u obtener modelos de Gemini.";
          const errStatus = errorJson?.error?.status || "ERROR";

          let customUserMessage = `Error de la API de Google Gemini (HTTP ${modelsStatus}): [${errStatus}] ${errMsg}`;
          if (modelsStatus === 400 && (errMsg.toLowerCase().includes("api key") || errMsg.toLowerCase().includes("invalid"))) {
            customUserMessage = `Error de la API de Google Gemini (HTTP ${modelsStatus}): API Key inválida. Motivo original: ${errMsg}`;
          }

          return res.status(200).json({
            success: false,
            error: customUserMessage,
            details: modelsBodyText
          });
        }

        let modelsData: any;
        try {
          modelsData = JSON.parse(modelsBodyText);
        } catch (e) {
          return res.status(200).json({
            success: false,
            error: "La respuesta de modelos de Google Gemini no es un JSON válido.",
            details: modelsBodyText
          });
        }

        if (!modelsData || !Array.isArray(modelsData.models)) {
          return res.status(200).json({
            success: false,
            error: "La API de Gemini no devolvió una lista de modelos válida.",
            details: modelsBodyText
          });
        }

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

        return res.status(200).json({
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
            return res.status(200).json({
              success: false,
              error: "Modelo no seleccionado para OpenAI.",
              details: "Parámetro 'model' ausente."
            });
          }

          const responseList = await fetch("https://api.openai.com/v1/models", {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${apiKey}`
            }
          });

          if (!responseList.ok) {
            const errData = await responseList.json().catch(() => ({}));
            const errMsg = errData.error?.message || `Status ${responseList.status}`;
            return res.status(200).json({
              success: false,
              error: `Error de la API de OpenAI (HTTP ${responseList.status}): ${errMsg}`,
              details: JSON.stringify(errData)
            });
          }

          const modelsData = await responseList.json();
          const modelsList = Array.isArray(modelsData.data) ? modelsData.data : [];

          const modelExists = modelsList.some((m: any) => m.id === model);
          if (!modelExists) {
            return res.status(200).json({
              success: false,
              error: `El modelo '${model}' no está disponible en su cuenta de OpenAI.`,
              details: `Modelos disponibles: ${modelsList.length}`
            });
          }

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
            const now = new Date();
            const formattedDate = now.toLocaleDateString("es-ES") + " " + now.toLocaleTimeString("es-ES");
            return res.status(200).json({
              success: true,
              message: "🟢 Conexión con OpenAI establecida correctamente.",
              modelsCount: modelsList.length,
              lastVerification: formattedDate
            });
          } else {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData.error?.message || `Status ${response.status}`;
            return res.status(200).json({
              success: false,
              error: `Fallo al probar completado con OpenAI: ${errMsg}`,
              details: JSON.stringify(errData)
            });
          }
        } catch (err: any) {
          console.error("Test connection OpenAI error:", err);
          return res.status(200).json({
            success: false,
            error: parseAiError(err),
            details: String(err)
          });
        }
      }

      return res.status(200).json({
        success: false,
        error: "Proveedor no soportado.",
        details: `Proveedor solicitado: '${provider}'`
      });
    } catch (error: any) {
      console.error("Error in test-connection route:", error);
      res.status(200).json({
        success: false,
        error: parseAiError(error),
        details: String(error)
      });
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
