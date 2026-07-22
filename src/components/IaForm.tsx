import React, { useState, useEffect } from "react";
import { db } from "../services/db";
import { AIService } from "../services/aiService";
import { 
  Brain, 
  Key, 
  Eye, 
  EyeOff, 
  Save, 
  RefreshCw, 
  Check, 
  Zap, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Play
} from "lucide-react";
import { cn } from "../utils/ui";

export default function IaForm() {
  const [provider, setProvider] = useState<"openai" | "gemini" | "iso">("iso");
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("");
  const [openaiModel, setOpenaiModel] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; modelsCount?: number; lastVerification?: string } | null>(null);

  const [availableModels, setAvailableModels] = useState<{ id: string; displayName: string }[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const activeModel = provider === "gemini" ? geminiModel : provider === "openai" ? openaiModel : "";
  const setActiveModel = (modelId: string) => {
    if (provider === "gemini") {
      setGeminiModel(modelId);
    } else if (provider === "openai") {
      setOpenaiModel(modelId);
    }
  };

  // Fetch available models using central AIService
  const fetchModels = async (prov: "openai" | "gemini" | "iso", key: string, targetModel = "") => {
    if (prov === "iso") {
      setAvailableModels([]);
      setModelsError(null);
      return;
    }
    if (!key) {
      setAvailableModels([]);
      setModelsError(null);
      return;
    }
    setIsLoadingModels(true);
    setModelsError(null);
    try {
      const apiProv = prov === "gemini" ? "gemini" : "openai";
      const result = await AIService.getModels(apiProv, key);

      if (result.success && result.models.length > 0) {
        setAvailableModels(result.models);
        const currentModel = prov === "gemini" ? geminiModel : openaiModel;
        const activeTarget = targetModel || currentModel;
        const matchedModel = result.models.find((m: any) => 
          m.id === activeTarget || 
          m.id === `models/${activeTarget}` || 
          m.id.replace("models/", "") === activeTarget.replace("models/", "")
        );

        if (matchedModel) {
          if (prov === "gemini") setGeminiModel(matchedModel.id);
          else if (prov === "openai") setOpenaiModel(matchedModel.id);
        } else {
          const firstModel = result.models[0].id;
          const firstModelName = result.models[0].displayName || firstModel;
          if (prov === "gemini") setGeminiModel(firstModel);
          else if (prov === "openai") setOpenaiModel(firstModel);

          if (activeTarget && activeTarget !== "iso" && activeTarget !== "ninguno" && activeTarget !== "") {
            alert(`El modelo anteriormente configurado o seleccionado (${activeTarget}) ya no está disponible en la API oficial de ${prov === "gemini" ? "Google Gemini" : "OpenAI"}. Se ha seleccionado automáticamente '${firstModelName}' (${firstModel}). Recuerde presionar "Guardar Configuración" para conservar este cambio.`);
          }
        }
      } else {
        setModelsError(result.error || "Fallo al obtener la lista de modelos de IA de la API.");
      }
    } catch (err: any) {
      console.error("Error fetching models list:", err);
      setModelsError(`Error al conectar para listar modelos: ${err.message}`);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Load configuration on mount
  useEffect(() => {
    async function loadIaSettings() {
      try {
        let p = await db.configuracion.getByKey("proveedor_activo", "");
        if (!p) {
          p = await db.configuracion.getByKey("ia_provider", "");
        }
        if (!p) {
          p = await db.configuracion.getByKey("ia_proveedor", "");
        }

        let resolvedProvider: "openai" | "gemini" | "iso" = "iso";
        if (p === "openai") resolvedProvider = "openai";
        else if (p === "gemini") resolvedProvider = "gemini";
        else resolvedProvider = "iso";

        const [gk, ok, gm, om, legacyM] = await Promise.all([
          db.configuracion.getByKey("ia_gemini_api_key", ""),
          db.configuracion.getByKey("ia_openai_api_key", ""),
          db.configuracion.getByKey("ia_gemini_model", ""),
          db.configuracion.getByKey("ia_openai_model", ""),
          db.configuracion.getByKey("ia_modelo", "")
        ]);

        setProvider(resolvedProvider);
        setGeminiKey(gk);
        setOpenaiKey(ok);

        const loadedGeminiModel = gm || (legacyM && !legacyM.includes("gpt") ? legacyM : "");
        const loadedOpenaiModel = om || (legacyM && legacyM.includes("gpt") ? legacyM : "");

        setGeminiModel(loadedGeminiModel);
        setOpenaiModel(loadedOpenaiModel);

        const activeKey = resolvedProvider === "gemini" ? gk : resolvedProvider === "openai" ? ok : "";
        const activeM = resolvedProvider === "gemini" ? loadedGeminiModel : loadedOpenaiModel;

        if (resolvedProvider !== "iso" && activeKey) {
          await fetchModels(resolvedProvider, activeKey, activeM);
        }
      } catch (err) {
        console.error("Error al cargar configuración de IA:", err);
      }
    }
    loadIaSettings();
  }, []);

  const handleProviderChange = (newProvider: "openai" | "gemini" | "iso") => {
    setProvider(newProvider);
    setTestResult(null);
    setAvailableModels([]);
    setModelsError(null);
    const activeKey = newProvider === "gemini" ? geminiKey : newProvider === "openai" ? openaiKey : "";
    const activeM = newProvider === "gemini" ? geminiModel : newProvider === "openai" ? openaiModel : "";
    if (newProvider !== "iso" && activeKey) {
      fetchModels(newProvider, activeKey, activeM);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTestResult(null);
    try {
      const selectedActiveModel = provider === "gemini" ? geminiModel : provider === "openai" ? openaiModel : "";
      const legacyProv = provider === "iso" ? "ninguno" : provider;

      await Promise.all([
        db.configuracion.setByKey("proveedor_activo", provider, "Proveedor activo de IA/Diagnóstico (openai, gemini, iso)"),
        db.configuracion.setByKey("ia_provider", legacyProv, "Proveedor de Inteligencia Artificial"),
        db.configuracion.setByKey("ia_proveedor", legacyProv, "Proveedor de Inteligencia Artificial (Legacy)"),
        db.configuracion.setByKey("ia_gemini_api_key", geminiKey, "API Key de Google Gemini"),
        db.configuracion.setByKey("ia_openai_api_key", openaiKey, "API Key de OpenAI"),
        db.configuracion.setByKey("ia_gemini_model", geminiModel, "Modelo Seleccionado para Google Gemini"),
        db.configuracion.setByKey("ia_openai_model", openaiModel, "Modelo Seleccionado para OpenAI"),
        db.configuracion.setByKey("ia_modelo", selectedActiveModel, "Modelo de IA Seleccionado Activo")
      ]);
      alert("Configuración de Inteligencia Artificial guardada correctamente.");
    } catch (error) {
      console.error("Error saving AI configuration:", error);
      alert("Error al guardar la configuración de Inteligencia Artificial.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (provider === "iso") return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const activeKey = provider === "gemini" ? geminiKey : openaiKey;
      const activeM = provider === "gemini" ? geminiModel : openaiModel;
      
      const res = await AIService.testConnection(provider, activeKey, activeM);
      setTestResult(res);

      if (res.success && res.models && res.models.length > 0) {
        setAvailableModels(res.models);
      }
    } catch (err: any) {
      console.error("Error testing connection:", err);
      setTestResult({
        success: false,
        message: `Sin conexión. Fallo de red temporal al probar la conexión: ${err.message}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-emerald-400" />
            Inteligencia Artificial
          </h3>
          <p className="text-zinc-500 mt-1">Configure el proveedor activo y las credenciales de diagnóstico técnico para su empresa.</p>
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20 text-sm"
        >
          {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Guardar Configuración
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Selector de Proveedor Activo */}
        <div className="space-y-4">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Proveedor Activo (proveedor_activo)</label>
          <div className="grid grid-cols-1 gap-3">
            {[
              { id: "openai", title: "OpenAI", desc: "Utiliza los modelos GPT de OpenAI para interpretar los gráficos de pulsado y contrastar las especificaciones técnicas." },
              { id: "gemini", title: "Google Gemini", desc: "Utiliza los modelos multimodales de Google AI para analizar las imágenes del pulsógrafo." },
              { id: "iso", title: "Motor ISO (Sin IA)", desc: "Utiliza un motor de análisis estático basado en reglas ISO 5707 e ISO 6690 sin consumir APIs externas." }
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleProviderChange(opt.id as any)}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all relative overflow-hidden group",
                  provider === opt.id 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-white shadow-md shadow-emerald-500/5" 
                    : "bg-black/20 border-white/5 text-zinc-400 hover:border-white/10 hover:bg-white/5"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 transition-all shrink-0",
                    provider === opt.id ? "border-emerald-500" : "border-zinc-700"
                  )}>
                    {provider === opt.id && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-in zoom-in-50" />}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-zinc-100">{opt.title}</p>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{opt.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Credenciales y Configuración de Proveedor */}
        <div className="lg:col-span-2 space-y-6">
          {provider === "iso" ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 min-h-[250px] animate-in fade-in duration-300">
              <div className="w-12 h-12 bg-zinc-800/80 rounded-2xl flex items-center justify-center text-zinc-400">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="max-w-md space-y-2">
                <h4 className="font-bold text-white text-base">Motor de Reglas ISO Activo</h4>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Ha seleccionado el análisis determinista. El sistema interpretará los parámetros y gráficos de pulsado utilizando reglas ISO 5707 / ISO 6690 sin realizar llamadas a servicios ni APIs externas.
                </p>
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs flex items-center gap-2 mt-4 text-left justify-center">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Sin consumo de cuotas ni dependencia de conexión externa.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* API Key del Proveedor Activo */}
              <div className="space-y-4 bg-zinc-900/40 border border-white/5 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                    <Key className="w-4 h-4 text-zinc-400" />
                    API Key de {provider === "gemini" ? "Google Gemini" : "OpenAI"}
                  </label>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                    (provider === "gemini" ? geminiKey : openaiKey)
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-zinc-800 text-zinc-500"
                  )}>
                    {(provider === "gemini" ? geminiKey : openaiKey) ? "✓ Configurada" : "No configurada"}
                  </span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={provider === "gemini" ? (showGeminiKey ? "text" : "password") : (showOpenaiKey ? "text" : "password")}
                      placeholder={`Pegue su API Key de ${provider === "gemini" ? "Gemini" : "OpenAI"} aquí...`}
                      value={provider === "gemini" ? geminiKey : openaiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (provider === "gemini") {
                          setGeminiKey(val);
                        } else {
                          setOpenaiKey(val);
                        }
                        setTestResult(null);
                        if (val) {
                          fetchModels(provider, val);
                        }
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-emerald-500 font-mono text-zinc-100 placeholder:text-zinc-600"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (provider === "gemini") {
                          setShowGeminiKey(!showGeminiKey);
                        } else {
                          setShowOpenaiKey(!showOpenaiKey);
                        }
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      title={provider === "gemini" ? (showGeminiKey ? "Ocultar clave" : "Mostrar clave") : (showOpenaiKey ? "Ocultar clave" : "Mostrar clave")}
                    >
                      {provider === "gemini" ? (
                        showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />
                      ) : (
                        showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (provider === "gemini") {
                        setGeminiKey("");
                      } else {
                        setOpenaiKey("");
                      }
                      setTestResult(null);
                      setAvailableModels([]);
                      setActiveModel("");
                    }}
                    disabled={!(provider === "gemini" ? geminiKey : openaiKey)}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-30 border border-red-500/20 rounded-xl px-4 flex items-center justify-center transition-all"
                    title="Eliminar API Key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Las API Keys se almacenan de forma independiente para cada proveedor en la empresa activa. Si borra la clave y guarda, se eliminará permanentemente.
                </p>
              </div>

              {/* Selector de Modelo del Proveedor Activo */}
              <div className="space-y-4 bg-zinc-900/40 border border-white/5 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                    <Brain className="w-4 h-4 text-zinc-400" />
                    Modelo de {provider === "gemini" ? "Google Gemini" : "OpenAI"}
                  </label>
                  <button
                    type="button"
                    onClick={() => fetchModels(provider, provider === "gemini" ? geminiKey : openaiKey)}
                    disabled={isLoadingModels || !(provider === "gemini" ? geminiKey : openaiKey)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-40 flex items-center gap-1.5 bg-emerald-500/5 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-all"
                  >
                    <RefreshCw className={cn("w-3 h-3", isLoadingModels && "animate-spin")} />
                    Actualizar modelos
                  </button>
                </div>

                {isLoadingModels ? (
                  <div className="flex items-center gap-2 py-3 text-sm text-zinc-500">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                    Consultando API para obtener modelos disponibles de {provider === "gemini" ? "Google Gemini" : "OpenAI"}...
                  </div>
                ) : modelsError ? (
                  <div className="p-3 bg-red-500/5 border border-red-500/20 text-red-400 rounded-xl text-xs">
                    {modelsError}
                    <button
                      type="button"
                      onClick={() => fetchModels(provider, provider === "gemini" ? geminiKey : openaiKey)}
                      className="underline ml-2 hover:text-red-300 font-bold"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : availableModels.length === 0 ? (
                  <div className="text-sm text-zinc-500 py-2 italic">
                    Ingrese la API Key de {provider === "gemini" ? "Gemini" : "OpenAI"} y presione "Actualizar modelos" para listar las opciones.
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={activeModel}
                      onChange={(e) => {
                        setActiveModel(e.target.value);
                        setTestResult(null);
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-zinc-100 appearance-none cursor-pointer"
                    >
                      {availableModels.map((m) => (
                        <option key={m.id} value={m.id} className="bg-zinc-950 text-white">
                          {m.displayName} ({m.id})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                      </svg>
                    </div>
                  </div>
                )}
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Mostrando únicamente los modelos oficiales correspondientes a {provider === "gemini" ? "Google Gemini" : "OpenAI"}.
                </p>
              </div>

              {/* Botón Probar Conexión */}
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !(provider === "gemini" ? geminiKey : openaiKey)}
                  className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white px-6 py-3 rounded-xl font-bold transition-all border border-white/5 text-sm w-full md:w-auto"
                >
                  {isTesting ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  ) : (
                    <Play className="w-4 h-4 text-emerald-400" />
                  )}
                  Probar conexión
                </button>

                {/* Resultado de la Prueba */}
                {testResult && (
                  <div className={cn(
                    "p-4 rounded-xl border flex gap-3 text-sm animate-in fade-in slide-in-from-top-2 duration-300",
                    testResult.success 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  )}>
                    {testResult.success ? (
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 shrink-0" />
                    )}
                    <div className="space-y-1">
                      <p className="font-bold">{testResult.success ? "Conexión Exitosa" : "Error de Conexión"}</p>
                      <p className="text-xs leading-relaxed opacity-90">{testResult.message}</p>
                      {testResult.success && testResult.modelsCount !== undefined && (
                        <div className="text-xs mt-2 pt-2 border-t border-emerald-500/10 space-y-0.5 opacity-80 font-mono">
                          <p>• Cantidad de modelos disponibles: <span className="font-bold text-white">{testResult.modelsCount}</span></p>
                          {testResult.lastVerification && (
                            <p>• Última verificación: <span className="font-bold text-white">{testResult.lastVerification}</span></p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
