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
  FileSpreadsheet
} from "lucide-react";
import { db, getActiveCompanyId } from "../services/db";
import { useAuth } from "../services/AuthContext";
import { aiDiagnosisStorage } from "../utils/aiDiagnosisStorage";
import { EvaluacionDiagnosis, ResultadoIA } from "../types/aiDiagnosis";
import { Tambo } from "../types/supabase";
import { AIService } from "../services/aiService";
import { downloadTechnicalPdf, downloadProducerPdf } from "../utils/pdfGenerator";
import IaForm from "../components/IaForm";

export default function AiDiagnosisPage() {
  const { profile, user: authUser } = useAuth();
  
  // Navigation Tabs: Only 2 tabs
  const [activeTab, setActiveTab] = useState<"nueva" | "historial">("nueva");

  // General state
  const [tambos, setTambos] = useState<Tambo[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionDiagnosis[]>([]);
  const [loadingTambos, setLoadingTambos] = useState(true);

  // Form States - Nueva Evaluación (Simplified to strictly required fields)
  const [selectedTamboId, setSelectedTamboId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  // Load initial data
  useEffect(() => {
    async function loadData() {
      setLoadingTambos(true);
      try {
        const companyId = getActiveCompanyId();
        let tambosList: Tambo[] = [];
        if (companyId) {
          tambosList = await db.tambos.getAll(companyId);
        } else {
          tambosList = await db.tambos.getAll();
        }
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

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Por favor cargue una imagen válida (PNG, JPG, WEBP).");
      return;
    }
    setImageFile(file);
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

      const res = await AIService.runDiagnosis({
        image: imagePreview,
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

    const msg = `🏥 *DIAGNÓSTICO TÉCNICO DE PULSADO - NORMA ISO 5707 / 6690*
📍 *Tambo:* ${tamboName}
📅 *Fecha:* ${dateStr}
📊 *Estado General:* ${res.estadoGeneral.toUpperCase()}

📝 *¿Qué significa este resultado?*
${inf?.queSignifica || res.diagnosticoTecnico}

🚨 *Riesgos identificados:*
${inf?.queRiesgosExisten || "Revisar la tabla de evaluación ISO."}

💡 *Acciones Recomendadas:*
${inf?.queSeRecomiendaHacer || (res.accionesCorrectivas || res.recomendaciones || []).join("\n• ")}

_Generado por GANPOR - Motor de Reglas ISO_`;

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
      item.resultadoIA.estadoGeneral.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Helper badge color
  const getBadgeStyle = (estado: string) => {
    switch (estado) {
      case "Conforme":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Advertencia":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Fuera de tolerancia":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "Crítico":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    }
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case "Conforme":
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case "Advertencia":
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case "Fuera de tolerancia":
        return <AlertCircle className="w-5 h-5 text-orange-400" />;
      case "Crítico":
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Info className="w-5 h-5 text-zinc-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Diagnóstico de Pulsado ISO
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase tracking-wider">
                  ISO 5707 / 6690
                </span>
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Evaluación técnica estricta basada exclusivamente en normas internacionales ISO, sin sesgo de marcas o modelos.
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

      {/* Navigation Tabs - STRICTLY 2 TABS */}
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
          {/* Left Column: Form (Strictly simplified) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800 backdrop-blur-xl">
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
                          Admite fotos de gráficos de pulsógrafo, pantallas LCD o informes impresos
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
                    placeholder="Detalles sobre temperatura, bajada o estado físico del equipo..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>

                {/* Analyze Button */}
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !selectedTamboId || !imagePreview}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-zinc-950 font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-base"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>{analysisStep}</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-5 h-5" />
                      <span>Analizar con Motor ISO</span>
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

            {/* Standard Reference Info Box */}
            <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/60 text-xs text-zinc-400 space-y-2">
              <h3 className="font-bold text-zinc-200 flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400" />
                Criterio Normativo ISO
              </h3>
              <p>
                Este módulo evalúa la frecuencia (60 ppm +/- 3 ppm), relación de pulsado (+/- 5%), fases de pulso (ta, tb, tc, td) y nivel de vacío (40-50 kPa) exclusivamente contra las normas <strong>ISO 5707:2007</strong> y <strong>ISO 6690:2007</strong>.
              </p>
            </div>
          </div>

          {/* Right Column: Results Display */}
          <div className="lg:col-span-7 space-y-6">
            {!analysisResult && !isAnalyzing && (
              <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                <div className="p-4 bg-zinc-800/50 rounded-2xl mb-4 text-zinc-500">
                  <FileSpreadsheet className="w-12 h-12" />
                </div>
                <h3 className="text-lg font-bold text-zinc-300 mb-1">
                  Esperando Análisis de Pulsógrafo
                </h3>
                <p className="text-sm text-zinc-500 max-w-md">
                  Cargue la imagen del reporte y presione "Analizar con Motor ISO" para obtener la tabla completa de parámetros, diagnóstico técnico y recomendaciones.
                </p>
              </div>
            )}

            {isAnalyzing && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                  <Brain className="w-8 h-8 text-emerald-400 absolute inset-0 m-auto" />
                </div>
                <h3 className="text-lg font-bold text-white">{analysisStep}</h3>
                <p className="text-xs text-zinc-400 max-w-sm">
                  Evaluando parámetros contra tolerancias estrictas ISO 5707 / ISO 6690...
                </p>
              </div>
            )}

            {analysisResult && currentEval && (
              <div className="space-y-6 animate-fadeIn">
                {/* Status Summary Banner */}
                <div className="bg-zinc-900/80 p-6 rounded-2xl border border-zinc-800 backdrop-blur-xl">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(analysisResult.estadoGeneral)}
                      <div>
                        <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
                          Dictamen General ISO
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

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => downloadTechnicalPdf(currentEval)}
                        className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <Download className="w-4 h-4" />
                        Descargar PDF Técnico
                      </button>

                      <button
                        onClick={() => downloadProducerPdf(currentEval)}
                        className="px-3.5 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <FileText className="w-4 h-4" />
                        Informe Productor
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

                  {/* ISO Parameters Table */}
                  <div className="mt-6">
                    <h3 className="text-sm font-bold text-zinc-200 mb-3 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      Tabla de Evaluación de Parámetros ISO
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
                            <tr key={idx} className="hover:bg-zinc-800/30 transition-colors">
                              <td className="p-3 font-semibold text-zinc-200">{item.parametro}</td>
                              <td className="p-3 font-bold text-white">{item.valorMedido}</td>
                              <td className="p-3 text-zinc-400">{item.valorPermitido}</td>
                              <td className="p-3 text-zinc-300 font-mono">{item.diferencia}</td>
                              <td className="p-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getBadgeStyle(item.estado)}`}>
                                  {item.estado}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Posibles Causas & Acciones Correctivas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {/* Posibles Causas */}
                    <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-2">
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        Posibles Causas
                      </h4>
                      <ul className="space-y-1.5 text-xs text-zinc-300">
                        {(analysisResult.posiblesCausas || []).map((causa, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-red-400 mt-0.5">•</span>
                            <span>{causa}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Acciones Correctivas */}
                    <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-2">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Wrench className="w-4 h-4" />
                        Acciones Correctivas
                      </h4>
                      <ul className="space-y-1.5 text-xs text-zinc-300">
                        {(analysisResult.accionesCorrectivas || analysisResult.recomendaciones || []).map((accion, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span>{accion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Non-technical Producer Summary Card */}
                  {analysisResult.informeProductor && (
                    <div className="mt-6 p-5 bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-3">
                      <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Informe Simplificado para el Productor
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
                          <span className="font-bold text-zinc-200 block mb-1">¿Qué significa?</span>
                          <p className="text-zinc-400 leading-relaxed">{analysisResult.informeProductor.queSignifica}</p>
                        </div>

                        <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
                          <span className="font-bold text-red-300 block mb-1">¿Qué riesgos existen?</span>
                          <p className="text-zinc-400 leading-relaxed">{analysisResult.informeProductor.queRiesgosExisten}</p>
                        </div>

                        <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
                          <span className="font-bold text-blue-300 block mb-1">¿Qué se recomienda hacer?</span>
                          <p className="text-zinc-400 leading-relaxed">{analysisResult.informeProductor.queSeRecomiendaHacer}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
              <option value="advertencia">Advertencia</option>
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
                          <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold border ${getBadgeStyle(item.resultadoIA.estadoGeneral)}`}>
                            {item.resultadoIA.estadoGeneral}
                          </span>
                        </td>
                        <td className="p-4 text-zinc-300 font-semibold">
                          {item.resultadoIA.nivelCriticidad}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setViewingEval(item)}
                              title="Ver detalle"
                              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => downloadTechnicalPdf(item)}
                              title="Descargar PDF Técnico"
                              className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors border border-emerald-500/20"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => downloadProducerPdf(item)}
                              title="Informe Simplificado Productor"
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div>
                <h3 className="text-xl font-bold text-white">{viewingEval.tamboNombre}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Fecha: {new Date(viewingEval.fecha).toLocaleDateString("es-AR")} | Evaluación ISO 5707 / 6690
                </p>
              </div>
              <button
                onClick={() => setViewingEval(null)}
                className="p-2 text-zinc-400 hover:text-white rounded-lg bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ISO Parameters Table */}
            <div>
              <h4 className="text-sm font-bold text-zinc-200 mb-3">Parámetros Evaluados</h4>
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

            {/* Causes & Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-2">
                <h5 className="text-xs font-bold text-red-400 uppercase">Posibles Causas</h5>
                <ul className="text-xs text-zinc-300 space-y-1">
                  {(viewingEval.resultadoIA.posiblesCausas || []).map((c, i) => (
                    <li key={i}>• {c}</li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-2">
                <h5 className="text-xs font-bold text-emerald-400 uppercase">Acciones Correctivas</h5>
                <ul className="text-xs text-zinc-300 space-y-1">
                  {(viewingEval.resultadoIA.accionesCorrectivas || viewingEval.resultadoIA.recomendaciones || []).map((a, i) => (
                    <li key={i}>• {a}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                onClick={() => downloadTechnicalPdf(viewingEval)}
                className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar PDF Técnico
              </button>

              <button
                onClick={() => downloadProducerPdf(viewingEval)}
                className="px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Informe Productor
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
