import React, { useState, useEffect } from "react";
import { db } from "../services/db";
import { 
  Configuracion, 
  TipoMantenimiento, 
  TipoReparacion, 
  PrioridadReclamo, 
  EstadoReclamo,
  Tambo,
  Cliente,
  Mantenimiento
} from "../types/supabase";
import { 
  Save, 
  RefreshCw, 
  Info, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  Settings, 
  Wrench, 
  AlertTriangle, 
  Activity,
  ChevronRight,
  Droplets,
  Calendar,
  HelpCircle
} from "lucide-react";
import { cn, formatDate } from "../utils/ui";

export default function TechnicalConfigPage() {
  const [loading, setLoading] = useState(true);
  const [maintTypes, setMaintTypes] = useState<TipoMantenimiento[]>([]);
  const [tambos, setTambos] = useState<(Tambo & { clientes: Cliente })[]>([]);
  const [selectedTamboId, setSelectedTamboId] = useState<string | null>(null);
  const [tamboMantenimientos, setTamboMantenimientos] = useState<string[]>([]);
  const [tamboLastDates, setTamboLastDates] = useState<Record<string, string>>({});
  const [isSavingTambo, setIsSavingTambo] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      setLoading(true);
      const [maintData, tambosData] = await Promise.all([
        db.tipos_mantenimiento.getAll(),
        db.tambos.getAll()
      ]);

      setMaintTypes(maintData);
      setTambos(tambosData);
    } catch (error) {
      console.error("Error loading technical config:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedTamboId) {
      loadTamboConfig(selectedTamboId);
    }
  }, [selectedTamboId]);

  async function loadTamboConfig(tamboId: string) {
    try {
      const [activeTypes, history] = await Promise.all([
        db.tambos.getMantenimientosActivos(tamboId),
        db.mantenimientos.getByTambo(tamboId)
      ]);
      
      setTamboMantenimientos(activeTypes);
      
      // Get last date for each type
      const lastDates: Record<string, string> = {};
      maintTypes.forEach(type => {
        const last = history
          .filter(m => m.tipo === type.nombre)
          .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
        
        if (last) {
          lastDates[type.nombre] = last.fecha;
        }
      });
      setTamboLastDates(lastDates);
    } catch (error) {
      console.error("Error loading tambo config:", error);
    }
  }

  async function handleSaveTamboConfig() {
    if (!selectedTamboId) return;
    setIsSavingTambo(true);
    try {
      await db.tambos.setMantenimientosActivos(selectedTamboId, tamboMantenimientos);
      alert("Configuración del tambo guardada correctamente.");
    } catch (error) {
      console.error("Error saving tambo config:", error);
      alert("Error al guardar la configuración del tambo.");
    } finally {
      setIsSavingTambo(false);
    }
  }

  async function handleUpdateTamboDate(tipo: string, fecha: string) {
    if (!selectedTamboId) return;
    try {
      await db.mantenimientos.create({
        tambo_id: selectedTamboId,
        tipo,
        fecha,
        observaciones: fecha === '1900-01-01' ? "Marcado como nunca realizado" : "Actualización manual desde configuración técnica"
      });
      setTamboLastDates(prev => ({ ...prev, [tipo]: fecha }));
    } catch (error) {
      console.error("Error updating tambo date:", error);
      alert("Error al actualizar la fecha.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configuración Técnica</h2>
        <p className="text-zinc-500 mt-1">Defina qué mantenimientos tiene cada tambo y gestione sus fechas técnicas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tambos List */}
        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl overflow-hidden h-[600px] flex flex-col">
          <div className="p-4 border-b border-white/5">
            <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500">Seleccionar Tambo</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {tambos.map(tambo => (
              <button
                key={tambo.id}
                onClick={() => setSelectedTamboId(tambo.id)}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-2xl transition-all text-left group",
                  selectedTamboId === tambo.id 
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" 
                    : "hover:bg-white/5 text-zinc-400"
                )}
              >
                <div>
                  <p className="font-bold">{tambo.nombre}</p>
                  <p className="text-xs text-zinc-500">{tambo.clientes.nombre}</p>
                </div>
                <ChevronRight className={cn("w-4 h-4 transition-transform", selectedTamboId === tambo.id ? "rotate-90" : "group-hover:translate-x-1")} />
              </button>
            ))}
          </div>
        </div>

        {/* Tambo Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {selectedTamboId ? (
            <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 md:p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{tambos.find(t => t.id === selectedTamboId)?.nombre}</h3>
                  <p className="text-zinc-500">Configuración técnica específica del equipo</p>
                </div>
                <button
                  onClick={handleSaveTamboConfig}
                  disabled={isSavingTambo}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20"
                >
                  {isSavingTambo ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Guardar Cambios
                </button>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Mantenimientos Habilitados
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {maintTypes.map(type => {
                    const isActive = tamboMantenimientos.includes(type.nombre);
                    const lastDate = tamboLastDates[type.nombre];
                    
                    return (
                      <div key={type.id} className={cn(
                        "p-4 rounded-2xl border transition-all space-y-4",
                        isActive ? "bg-white/5 border-white/10" : "bg-black/20 border-white/5 opacity-60"
                      )}>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isActive}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTamboMantenimientos([...tamboMantenimientos, type.nombre]);
                                } else {
                                  setTamboMantenimientos(tamboMantenimientos.filter(t => t !== type.nombre));
                                }
                              }}
                              className="w-5 h-5 rounded-lg bg-white/5 border-white/10 text-emerald-500 focus:ring-emerald-500/20 transition-all"
                            />
                            <span className="font-bold">{type.nombre}</span>
                          </label>
                        </div>

                        {isActive && (
                          <div className="space-y-3 pt-3 border-t border-white/5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Último Mantenimiento</span>
                              <button
                                onClick={() => handleUpdateTamboDate(type.nombre, '1900-01-01')}
                                className={cn(
                                  "text-[10px] font-bold px-2 py-1 rounded-lg border transition-all",
                                  lastDate === '1900-01-01' 
                                    ? "bg-zinc-500/20 text-zinc-400 border-zinc-500/20" 
                                    : "bg-white/5 text-zinc-500 border-white/10 hover:bg-white/10"
                                )}
                              >
                                {lastDate === '1900-01-01' ? "NUNCA REALIZADO" : "MARCAR NUNCA"}
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="date"
                                value={lastDate && lastDate !== '1900-01-01' ? lastDate : ""}
                                onChange={(e) => handleUpdateTamboDate(type.nombre, e.target.value)}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                              />
                              <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center justify-center">
                                <Calendar className="w-4 h-4 text-zinc-500" />
                              </div>
                            </div>
                            {lastDate && lastDate !== '1900-01-01' && (
                              <p className="text-[10px] text-zinc-500 italic">
                                Registrado el {formatDate(lastDate)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-[#0f0f0f] border border-white/5 border-dashed rounded-3xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center">
                <Droplets className="w-8 h-8 text-zinc-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Configuración por Equipo</h3>
                <p className="text-zinc-500 max-w-xs mx-auto mt-2">
                  Seleccione un tambo de la lista para gestionar sus mantenimientos específicos y fechas técnicas.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center pt-8">
        <button 
          onClick={loadAllData}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-100 transition-colors text-sm font-medium"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Recargar todos los datos
        </button>
      </div>
    </div>
  );
}
