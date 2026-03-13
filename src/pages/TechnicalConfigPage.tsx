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
  const [activeTab, setActiveTab] = useState<"params" | "maint" | "repair" | "priority" | "status" | "tambos">("params");

  // System Params State
  const [configs, setConfigs] = useState<Configuracion[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Maintenance Types State
  const [maintTypes, setMaintTypes] = useState<TipoMantenimiento[]>([]);
  const [editingMaint, setEditingMaint] = useState<TipoMantenimiento | null>(null);
  const [isAddingMaint, setIsAddingMaint] = useState(false);
  const [newMaint, setNewMaint] = useState({ nombre: "", frecuencia_meses: 12, descripcion: "" });

  // Repair Types State
  const [repairTypes, setRepairTypes] = useState<TipoReparacion[]>([]);
  const [editingRepair, setEditingRepair] = useState<TipoReparacion | null>(null);
  const [isAddingRepair, setIsAddingRepair] = useState(false);
  const [newRepair, setNewRepair] = useState({ nombre: "", descripcion: "" });

  // Priorities State
  const [priorities, setPriorities] = useState<PrioridadReclamo[]>([]);
  const [editingPriority, setEditingPriority] = useState<PrioridadReclamo | null>(null);
  const [isAddingPriority, setIsAddingPriority] = useState(false);
  const [newPriority, setNewPriority] = useState({ nombre: "" });

  // Statuses State
  const [statuses, setStatuses] = useState<EstadoReclamo[]>([]);
  const [editingStatus, setEditingStatus] = useState<EstadoReclamo | null>(null);
  const [isAddingStatus, setIsAddingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState({ nombre: "" });

  // Tambos State
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
      // Ensure all seeds are run
      await Promise.all([
        db.configuracion.seed(),
        db.tipos_mantenimiento.seed(),
        db.tipos_reparacion.seed(),
        db.prioridades_reclamo.seed(),
        db.estados_reclamo.seed()
      ]);

      const [
        configData, 
        maintData, 
        repairData, 
        priorityData, 
        statusData,
        tambosData
      ] = await Promise.all([
        db.configuracion.getAll(),
        db.tipos_mantenimiento.getAll(),
        db.tipos_reparacion.getAll(),
        db.prioridades_reclamo.getAll(),
        db.estados_reclamo.getAll(),
        db.tambos.getAll()
      ]);

      setConfigs(configData);
      setMaintTypes(maintData);
      setRepairTypes(repairData);
      setPriorities(priorityData);
      setStatuses(statusData);
      setTambos(tambosData);

      const values: Record<string, string> = {};
      configData.forEach(c => {
        values[c.id] = c.valor;
      });
      setEditValues(values);
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
      
      // Also save any changed dates as new maintenance records if they differ from history
      // For simplicity, we'll only save if the user explicitly changed them in the UI
      // But here we'll just show a success message as the dates are handled individually in the UI
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

  // System Params Handlers
  async function handleUpdateConfig(id: string) {
    const config = configs.find(c => c.id === id);
    if (!config) return;
    const newValue = editValues[id];
    if (newValue === config.valor) return;
    setSavingId(id);
    try {
      await db.configuracion.update(config.clave, newValue);
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, valor: newValue } : c));
    } catch (error) {
      console.error("Error updating config:", error);
      alert("Error al guardar la configuración.");
    } finally {
      setSavingId(null);
    }
  }

  // Maintenance Handlers
  async function handleAddMaint() {
    if (!newMaint.nombre.trim()) return;
    try {
      const created = await db.tipos_mantenimiento.create(newMaint);
      setMaintTypes([...maintTypes, created]);
      setNewMaint({ nombre: "", frecuencia_meses: 12, descripcion: "" });
      setIsAddingMaint(false);
    } catch (error) {
      console.error("Error adding maintenance type:", error);
    }
  }

  async function handleUpdateMaint() {
    if (!editingMaint || !editingMaint.nombre.trim()) return;
    try {
      const updated = await db.tipos_mantenimiento.update(editingMaint.id, editingMaint);
      setMaintTypes(maintTypes.map(t => t.id === updated.id ? updated : t));
      setEditingMaint(null);
    } catch (error) {
      console.error("Error updating maintenance type:", error);
    }
  }

  async function handleDeleteMaint(id: string) {
    if (!confirm("¿Está seguro? Esto podría afectar los registros existentes.")) return;
    try {
      await db.tipos_mantenimiento.delete(id);
      setMaintTypes(maintTypes.filter(t => t.id !== id));
    } catch (error) {
      console.error("Error deleting maintenance type:", error);
    }
  }

  // Repair Handlers
  async function handleAddRepair() {
    if (!newRepair.nombre.trim()) return;
    try {
      const created = await db.tipos_reparacion.create(newRepair);
      setRepairTypes([...repairTypes, created]);
      setNewRepair({ nombre: "", descripcion: "" });
      setIsAddingRepair(false);
    } catch (error) {
      console.error("Error adding repair type:", error);
    }
  }

  async function handleUpdateRepair() {
    if (!editingRepair || !editingRepair.nombre.trim()) return;
    try {
      const updated = await db.tipos_reparacion.update(editingRepair.id, editingRepair);
      setRepairTypes(repairTypes.map(t => t.id === updated.id ? updated : t));
      setEditingRepair(null);
    } catch (error) {
      console.error("Error updating repair type:", error);
    }
  }

  async function handleDeleteRepair(id: string) {
    if (!confirm("¿Está seguro?")) return;
    try {
      await db.tipos_reparacion.delete(id);
      setRepairTypes(repairTypes.filter(t => t.id !== id));
    } catch (error) {
      console.error("Error deleting repair type:", error);
    }
  }

  // Priority Handlers
  async function handleAddPriority() {
    if (!newPriority.nombre.trim()) return;
    try {
      const created = await db.prioridades_reclamo.create(newPriority);
      setPriorities([...priorities, created]);
      setNewPriority({ nombre: "" });
      setIsAddingPriority(false);
    } catch (error) {
      console.error("Error adding priority:", error);
    }
  }

  async function handleUpdatePriority() {
    if (!editingPriority || !editingPriority.nombre.trim()) return;
    try {
      const updated = await db.prioridades_reclamo.update(editingPriority.id, editingPriority);
      setPriorities(priorities.map(t => t.id === updated.id ? updated : t));
      setEditingPriority(null);
    } catch (error) {
      console.error("Error updating priority:", error);
    }
  }

  async function handleDeletePriority(id: string) {
    if (!confirm("¿Está seguro?")) return;
    try {
      await db.prioridades_reclamo.delete(id);
      setPriorities(priorities.filter(t => t.id !== id));
    } catch (error) {
      console.error("Error deleting priority:", error);
    }
  }

  // Status Handlers
  async function handleAddStatus() {
    if (!newStatus.nombre.trim()) return;
    try {
      const created = await db.estados_reclamo.create(newStatus);
      setStatuses([...statuses, created]);
      setNewStatus({ nombre: "" });
      setIsAddingStatus(false);
    } catch (error) {
      console.error("Error adding status:", error);
    }
  }

  async function handleUpdateStatus() {
    if (!editingStatus || !editingStatus.nombre.trim()) return;
    try {
      const updated = await db.estados_reclamo.update(editingStatus.id, editingStatus);
      setStatuses(statuses.map(t => t.id === updated.id ? updated : t));
      setEditingStatus(null);
    } catch (error) {
      console.error("Error updating status:", error);
    }
  }

  async function handleDeleteStatus(id: string) {
    if (!confirm("¿Está seguro?")) return;
    try {
      await db.estados_reclamo.delete(id);
      setStatuses(statuses.filter(t => t.id !== id));
    } catch (error) {
      console.error("Error deleting status:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const tabs = [
    { id: "params", label: "Parámetros", icon: Settings },
    { id: "maint", label: "Mantenimientos", icon: Activity },
    { id: "repair", label: "Reparaciones", icon: Wrench },
    { id: "priority", label: "Prioridades", icon: AlertTriangle },
    { id: "status", label: "Estados", icon: ChevronRight },
    { id: "tambos", label: "Equipos", icon: Droplets },
  ] as const;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configuración Técnica</h2>
        <p className="text-zinc-500 mt-1">Administración avanzada de parámetros y catálogos del sistema.</p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === tab.id 
                ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" 
                : "bg-white/5 text-zinc-400 hover:bg-white/10"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === "params" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {configs.map((config) => (
              <div key={config.id} className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-4">
                <div>
                  <h4 className="font-bold text-zinc-100">{config.descripcion}</h4>
                  <p className="text-xs text-zinc-500 font-mono mt-1 uppercase tracking-wider">{config.clave}</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editValues[config.id] || ""}
                    onChange={(e) => setEditValues({ ...editValues, [config.id]: e.target.value })}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                  />
                  <button
                    onClick={() => handleUpdateConfig(config.id)}
                    disabled={savingId === config.id || editValues[config.id] === config.valor}
                    className="p-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black rounded-xl transition-all"
                  >
                    {savingId === config.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "maint" && (
          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="font-bold">Tipos de Mantenimiento</h3>
              <button onClick={() => setIsAddingMaint(true)} className="flex items-center gap-2 bg-emerald-500 text-black px-4 py-2 rounded-xl font-bold text-sm">
                <Plus className="w-4 h-4" /> Nuevo Tipo
              </button>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Frecuencia (Meses)</th>
                  <th className="px-6 py-4">Descripción</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isAddingMaint && (
                  <tr className="bg-emerald-500/5">
                    <td className="px-6 py-4">
                      <input autoFocus type="text" placeholder="Nombre..." value={newMaint.nombre} onChange={e => setNewMaint({...newMaint, nombre: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm" />
                    </td>
                    <td className="px-6 py-4">
                      <input type="number" value={newMaint.frecuencia_meses} onChange={e => setNewMaint({...newMaint, frecuencia_meses: parseInt(e.target.value)})} className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm" />
                    </td>
                    <td className="px-6 py-4">
                      <input type="text" placeholder="Descripción..." value={newMaint.descripcion} onChange={e => setNewMaint({...newMaint, descripcion: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={handleAddMaint} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setIsAddingMaint(false)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg"><X className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )}
                {maintTypes.map(type => (
                  <tr key={type.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      {editingMaint?.id === type.id ? (
                        <input autoFocus type="text" value={editingMaint.nombre} onChange={e => setEditingMaint({...editingMaint, nombre: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm" />
                      ) : <span className="font-bold">{type.nombre}</span>}
                    </td>
                    <td className="px-6 py-4">
                      {editingMaint?.id === type.id ? (
                        <input type="number" value={editingMaint.frecuencia_meses || 0} onChange={e => setEditingMaint({...editingMaint, frecuencia_meses: parseInt(e.target.value)})} className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm" />
                      ) : <span className="text-zinc-400 font-mono">{type.frecuencia_meses} meses</span>}
                    </td>
                    <td className="px-6 py-4">
                      {editingMaint?.id === type.id ? (
                        <input type="text" value={editingMaint.descripcion || ""} onChange={e => setEditingMaint({...editingMaint, descripcion: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm" />
                      ) : <span className="text-sm text-zinc-500">{type.descripcion || "-"}</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {editingMaint?.id === type.id ? (
                          <>
                            <button onClick={handleUpdateMaint} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingMaint(null)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg"><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setEditingMaint(type)} className="p-2 text-zinc-500 hover:text-emerald-400 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteMaint(type.id)} className="p-2 text-zinc-500 hover:text-red-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "repair" && (
          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="font-bold">Tipos de Reparación</h3>
              <button onClick={() => setIsAddingRepair(true)} className="flex items-center gap-2 bg-emerald-500 text-black px-4 py-2 rounded-xl font-bold text-sm">
                <Plus className="w-4 h-4" /> Nuevo Tipo
              </button>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4">Descripción</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isAddingRepair && (
                  <tr className="bg-emerald-500/5">
                    <td className="px-6 py-4">
                      <input autoFocus type="text" placeholder="Nombre..." value={newRepair.nombre} onChange={e => setNewRepair({...newRepair, nombre: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm" />
                    </td>
                    <td className="px-6 py-4">
                      <input type="text" placeholder="Descripción..." value={newRepair.descripcion} onChange={e => setNewRepair({...newRepair, descripcion: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={handleAddRepair} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setIsAddingRepair(false)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg"><X className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )}
                {repairTypes.map(type => (
                  <tr key={type.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      {editingRepair?.id === type.id ? (
                        <input autoFocus type="text" value={editingRepair.nombre} onChange={e => setEditingRepair({...editingRepair, nombre: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm" />
                      ) : <span className="font-bold">{type.nombre}</span>}
                    </td>
                    <td className="px-6 py-4">
                      {editingRepair?.id === type.id ? (
                        <input type="text" value={editingRepair.descripcion || ""} onChange={e => setEditingRepair({...editingRepair, descripcion: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm" />
                      ) : <span className="text-sm text-zinc-500">{type.descripcion || "-"}</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {editingRepair?.id === type.id ? (
                          <>
                            <button onClick={handleUpdateRepair} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingRepair(null)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg"><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setEditingRepair(type)} className="p-2 text-zinc-500 hover:text-emerald-400 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteRepair(type.id)} className="p-2 text-zinc-500 hover:text-red-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(activeTab === "priority" || activeTab === "status") && (
          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl overflow-hidden max-w-2xl">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="font-bold">{activeTab === "priority" ? "Prioridades de Reclamo" : "Estados de Reclamo"}</h3>
              <button 
                onClick={() => activeTab === "priority" ? setIsAddingPriority(true) : setIsAddingStatus(true)} 
                className="flex items-center gap-2 bg-emerald-500 text-black px-4 py-2 rounded-xl font-bold text-sm"
              >
                <Plus className="w-4 h-4" /> Nuevo
              </button>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-6 py-4">Nombre</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {activeTab === "priority" && isAddingPriority && (
                  <tr className="bg-emerald-500/5">
                    <td className="px-6 py-4">
                      <input autoFocus type="text" placeholder="Nombre..." value={newPriority.nombre} onChange={e => setNewPriority({nombre: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={handleAddPriority} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setIsAddingPriority(false)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg"><X className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )}
                {activeTab === "status" && isAddingStatus && (
                  <tr className="bg-emerald-500/5">
                    <td className="px-6 py-4">
                      <input autoFocus type="text" placeholder="Nombre..." value={newStatus.nombre} onChange={e => setNewStatus({nombre: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={handleAddStatus} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setIsAddingStatus(false)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg"><X className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )}
                {(activeTab === "priority" ? priorities : statuses).map(item => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      {((activeTab === "priority" ? editingPriority : editingStatus)?.id === item.id) ? (
                        <input 
                          autoFocus 
                          type="text" 
                          value={(activeTab === "priority" ? editingPriority : editingStatus)?.nombre || ""} 
                          onChange={e => activeTab === "priority" 
                            ? setEditingPriority({...editingPriority!, nombre: e.target.value}) 
                            : setEditingStatus({...editingStatus!, nombre: e.target.value})
                          } 
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm" 
                        />
                      ) : <span className="font-bold">{item.nombre}</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {((activeTab === "priority" ? editingPriority : editingStatus)?.id === item.id) ? (
                          <>
                            <button onClick={activeTab === "priority" ? handleUpdatePriority : handleUpdateStatus} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><Check className="w-4 h-4" /></button>
                            <button onClick={() => activeTab === "priority" ? setEditingPriority(null) : setEditingStatus(null)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg"><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => activeTab === "priority" ? setEditingPriority(item as any) : setEditingStatus(item as any)} className="p-2 text-zinc-500 hover:text-emerald-400 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => activeTab === "priority" ? handleDeletePriority(item.id) : handleDeleteStatus(item.id)} className="p-2 text-zinc-500 hover:text-red-400 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "tambos" && (
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
        )}
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
