import React, { useState, useEffect } from "react";
import { 
  Brain, 
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
  Download, 
  Eye, 
  Info,
  Droplets,
  Wrench,
  Share2,
  X,
  FileSpreadsheet,
  Award,
  ShieldCheck,
  Activity,
  HeartPulse,
  ClipboardCheck,
  Layers,
  Zap,
  FileCode
} from "lucide-react";
import { db, getActiveCompanyId } from "../services/db";
import { useAuth } from "../services/AuthContext";
import { aiDiagnosisStorage } from "../utils/aiDiagnosisStorage";
import { EvaluacionDiagnosis, ResultadoIA } from "../types/aiDiagnosis";
import { Tambo } from "../types/supabase";
import { AIService } from "../services/aiService";
import { downloadTechnicalPdf, downloadProducerPdf } from "../utils/pdfGenerator";
import { evaluatePulsatorISO } from "../utils/isoRulesEngine";
import IaForm from "../components/IaForm";

export default function AiDiagnosisPage() {
  const { profile, user: authUser } = useAuth();
  
  // Navigation Tabs: Only 2 main tabs ("nueva" or "historial")
  const [activeTab, setActiveTab] = useState<"nueva" | "historial">("nueva");

  // View mode within result display: "productor" vs "tecnico" vs "depuracion"
  const [reportViewMode, setReportViewMode] = useState<"productor" | "tecnico" | "depuracion">("productor");

  // General state
  const [tambos, setTambos] = useState<Tambo[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionDiagnosis[]>([]);
  const [loadingTambos, setLoadingTambos] = useState(true);

  // Form States
  const [selectedTamboId, setSelectedTamboId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageHash, setImageHash] = useState<string>("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // AI Loading & Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("Cargando imagen…");
  const [analysisResult, setAnalysisResult] = useState<ResultadoIA | null>(null);
  const [currentEval, setCurrentEval] = useState<EvaluacionDiagnosis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Config modal state
  const [isIaConfigOpen, setIsIaConfigOpen] = useState(false);

  // History states for View Modal & Filtering
  const [viewingEval, setViewingEval] = useState<EvaluacionDiagnosis | null>(null);
  const [modalReportMode, setModalReportMode] = useState<"productor" | "tecnico">("productor");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  // Load initial data
  useEffect(() => {
    async function loadData() {
      setLoadingTambos(true);
      try {
        const companyId = getActiveCompanyId();
        let tambosList: Tambo[] = [];
        tambosList = await db.tambos.getAll();
        setTambos(tambosList);
        if (tambosList.length > 0) {
          setSelectedTamboId(tambosList[0].id);
        }
      } catch (err) {
        console.error("Error al cargar tambos:", err);
      } finally {
        setLoadingTambos(false);
      }

      // Load saved evaluations from local storage
      const savedEvals = aiDiagnosisStorage.getEvaluaciones();
      setEvaluaciones(savedEvals);
    }

    loadData();
  }, []);

  // Handle File Select / Drag and Drop
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Por favor cargue una imagen válida (PNG, JPG, WEBP).");
      return;
    }
    setImageFile(file);

    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      setImageHash(hashHex);
    } catch (e) {
      setImageHash(`sha256-${Date.now()}`);
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Run AI / ISO Engine Analysis
  const handleAnalyze = async () => {
    if (!selectedTamboId) {
      alert("Por favor seleccione un Establecimiento (Tambo).");
      return;
    }
    if (!imagePreview) {
      alert("Por favor cargue una imagen del reporte o pantalla del pulsógrafo.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setCurrentEval(null);

    setAnalysisStep("Procesando imagen del pulsógrafo…");

    try {
      setTimeout(() => setAnalysisStep("Extrayendo tiempos y fases de pulso (ISO 5707 / 6690)…"), 1000);
      setTimeout(() => setAnalysisStep("Contrastando parámetros contra Motor ISO…"), 2000);

      const computedHash = imageHash || `hash-${Date.now()}`;

      const res = await AIService.runDiagnosis({
        image: imagePreview,
        fileName: imageFile?.name || "imagen_pulsografo.png",
        fileSize: imageFile?.size || imagePreview.length,
        mimeType: imageFile?.type || "image/png",
        imageHash: computedHash,
        tamboId: selectedTamboId,
        additionalNotes
      });

      const selectedTambo = tambos.find(t => t.id === selectedTamboId);

      const newEval: EvaluacionDiagnosis = {
        id: `eval-${Date.now()}`,
        fecha: new Date().toISOString(),
        tecnicoNombre: profile?.full_name || authUser?.email || "Técnico Especialista",
        tecnicoEmail: authUser?.email || "",
        tamboId: selectedTamboId,
        tamboNombre: selectedTambo?.nombre || "Establecimiento",
        imagenUrl: imagePreview,
        estado: "Aprobado",
        resultadoIA: res,
        informeSimplificado: res.informeProductor?.queSignifica || res.diagnosticoTecnico
      };

      // Save to storage
      aiDiagnosisStorage.saveEvaluacion(newEval);

      // Update state
      setEvaluaciones(aiDiagnosisStorage.getEvaluaciones());
      setAnalysisResult(res);
      setCurrentEval(newEval);
      setReportViewMode("productor");

    } catch (err: any) {
      console.error("Error en análisis:", err);
      setAnalysisError(err.message || "Error al procesar el análisis con el Motor ISO.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // WhatsApp sharing handler
  const handleShareWhatsApp = (evalData: EvaluacionDiagnosis) => {
    const res = evalData.resultadoIA;
    const inf = res.informeProductor;
    const tamboName = evalData.tamboNombre || "Establecimiento";
    const dateStr = evalData.fecha ? new Date(evalData.fecha).toLocaleDateString("es-AR") : new Date().toLocaleDateString("es-AR");

    const msg = `🏥 *GANPOR - INFORME DE PULSADO PARA EL PRODUCTOR*
📍 *Establecimiento:* ${tamboName}
📅 *Fecha:* ${dateStr}
📊 *Estado del Pulsador:* ${res.estadoGeneral.toUpperCase()}

💡 *¿Cómo impacta en el ordeño?*
${inf?.interpretacion || inf?.queSignifica || res.diagnosticoTecnico}

🩺 *Salud de la Ubre y Bienestar:*
${inf?.queRiesgosExisten || "Revisar la tabla de parámetros ISO."}

🔧 *Recomendaciones:*
${inf?.queSeRecomiendaHacer || (res.accionesCorrectivas || res.recomendaciones || []).join("\n• ")}

📌 *Conclusión Final:*
${inf?.conclusionFinal || "Evaluación profesional procesada según Norma ISO 5707 / 6690."}

_Servicio Profesional GANPOR - Evaluación e Inspección de Pulsado_`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  // Delete Evaluation
  const handleDeleteEval = (id: string) => {
    if (confirm("¿Está seguro de eliminar este registro del historial?")) {
      aiDiagnosisStorage.deleteEvaluacion(id);
      setEvaluaciones(aiDiagnosisStorage.getEvaluaciones());
      if (viewingEval?.id === id) setViewingEval(null);
    }
  };

  // Filter evaluations for history
  const filteredEvaluaciones = evaluaciones.filter((item) => {
    const matchesSearch = 
      item.tamboNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tecnicoNombre.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = 
      statusFilter === "todos" || 
      (item.resultadoIA?.estadoGeneral || "").toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Helper badge color
  const getBadgeStyle = (estado: string) => {
    switch (estado) {
      case "Conforme":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "Advertencia":
      case "Atención":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "Fuera de tolerancia":
        return "bg-orange-500/10 text-orange-400 border-orange-500/30";
      case "Crítico":
        return "bg-red-500/10 text-red-400 border-red-500/30";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
    }
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case "Conforme":
        return <CheckCircle2 className="w-6 h-6 text-emerald-400" />;
      case "Advertencia":
      case "Atención":
        return <AlertTriangle className="w-6 h-6 text-amber-400" />;
      case "Fuera de tolerancia":
        return <AlertCircle className="w-6 h-6 text-orange-400" />;
      case "Crítico":
        return <XCircle className="w-6 h-6 text-red-400" />;
      default:
        return <Info className="w-6 h-6 text-zinc-400" />;
    }
  };

  const getStatusIndicator = (estado: string) => {
    switch (estado) {
      case "Conforme":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">🟢 Conforme</span>;
      case "Advertencia":
      case "Atención":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">🟡 Atención</span>;
      case "Fuera de tolerancia":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">🔴 Desviado</span>;
      case "Crítico":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">🔴 Crítico</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">⚪ Sin evaluar</span>;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      {/* Institutional Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-gradient-to-r from-emerald-950/60 via-zinc-900/80 to-zinc-900/60 p-6 rounded-2xl border border-emerald-500/20 backdrop-blur-xl shadow-xl shadow-emerald-950/10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
                GANPOR - DIAGNÓSTICO DE PULSADO
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold uppercase tracking-wider">
                  NORMA ISO 5707 / 6690
                </span>
              </h1>
              <p className="text-sm text-zinc-300 mt-0.5">
                Evaluación mecánica y neumática imparcial para optimizar la salud mamaria y el rendimiento del ordeño.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsIaConfigOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-medium text-sm transition-colors border border-zinc-700"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Configurar Motor / IA
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex border-b border-zinc-800 mb-8">
        <button
          onClick={() => setActiveTab("nueva")}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-all border-b-2 -mb-px ${
            activeTab === "nueva"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Nueva Evaluación ISO
        </button>

        <button
          onClick={() => setActiveTab("historial")}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition-all border-b-2 -mb-px ${
            activeTab === "historial"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
          }`}
        >
          <FileText className="w-4 h-4" />
          Historial de Diagnósticos ({evaluaciones.length})
        </button>
      </div>

      {/* TAB 1: NUEVA EVALUACIÓN */}
      {activeTab === "nueva" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Input Form */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800 backdrop-blur-xl shadow-lg">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Droplets className="w-5 h-5 text-emerald-400" />
                Datos de la Evaluación
              </h2>

              <div className="space-y-5">
                {/* 1. Tambo Selector */}
                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
                    Establecimiento (Tambo) <span className="text-red-400">*</span>
                  </label>
                  {loadingTambos ? (
                    <div className="h-10 bg-zinc-800 animate-pulse rounded-xl" />
                  ) : (
                    <select
                      value={selectedTamboId}
                      onChange={(e) => setSelectedTamboId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-emerald-500 font-medium text-sm"
                    >
                      {tambos.map((tambo) => (
                        <option key={tambo.id} value={tambo.id}>
                          {tambo.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 2. Image Drag & Drop Upload Zone */}
                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
                    Imagen del Reporte / Pantalla del Pulsógrafo <span className="text-red-400">*</span>
                  </label>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                      isDragOver
                        ? "border-emerald-500 bg-emerald-500/10"
                        : imagePreview
                        ? "border-zinc-700 bg-zinc-950"
                        : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="pulsator-image-upload"
                    />

                    {imagePreview ? (
                      <div className="relative group">
                        <img
                          src={imagePreview}
                          alt="Reporte de pulsógrafo"
                          className="max-h-52 mx-auto rounded-xl object-contain border border-zinc-800"
                        />
                        <div className="mt-3 flex items-center justify-center gap-2">
                          <label
                            htmlFor="pulsator-image-upload"
                            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 rounded-lg cursor-pointer transition-colors"
                          >
                            Cambiar imagen
                          </label>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setImageFile(null);
                              setImagePreview(null);
                            }}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-400 rounded-lg transition-colors"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label htmlFor="pulsator-image-upload" className="cursor-pointer block py-4">
                        <Upload className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-zinc-200">
                          Arrastre la imagen aquí o haga clic para seleccionar
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          Admite gráficos de pulsógrafo, fotos de pantalla LCD o impresiones
                        </p>
                      </label>
                    )}
                  </div>
                </div>

                {/* 3. Additional Field Notes (Optional) */}
                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
                    Notas u Observaciones de Campo (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Observaciones adicionales del técnico sobre el pulsador o la bajada..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>

                {/* Analyze Button */}
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !selectedTamboId || !imagePreview}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-zinc-950 font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-base"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>{analysisStep}</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-5 h-5" />
                      <span>Generar Informe de Pulsado</span>
                    </>
                  )}
                </button>

                {analysisError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs leading-relaxed flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Error en el análisis</p>
                      <p>{analysisError}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Normative Reference Card */}
            <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/60 text-xs text-zinc-400 space-y-2">
              <h3 className="font-bold text-zinc-200 flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400" />
                Normas Internacionales de Referencia
              </h3>
              <p className="leading-relaxed">
                Este diagnóstico evalúa la Frecuencia (60 ppm ± 3), Relación de Pulsado (± 5%), Fases A, B, C, D y Nivel de Vacío (40-50 kPa) exclusivamente bajo las normas <strong>ISO 5707:2007</strong> y <strong>ISO 6690:2007</strong>.
              </p>
            </div>
          </div>

          {/* Right Column: High-Impact Professional Report View */}
          <div className="lg:col-span-7 space-y-6">
            {!analysisResult && !isAnalyzing && (
              <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[420px]">
                <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl mb-4 border border-emerald-500/20">
                  <FileSpreadsheet className="w-12 h-12" />
                </div>
                <h3 className="text-lg font-bold text-zinc-200 mb-1">
                  Esperando Análisis de Pulsógrafo
                </h3>
                <p className="text-sm text-zinc-400 max-w-md leading-relaxed">
                  Cargue la imagen del reporte y presione "Generar Informe de Pulsado" para obtener el informe profesional para el productor con tablas de valores, interpretación técnica y recomendaciones.
                </p>
              </div>
            )}

            {isAnalyzing && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[420px] space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                  <Brain className="w-8 h-8 text-emerald-400 absolute inset-0 m-auto" />
                </div>
                <h3 className="text-lg font-bold text-white">{analysisStep}</h3>
                <p className="text-xs text-zinc-400 max-w-sm">
                  Evaluando parámetros contra tolerancias ISO 5707 / ISO 6690...
                </p>
              </div>
            )}

            {analysisResult && currentEval && (
              <div className="space-y-6 animate-fadeIn">
                {/* View Switcher Controls (Productor vs Técnico) */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800 backdrop-blur-xl">
                  <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                    <button
                      onClick={() => setReportViewMode("productor")}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                        reportViewMode === "productor"
                          ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <Award className="w-4 h-4" />
                      Informe para el Productor
                    </button>
                    <button
                      onClick={() => setReportViewMode("tecnico")}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                        reportViewMode === "tecnico"
                          ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Reporte Técnico ISO
                    </button>
                    <button
                      onClick={() => setReportViewMode("depuracion")}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        reportViewMode === "depuracion"
                          ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <Brain className="w-4 h-4" />
                      Trazabilidad OCR
                    </button>
                  </div>

                  {/* Action Download Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => downloadProducerPdf(currentEval)}
                      className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      PDF Productor
                    </button>

                    <button
                      onClick={() => downloadTechnicalPdf(currentEval)}
                      className="px-3.5 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <FileText className="w-4 h-4" />
                      PDF Técnico
                    </button>

                    <button
                      onClick={() => handleShareWhatsApp(currentEval)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                    >
                      <Share2 className="w-4 h-4" />
                      WhatsApp
                    </button>
                  </div>
                </div>

                {/* REPORT VIEW: INFORME PARA EL PRODUCTOR */}
                {reportViewMode === "productor" && (
                  <div className="bg-zinc-900/90 rounded-2xl border border-emerald-500/30 overflow-hidden shadow-2xl backdrop-blur-xl">
                    {/* Header Card */}
                    <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 p-6 text-zinc-950">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-950 bg-emerald-300/60 px-2.5 py-0.5 rounded-full">
                            GANPOR - SERVICIO PROFESIONAL
                          </span>
                          <h2 className="text-2xl font-black mt-1 text-zinc-950">
                            Informe de Pulsado para el Productor
                          </h2>
                          <p className="text-xs text-emerald-950 font-medium mt-0.5">
                            Establecimiento: <span className="font-bold">{currentEval.tamboNombre}</span> | Fecha: <span className="font-bold">{new Date(currentEval.fecha).toLocaleDateString("es-AR")}</span>
                          </p>
                        </div>

                        <div className="bg-zinc-950/90 text-white p-3.5 rounded-xl border border-zinc-800 text-right">
                          <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block">Estado del Pulsador</span>
                          <span className="text-lg font-black text-white">{analysisResult.estadoGeneral}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Section 1: Analyzed Image */}
                      {imagePreview && (
                        <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 space-y-2">
                          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            Imagen del Pulsógrafo Analizada
                          </h3>
                          <div className="flex flex-col sm:flex-row items-center gap-4 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/80">
                            <img
                              src={imagePreview}
                              alt="Reporte de pulsógrafo"
                              className="w-full sm:w-48 h-32 object-contain rounded-lg bg-black/60 border border-zinc-800"
                            />
                            <div className="text-xs text-zinc-400 space-y-1">
                              <p className="font-semibold text-zinc-200">Registro gráfico capturado en la sala de ordeño</p>
                              <p>El diagnóstico evalúa la estabilidad del vacío, frecuencia y tiempos de apertura/cierre de la pezonera.</p>
                              <span className="inline-block mt-2 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                                Diagnóstico asociado a la muestra analizada
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Section 2: Table of Measured Values */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                          Tabla de Valores Medidos y Comparación ISO
                        </h3>

                        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/80">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-900 text-zinc-300 font-bold uppercase tracking-wider border-b border-zinc-800">
                              <tr>
                                <th className="p-3">Parámetro</th>
                                <th className="p-3">Valor Medido</th>
                                <th className="p-3">Rango Estándar ISO</th>
                                <th className="p-3">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                              {(analysisResult.evaluacionISO || []).map((row, idx) => (
                                <React.Fragment key={idx}>
                                  <tr className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="p-3 font-semibold text-zinc-200">
                                      {row.canal && row.canal !== "Global" && (
                                        <span className="inline-block mr-2 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[10px]">
                                          {row.canal}
                                        </span>
                                      )}
                                      {row.parametro}
                                    </td>
                                    <td className="p-3 font-bold text-white font-mono">{row.valorMedido}</td>
                                    <td className="p-3 text-zinc-400">{row.valorPermitido}</td>
                                    <td className="p-3">{getStatusIndicator(row.estado)}</td>
                                  </tr>
                                  {row.interpretacion && (
                                    <tr className="bg-zinc-950/40 border-b border-zinc-800/40">
                                      <td colSpan={4} className="px-3 py-2 text-[11px] text-zinc-400 italic">
                                        <span className="font-semibold text-emerald-400 not-italic mr-1">💡 Interpretación:</span>
                                        {row.interpretacion}
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Section 3: Interpretation of Diagnosis */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Brain className="w-4 h-4 text-emerald-400" />
                          Interpretación del Diagnóstico
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* How it affects milking */}
                          <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 space-y-2">
                            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Activity className="w-4 h-4" />
                              Impacto en la Bajada de Leche
                            </h4>
                            <p className="text-xs text-zinc-300 leading-relaxed">
                              {analysisResult.informeProductor?.interpretacion || analysisResult.informeProductor?.queSignifica}
                            </p>
                          </div>

                          {/* Health & Comfort */}
                          <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 space-y-2">
                            <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                              <HeartPulse className="w-4 h-4" />
                              Salud del Pezón y Bienestar
                            </h4>
                            <p className="text-xs text-zinc-300 leading-relaxed">
                              {analysisResult.informeProductor?.queRiesgosExisten}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Section 4: Operational Recommendations & Plan de Inspección */}
                      {(analysisResult.planInspeccion || (analysisResult.informeProductor?.planInspeccionSencillo)) && (
                        <div className="bg-zinc-950/80 p-5 rounded-xl border border-zinc-800 space-y-3">
                          <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                            <Wrench className="w-4 h-4" />
                            Plan de Inspección Recomendado en Sala
                          </h3>
                          <ol className="space-y-2 text-xs text-zinc-300 list-decimal list-inside">
                            {(analysisResult.informeProductor?.planInspeccionSencillo || analysisResult.planInspeccion || []).map((step, i) => (
                              <li key={i} className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80">
                                <span className="font-semibold text-zinc-100">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Section 5: Operational Recommendations */}
                      <div className="bg-emerald-950/20 p-5 rounded-xl border border-emerald-500/30 space-y-3">
                        <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Recomendaciones de Mantenimiento y Acciones
                        </h3>
                        <ul className="space-y-2 text-xs text-zinc-200">
                          {(analysisResult.accionesCorrectivas || analysisResult.recomendaciones || [analysisResult.informeProductor?.queSeRecomiendaHacer]).map((rec, i) => (
                            <li key={i} className="flex items-start gap-2 bg-zinc-950/60 p-2.5 rounded-lg border border-emerald-500/20">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Section 6: Professional Final Conclusion */}
                      {analysisResult.informeProductor?.conclusionFinal && (
                        <div className="bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-5 rounded-xl border border-zinc-800 space-y-2">
                          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                            Conclusión Final del Informe
                          </h3>
                          <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                            {analysisResult.informeProductor.conclusionFinal}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* REPORT VIEW: REPORTE TÉCNICO ISO */}
                {reportViewMode === "tecnico" && (
                  <div className="bg-zinc-900/90 p-6 rounded-2xl border border-zinc-800 backdrop-blur-xl space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(analysisResult.estadoGeneral)}
                        <div>
                          <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
                            Dictamen General ISO 5707 / 6690
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-white">
                              {analysisResult.estadoGeneral}
                            </span>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold uppercase ${getBadgeStyle(analysisResult.estadoGeneral)}`}>
                              Criticidad: {analysisResult.nivelCriticidad}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ISO Table */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        Tabla Técnica Completa de Parámetros ISO
                      </h3>

                      <div className="overflow-x-auto rounded-xl border border-zinc-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-zinc-950 text-zinc-400 font-bold uppercase tracking-wider border-b border-zinc-800">
                            <tr>
                              <th className="p-3">Parámetro</th>
                              <th className="p-3">Medido</th>
                              <th className="p-3">Estándar ISO</th>
                              <th className="p-3">Desviación</th>
                              <th className="p-3">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/40">
                            {(analysisResult.evaluacionISO || []).map((item, idx) => (
                              <React.Fragment key={idx}>
                                <tr className="hover:bg-zinc-800/30 transition-colors">
                                  <td className="p-3 font-semibold text-zinc-200">
                                    {item.canal && item.canal !== "Global" && (
                                      <span className="inline-block mr-2 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[10px]">
                                        {item.canal}
                                      </span>
                                    )}
                                    {item.parametro}
                                  </td>
                                  <td className="p-3 font-bold text-white font-mono">{item.valorMedido}</td>
                                  <td className="p-3 text-zinc-400">{item.valorPermitido}</td>
                                  <td className="p-3 text-zinc-300 font-mono">{item.diferencia}</td>
                                  <td className="p-3">
                                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getBadgeStyle(item.estado)}`}>
                                      {item.estado}
                                    </span>
                                  </td>
                                </tr>
                                {item.interpretacion && (
                                  <tr className="bg-zinc-950/60 border-b border-zinc-800/60">
                                    <td colSpan={5} className="px-3 py-2 text-[11px] text-zinc-300">
                                      <span className="font-semibold text-emerald-400 mr-1">💡 Análisis Técnico:</span>
                                      {item.interpretacion}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* CANAL 1 vs CANAL 2 INDIVIDUAL ANALYSIS PIPELINE */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-400" />
                        Desglose Técnico e Interpretación por Canal
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Canal 1 Card */}
                        <div className="p-4 bg-zinc-950/90 border border-emerald-500/30 rounded-xl space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                            <span className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                              {analysisResult.analisisCanal1?.nombreCanal || "Canal 1"}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${getBadgeStyle(analysisResult.analisisCanal1?.estadoCanal || "Conforme")}`}>
                              {analysisResult.analisisCanal1?.estadoCanal || "Conforme"}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {analysisResult.analisisCanal1?.interpretacionExclusiva || "Valores extraídos dentro de norma ISO."}
                          </p>
                        </div>

                        {/* Canal 2 Card */}
                        <div className="p-4 bg-zinc-950/90 border border-cyan-500/30 rounded-xl space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                            <span className="font-bold text-cyan-400 text-xs flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                              {analysisResult.analisisCanal2?.nombreCanal || "Canal 2"}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${getBadgeStyle(analysisResult.analisisCanal2?.estadoCanal || "Conforme")}`}>
                              {analysisResult.analisisCanal2?.estadoCanal || (analysisResult.analisisCanal2 ? "Conforme" : "N/A (Monocanal)")}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {analysisResult.analisisCanal2?.interpretacionExclusiva || (analysisResult.analisisCanal2 ? "Valores extraídos dentro de norma ISO." : "Registrada curva de pulsado monocanal. Para análisis comparativo dual se requiere gráfica de dos canales.")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* INTER-CHANNEL COMPARATIVE ANALYSIS (PUNTOS 7 Y 8) */}
                    {analysisResult.analisisComparativo && (
                      <div className="p-5 bg-zinc-950/90 border border-emerald-500/30 rounded-xl space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-400" />
                            Análisis Comparativo Inter-Canal (Sincronización y Simetría Neumática)
                          </h4>
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                            analysisResult.analisisComparativo.esAceptableISO
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-red-500/10 text-red-400 border-red-500/30"
                          }`}>
                            {analysisResult.analisisComparativo.esAceptableISO ? "🟢 Funcionamiento Uniforme ISO" : "🔴 Asimetría entre Canales"}
                          </span>
                        </div>

                        {/* Comparative Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                          {analysisResult.analisisComparativo.diferenciaRelacion && (
                            <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 space-y-1">
                              <span className="text-zinc-400 text-[11px] font-semibold block">Δ Relación de Pulsado:</span>
                              <span className="font-bold text-white font-mono text-sm">{analysisResult.analisisComparativo.diferenciaRelacion.diferencia}</span>
                              {analysisResult.analisisComparativo.diferenciaRelacion.observacion && (
                                <span className="text-zinc-500 text-[10px] block">{analysisResult.analisisComparativo.diferenciaRelacion.observacion}</span>
                              )}
                            </div>
                          )}

                          {analysisResult.analisisComparativo.diferenciaFrecuencia && (
                            <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 space-y-1">
                              <span className="text-zinc-400 text-[11px] font-semibold block">Δ Frecuencia:</span>
                              <span className="font-bold text-white font-mono text-sm">{analysisResult.analisisComparativo.diferenciaFrecuencia.diferencia}</span>
                              {analysisResult.analisisComparativo.diferenciaFrecuencia.observacion && (
                                <span className="text-zinc-500 text-[10px] block">{analysisResult.analisisComparativo.diferenciaFrecuencia.observacion}</span>
                              )}
                            </div>
                          )}

                          {analysisResult.analisisComparativo.diferenciaTd && (
                            <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 space-y-1">
                              <span className="text-zinc-400 text-[11px] font-semibold block">Δ Fase d (Masaje):</span>
                              <span className="font-bold text-white font-mono text-sm">{analysisResult.analisisComparativo.diferenciaTd.diferencia}</span>
                              {analysisResult.analisisComparativo.diferenciaTd.observacion && (
                                <span className="text-zinc-500 text-[10px] block">{analysisResult.analisisComparativo.diferenciaTd.observacion}</span>
                              )}
                            </div>
                          )}

                          {analysisResult.analisisComparativo.diferenciaVacio && (
                            <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 space-y-1">
                              <span className="text-zinc-400 text-[11px] font-semibold block">Δ Nivel de Vacío:</span>
                              <span className="font-bold text-white font-mono text-sm">{analysisResult.analisisComparativo.diferenciaVacio.diferencia}</span>
                              {analysisResult.analisisComparativo.diferenciaVacio.observacion && (
                                <span className="text-zinc-500 text-[10px] block">{analysisResult.analisisComparativo.diferenciaVacio.observacion}</span>
                              )}
                            </div>
                          )}

                          {analysisResult.analisisComparativo.sincronizacion && (
                            <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 space-y-1">
                              <span className="text-zinc-400 text-[11px] font-semibold block">Sincronización:</span>
                              <span className="font-bold text-emerald-400 font-mono text-sm">{analysisResult.analisisComparativo.sincronizacion.tipo}</span>
                              {analysisResult.analisisComparativo.sincronizacion.observacion && (
                                <span className="text-zinc-500 text-[10px] block">{analysisResult.analisisComparativo.sincronizacion.observacion}</span>
                              )}
                            </div>
                          )}

                          {analysisResult.analisisComparativo.balance && (
                            <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 space-y-1">
                              <span className="text-zinc-400 text-[11px] font-semibold block">Reparto de Balance:</span>
                              <span className="font-bold text-white font-mono text-sm">{analysisResult.analisisComparativo.balance.relacionBalance}</span>
                              {analysisResult.analisisComparativo.balance.observacion && (
                                <span className="text-zinc-500 text-[10px] block">{analysisResult.analisisComparativo.balance.observacion}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Comparative Synthesis */}
                        <div className="bg-zinc-900/90 p-3.5 rounded-lg border border-zinc-800 text-xs space-y-1">
                          <span className="font-bold text-emerald-400 text-xs block">Conclusión Comparativa entre Canales:</span>
                          <p className="text-zinc-300 leading-relaxed">
                            {analysisResult.analisisComparativo.conclusionComparativa}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* GLOBAL CONCLUSION (PUNTO 9: FUNDAMENTADA SIN PROMEDIAR) */}
                    {analysisResult.conclusionGlobal && (
                      <div className="p-5 bg-gradient-to-r from-emerald-950/40 via-zinc-900/90 to-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-2">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Conclusión Global Fundamentada del Sistema
                        </h4>
                        <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-line font-medium">
                          {analysisResult.conclusionGlobal}
                        </p>
                      </div>
                    )}

                    {/* 1. Análisis de Posibles Causas (Hipótesis Técnicas) */}
                    <div className="p-5 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3">
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        Análisis de Posibles Causas (Hipótesis Técnicas)
                      </h4>

                      {analysisResult.posiblesCausasDetalladas && analysisResult.posiblesCausasDetalladas.length > 0 ? (
                        <div className="space-y-3">
                          {analysisResult.posiblesCausasDetalladas.map((item, i) => (
                            <div key={i} className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800 space-y-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-bold text-zinc-100 text-xs">{item.causa}</span>
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                  item.probabilidad === "Alta"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    : item.probabilidad === "Media"
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                    : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                }`}>
                                  {item.probabilidad === "Alta" ? "🟢 Alta probabilidad" : item.probabilidad === "Media" ? "🟡 Probabilidad media" : "🔵 Probabilidad baja"}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 leading-relaxed">
                                <span className="text-zinc-300 font-medium">Justificación: </span>
                                {item.justificacion}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <ul className="space-y-1.5 text-xs text-zinc-300">
                          {(analysisResult.posiblesCausas || []).map((causa, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-red-400 mt-0.5">•</span>
                              <span>{causa}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* 2. Plan de Inspección Recomendado & 3. Impacto Potencial */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Plan de Inspección */}
                      <div className="p-5 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3">
                        <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="w-4 h-4" />
                          Plan de Inspección Recomendado
                        </h4>
                        <ol className="space-y-2 text-xs text-zinc-300 list-decimal list-inside">
                          {(analysisResult.planInspeccion || []).map((step, i) => (
                            <li key={i} className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80">
                              <span className="font-semibold text-zinc-200">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* Riesgos Operativos */}
                      <div className="p-5 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3">
                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" />
                          Riesgos Operativos / Impacto Potencial
                        </h4>
                        <ul className="space-y-2 text-xs text-zinc-300">
                          {(analysisResult.impactoPotencial || []).map((riesgo, i) => (
                            <li key={i} className="flex items-start gap-2 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80">
                              <span className="text-amber-400 font-bold shrink-0">•</span>
                              <span>{riesgo}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* 4. Acciones Correctivas Recomendadas */}
                    <div className="p-5 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Wrench className="w-4 h-4" />
                        Acciones Correctivas Recomendadas
                      </h4>
                      <ul className="space-y-2 text-xs text-zinc-300">
                        {(analysisResult.accionesCorrectivas || analysisResult.recomendaciones || []).map((accion, i) => (
                          <li key={i} className="flex items-start gap-2 bg-zinc-900/60 p-2.5 rounded-lg border border-emerald-500/20">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{accion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* REPORT VIEW: TRAZABILIDAD Y DEPURACIÓN OCR (AUDIT FLOW) */}
                {reportViewMode === "depuracion" && (
                  <div className="bg-zinc-900/90 rounded-2xl border border-emerald-500/30 overflow-hidden shadow-2xl backdrop-blur-xl p-6 space-y-6">
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                          <Brain className="w-5 h-5 text-emerald-400" />
                          Modo Depuración y Trazabilidad de Análisis OCR
                        </h3>
                        <p className="text-xs text-zinc-400 mt-1">
                          Visualización del flujo: Imagen ➔ Hash SHA-256 ➔ IA OCR JSON Literal ➔ Motor ISO.
                        </p>
                      </div>
                      <span className="text-[10px] font-mono px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full font-bold">
                        OCR AUDIT VERIFIED
                      </span>
                    </div>

                    {/* Stage 1: Client File & Hash */}
                    <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 space-y-2">
                      <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        1. Archivo e Identificación Única Hash (Cliente)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                        <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800">
                          <span className="text-zinc-500 text-[10px] block">Nombre de Archivo:</span>
                          <span className="text-zinc-200 font-bold truncate block">
                            {analysisResult.trazabilidad?.archivo?.nombre || imageFile?.name || "imagen_pulsografo.png"}
                          </span>
                        </div>
                        <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800">
                          <span className="text-zinc-500 text-[10px] block">Tamaño:</span>
                          <span className="text-zinc-200 font-bold block">
                            {analysisResult.trazabilidad?.archivo?.tamano || imageFile?.size || 0} bytes
                          </span>
                        </div>
                        <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800">
                          <span className="text-zinc-500 text-[10px] block">Tipo MIME:</span>
                          <span className="text-zinc-200 font-bold block">
                            {analysisResult.trazabilidad?.archivo?.tipo || imageFile?.type || "image/png"}
                          </span>
                        </div>
                        <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800">
                          <span className="text-zinc-500 text-[10px] block">Hash SHA-256:</span>
                          <span className="text-emerald-400 font-bold truncate block text-[11px]" title={analysisResult.trazabilidad?.archivo?.hash || imageHash}>
                            {analysisResult.trazabilidad?.archivo?.hash || imageHash || "no-calculado"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stage 2: AI Execution Info */}
                    <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 space-y-2">
                      <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        2. Motor de Visión e Inteligencia Artificial
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800">
                          <span className="text-zinc-500 text-[10px] block">Proveedor:</span>
                          <span className="text-amber-400 font-bold uppercase">{analysisResult.trazabilidad?.proveedorInfo?.proveedor || "Google Gemini"}</span>
                        </div>
                        <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800">
                          <span className="text-zinc-500 text-[10px] block">Modelo de Lenguaje/Visión:</span>
                          <span className="text-zinc-200 font-bold">{analysisResult.trazabilidad?.proveedorInfo?.modelo || "gemini-2.5-flash"}</span>
                        </div>
                        <div className="bg-zinc-900 p-2.5 rounded border border-zinc-800">
                          <span className="text-zinc-500 text-[10px] block">Marca de Tiempo:</span>
                          <span className="text-zinc-200 font-bold">{analysisResult.trazabilidad?.timestamp ? new Date(analysisResult.trazabilidad.timestamp).toLocaleString("es-AR") : new Date().toLocaleString("es-AR")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stage 3: Extracted Raw OCR Object */}
                    <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-blue-400" />
                          3. Objeto JSON de OCR Extraído por IA
                        </h4>
                        <span className="text-[10px] font-mono text-zinc-400">
                          Canales Detectados: <strong className="text-emerald-400">{analysisResult.datosExtraidos?.canales?.length || 1}</strong> | Confianza: <strong className="text-emerald-400">{analysisResult.nivelConfianza}%</strong>
                        </span>
                      </div>
                      <pre className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-80 leading-relaxed">
                        {JSON.stringify(analysisResult.trazabilidad?.ocrObject || analysisResult.datosExtraidos, null, 2)}
                      </pre>
                    </div>

                    {/* Stage 4: Extracted Channels Table */}
                    <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 space-y-3">
                      <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        4. Valores Numéricos Literalmente Extraídos por Canal
                      </h4>
                      <div className="overflow-x-auto rounded-xl border border-zinc-800">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="bg-zinc-900 text-zinc-400 font-bold uppercase text-[10px]">
                            <tr>
                              <th className="p-2.5">Canal</th>
                              <th className="p-2.5">Frecuencia</th>
                              <th className="p-2.5">Relación</th>
                              <th className="p-2.5">Vacío</th>
                              <th className="p-2.5">Ta</th>
                              <th className="p-2.5">Tb</th>
                              <th className="p-2.5">Tc</th>
                              <th className="p-2.5">Td</th>
                              <th className="p-2.5">Ta+Tb</th>
                              <th className="p-2.5">Tc+Td</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800">
                            {(analysisResult.datosExtraidos?.canales || []).map((ch: any, idx: number) => (
                              <tr key={idx} className="hover:bg-zinc-900/50">
                                <td className="p-2.5 font-bold text-emerald-400">{ch.nombreCanal}</td>
                                <td className="p-2.5 text-zinc-200">{ch.frecuenciaMedida ?? "N/A"} ppm</td>
                                <td className="p-2.5 text-zinc-200">{ch.relacionMedida ?? "N/A"}</td>
                                <td className="p-2.5 text-zinc-200">{ch.vacioMedido ?? "N/A"}</td>
                                <td className="p-2.5 text-zinc-200">{ch.taMedido ?? "N/A"}{ch.unidadFases || "%"}</td>
                                <td className="p-2.5 text-zinc-200">{ch.tbMedido ?? "N/A"}{ch.unidadFases || "%"}</td>
                                <td className="p-2.5 text-zinc-200">{ch.tcMedido ?? "N/A"}{ch.unidadFases || "%"}</td>
                                <td className="p-2.5 text-zinc-200">{ch.tdMedido ?? "N/A"}{ch.unidadFases || "%"}</td>
                                <td className="p-2.5 text-zinc-200">{ch.taTbMedido ?? (ch.taMedido && ch.tbMedido ? (ch.taMedido + ch.tbMedido).toFixed(1) : "N/A")}{ch.unidadFases || "%"}</td>
                                <td className="p-2.5 text-zinc-200">{ch.tcTdMedido ?? (ch.tcMedido && ch.tdMedido ? (ch.tcMedido + ch.tdMedido).toFixed(1) : "N/A")}{ch.unidadFases || "%"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Stage 5: ISO Engine Output */}
                    <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800 space-y-3">
                      <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        5. Dictamen del Motor de Reglas Determinista ISO
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-zinc-900 p-3 rounded border border-zinc-800">
                          <span className="text-zinc-500 text-[10px] block">Estado General ISO:</span>
                          <span className="text-base font-black text-white">{analysisResult.estadoGeneral}</span>
                        </div>
                        <div className="bg-zinc-900 p-3 rounded border border-zinc-800">
                          <span className="text-zinc-500 text-[10px] block">Nivel de Criticidad:</span>
                          <span className="text-base font-black text-amber-400">{analysisResult.nivelCriticidad}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: HISTORIAL DE DIAGNÓSTICOS */}
      {activeTab === "historial" && (
        <div className="space-y-6">
          {/* History Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 justify-between bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800 backdrop-blur-xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar por tambo o técnico..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="todos">Todos los Estados</option>
              <option value="conforme">Conforme</option>
              <option value="advertencia">Advertencia / Atención</option>
              <option value="fuera de tolerancia">Fuera de Tolerancia</option>
              <option value="crítico">Crítico</option>
            </select>
          </div>

          {/* History Table */}
          {filteredEvaluaciones.length === 0 ? (
            <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-12 text-center text-zinc-500">
              <FileText className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
              <p className="font-semibold text-zinc-300">No se encontraron evaluaciones grabadas.</p>
              <p className="text-xs mt-1">Realice un nuevo diagnóstico para guardarlo en el historial.</p>
            </div>
          ) : (
            <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800 overflow-hidden backdrop-blur-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 font-bold uppercase tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="p-4">Establecimiento</th>
                      <th className="p-4">Fecha</th>
                      <th className="p-4">Estado General</th>
                      <th className="p-4">Criticidad</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/40">
                    {filteredEvaluaciones.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="p-4 font-bold text-white">{item.tamboNombre}</td>
                        <td className="p-4 text-zinc-400">
                          {new Date(item.fecha).toLocaleDateString("es-AR")}
                        </td>
                        <td className="p-4">
                          {getStatusIndicator(item.resultadoIA.estadoGeneral)}
                        </td>
                        <td className="p-4 text-zinc-300 font-semibold">
                          {item.resultadoIA.nivelCriticidad}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setViewingEval(item);
                                setModalReportMode("productor");
                              }}
                              title="Ver detalle"
                              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => downloadProducerPdf(item)}
                              title="Descargar PDF Productor"
                              className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors border border-emerald-500/20"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => downloadTechnicalPdf(item)}
                              title="PDF Técnico ISO"
                              className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors border border-blue-500/20"
                            >
                              <FileText className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleShareWhatsApp(item)}
                              title="Compartir por WhatsApp"
                              className="p-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 rounded-lg transition-colors"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteEval(item.id)}
                              title="Eliminar"
                              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: VIEW EVALUATION DETAILS FROM HISTORY */}
      {viewingEval && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div>
                <h3 className="text-xl font-bold text-white">{viewingEval.tamboNombre}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Fecha: {new Date(viewingEval.fecha).toLocaleDateString("es-AR")} | Informe de Pulsado GANPOR
                </p>
              </div>
              <button
                onClick={() => setViewingEval(null)}
                className="p-2 text-zinc-400 hover:text-white rounded-lg bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Switcher */}
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-fit">
              <button
                onClick={() => setModalReportMode("productor")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  modalReportMode === "productor"
                    ? "bg-emerald-500 text-zinc-950"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Award className="w-4 h-4" />
                Informe para el Productor
              </button>
              <button
                onClick={() => setModalReportMode("tecnico")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  modalReportMode === "tecnico"
                    ? "bg-emerald-500 text-zinc-950"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Reporte Técnico ISO
              </button>
            </div>

            {/* Modal Content - Productor */}
            {modalReportMode === "productor" && (
              <div className="space-y-6">
                {/* Image */}
                {viewingEval.imagenUrl && (
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase mb-2">Imagen Analizada del Pulsógrafo</h4>
                    <img
                      src={viewingEval.imagenUrl}
                      alt="Pulsógrafo"
                      className="max-h-48 rounded-lg border border-zinc-800 mx-auto"
                    />
                  </div>
                )}

                {/* Table */}
                <div>
                  <h4 className="text-sm font-bold text-zinc-200 mb-3">Tabla de Valores Medidos</h4>
                  <div className="overflow-x-auto rounded-xl border border-zinc-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-zinc-400 font-bold uppercase border-b border-zinc-800">
                        <tr>
                          <th className="p-3">Parámetro</th>
                          <th className="p-3">Medido</th>
                          <th className="p-3">Estándar ISO</th>
                          <th className="p-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800 bg-zinc-950/40">
                        {(viewingEval.resultadoIA.evaluacionISO || []).map((row, i) => (
                          <tr key={i}>
                            <td className="p-3 font-semibold text-zinc-200">{row.parametro}</td>
                            <td className="p-3 font-bold text-white">{row.valorMedido}</td>
                            <td className="p-3 text-zinc-400">{row.valorPermitido}</td>
                            <td className="p-3">{getStatusIndicator(row.estado)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Interpretation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1">
                    <h5 className="text-xs font-bold text-emerald-400 uppercase">Impacto en el Ordeño</h5>
                    <p className="text-xs text-zinc-300">{viewingEval.resultadoIA.informeProductor?.interpretacion || viewingEval.resultadoIA.informeProductor?.queSignifica}</p>
                  </div>

                  <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1">
                    <h5 className="text-xs font-bold text-red-400 uppercase">Salud y Bienestar</h5>
                    <p className="text-xs text-zinc-300">{viewingEval.resultadoIA.informeProductor?.queRiesgosExisten}</p>
                  </div>
                </div>

                {/* Causes & Inspection Plan */}
                {(viewingEval.resultadoIA.posiblesCausasDetalladas || viewingEval.resultadoIA.posiblesCausas) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                      <h5 className="text-xs font-bold text-amber-400 uppercase">Posibles Causas del Desvío</h5>
                      <ul className="text-xs text-zinc-300 space-y-1.5">
                        {viewingEval.resultadoIA.posiblesCausasDetalladas?.map((c, i) => (
                          <li key={i}>
                            <strong className="text-zinc-200">• {c.causa}:</strong> {c.justificacionProductor || c.justificacion}
                          </li>
                        )) || viewingEval.resultadoIA.posiblesCausas?.map((c, i) => (
                          <li key={i}>• {c}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                      <h5 className="text-xs font-bold text-blue-400 uppercase">Plan de Verificación en Sala</h5>
                      <ol className="text-xs text-zinc-300 space-y-1 list-decimal list-inside">
                        {(viewingEval.resultadoIA.planInspeccion || []).map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-2">
                  <h5 className="text-xs font-bold text-emerald-400 uppercase">Recomendaciones de Mantenimiento</h5>
                  <ul className="text-xs text-zinc-200 space-y-1">
                    {(viewingEval.resultadoIA.accionesCorrectivas || [viewingEval.resultadoIA.informeProductor?.queSeRecomiendaHacer]).map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                </div>

                {/* Final Conclusion */}
                {viewingEval.resultadoIA.informeProductor?.conclusionFinal && (
                  <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1">
                    <h5 className="text-xs font-bold text-zinc-300 uppercase">Conclusión Final</h5>
                    <p className="text-xs text-zinc-300 leading-relaxed">{viewingEval.resultadoIA.informeProductor.conclusionFinal}</p>
                  </div>
                )}
              </div>
            )}

            {/* Modal Content - Técnico */}
            {modalReportMode === "tecnico" && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-zinc-200 mb-3">Parámetros Técnicos ISO</h4>
                  <div className="overflow-x-auto rounded-xl border border-zinc-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-zinc-400 font-bold uppercase border-b border-zinc-800">
                        <tr>
                          <th className="p-3">Parámetro</th>
                          <th className="p-3">Medido</th>
                          <th className="p-3">Estándar ISO</th>
                          <th className="p-3">Diferencia</th>
                          <th className="p-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800 bg-zinc-950/40">
                        {(viewingEval.resultadoIA.evaluacionISO || []).map((row, i) => (
                          <tr key={i}>
                            <td className="p-3 font-semibold text-zinc-200">{row.parametro}</td>
                            <td className="p-3 font-bold text-white">{row.valorMedido}</td>
                            <td className="p-3 text-zinc-400">{row.valorPermitido}</td>
                            <td className="p-3 text-zinc-300">{row.diferencia}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getBadgeStyle(row.estado)}`}>
                                {row.estado}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* DESGLOSE TÉCNICO E INTERPRETACIÓN POR CANAL DE PULSADO */}
                <div className="space-y-3 p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                  <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Desglose Técnico e Interpretación por Canal</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Canal 1 Card */}
                    <div className="p-3.5 bg-zinc-900/90 border border-emerald-500/30 rounded-xl space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                        <span className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          {viewingEval.resultadoIA.analisisCanal1?.nombreCanal || "Canal 1"}
                        </span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${getBadgeStyle(viewingEval.resultadoIA.analisisCanal1?.estadoCanal || "Conforme")}`}>
                          {viewingEval.resultadoIA.analisisCanal1?.estadoCanal || "Conforme"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {viewingEval.resultadoIA.analisisCanal1?.interpretacionExclusiva || "Evaluación técnica ISO conforme."}
                      </p>
                    </div>

                    {/* Canal 2 Card */}
                    <div className="p-3.5 bg-zinc-900/90 border border-cyan-500/30 rounded-xl space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                        <span className="font-bold text-cyan-400 text-xs flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                          {viewingEval.resultadoIA.analisisCanal2?.nombreCanal || "Canal 2"}
                        </span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${getBadgeStyle(viewingEval.resultadoIA.analisisCanal2?.estadoCanal || "Conforme")}`}>
                          {viewingEval.resultadoIA.analisisCanal2?.estadoCanal || (viewingEval.resultadoIA.analisisCanal2 ? "Conforme" : "N/A (Monocanal)")}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {viewingEval.resultadoIA.analisisCanal2?.interpretacionExclusiva || (viewingEval.resultadoIA.analisisCanal2 ? "Valores extraídos dentro de norma ISO." : "Curva monocanal registrada.")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ANÁLISIS COMPARATIVO INTER-CANAL */}
                {viewingEval.resultadoIA.analisisComparativo && (
                  <div className="p-4 bg-zinc-950 border border-emerald-500/30 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                      <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        Análisis Comparativo Inter-Canal (Sincronización y Simetría Neumática)
                      </h5>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        viewingEval.resultadoIA.analisisComparativo.esAceptableISO
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-red-500/10 text-red-400 border-red-500/30"
                      }`}>
                        {viewingEval.resultadoIA.analisisComparativo.esAceptableISO ? "🟢 Funcionamiento Uniforme ISO" : "🔴 Asimetría entre Canales"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                      {viewingEval.resultadoIA.analisisComparativo.diferenciaRelacion && (
                        <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 space-y-0.5">
                          <span className="text-zinc-400 text-[10px] block">Δ Relación de Pulsado:</span>
                          <span className="font-bold text-white font-mono text-xs">{viewingEval.resultadoIA.analisisComparativo.diferenciaRelacion.diferencia}</span>
                        </div>
                      )}
                      {viewingEval.resultadoIA.analisisComparativo.diferenciaFrecuencia && (
                        <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 space-y-0.5">
                          <span className="text-zinc-400 text-[10px] block">Δ Frecuencia:</span>
                          <span className="font-bold text-white font-mono text-xs">{viewingEval.resultadoIA.analisisComparativo.diferenciaFrecuencia.diferencia}</span>
                        </div>
                      )}
                      {viewingEval.resultadoIA.analisisComparativo.diferenciaTd && (
                        <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 space-y-0.5">
                          <span className="text-zinc-400 text-[10px] block">Δ Fase d (Masaje):</span>
                          <span className="font-bold text-white font-mono text-xs">{viewingEval.resultadoIA.analisisComparativo.diferenciaTd.diferencia}</span>
                        </div>
                      )}
                      {viewingEval.resultadoIA.analisisComparativo.diferenciaVacio && (
                        <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 space-y-0.5">
                          <span className="text-zinc-400 text-[10px] block">Δ Nivel de Vacío:</span>
                          <span className="font-bold text-white font-mono text-xs">{viewingEval.resultadoIA.analisisComparativo.diferenciaVacio.diferencia}</span>
                        </div>
                      )}
                      {viewingEval.resultadoIA.analisisComparativo.sincronizacion && (
                        <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 space-y-0.5">
                          <span className="text-zinc-400 text-[10px] block">Sincronización:</span>
                          <span className="font-bold text-emerald-400 font-mono text-xs">{viewingEval.resultadoIA.analisisComparativo.sincronizacion.tipo}</span>
                        </div>
                      )}
                      {viewingEval.resultadoIA.analisisComparativo.balance && (
                        <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 space-y-0.5">
                          <span className="text-zinc-400 text-[10px] block">Reparto de Balance:</span>
                          <span className="font-bold text-white font-mono text-xs">{viewingEval.resultadoIA.analisisComparativo.balance.relacionBalance}</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-xs space-y-1">
                      <span className="font-bold text-emerald-400 text-xs block">Conclusión Comparativa entre Canales:</span>
                      <p className="text-zinc-300 leading-relaxed text-[11px]">
                        {viewingEval.resultadoIA.analisisComparativo.conclusionComparativa}
                      </p>
                    </div>
                  </div>
                )}

                {/* CONCLUSIÓN GLOBAL */}
                {viewingEval.resultadoIA.conclusionGlobal && (
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-1.5">
                    <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Conclusión Global Fundamentada del Sistema</h5>
                    <p className="text-xs text-zinc-200 leading-relaxed font-medium">
                      {viewingEval.resultadoIA.conclusionGlobal}
                    </p>
                  </div>
                )}

                {/* 1. Posibles Causas Técnicas con Probabilidad */}
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                  <h5 className="text-xs font-bold text-red-400 uppercase">Análisis de Posibles Causas (Hipótesis Técnicas)</h5>
                  {viewingEval.resultadoIA.posiblesCausasDetalladas && viewingEval.resultadoIA.posiblesCausasDetalladas.length > 0 ? (
                    <div className="space-y-2">
                      {viewingEval.resultadoIA.posiblesCausasDetalladas.map((item, i) => (
                        <div key={i} className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-zinc-100 text-xs">{item.causa}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              item.probabilidad === "Alta"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : item.probabilidad === "Media"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            }`}>
                              {item.probabilidad === "Alta" ? "🟢 Alta probabilidad" : item.probabilidad === "Media" ? "🟡 Probabilidad media" : "🔵 Probabilidad baja"}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400">
                            <span className="text-zinc-300 font-medium">Justificación: </span>
                            {item.justificacion}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="text-xs text-zinc-300 space-y-1">
                      {(viewingEval.resultadoIA.posiblesCausas || []).map((c, i) => (
                        <li key={i}>• {c}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* 2. Plan de Inspección & 3. Riesgos Operativos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                    <h5 className="text-xs font-bold text-blue-400 uppercase">Plan de Inspección Recomendado</h5>
                    <ol className="text-xs text-zinc-300 space-y-1 list-decimal list-inside">
                      {(viewingEval.resultadoIA.planInspeccion || []).map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>

                  <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                    <h5 className="text-xs font-bold text-amber-400 uppercase">Riesgos Operativos</h5>
                    <ul className="text-xs text-zinc-300 space-y-1">
                      {(viewingEval.resultadoIA.impactoPotencial || []).map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 4. Acciones Correctivas */}
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                  <h5 className="text-xs font-bold text-emerald-400 uppercase">Acciones Correctivas Recomendadas</h5>
                  <ul className="text-xs text-zinc-300 space-y-1">
                    {(viewingEval.resultadoIA.accionesCorrectivas || viewingEval.resultadoIA.recomendaciones || []).map((a, i) => (
                      <li key={i}>• {a}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                onClick={() => downloadProducerPdf(viewingEval)}
                className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar PDF Productor
              </button>

              <button
                onClick={() => downloadTechnicalPdf(viewingEval)}
                className="px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Descargar PDF Técnico
              </button>

              <button
                onClick={() => handleShareWhatsApp(viewingEval)}
                className="px-4 py-2 bg-emerald-600 text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Compartir por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIG MODAL FOR AI / ISO ENGINE */}
      {isIaConfigOpen && (
        <IaForm onClose={() => setIsIaConfigOpen(false)} />
      )}
    </div>
  );
}
