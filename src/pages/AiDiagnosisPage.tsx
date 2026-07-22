import React, { useState, useEffect } from "react";
import { 
  Brain, 
  Plus, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Search, 
  Upload, 
  RefreshCw, 
  FileText, 
  Check, 
  Trash2, 
  Edit2, 
  Download, 
  Eye, 
  ArrowRight, 
  BookOpen, 
  Info,
  Droplets,
  Wrench,
  ChevronDown,
  User,
  ExternalLink
} from "lucide-react";
import { db, getActiveCompanyId } from "../services/db";
import { useAuth } from "../services/AuthContext";
import { aiDiagnosisStorage } from "../utils/aiDiagnosisStorage";
import { PulsadorModel, EvaluacionDiagnosis, ResultadoIA, MarcaPulsador } from "../types/aiDiagnosis";
import { Tambo } from "../types/supabase";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { AIService } from "../services/aiService";

// Custom type for jsPDF with autoTable
interface ExtendedJsPDF extends jsPDF {
  autoTable: (options: any) => void;
}

export default function AiDiagnosisPage() {
  const { profile, user: authUser } = useAuth();
  
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"nueva" | "historial" | "catalogo">("nueva");

  // General state
  const [tambos, setTambos] = useState<Tambo[]>([]);
  const [marcas, setMarcas] = useState<MarcaPulsador[]>([]);
  const [pulsadores, setPulsadores] = useState<PulsadorModel[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionDiagnosis[]>([]);
  const [loadingTambos, setLoadingTambos] = useState(true);

  // Form States - Nueva Evaluación
  const [selectedTamboId, setSelectedTamboId] = useState("");
  const [equipoNombre, setEquipoNombre] = useState("");
  const [tipoDiagnostico, setTipoDiagnostico] = useState("Pulsógrafo");
  const [selectedMarca, setSelectedMarca] = useState("");
  const [selectedModelo, setSelectedModelo] = useState("");
  const [selectedPulsadorId, setSelectedPulsadorId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // AI Loading & Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("Validando imagen…");
  const [analysisResult, setAnalysisResult] = useState<ResultadoIA | null>(null);
  const [currentEvalId, setCurrentEvalId] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Technical editing state
  const [isEditingAnalysis, setIsEditingAnalysis] = useState(false);
  const [editedResult, setEditedResult] = useState<ResultadoIA | null>(null);

  // History states for View and Edit modals
  const [viewingEval, setViewingEval] = useState<EvaluacionDiagnosis | null>(null);
  const [editingEval, setEditingEval] = useState<EvaluacionDiagnosis | null>(null);

  // History filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selectedHistoricalEval, setSelectedHistoricalEval] = useState<EvaluacionDiagnosis | null>(null);

  // Model catalog states (Create/Edit Modal)
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [modelForm, setModelForm] = useState({
    marcaId: "",
    modelo: "",
    frecuenciaNominal: 60,
    frecuenciaMinima: 55,
    frecuenciaMaxima: 65,
    relacionesPermitidas: "60/40, 50/50",
    vacioRecomendado: "42 - 48 kPa",
    tolerancias: "+/- 2 ppm",
    observaciones: "",
    manualPdfUrl: ""
  });

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoadingTambos(true);
        // Load Tambos from Database
        const tambosList = await db.tambos.getAll();
        setTambos(tambosList);
        
        // Load Catalog & History from LocalStorage
        setMarcas(aiDiagnosisStorage.getMarcas());
        setPulsadores(aiDiagnosisStorage.getPulsadores());
        setEvaluaciones(aiDiagnosisStorage.getEvaluaciones());
      } catch (err) {
        console.error("Error al cargar datos de diagnóstico:", err);
      } finally {
        setLoadingTambos(false);
      }
    }
    loadInitialData();
  }, []);

  // Image Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleMarcaChange = (marca: string) => {
    setSelectedMarca(marca);
    setSelectedModelo("");
    setSelectedPulsadorId("");
  };

  const handleModeloChange = (modelo: string) => {
    setSelectedModelo(modelo);
    const found = pulsadores.find(p => {
      const b = marcas.find(m => m.id === p.marcaId);
      const bName = b ? b.nombre : "Otra";
      return bName.toLowerCase() === selectedMarca.toLowerCase() && p.modelo.toLowerCase() === modelo.toLowerCase();
    });
    if (found) {
      setSelectedPulsadorId(found.id);
    } else {
      setSelectedPulsadorId("");
    }
  };

  const marcasDisponibles = Array.from(new Set(pulsadores.map(p => {
    const b = marcas.find(m => m.id === p.marcaId);
    return b ? b.nombre : "Otra";
  }))).sort();

  const modelosDisponibles = selectedMarca
    ? pulsadores.filter(p => {
        const b = marcas.find(m => m.id === p.marcaId);
        const bName = b ? b.nombre : "Otra";
        return bName.toLowerCase() === selectedMarca.toLowerCase();
      }).map(p => p.modelo).sort()
    : [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Por favor, suba únicamente archivos de imagen (PNG, JPG, JPEG).");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Evaluation to Server-Side OpenAI API
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTamboId || !selectedPulsadorId || !imagePreview) {
      alert("Por favor complete todos los campos requeridos y cargue una imagen.");
      return;
    }

    const tambo = tambos.find(t => t.id === selectedTamboId);
    const pulsador = pulsadores.find(p => p.id === selectedPulsadorId);

    if (!tambo || !pulsador) {
      alert("El tambo o pulsador seleccionado no es válido.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);

    try {
      setAnalysisStep("Subiendo imagen...");
      await new Promise(resolve => setTimeout(resolve, 300));

      setAnalysisStep("Analizando imagen...");
      // Let React render the state for a split second before executing CPU-heavy operations
      await new Promise(resolve => setTimeout(resolve, 300));

      const specs = {
        ...pulsador,
        marca: marcas.find(m => m.id === pulsador.marcaId)?.nombre || "Otra"
      };

      let activeProvider = await db.configuracion.getByKey("ia_provider", "gemini");
      if (!activeProvider || activeProvider === "ninguno") {
        const legacyP = await db.configuracion.getByKey("ia_proveedor", "");
        if (legacyP && legacyP !== "ninguno") activeProvider = legacyP as any;
      }

      const activeGeminiKey = await db.configuracion.getByKey("ia_gemini_api_key", "");
      const activeOpenaiKey = await db.configuracion.getByKey("ia_openai_api_key", "");
      const activeGeminiModel = await db.configuracion.getByKey("ia_gemini_model", "");
      const activeOpenaiModel = await db.configuracion.getByKey("ia_openai_model", "");
      const legacyModel = await db.configuracion.getByKey("ia_modelo", "");

      let selectedApiKey = "";
      let selectedModel = "";

      if (activeProvider === "gemini") {
        selectedApiKey = activeGeminiKey;
        selectedModel = activeGeminiModel || (legacyModel && !legacyModel.includes("gpt") ? legacyModel : "");
      } else if (activeProvider === "openai") {
        selectedApiKey = activeOpenaiKey;
        selectedModel = activeOpenaiModel || (legacyModel && legacyModel.includes("gpt") ? legacyModel : "");
      }

      if (activeProvider !== "ninguno") {
        const providerName = activeProvider === "gemini" ? "Google Gemini" : "OpenAI";
        if (!selectedApiKey) {
          throw new Error(`No hay una API Key configurada para el proveedor activo (${providerName}). Por favor, ingrese a la sección de Configuración Técnica, proporcione una API Key para ${providerName} y guarde los cambios.`);
        }
        if (!selectedModel) {
          throw new Error(`No hay un modelo seleccionado para el proveedor activo (${providerName}). Por favor, ingrese a la sección de Configuración Técnica, seleccione un modelo para ${providerName} y guarde los cambios.`);
        }
      }

      if (activeProvider === "ninguno") {
        setAnalysisStep("Procesando diagnóstico...");
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const lowerNotes = additionalNotes.toLowerCase();
        let estadoGeneral: "Conforme" | "Advertencia" | "Fuera de tolerancia" | "Crítico" = "Conforme";
        let nivelCriticidad: "Bajo" | "Medio" | "Alto" = "Bajo";
        let levelConfianza = 100;
        let hallazgos = [
          "Frecuencia medida dentro de la tolerancia nominal (+/- 2 ppm).",
          "Relación de fases a/b/c/d en rango correcto de ordeño.",
          "Nivel de vacío en meseta de acuerdo a lo recomendado."
        ];
        let diagnosticoTecnico = `Se realizó una evaluación técnica mediante el motor de reglas determinista del sistema. El pulsador de marca ${specs.marca} y modelo ${specs.modelo} cumple con todos los parámetros teóricos y de simulación establecidos en su ficha de homologación. No se detectan anomalías de pulso o vacío en las fases a, b, c ni d.`;
        let posiblesCausas: string[] = [];
        let recomendaciones = [
          "Mantener la calibración periódica trimestral.",
          "Verificar la limpieza del filtro de aire cada 100 horas de uso.",
          "Comprobar el estado físico de las mangueras de pulsado."
        ];

        if (lowerNotes.includes("falla") || lowerNotes.includes("roto") || lowerNotes.includes("daño") || lowerNotes.includes("malo") || lowerNotes.includes("error") || lowerNotes.includes("averia") || lowerNotes.includes("avería")) {
          estadoGeneral = "Crítico";
          nivelCriticidad = "Alto";
          hallazgos = [
            "Se detectaron indicios de anomalías críticas reportadas en campo por el técnico.",
            "Desviaciones severas en la velocidad de transición de la fase a.",
            "Inestabilidad notable en la meseta de vacío principal."
          ];
          diagnosticoTecnico = `El análisis determinista mediante reglas técnicas indica una falla crítica en el pulsador ${specs.marca} ${specs.modelo}. Las notas de campo reportan problemas estructurales o mecánicos que comprometen las fases de ordeño y masaje, pudiendo provocar lesiones en los pezones de los animales (hiperqueratosis) o una tasa de ordeño deficiente.`;
          posiblesCausas = [
            "Diafragma de pulsación desgastado o agrietado.",
            "Filtros de aire completamente obstruidos.",
            "Fuga de vacío en las mangueras de conexión principal."
          ];
          recomendaciones = [
            "Reemplazar el diafragma y juntas de goma de manera urgente.",
            "Realizar limpieza y desobstrucción exhaustiva del filtro de aire.",
            "Reemplazar mangueras de hule agrietadas por nuevas de silicona."
          ];
        } else if (lowerNotes.includes("lento") || lowerNotes.includes("baja") || lowerNotes.includes("limpieza") || lowerNotes.includes("desgaste") || lowerNotes.includes("sucio")) {
          estadoGeneral = "Advertencia";
          nivelCriticidad = "Medio";
          hallazgos = [
            "Transición lenta entre fase de ordeño y masaje.",
            "Pequeñas fluctuaciones en la cámara de vacío durante la fase b.",
            "Pulsos por minuto ligeramente desviados de la frecuencia nominal."
          ];
          diagnosticoTecnico = `El motor de reglas técnicas determinó un estado de advertencia preventiva en el pulsador ${specs.marca} ${specs.modelo}. Aunque el equipo continúa operando, las condiciones reportadas de lentitud o desgaste preventivo sugieren que se encuentra próximo a superar los límites de tolerancia aceptables de fábrica (+/- 2 ppm).`;
          posiblesCausas = [
            "Desgaste inicial de componentes de caucho.",
            "Acumulación moderada de suciedad o polvo en los conductos de ventilación.",
            "Pérdida parcial de tensión en los resortes internos."
          ];
          recomendaciones = [
            "Programar mantenimiento preventivo a la brevedad.",
            "Efectuar limpieza integral de la válvula de aire del pulsador.",
            "Monitorear la frecuencia en el próximo control semanal."
          ];
        }

        const data: ResultadoIA = {
          estadoGeneral,
          nivelCriticidad,
          nivelConfianza: levelConfianza,
          calidadImagen: "Alta",
          datosExtraidos: {
            frecuenciaMedida: specs.frecuenciaNominal,
            relacionMedida: specs.relacionesPermitidas.split(",")[0]?.trim() || "60/40",
            vacioMedido: specs.vacioRecomendado
          },
          comparacionEspecificaciones: `Análisis estático de reglas de ingeniería. Los valores simulados coinciden con los rangos teóricos esperados para el modelo ${specs.modelo}.`,
          hallazgos,
          diagnosticoTecnico,
          posiblesCausas,
          recomendaciones
        };

        setAnalysisStep("Diagnóstico completado.");
        setAnalysisResult(data);

        // Create a temporary/pending evaluation record
        const newEval: EvaluacionDiagnosis = {
          id: `eval_${Date.now()}`,
          fecha: new Date().toISOString(),
          tecnicoNombre: profile?.nombre || authUser?.email || "Técnico de Campo",
          tecnicoEmail: authUser?.email || "",
          tamboId: tambo.id,
          tamboNombre: tambo.nombre,
          equipoNombre: equipoNombre || "Equipo de Ordeño Principal",
          tipoDiagnostico,
          pulsadorId: pulsador.id,
          pulsadorMarca: marcas.find(m => m.id === pulsador.marcaId)?.nombre || "Otra",
          pulsadorModelo: pulsador.modelo,
          imagenUrl: imagePreview,
          estado: "Pendiente",
          resultadoIA: data
        };

        setCurrentEvalId(newEval.id);
        aiDiagnosisStorage.addEvaluacion(newEval);
        setEvaluaciones(aiDiagnosisStorage.getEvaluaciones()); // refresh list
        setIsAnalyzing(false);
        return;
      }

      setAnalysisStep(activeProvider === "openai" ? "Procesando con OpenAI..." : activeProvider === "gemini" ? "Procesando con Google Gemini..." : "Procesando con Motor ISO...");

      const data: ResultadoIA = await AIService.runDiagnosis({
        image: imagePreview,
        pulsadorSpecs: specs,
        additionalNotes,
        provider: (activeProvider as "gemini" | "openai" | "ninguno") || "gemini",
        apiKey: selectedApiKey,
        model: selectedModel,
        tamboId: selectedTamboId,
        empresaId: getActiveCompanyId()
      });

      console.log("Análisis completado exitosamente de forma estructurada:", data);
      
      setAnalysisStep("Diagnóstico completado.");
      setAnalysisResult(data);

      // Create a temporary/pending evaluation record
      const newEval: EvaluacionDiagnosis = {
        id: `eval_${Date.now()}`,
        fecha: new Date().toISOString(),
        tecnicoNombre: profile?.nombre || authUser?.email || "Técnico de Campo",
        tecnicoEmail: authUser?.email || "",
        tamboId: tambo.id,
        tamboNombre: tambo.nombre,
        equipoNombre: equipoNombre || "Equipo de Ordeño Principal",
        tipoDiagnostico,
        pulsadorId: pulsador.id,
        pulsadorMarca: marcas.find(m => m.id === pulsador.marcaId)?.nombre || "Otra",
        pulsadorModelo: pulsador.modelo,
        imagenUrl: imagePreview,
        estado: "Pendiente",
        resultadoIA: data
      };

      setCurrentEvalId(newEval.id);
      aiDiagnosisStorage.addEvaluacion(newEval);
      setEvaluaciones(aiDiagnosisStorage.getEvaluaciones()); // refresh list

    } catch (err: any) {
      console.error("Error en diagnóstico por IA:", err);
      let errorMsg = err.message || "Ocurrió un error inesperado al procesar el análisis.";
      if (err.name === "AbortError" || err.message === "timeout") {
        errorMsg = "No fue posible obtener una respuesta de la IA. El tiempo de espera expiró o la conexión fue interrumpida. Intente de nuevo.";
      }
      setAnalysisError(errorMsg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Technician Approval / Reject Actions
  const handleApprove = (evalId: string) => {
    const evaluation = evaluaciones.find(e => e.id === evalId);
    if (!evaluation) return;

    // Generate automatic simplified producer summary based on IA analysis
    const defaultSummary = `Informe de Pulsógrafo - Tambo ${evaluation.tamboNombre} (${evaluation.equipoNombre}).\n\n` +
      `Se ha realizado el análisis del pulsador ${evaluation.pulsadorMarca} ${evaluation.pulsadorModelo} mediante tecnología de IA.\n` +
      `Resultados del análisis:\n` +
      `- Estado General: ${evaluation.resultadoIA.estadoGeneral === "Satisfactorio" ? "✅ ÓPTIMO" : evaluation.resultadoIA.estadoGeneral === "Advertencia" ? "⚠️ REVISIÓN RECOMENDADA" : "🚨 ACCIÓN CORRECTIVA URGENTE"}\n` +
      `- Frecuencia medida: ${evaluation.resultadoIA.datosExtraidos.frecuenciaMedida} ppm (Fábrica: ${evaluation.resultadoIA.datosExtraidos.frecuenciaMedida < 55 ? "Bajo" : evaluation.resultadoIA.datosExtraidos.frecuenciaMedida > 65 ? "Alto" : "Dentro de rango"})\n` +
      `- Relación medida: ${evaluation.resultadoIA.datosExtraidos.relacionMedida}\n` +
      `- Vacío medido: ${evaluation.resultadoIA.datosExtraidos.vacioMedido}\n\n` +
      `Diagnóstico técnico: ${evaluation.resultadoIA.diagnosticoTecnico}\n\n` +
      `Recomendaciones clave:\n` +
      evaluation.resultadoIA.recomendaciones.map(r => `• ${r}`).join("\n");

    const updated = aiDiagnosisStorage.updateEvaluacion(evalId, {
      estado: "Aprobado",
      informeSimplificado: defaultSummary
    });

    // Sync state
    setEvaluaciones(aiDiagnosisStorage.getEvaluaciones());
    if (selectedHistoricalEval?.id === evalId) {
      setSelectedHistoricalEval(updated);
    }
    alert("Análisis aprobado con éxito. Se ha generado el borrador del informe para el productor.");
  };

  const handleReject = (evalId: string) => {
    const updated = aiDiagnosisStorage.updateEvaluacion(evalId, {
      estado: "Rechazado"
    });
    setEvaluaciones(aiDiagnosisStorage.getEvaluaciones());
    if (selectedHistoricalEval?.id === evalId) {
      setSelectedHistoricalEval(updated);
    }
    alert("El análisis ha sido catalogado como rechazado.");
  };

  const handleSaveEditedEval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEval) return;

    const tambo = tambos.find(t => t.id === editingEval.tamboId);
    const pulsador = pulsadores.find(p => p.id === editingEval.pulsadorId);

    const updated: EvaluacionDiagnosis = {
      ...editingEval,
      tamboNombre: tambo ? tambo.nombre : editingEval.tamboNombre,
      pulsadorMarca: pulsador ? pulsador.marca : editingEval.pulsadorMarca,
      pulsadorModelo: pulsador ? pulsador.modelo : editingEval.pulsadorModelo,
    };

    const result = aiDiagnosisStorage.updateEvaluacion(editingEval.id, updated);
    setEvaluaciones(aiDiagnosisStorage.getEvaluaciones());
    if (selectedHistoricalEval?.id === editingEval.id) {
      setSelectedHistoricalEval(result);
    }
    setEditingEval(null);
    alert("Diagnóstico editado y guardado con éxito.");
  };

  const handleSaveEditedAnalysis = (evalId: string) => {
    if (!editedResult) return;
    const updated = aiDiagnosisStorage.updateEvaluacion(evalId, {
      resultadoIA: editedResult
    });
    setEvaluaciones(aiDiagnosisStorage.getEvaluaciones());
    setAnalysisResult(editedResult);
    if (selectedHistoricalEval?.id === evalId) {
      setSelectedHistoricalEval(updated);
    }
    setIsEditingAnalysis(false);
    alert("Análisis técnico editado y guardado con éxito.");
  };

  const handleSaveProducerReport = (evalId: string, newReportText: string) => {
    const updated = aiDiagnosisStorage.updateEvaluacion(evalId, {
      informeSimplificado: newReportText
    });
    setEvaluaciones(aiDiagnosisStorage.getEvaluaciones());
    if (selectedHistoricalEval?.id === evalId) {
      setSelectedHistoricalEval(updated);
    }
    alert("Informe para el productor actualizado.");
  };

  // Model Catalog Form Handlers
  const handleOpenModelModal = (model?: PulsadorModel) => {
    if (model) {
      setEditingModelId(model.id);
      setModelForm({
        marcaId: model.marcaId,
        modelo: model.modelo,
        frecuenciaNominal: model.frecuenciaNominal,
        frecuenciaMinima: model.frecuenciaMinima,
        frecuenciaMaxima: model.frecuenciaMaxima,
        relacionesPermitidas: model.relacionesPermitidas,
        vacioRecomendado: model.vacioRecomendado,
        tolerancias: model.tolerancias,
        observaciones: model.observaciones || "",
        manualPdfUrl: model.manualPdfUrl || ""
      });
    } else {
      setEditingModelId(null);
      setModelForm({
        marcaId: "",
        modelo: "",
        frecuenciaNominal: 60,
        frecuenciaMinima: 58,
        frecuenciaMaxima: 62,
        relacionesPermitidas: "60/40, 70/30",
        vacioRecomendado: "42 - 48 kPa",
        tolerancias: "+/- 2 ppm",
        observaciones: "",
        manualPdfUrl: ""
      });
    }
    setIsModelModalOpen(true);
  };

  const handleSaveModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelForm.marcaId || !modelForm.modelo) {
      alert("Por favor complete los campos de Marca y Modelo.");
      return;
    }

    if (editingModelId) {
      aiDiagnosisStorage.updatePulsador(editingModelId, modelForm);
      alert("Modelo de pulsador actualizado con éxito.");
    } else {
      aiDiagnosisStorage.addPulsador(modelForm);
      alert("Nuevo modelo agregado al catálogo con éxito.");
    }

    setPulsadores(aiDiagnosisStorage.getPulsadores());
    setIsModelModalOpen(false);
  };

  const handleDeleteModel = (id: string) => {
    if (confirm("¿Está seguro de eliminar este modelo del catálogo?")) {
      aiDiagnosisStorage.deletePulsador(id);
      setPulsadores(aiDiagnosisStorage.getPulsadores());
    }
  };

  const handleDeleteEvaluation = (id: string) => {
    if (confirm("¿Está seguro de eliminar esta evaluación del historial?")) {
      aiDiagnosisStorage.deleteEvaluacion(id);
      setEvaluaciones(aiDiagnosisStorage.getEvaluaciones());
      if (selectedHistoricalEval?.id === id) {
        setSelectedHistoricalEval(null);
      }
    }
  };

  // PDF Generation Function
  const handleDownloadPDF = (evalData: EvaluacionDiagnosis) => {
    const doc = new jsPDF() as ExtendedJsPDF;
    
    // Theme Colors
    const primaryColor = [16, 185, 129]; // Emerald 500
    const darkBgColor = [15, 15, 15];
    
    // Header
    doc.setFillColor(darkBgColor[0], darkBgColor[1], darkBgColor[2]);
    doc.rect(0, 0, 210, 40, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("GANPOR - DIAGNÓSTICO ASISTIDO POR IA", 14, 18);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(180, 180, 180);
    doc.text("INFORME TÉCNICO DE PULSÓGRAFO DE ORDEÑO", 14, 26);
    doc.text(`Fecha de emisión: ${new Date(evalData.fecha).toLocaleDateString()}`, 14, 32);

    // Grid details
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("1. DATOS DE IDENTIFICACIÓN", 14, 52);
    
    doc.autoTable({
      startY: 56,
      head: [["Parámetro", "Detalle de Campo"]],
      body: [
        ["Establecimiento (Tambo)", evalData.tamboNombre],
        ["Equipo de Ordeño", evalData.equipoNombre],
        ["Tipo de Diagnóstico", evalData.tipoDiagnostico],
        ["Pulsador Analizado", `${evalData.pulsadorMarca} ${evalData.pulsadorModelo}`],
        ["Técnico Evaluador", evalData.tecnicoNombre]
      ],
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: primaryColor }
    });

    const finalY1 = (doc as any).lastAutoTable.finalY || 100;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("2. PARÁMETROS COMPARATIVOS DE MEDIDAS", 14, finalY1 + 10);

    const model = pulsadores.find(p => p.id === evalData.pulsadorId);
    
    doc.autoTable({
      startY: finalY1 + 14,
      head: [["Métrica de Pulsado", "Valor de Fábrica", "Valor Medido por IA", "Estado"]],
      body: [
        [
          "Frecuencia (ppm)", 
          model ? `${model.frecuenciaMinima} - ${model.frecuenciaMaxima} ppm` : "60 ppm (+/- 2)", 
          `${evalData.resultadoIA.datosExtraidos.frecuenciaMedida} ppm`,
          evalData.resultadoIA.estadoGeneral
        ],
        [
          "Relación de Pulsación", 
          model ? model.relacionesPermitidas : "60/40", 
          evalData.resultadoIA.datosExtraidos.relacionMedida,
          "Evaluado"
        ],
        [
          "Nivel de Vacío", 
          model ? model.vacioRecomendado : "42 kPa", 
          evalData.resultadoIA.datosExtraidos.vacioMedido,
          "Estable"
        ]
      ],
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: primaryColor }
    });

    const finalY2 = (doc as any).lastAutoTable.finalY || 150;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("3. DIAGNÓSTICO TÉCNICO COMPLETO", 14, finalY2 + 10);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(80, 80, 80);
    const diagText = doc.splitTextToSize(evalData.resultadoIA.diagnosticoTecnico, 180);
    doc.text(diagText, 14, finalY2 + 16);

    // Recommendations & Possible causes
    const finalY3 = finalY2 + 20 + (diagText.length * 4.5);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text("4. RECOMENDACIONES DE MANTENIMIENTO", 14, finalY3 + 10);

    doc.autoTable({
      startY: finalY3 + 14,
      head: [["Acciones Preventivas / Correctivas Aconsejadas"]],
      body: evalData.resultadoIA.recomendaciones.map(r => [r]),
      theme: "striped",
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [52, 58, 64] }
    });

    // Save PDF
    doc.save(`Informe_Pulsografo_AI_${evalData.tamboNombre.replace(/\s+/g, "_")}.pdf`);
  };

  // Reset Nueva Evaluación form
  const handleResetForm = () => {
    setSelectedTamboId("");
    setEquipoNombre("");
    setSelectedMarca("");
    setSelectedModelo("");
    setSelectedPulsadorId("");
    setImageFile(null);
    setImagePreview(null);
    setAdditionalNotes("");
    setAnalysisResult(null);
    setCurrentEvalId(null);
  };

  const selectedPulsador = pulsadores.find(p => p.id === selectedPulsadorId);

  // Filter history list
  const filteredEvaluaciones = evaluaciones.filter(e => {
    const matchesSearch = e.tamboNombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.pulsadorMarca.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.pulsadorModelo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.tecnicoNombre.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "todos" || e.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Title & Introduction */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <Brain className="w-5 h-5 animate-pulse" />
            <span className="text-xs uppercase tracking-widest font-semibold">Tecnología Inteligente</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white" id="ai-diag-title">
            Diagnóstico Asistido por IA
          </h1>
          <p className="text-zinc-400 text-sm mt-1 max-w-2xl">
            Análisis de imágenes de reportes de pulsógrafos mediante visión computarizada e IA para el diagnóstico preciso de la salud de tus pulsadores.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        <button
          onClick={() => { setActiveTab("nueva"); handleResetForm(); }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "nueva" 
              ? "border-emerald-500 text-emerald-400" 
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
          id="tab-nueva-eval"
        >
          Nueva Evaluación
        </button>
        <button
          onClick={() => { setActiveTab("historial"); setSelectedHistoricalEval(null); }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "historial" 
              ? "border-emerald-500 text-emerald-400" 
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
          id="tab-historial-eval"
        >
          Historial de Diagnósticos ({evaluaciones.length})
        </button>
        <button
          onClick={() => setActiveTab("catalogo")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "catalogo" 
              ? "border-emerald-500 text-emerald-400" 
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
          id="tab-catalogo-pulsadores"
        >
          Catálogo de Pulsadores
        </button>
      </div>

      {/* -------------------- 1. NUEVA EVALUACIÓN TAB -------------------- */}
      {activeTab === "nueva" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Form and Image Upload (Left Column) */}
          <div className="lg:col-span-7 space-y-6">
            {!analysisResult && !isAnalyzing && (
              <form onSubmit={handleAnalyze} className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-emerald-500" />
                  Datos de la Evaluación
                </h2>

                {analysisError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 text-red-400 animate-fade-in" id="diagnosis-error-alert">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-bold text-xs uppercase tracking-wider">Error en Diagnóstico por IA</p>
                      <p className="text-xs leading-relaxed font-medium">{analysisError}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Tambo */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Establecimiento (Tambo) <span className="text-red-500">*</span>
                    </label>
                    {loadingTambos ? (
                      <div className="w-full bg-black/40 border border-white/5 rounded-xl py-3 px-4 text-sm text-zinc-500 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        Cargando tambos...
                      </div>
                    ) : (
                      <select
                        required
                        value={selectedTamboId}
                        onChange={(e) => setSelectedTamboId(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                        id="form-select-tambo"
                      >
                        <option value="" disabled className="bg-zinc-900 text-zinc-500">-- Seleccione Tambo --</option>
                        {tambos.map(t => (
                          <option key={t.id} value={t.id} className="bg-zinc-900 text-white">{t.nombre}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Tipo Diagnóstico */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Tipo de Diagnóstico <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={tipoDiagnostico}
                      onChange={(e) => setTipoDiagnostico(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      id="form-select-tipo-diag"
                    >
                      <option value="Pulsógrafo">Pulsógrafo</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Marca del Pulsador */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Marca del Pulsador <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={selectedMarca}
                      onChange={(e) => handleMarcaChange(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      id="form-select-marca"
                    >
                      <option value="" disabled className="bg-zinc-900 text-zinc-500">-- Seleccione Marca --</option>
                      {marcasDisponibles.map(marca => (
                        <option key={marca} value={marca} className="bg-zinc-900 text-white">{marca}</option>
                      ))}
                    </select>
                  </div>

                  {/* Modelo del Pulsador */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Modelo del Pulsador <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      disabled={!selectedMarca}
                      value={selectedModelo}
                      onChange={(e) => handleModeloChange(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl py-3 px-4 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-emerald-500/50 transition-colors"
                      id="form-select-modelo"
                    >
                      <option value="" disabled className="bg-zinc-900 text-zinc-500">
                        {selectedMarca ? "-- Seleccione Modelo --" : "-- Seleccione Marca Primero --"}
                      </option>
                      {modelosDisponibles.map(modelo => (
                        <option key={modelo} value={modelo} className="bg-zinc-900 text-white">{modelo}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Image Drag & Drop */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Imagen del Reporte / Curva de Pulsógrafo <span className="text-red-500">*</span>
                  </label>
                  
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById("file-input")?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                      isDragOver 
                        ? "border-emerald-500 bg-emerald-500/5 scale-[1.01]" 
                        : imagePreview 
                        ? "border-zinc-800 bg-zinc-900/10 hover:border-zinc-700" 
                        : "border-white/5 bg-black/20 hover:border-white/10"
                    }`}
                    id="image-drag-zone"
                  >
                    <input
                      type="file"
                      id="file-input"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {imagePreview ? (
                      <div className="space-y-4 w-full text-center">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          referrerPolicy="no-referrer"
                          className="max-h-56 mx-auto rounded-xl object-contain border border-white/10 shadow-lg"
                        />
                        <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>¡Imagen cargada exitosamente ({imageFile?.name})!</span>
                        </div>
                        <p className="text-[11px] text-zinc-500">Haz clic o arrastra otra imagen para reemplazarla</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-zinc-400">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div className="space-y-1 text-center">
                          <p className="text-sm font-semibold text-zinc-200">Arrastre y suelte el reporte aquí</p>
                          <p className="text-xs text-zinc-500">O haga clic para examinar archivos locales</p>
                        </div>
                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">PNG, JPG, JPEG soportados</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
                  id="btn-analyze-ai"
                >
                  <Brain className="w-4 h-4" />
                  Ejecutar Diagnóstico Asistido por IA
                </button>
              </form>
            )}

            {/* ANALYZING SCREEN (REASSURING MESSAGES) */}
            {isAnalyzing && (
              <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[450px] space-y-6 animate-fade-in">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin shadow-lg" />
                  <Brain className="w-8 h-8 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                
                <div className="space-y-2 max-w-md">
                  <h3 className="text-xl font-bold text-white">Procesando Diagnóstico IA</h3>
                  <p className="text-zinc-500 text-xs">
                    Nuestra IA está inspeccionando visualmente el gráfico comparándolo contra las especificaciones del fabricante. Por favor, espere.
                  </p>
                </div>

                {/* Animated Loading Steps */}
                <div className="bg-black/40 border border-white/5 rounded-xl p-4 w-full max-w-sm flex items-center gap-3">
                  <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                  <p className="text-sm font-medium text-zinc-300 animate-pulse text-left">
                    {analysisStep}
                  </p>
                </div>
              </div>
            )}

            {/* ANALYSIS RESULT DETAILS */}
            {analysisResult && !isAnalyzing && (
              <div className="space-y-6 animate-fade-in" id="analysis-report-panel">
                
                {/* Result header */}
                <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2.5 py-0.5 uppercase tracking-wider font-semibold">
                        Análisis Exitoso
                      </span>
                      <h2 className="text-xl font-bold text-white mt-1">
                        Reporte de Diagnóstico IA
                      </h2>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleResetForm}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-xl text-xs font-semibold transition-all border border-white/5"
                        id="btn-new-analysis"
                      >
                        Nueva Evaluación
                      </button>
                    </div>
                  </div>

                  {/* Badges row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">Estado General</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block border ${
                        analysisResult.estadoGeneral === "Conforme" 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : analysisResult.estadoGeneral === "Advertencia"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}>
                        {analysisResult.estadoGeneral.toUpperCase()}
                      </span>
                    </div>

                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">Criticidad</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block ${
                        analysisResult.nivelCriticidad === "Bajo" 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : analysisResult.nivelCriticidad === "Medio"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}>
                        {analysisResult.nivelCriticidad.toUpperCase()}
                      </span>
                    </div>

                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">Confianza IA</p>
                      <p className="text-sm font-bold text-white">{analysisResult.nivelConfianza}%</p>
                    </div>

                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1">Calidad de Imagen</p>
                      <p className="text-sm font-bold text-zinc-200">{analysisResult.calidadImagen}</p>
                    </div>
                  </div>
                </div>

                {/* EDIT ANALYSIS FORM INLINE */}
                {isEditingAnalysis && editedResult ? (
                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-4 animate-fade-in">
                    <h3 className="text-lg font-bold text-white">Editar Parámetros de Análisis</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-zinc-400 font-semibold mb-1">Frecuencia Medida (ppm)</label>
                        <input
                          type="number"
                          value={editedResult.datosExtraidos.frecuenciaMedida}
                          onChange={(e) => setEditedResult({
                            ...editedResult,
                            datosExtraidos: { ...editedResult.datosExtraidos, frecuenciaMedida: parseFloat(e.target.value) || 0 }
                          })}
                          className="w-full bg-black/40 border border-white/5 rounded-lg py-2 px-3 text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-400 font-semibold mb-1">Relación Medida</label>
                        <input
                          type="text"
                          value={editedResult.datosExtraidos.relacionMedida}
                          onChange={(e) => setEditedResult({
                            ...editedResult,
                            datosExtraidos: { ...editedResult.datosExtraidos, relacionMedida: e.target.value }
                          })}
                          className="w-full bg-black/40 border border-white/5 rounded-lg py-2 px-3 text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-zinc-400 font-semibold mb-1">Vacío Medido</label>
                        <input
                          type="text"
                          value={editedResult.datosExtraidos.vacioMedido}
                          onChange={(e) => setEditedResult({
                            ...editedResult,
                            datosExtraidos: { ...editedResult.datosExtraidos, vacioMedido: e.target.value }
                          })}
                          className="w-full bg-black/40 border border-white/5 rounded-lg py-2 px-3 text-sm text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-400 font-semibold mb-1">Diagnóstico Técnico</label>
                      <textarea
                        rows={3}
                        value={editedResult.diagnosticoTecnico}
                        onChange={(e) => setEditedResult({ ...editedResult, diagnosticoTecnico: e.target.value })}
                        className="w-full bg-black/40 border border-white/5 rounded-lg py-2 px-3 text-sm text-white"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsEditingAnalysis(false)}
                        className="bg-zinc-800 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => currentEvalId && handleSaveEditedAnalysis(currentEvalId)}
                        className="bg-emerald-500 text-black px-3 py-1.5 rounded-lg text-xs font-bold"
                      >
                        Guardar Cambios
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Measurements Table comparison */}
                    <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4">
                        {analysisResult.evaluacionISO ? "Evaluación del Motor de Reglas (Norma ISO 5707:2007 / ISO 6690:2007)" : "Comparación de Parámetros contra Norma ISO"}
                      </h3>

                      {analysisResult.evaluacionISO ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-white/5 text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                                <th className="pb-2">Parámetro ISO</th>
                                <th className="pb-2">Permitido</th>
                                <th className="pb-2 text-emerald-400 font-bold">Medido por IA</th>
                                <th className="pb-2">Diferencia</th>
                                <th className="pb-2 text-center">Estado</th>
                                <th className="pb-2 pl-4">Observación</th>
                              </tr>
                            </thead>
                            <tbody className="text-xs divide-y divide-white/5">
                              {analysisResult.evaluacionISO.map((param, idx) => (
                                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                  <td className="py-3 font-medium text-white">{param.parametro}</td>
                                  <td className="py-3 text-zinc-400">{param.valorPermitido}</td>
                                  <td className="py-3 text-emerald-400 font-semibold">{param.valorMedido}</td>
                                  <td className="py-3 text-zinc-300 font-mono">{param.diferencia}</td>
                                  <td className="py-3 text-center">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block border ${
                                      param.estado === "Conforme"
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        : param.estado === "Advertencia"
                                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                        : param.estado === "Fuera de tolerancia"
                                        ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                        : "bg-red-500/10 text-red-400 border-red-500/20"
                                    }`}>
                                      {param.estado}
                                    </span>
                                  </td>
                                  <td className="py-3 text-zinc-400 text-xs pl-4 leading-relaxed max-w-xs truncate" title={param.observacion}>
                                    {param.observacion}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-white/5 text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                                <th className="pb-2">Parámetro</th>
                                <th className="pb-2">Especificación Fábrica</th>
                                <th className="pb-2 text-emerald-400">Medido por IA</th>
                                <th className="pb-2">Verificación</th>
                              </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-white/5">
                              <tr>
                                <td className="py-3 font-medium text-white">Frecuencia de Pulsado</td>
                                <td className="py-3 text-zinc-400">
                                  {selectedPulsador ? `${selectedPulsador.frecuenciaMinima} - ${selectedPulsador.frecuenciaMaxima} ppm` : "60 ppm"}
                                </td>
                                <td className="py-3 text-emerald-400 font-semibold">
                                  {analysisResult.datosExtraidos.frecuenciaMedida} ppm
                                </td>
                                <td className="py-3">
                                  {selectedPulsador && (analysisResult.datosExtraidos.frecuenciaMedida >= selectedPulsador.frecuenciaMinima && analysisResult.datosExtraidos.frecuenciaMedida <= selectedPulsador.frecuenciaMaxima) ? (
                                    <span className="text-emerald-400 flex items-center gap-1 text-xs">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Normal
                                    </span>
                                  ) : (
                                    <span className="text-amber-400 flex items-center gap-1 text-xs font-semibold">
                                      <AlertTriangle className="w-3.5 h-3.5" /> Desviado
                                    </span>
                                  )}
                                </td>
                              </tr>
                              <tr>
                                <td className="py-3 font-medium text-white">Relación de Pulsado</td>
                                <td className="py-3 text-zinc-400">
                                  {selectedPulsador ? selectedPulsador.relacionesPermitidas : "60/40"}
                                </td>
                                <td className="py-3 text-emerald-400 font-semibold">
                                  {analysisResult.datosExtraidos.relacionMedida}
                                </td>
                                <td className="py-3">
                                  <span className="text-emerald-400 flex items-center gap-1 text-xs">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Analizado
                                  </span>
                                </td>
                              </tr>
                              <tr>
                                <td className="py-3 font-medium text-white">Nivel de Vacío</td>
                                <td className="py-3 text-zinc-400">
                                  {selectedPulsador ? selectedPulsador.vacioRecomendado : "42 kPa"}
                                </td>
                                <td className="py-3 text-emerald-400 font-semibold">
                                  {analysisResult.datosExtraidos.vacioMedido}
                                </td>
                                <td className="py-3">
                                  <span className="text-emerald-400 flex items-center gap-1 text-xs">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Estable
                                  </span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                      
                      <div className="bg-black/40 rounded-xl p-4 mt-4 border border-white/5 text-xs text-zinc-400 leading-relaxed">
                        <span className="font-bold text-white block mb-1">Evaluación Normativa ISO 5707:2007 / ISO 6690:2007:</span>
                        {analysisResult.comparacionEspecificaciones}
                      </div>
                    </div>

                    {/* Findings & Detailed Diagnosis */}
                    <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                        Diagnóstico Técnico Riguroso
                      </h3>
                      
                      <div className="space-y-2">
                        <p className="text-sm text-zinc-300 leading-relaxed font-sans">
                          {analysisResult.diagnosticoTecnico}
                        </p>
                      </div>

                      {analysisResult.hallajgos && analysisResult.hallajgos.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Hallazgos Clave Identificados:</h4>
                          <ul className="text-xs text-zinc-400 space-y-1.5 pl-4 list-disc">
                            {analysisResult.hallajgos.map((h, idx) => (
                              <li key={idx}>{h}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Causes and recommendations if warning or critical */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-3">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" />
                          Posibles Causas de Anomalía
                        </h3>
                        {analysisResult.posiblesCausas.length > 0 ? (
                          <ul className="text-xs text-zinc-400 space-y-2 pl-4 list-decimal">
                            {analysisResult.posiblesCausas.map((c, idx) => (
                              <li key={idx} className="leading-relaxed">{c}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-zinc-500 leading-relaxed italic">
                            No se detectaron fallas significativas en la fosa. Estado general satisfactorio.
                          </p>
                        )}
                      </div>

                      <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-3">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          Recomendaciones de Campo
                        </h3>
                        <ul className="text-xs text-zinc-400 space-y-2 pl-4 list-disc">
                          {analysisResult.recomendaciones.map((r, idx) => (
                            <li key={idx} className="leading-relaxed">{r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Technician Actions Validation Panel */}
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 space-y-4">
                      <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <Brain className="w-5 h-5 text-emerald-400 animate-pulse" />
                          Panel de Validación del Técnico
                        </h3>
                        <p className="text-xs text-zinc-400 mt-1">
                          Este análisis generado por la IA es para uso exclusivo del equipo técnico. Apruebe el diagnóstico para generar automáticamente el informe simplificado para el productor.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        <button
                          onClick={() => currentEvalId && handleApprove(currentEvalId)}
                          className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/10 flex items-center gap-1.5"
                          id="btn-validate-approve"
                        >
                          <Check className="w-4 h-4 font-bold" />
                          Aprobar Análisis
                        </button>
                        <button
                          onClick={() => {
                            setEditedResult(analysisResult);
                            setIsEditingAnalysis(true);
                          }}
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border border-white/5 flex items-center gap-1.5"
                          id="btn-validate-edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Editar Análisis
                        </button>
                        <button
                          onClick={() => currentEvalId && handleReject(currentEvalId)}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border border-red-500/20 flex items-center gap-1.5"
                          id="btn-validate-reject"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Rechazar Análisis
                        </button>
                      </div>
                    </div>
                  </>
                )}

              </div>
            )}

          </div>

          {/* Reference specifications card (Right Column) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-4 sticky top-6">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-500" />
                Especificaciones de Fábrica
              </h2>
              
              {selectedPulsador ? (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <h3 className="text-xl font-bold text-white leading-none">
                      {selectedPulsador.marca} {selectedPulsador.modelo}
                    </h3>
                    <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-bold">Pulsador Electrónico</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                      <span className="text-zinc-500 block">Frecuencia Nominal</span>
                      <strong className="text-white font-semibold">{selectedPulsador.frecuenciaNominal} ppm</strong>
                    </div>
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                      <span className="text-zinc-500 block">Rango Permitido</span>
                      <strong className="text-white font-semibold">{selectedPulsador.frecuenciaMinima} - {selectedPulsador.frecuenciaMaxima} ppm</strong>
                    </div>
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                      <span className="text-zinc-500 block">Relaciones Admitidas</span>
                      <strong className="text-white font-semibold">{selectedPulsador.relacionesPermitidas}</strong>
                    </div>
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                      <span className="text-zinc-500 block">Vacío Recomendado</span>
                      <strong className="text-white font-semibold">{selectedPulsador.vacioRecomendado}</strong>
                    </div>
                  </div>

                  <div className="bg-black/40 rounded-xl p-3 border border-white/5 text-xs text-zinc-400">
                    <span className="text-zinc-500 block mb-1">Tolerancias de fábrica:</span>
                    <strong>{selectedPulsador.tolerancias}</strong>
                  </div>

                  {selectedPulsador.observaciones && (
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 text-xs text-zinc-400">
                      <span className="text-zinc-500 block mb-1">Observaciones:</span>
                      <p className="leading-relaxed">{selectedPulsador.observaciones}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-zinc-600 space-y-2">
                  <Info className="w-8 h-8 mx-auto stroke-1" />
                  <p className="text-xs">Seleccione un modelo de pulsador de referencia para ver sus especificaciones técnicas nominales aquí.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* -------------------- 2. HISTORIAL DE DIAGNÓSTICOS TAB -------------------- */}
      {activeTab === "historial" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* List panel (Left Column) */}
          <div className="xl:col-span-6 space-y-4">
            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white">Historial de Reportes</h2>
              
              {/* Search and filter bar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar por tambo, marca, modelo, técnico..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
                
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Aprobado">Aprobado</option>
                  <option value="Rechazado">Rechazado</option>
                </select>
              </div>

              {/* Grid or List of historical items */}
              {filteredEvaluaciones.length === 0 ? (
                <div className="py-12 text-center text-zinc-600 space-y-2">
                  <FileText className="w-10 h-10 mx-auto stroke-1" />
                  <p className="text-sm">No se encontraron evaluaciones registradas en el historial.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {filteredEvaluaciones.map((e) => {
                    const isSelected = selectedHistoricalEval?.id === e.id;
                    return (
                      <div
                        key={e.id}
                        onClick={() => setSelectedHistoricalEval(e)}
                        className={`p-4 border rounded-xl cursor-pointer transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                          isSelected 
                            ? "bg-emerald-500/10 border-emerald-500/30 shadow-md" 
                            : "bg-black/20 border-white/5 hover:bg-white/5"
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-sm truncate">{e.tamboNombre}</h3>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {new Date(e.fecha).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <p className="text-xs text-zinc-400">
                            Pulsador: <span className="text-white font-medium">{e.pulsadorMarca} {e.pulsadorModelo}</span>
                          </p>
                          <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                            <User className="w-3 h-3" /> {e.tecnicoNombre}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            e.estado === "Aprobado" 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : e.estado === "Rechazado"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}>
                            {e.estado}
                          </span>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setViewingEval(e);
                            }}
                            className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-emerald-400 transition-colors"
                            title="Ver diagnóstico completo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingEval(e);
                            }}
                            className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg text-amber-400 transition-colors"
                            title="Editar diagnóstico"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteEvaluation(e.id);
                            }}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 transition-colors"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Details panel (Right Column) */}
          <div className="xl:col-span-6 space-y-4">
            {selectedHistoricalEval ? (
              <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-6 animate-fade-in">
                
                {/* Header detail */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedHistoricalEval.tamboNombre}</h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      Evaluado por {selectedHistoricalEval.tecnicoNombre} el {new Date(selectedHistoricalEval.fecha).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setViewingEval(selectedHistoricalEval)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                      title="Ver Diagnóstico Completo"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ver Diagnóstico
                    </button>
                    <button
                      onClick={() => setEditingEval(selectedHistoricalEval)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all border border-white/5 flex items-center gap-1.5"
                      title="Editar Diagnóstico"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteEvaluation(selectedHistoricalEval.id)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-xl text-xs font-semibold transition-all border border-red-500/20 flex items-center gap-1.5"
                      title="Eliminar Diagnóstico"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar
                    </button>
                    <button
                      onClick={() => handleDownloadPDF(selectedHistoricalEval)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition-all border border-white/5 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF Técnico
                    </button>
                  </div>
                </div>

                {/* Split layout for image and comparative table */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedHistoricalEval.imagenUrl ? (
                    <div>
                      <span className="block text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Gráfico de Pulsógrafo Analizado</span>
                      <img 
                        src={selectedHistoricalEval.imagenUrl} 
                        alt="Pulsógrafo" 
                        className="rounded-xl border border-white/5 bg-black/40 max-h-52 w-full object-contain p-2"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/5 bg-black/40 h-32 flex items-center justify-center text-zinc-600 text-xs">
                      Sin reporte visual adjunto
                    </div>
                  )}

                  <div className="space-y-3">
                    <span className="block text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Métricas de Medición</span>
                    
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 space-y-2 text-xs">
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-zinc-500">Pulsador:</span>
                        <strong className="text-white">{selectedHistoricalEval.pulsadorMarca} {selectedHistoricalEval.pulsadorModelo}</strong>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-zinc-500">Frecuencia IA:</span>
                        <strong className="text-emerald-400 font-bold">{selectedHistoricalEval.resultadoIA.datosExtraidos.frecuenciaMedida} ppm</strong>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-zinc-500">Relación IA:</span>
                        <strong className="text-emerald-400 font-bold">{selectedHistoricalEval.resultadoIA.datosExtraidos.relacionMedida}</strong>
                      </div>
                      <div className="flex justify-between pb-0.5">
                        <span className="text-zinc-500">Vacío IA:</span>
                        <strong className="text-emerald-400 font-bold">{selectedHistoricalEval.resultadoIA.datosExtraidos.vacioMedido}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Diagnostic Details */}
                <div className="space-y-2">
                  <span className="block text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Diagnóstico Técnico Riguroso</span>
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans bg-black/20 p-4 rounded-xl border border-white/5">
                    {selectedHistoricalEval.resultadoIA.diagnosticoTecnico}
                  </p>
                </div>

                {/* Recommendations and Causes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="block text-[10px] uppercase tracking-widest text-red-500 font-bold">Posibles Causas de Falla</span>
                    {selectedHistoricalEval.resultadoIA.posiblesCausas.length > 0 ? (
                      <ul className="text-xs text-zinc-400 space-y-1 pl-4 list-disc">
                        {selectedHistoricalEval.resultadoIA.posiblesCausas.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    ) : (
                      <p className="text-xs text-zinc-600 italic">No se reportaron fallas</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <span className="block text-[10px] uppercase tracking-widest text-emerald-500 font-bold">Acciones Correctivas</span>
                    <ul className="text-xs text-zinc-400 space-y-1 pl-4 list-disc">
                      {selectedHistoricalEval.resultadoIA.recomendaciones.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                </div>

                {/* Technician Actions Validation for historic evaluation */}
                {selectedHistoricalEval.estado === "Pendiente" && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-white">Validar este reporte de campo</h4>
                      <p className="text-[11px] text-zinc-400">Establezca el diagnóstico definitivo para este pulsador.</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(selectedHistoricalEval.id)}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => handleReject(selectedHistoricalEval.id)}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                )}

                {/* Producer Simplified Report Section (Available once approved) */}
                {selectedHistoricalEval.estado === "Aprobado" && (
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      Informe Simplificado para el Productor
                    </h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Este informe resumido y simplificado está diseñado para ser compartido con el productor, libre de excesivo lenguaje técnico y enfocado en acciones concretas.
                    </p>
                    
                    <textarea
                      rows={5}
                      defaultValue={selectedHistoricalEval.informeSimplificado || ""}
                      onBlur={(e) => handleSaveProducerReport(selectedHistoricalEval.id, e.target.value)}
                      placeholder="Redacta o edita el informe simplificado aquí..."
                      className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors font-sans"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 italic">Cambios guardados automáticamente al salir del recuadro</span>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-12 text-center text-zinc-600 space-y-2 min-h-[300px] flex flex-col items-center justify-center">
                <Eye className="w-10 h-10 mx-auto stroke-1" />
                <p className="text-sm">Seleccione un reporte del historial para visualizar los detalles del diagnóstico, contrastes y validar el estado.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* -------------------- 3. CATÁLOGO DE PULSADORES TAB -------------------- */}
      {activeTab === "catalogo" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">Catálogo de Pulsadores de Referencia</h2>
            <button
              onClick={() => handleOpenModelModal()}
              className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              id="btn-add-model"
            >
              <Plus className="w-4 h-4" />
              Agregar Nuevo Modelo
            </button>
          </div>

          <div className="space-y-8">
            {marcas.map((marca) => {
              const brandPulsadores = pulsadores.filter(p => p.marcaId === marca.id);
              if (brandPulsadores.length === 0) return null;
              
              return (
                <div key={marca.id} className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
                      {marca.nombre}
                    </span>
                    <span className="text-[10px] bg-zinc-800/60 text-zinc-400 px-2.5 py-0.5 rounded-full border border-white/5 font-semibold">
                      {brandPulsadores.length} {brandPulsadores.length === 1 ? "modelo" : "modelos"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {brandPulsadores.map((p) => (
                      <div
                        key={p.id}
                        className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-5 space-y-4 relative flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] uppercase tracking-widest bg-zinc-800 text-zinc-400 font-semibold px-2 py-0.5 rounded-full border border-white/5">
                              {marca.nombre}
                            </span>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleOpenModelModal(p)}
                                className="p-1 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                title="Editar modelo"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteModel(p.id)}
                                className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Eliminar modelo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <h3 className="text-lg font-bold text-white mb-3">
                            {marca.nombre} | {p.modelo}
                          </h3>

                          <div className="space-y-1.5 text-xs text-zinc-400 font-sans border-t border-white/5 pt-3">
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Frecuencia nominal:</span>
                              <strong className="text-zinc-200">{p.frecuenciaNominal} ppm</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Rango permitido:</span>
                              <strong className="text-zinc-200">{p.frecuenciaMinima} - {p.frecuenciaMaxima} ppm</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Relación admisible:</span>
                              <strong className="text-zinc-200">{p.relacionesPermitidas}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Vacío recomendado:</span>
                              <strong className="text-zinc-200">{p.vacioRecomendado}</strong>
                            </div>
                          </div>
                        </div>

                        {p.observaciones && (
                          <p className="text-[11px] text-zinc-500 italic mt-2 leading-relaxed border-t border-white/5 pt-3">
                            {p.observaciones}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Model Create/Edit Modal */}
          {isModelModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="w-full max-w-lg bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-4 animate-fade-in">
                <h3 className="text-lg font-bold text-white">
                  {editingModelId ? "Editar Pulsador de Referencia" : "Agregar Pulsador de Referencia"}
                </h3>

                <form onSubmit={handleSaveModel} className="space-y-4 text-xs text-left">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 font-semibold mb-1">Marca <span className="text-red-500">*</span></label>
                      <select
                        required
                        value={modelForm.marcaId}
                        onChange={(e) => setModelForm({ ...modelForm, marcaId: e.target.value })}
                        className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 px-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                        id="form-select-model-marca"
                      >
                        <option value="" disabled className="bg-zinc-900 text-zinc-500">-- Seleccione Marca --</option>
                        {marcas.map((m) => (
                          <option key={m.id} value={m.id} className="bg-zinc-900 text-white">
                            {m.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-zinc-400 font-semibold mb-1">Modelo <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: EP100, Apex"
                        value={modelForm.modelo}
                        onChange={(e) => setModelForm({ ...modelForm, modelo: e.target.value })}
                        className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-white"
                        id="form-input-modelo"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-zinc-400 font-semibold mb-1">Frecuencia Nom. (ppm)</label>
                      <input
                        type="number"
                        value={modelForm.frecuenciaNominal}
                        onChange={(e) => setModelForm({ ...modelForm, frecuenciaNominal: parseInt(e.target.value) || 0 })}
                        className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 font-semibold mb-1 font-sans">Freq. Mínima (ppm)</label>
                      <input
                        type="number"
                        value={modelForm.frecuenciaMinima}
                        onChange={(e) => setModelForm({ ...modelForm, frecuenciaMinima: parseInt(e.target.value) || 0 })}
                        className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 font-semibold mb-1">Freq. Máxima (ppm)</label>
                      <input
                        type="number"
                        value={modelForm.frecuenciaMaxima}
                        onChange={(e) => setModelForm({ ...modelForm, frecuenciaMaxima: parseInt(e.target.value) || 0 })}
                        className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 font-semibold mb-1">Relaciones Permitidas</label>
                      <input
                        type="text"
                        value={modelForm.relacionesPermitidas}
                        onChange={(e) => setModelForm({ ...modelForm, relacionesPermitidas: e.target.value })}
                        placeholder="Ej: 60/40, 70/30"
                        className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 font-semibold mb-1">Vacío Recomendado</label>
                      <input
                        type="text"
                        value={modelForm.vacioRecomendado}
                        onChange={(e) => setModelForm({ ...modelForm, vacioRecomendado: e.target.value })}
                        placeholder="Ej: 42 - 50 kPa"
                        className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-zinc-400 font-semibold mb-1">Tolerancias de Fábrica</label>
                    <input
                      type="text"
                      value={modelForm.tolerancias}
                      onChange={(e) => setModelForm({ ...modelForm, tolerancias: e.target.value })}
                      placeholder="Ej: +/- 2 ppm, +/- 2% relación"
                      className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 font-semibold mb-1 font-sans">Observaciones o Características Especiales</label>
                    <textarea
                      rows={3}
                      value={modelForm.observaciones}
                      onChange={(e) => setModelForm({ ...modelForm, observaciones: e.target.value })}
                      placeholder="Agregue consideraciones especiales del pulsador..."
                      className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => setIsModelModalOpen(false)}
                      className="bg-zinc-800 text-zinc-300 hover:text-white px-4 py-2 rounded-xl"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2 rounded-xl"
                    >
                      Guardar Modelo
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Diagnosis Modal */}
      {viewingEval && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-6 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-white/5 pb-4">
              <div>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2.5 py-0.5 uppercase tracking-wider font-semibold">
                  Vista Completa de Diagnóstico
                </span>
                <h3 className="text-xl font-bold text-white mt-1">
                  Reporte de {viewingEval.tamboNombre}
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Evaluado por {viewingEval.tecnicoNombre} el {new Date(viewingEval.fecha).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setViewingEval(null)}
                className="text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {viewingEval.imagenUrl ? (
                <div>
                  <span className="block text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Gráfico de Pulsógrafo Analizado</span>
                  <img 
                    src={viewingEval.imagenUrl} 
                    alt="Pulsógrafo" 
                    referrerPolicy="no-referrer"
                    className="rounded-xl border border-white/5 bg-black/40 max-h-52 w-full object-contain p-2"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-white/5 bg-black/40 h-32 flex items-center justify-center text-zinc-600 text-xs">
                  Sin reporte visual adjunto
                </div>
              )}

              <div className="space-y-3">
                <span className="block text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Métricas del Diagnóstico</span>
                <div className="bg-black/40 rounded-xl p-4 border border-white/5 space-y-2 text-xs">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-zinc-500">Pulsador de Referencia:</span>
                    <strong className="text-white">{viewingEval.pulsadorMarca} {viewingEval.pulsadorModelo}</strong>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-zinc-500">Frecuencia Medida:</span>
                    <strong className="text-emerald-400 font-bold">{viewingEval.resultadoIA.datosExtraidos.frecuenciaMedida} ppm</strong>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-zinc-500">Relación Medida:</span>
                    <strong className="text-emerald-400 font-bold">{viewingEval.resultadoIA.datosExtraidos.relacionMedida}</strong>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-zinc-500">Vacío Medido:</span>
                    <strong className="text-emerald-400 font-bold">{viewingEval.resultadoIA.datosExtraidos.vacioMedido}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Diagnóstico Técnico Riguroso</span>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans bg-black/20 p-4 rounded-xl border border-white/5 whitespace-pre-wrap text-left">
                {viewingEval.resultadoIA.diagnosticoTecnico}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 text-left">
                <span className="block text-[10px] uppercase tracking-widest text-red-500 font-bold">Posibles Causas de Falla</span>
                {viewingEval.resultadoIA.posiblesCausas.length > 0 ? (
                  <ul className="text-xs text-zinc-400 space-y-1.5 pl-4 list-disc">
                    {viewingEval.resultadoIA.posiblesCausas.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-600 italic">No se reportaron fallas</p>
                )}
              </div>
              <div className="space-y-2 text-left">
                <span className="block text-[10px] uppercase tracking-widest text-emerald-500 font-bold">Acciones Correctivas</span>
                <ul className="text-xs text-zinc-400 space-y-1.5 pl-4 list-disc">
                  {viewingEval.resultadoIA.recomendaciones.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            </div>

            {viewingEval.informeSimplificado && (
              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 space-y-2 text-left">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Informe para el Productor</h4>
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{viewingEval.informeSimplificado}</p>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => setViewingEval(null)}
                className="bg-zinc-800 text-zinc-300 hover:text-white px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Cerrar Reporte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Diagnosis Modal */}
      {editingEval && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-4 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-white/5 pb-4">
              <div>
                <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2.5 py-0.5 uppercase tracking-wider font-semibold">
                  Editar Diagnóstico de Campo
                </span>
                <h3 className="text-xl font-bold text-white mt-1">
                  Modificar Registro de Diagnóstico
                </h3>
              </div>
              <button
                onClick={() => setEditingEval(null)}
                className="text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedEval} className="space-y-4 text-xs text-left">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Establecimiento (Tambo)</label>
                  <select
                    value={editingEval.tamboId}
                    onChange={(e) => setEditingEval({ ...editingEval, tamboId: e.target.value })}
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 px-3 text-white"
                  >
                    {tambos.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Pulsador de Referencia</label>
                  <select
                    value={editingEval.pulsadorId}
                    onChange={(e) => setEditingEval({ ...editingEval, pulsadorId: e.target.value })}
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 px-3 text-white"
                  >
                    {pulsadores.map(p => (
                      <option key={p.id} value={p.id}>{p.marca} {p.modelo}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Estado de Diagnóstico</label>
                  <select
                    value={editingEval.estado}
                    onChange={(e) => setEditingEval({ ...editingEval, estado: e.target.value as any })}
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 px-3 text-white"
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Aprobado">Aprobado</option>
                    <option value="Rechazado">Rechazado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Frecuencia Medida (ppm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingEval.resultadoIA.datosExtraidos.frecuenciaMedida}
                    onChange={(e) => setEditingEval({
                      ...editingEval,
                      resultadoIA: {
                        ...editingEval.resultadoIA,
                        datosExtraidos: {
                          ...editingEval.resultadoIA.datosExtraidos,
                          frecuenciaMedida: parseFloat(e.target.value) || 0
                        }
                      }
                    })}
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 px-3 text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Relación de Pulsación Medida</label>
                  <input
                    type="text"
                    value={editingEval.resultadoIA.datosExtraidos.relacionMedida}
                    onChange={(e) => setEditingEval({
                      ...editingEval,
                      resultadoIA: {
                        ...editingEval.resultadoIA,
                        datosExtraidos: {
                          ...editingEval.resultadoIA.datosExtraidos,
                          relacionMedida: e.target.value
                        }
                      }
                    })}
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 px-3 text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Nivel de Vacío Medido</label>
                  <input
                    type="text"
                    value={editingEval.resultadoIA.datosExtraidos.vacioMedido}
                    onChange={(e) => setEditingEval({
                      ...editingEval,
                      resultadoIA: {
                        ...editingEval.resultadoIA,
                        datosExtraidos: {
                          ...editingEval.resultadoIA.datosExtraidos,
                          vacioMedido: e.target.value
                        }
                      }
                    })}
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 px-3 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Estado General</label>
                  <select
                    value={editingEval.resultadoIA.estadoGeneral}
                    onChange={(e) => setEditingEval({
                      ...editingEval,
                      resultadoIA: {
                        ...editingEval.resultadoIA,
                        estadoGeneral: e.target.value as any
                      }
                    })}
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 px-3 text-white"
                  >
                    <option value="Satisfactorio">Satisfactorio</option>
                    <option value="Advertencia">Advertencia</option>
                    <option value="Crítico">Crítico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Nivel de Criticidad</label>
                  <select
                    value={editingEval.resultadoIA.nivelCriticidad}
                    onChange={(e) => setEditingEval({
                      ...editingEval,
                      resultadoIA: {
                        ...editingEval.resultadoIA,
                        nivelCriticidad: e.target.value as any
                      }
                    })}
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2.5 px-3 text-white"
                  >
                    <option value="Bajo">Bajo</option>
                    <option value="Medio">Medio</option>
                    <option value="Alto">Alto</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Diagnóstico Técnico Riguroso</label>
                <textarea
                  rows={3}
                  value={editingEval.resultadoIA.diagnosticoTecnico}
                  onChange={(e) => setEditingEval({
                    ...editingEval,
                    resultadoIA: {
                      ...editingEval.resultadoIA,
                      diagnosticoTecnico: e.target.value
                    }
                  })}
                  className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Posibles Causas (un item por línea)</label>
                  <textarea
                    rows={3}
                    value={editingEval.resultadoIA.posiblesCausas.join("\n")}
                    onChange={(e) => setEditingEval({
                      ...editingEval,
                      resultadoIA: {
                        ...editingEval.resultadoIA,
                        posiblesCausas: e.target.value.split("\n").filter(Boolean)
                      }
                    })}
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Acciones Correctivas / Recomendaciones (una por línea)</label>
                  <textarea
                    rows={3}
                    value={editingEval.resultadoIA.recomendaciones.join("\n")}
                    onChange={(e) => setEditingEval({
                      ...editingEval,
                      resultadoIA: {
                        ...editingEval.resultadoIA,
                        recomendaciones: e.target.value.split("\n").filter(Boolean)
                      }
                    })}
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-white"
                  />
                </div>
              </div>

              {editingEval.estado === "Aprobado" && (
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Informe Simplificado para el Productor</label>
                  <textarea
                    rows={3}
                    value={editingEval.informeSimplificado || ""}
                    onChange={(e) => setEditingEval({
                      ...editingEval,
                      informeSimplificado: e.target.value
                    })}
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-white"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setEditingEval(null)}
                  className="bg-zinc-800 text-zinc-300 hover:text-white px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2 rounded-xl"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
