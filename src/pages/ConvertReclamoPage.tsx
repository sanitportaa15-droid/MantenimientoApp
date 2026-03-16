import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../services/db";
import { Reclamo, ReclamoEstado, TipoReparacion } from "../types/supabase";
import { ArrowLeft, Save, CheckCircle2, Camera, Settings2, Wrench, Eye, Plus, RefreshCw } from "lucide-react";
import { cn } from "../utils/ui";

export default function ConvertReclamoPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [reclamo, setReclamo] = useState<any>(null);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [repairTypes, setRepairTypes] = useState<TipoReparacion[]>([]);
  const [isSavingNewType, setIsSavingNewType] = useState(false);
  
  const [resolutionType, setResolutionType] = useState<"mantenimiento" | "reparacion" | "revision">("mantenimiento");
  const [repairType, setRepairType] = useState("");
  const [otherRepairType, setOtherRepairType] = useState("");
  
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [observaciones, setObservaciones] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const reclamoData = await db.reclamos.getById(id!);
        setReclamo(reclamoData);
        
        const [maintTypes, repairTypesData] = await Promise.all([
          db.tambos.getMantenimientosActivos(reclamoData.tambo_id),
          db.tipos_reparacion.getAll()
        ]);
        
        setActiveTypes(maintTypes);
        setRepairTypes(repairTypesData);
      } catch (error) {
        console.error("Error loading data:", error);
        alert("Error al cargar los datos.");
        navigate("/reclamos");
      } finally {
        setInitialLoading(false);
      }
    }
    loadData();
  }, [id]);

  async function handleSaveNewRepairType() {
    if (!otherRepairType.trim()) return;
    setIsSavingNewType(true);
    try {
      const created = await db.tipos_reparacion.create({
        nombre: otherRepairType.trim(),
        descripcion: "Agregado desde resolución de reclamo"
      });
      setRepairTypes([...repairTypes, created]);
      setRepairType(created.nombre);
      setOtherRepairType("");
      alert("Tipo de reparación guardado correctamente.");
    } catch (error) {
      console.error("Error saving new repair type:", error);
      alert("Error al guardar el nuevo tipo de reparación.");
    } finally {
      setIsSavingNewType(null as any); // Reset
      setIsSavingNewType(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (resolutionType === "mantenimiento" && selectedTipos.length === 0) {
      alert("Por favor, seleccione al menos un tipo de mantenimiento.");
      return;
    }

    if (resolutionType === "reparacion" && !repairType) {
      alert("Por favor, seleccione el tipo de reparación.");
      return;
    }

    setLoading(true);
    try {
      // 1. If maintenance, create records
      if (resolutionType === "mantenimiento") {
        const records = selectedTipos.map(tipo => ({
          tambo_id: reclamo.tambo_id,
          tipo,
          fecha,
          observaciones: observaciones.trim() || null,
          foto_url: fotoUrl.trim() || null
        }));
        await db.mantenimientos.createMany(records);
      }

      // 2. Update claim description with resolution details
      const finalRepairType = repairType === "Otro" ? otherRepairType : repairType;
      const resolutionSummary = `
--- RESOLUCIÓN ---
Tipo: ${resolutionType === "mantenimiento" ? "Mantenimiento realizado" : resolutionType === "reparacion" ? "Reparación / Falla corregida" : "Solo revisión"}
${resolutionType === "reparacion" ? `Falla: ${finalRepairType}\n` : ""}
Fecha: ${fecha}
Observaciones: ${observaciones.trim() || "Sin observaciones"}
${fotoUrl ? `Foto: ${fotoUrl}\n` : ""}
`;

      const updatedDescription = `${reclamo.descripcion || ""}\n${resolutionSummary}`;

      // 3. Mark claim as resolved
      const selectedRepairTypeObj = repairTypes.find(t => t.nombre === repairType);
      await db.reclamos.update(id!, { 
        estado: ReclamoEstado.RESUELTO,
        descripcion: updatedDescription.trim(),
        tipo_reparacion_id: selectedRepairTypeObj?.id || null
      });

      alert("Reclamo resuelto correctamente.");
      navigate("/reclamos");
    } catch (error) {
      console.error("Error resolving reclamo:", error);
      alert("Error al procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  const toggleTipo = (tipo: string) => {
    setSelectedTipos(prev => 
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Resolver Reclamo</h2>
          <p className="text-zinc-500">Seleccione cómo se resolvió el problema para cerrar el reclamo.</p>
        </div>
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 space-y-2">
        <h4 className="text-emerald-400 font-bold uppercase tracking-widest text-xs">Reclamo Original</h4>
        <h3 className="text-xl font-bold">{reclamo.titulo}</h3>
        <p className="text-sm text-zinc-400">{reclamo.tambos.nombre} • {reclamo.tambos.clientes.nombre}</p>
        {reclamo.descripcion && (
          <div className="mt-4 p-4 bg-black/20 rounded-2xl text-sm text-zinc-300 whitespace-pre-wrap">
            {reclamo.descripcion}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 space-y-8">
          {/* Resolution Type Selector */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Tipo de Resolución</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setResolutionType("mantenimiento")}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all flex flex-col gap-2",
                  resolutionType === "mantenimiento"
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                    : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/10"
                )}
              >
                <Settings2 className="w-5 h-5" />
                <span className="font-bold">Mantenimiento</span>
              </button>
              <button
                type="button"
                onClick={() => setResolutionType("reparacion")}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all flex flex-col gap-2",
                  resolutionType === "reparacion"
                    ? "bg-blue-500/10 border-blue-500/40 text-blue-400"
                    : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/10"
                )}
              >
                <Wrench className="w-5 h-5" />
                <span className="font-bold">Reparación</span>
              </button>
              <button
                type="button"
                onClick={() => setResolutionType("revision")}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all flex flex-col gap-2",
                  resolutionType === "revision"
                    ? "bg-zinc-500/10 border-zinc-500/40 text-zinc-400"
                    : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/10"
                )}
              >
                <Eye className="w-5 h-5" />
                <span className="font-bold">Solo revisión</span>
              </button>
            </div>
          </div>

          {/* Maintenance List */}
          {resolutionType === "mantenimiento" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
                Seleccionar Trabajos Realizados ({selectedTipos.length})
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {activeTypes.map(tipo => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => toggleTipo(tipo)}
                    className={cn(
                      "px-4 py-3 rounded-xl text-sm font-medium border text-left transition-all flex items-center justify-between",
                      selectedTipos.includes(tipo)
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                        : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/20"
                    )}
                  >
                    <span>{tipo}</span>
                    {selectedTipos.includes(tipo) && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Repair Type Selector */}
          {resolutionType === "reparacion" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Tipo de Reparación</label>
                <select
                  required={resolutionType === "reparacion"}
                  value={repairType}
                  onChange={(e) => setRepairType(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="" disabled>Seleccione una falla...</option>
                  {repairTypes.map(type => (
                    <option key={type.id} value={type.nombre} className="bg-[#0f0f0f]">{type.nombre}</option>
                  ))}
                  <option value="Otro" className="bg-[#0f0f0f]">Otro tipo de reparación...</option>
                </select>
              </div>

              {repairType === "Otro" && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Otro tipo de falla</label>
                  <div className="flex gap-2">
                    <input
                      required={repairType === "Otro"}
                      type="text"
                      value={otherRepairType}
                      onChange={(e) => setOtherRepairType(e.target.value)}
                      placeholder="Escriba el problema..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleSaveNewRepairType}
                      disabled={!otherRepairType.trim() || isSavingNewType}
                      className="px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all flex items-center gap-2 text-sm disabled:opacity-50"
                      title="Guardar como nuevo tipo de reparación"
                    >
                      {isSavingNewType ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      <span className="hidden md:inline">Guardar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Fecha del Trabajo</label>
              <input
                required
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">URL de Foto (Opcional)</label>
              <div className="relative">
                <input
                  type="url"
                  value={fotoUrl}
                  onChange={(e) => setFotoUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-10 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="https://..."
                />
                <Camera className="absolute left-3 top-3.5 w-4 h-4 text-zinc-500" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Observaciones Finales</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              placeholder="Detalles del trabajo realizado..."
            />
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          className={cn(
            "w-full disabled:opacity-50 text-black font-bold py-5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg text-lg",
            resolutionType === "mantenimiento" ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" :
            resolutionType === "reparacion" ? "bg-blue-500 hover:bg-blue-600 shadow-blue-500/20" :
            "bg-zinc-500 hover:bg-zinc-600 shadow-zinc-500/20"
          )}
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-6 h-6" />
              {resolutionType === "mantenimiento" ? "Registrar Mantenimiento y Resolver Reclamo" : "Resolver Reclamo"}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
