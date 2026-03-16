import React, { useState, useEffect } from "react";
import { db } from "../services/db";
import { 
  Configuracion, 
  TipoMantenimiento, 
  TipoReparacion, 
  PrioridadReclamo, 
  EstadoReclamo,
  Tambo,
  Cliente
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
  Calendar
} from "lucide-react";
import { cn, formatDate } from "../utils/ui";

type ConfigTab = "equipos" | "parametros" | "mantenimientos" | "reparaciones" | "reclamos";

export default function TechnicalConfigPage() {
  const [activeTab, setActiveTab] = useState<ConfigTab>("equipos");
  const [loading, setLoading] = useState(true);
  
  // Global Data states
  const [configs, setConfigs] = useState<Configuracion[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [maintTypes, setMaintTypes] = useState<TipoMantenimiento[]>([]);
  const [repairTypes, setRepairTypes] = useState<TipoReparacion[]>([]);
  const [priorities, setPriorities] = useState<PrioridadReclamo[]>([]);
  const [statuses, setStatuses] = useState<EstadoReclamo[]>([]);
  const [tambos, setTambos] = useState<(Tambo & { clientes: Cliente })[]>([]);

  // Tambo Selection states
  const [selectedTamboId, setSelectedTamboId] = useState<string | null>(null);
  const [tamboMantenimientos, setTamboMantenimientos] = useState<string[]>([]);
  const [tamboLastDates, setTamboLastDates] = useState<Record<string, string>>({});
  const [isSavingTambo, setIsSavingTambo] = useState(false);
  const [savingConfigId, setSavingConfigId] = useState<string | null>(null);

  // CRUD UI states
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newItem, setNewItem] = useState<any>({});
  const [subTab, setSubTab] = useState<"prioridades" | "estados">("prioridades");

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      setLoading(true);
      // Seed defaults
      await Promise.all([
        db.configuracion.seed(),
        db.tipos_mantenimiento.seed(),
        db.tipos_reparacion.seed(),
        db.prioridades_reclamo.seed(),
        db.estados_reclamo.seed()
      ]);

      const [configData, maintData, repairData, priorityData, statusData, tambosData] = await Promise.all([
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

  async function handleUpdateConfig(id: string) {
    const config = configs.find(c => c.id === id);
    if (!config) return;
    
    const newValue = editValues[id];
    if (newValue === config.valor) return;

    setSavingConfigId(id);
    try {
      await db.configuracion.update(config.clave, newValue);
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, valor: newValue } : c));
      alert("Configuración guardada correctamente.");
    } catch (error) {
      console.error("Error updating config:", error);
      alert("Error al guardar la configuración.");
    } finally {
      setSavingConfigId(null);
    }
  }

  // CRUD Handlers
  async function handleAdd(target: string) {
    try {
      let created;
      switch (target) {
        case "mantenimientos":
          created = await db.tipos_mantenimiento.create(newItem);
          setMaintTypes([...maintTypes, created]);
          break;
        case "reparaciones":
          created = await db.tipos_reparacion.create(newItem);
          setRepairTypes([...repairTypes, created]);
          break;
        case "prioridades":
          created = await db.prioridades_reclamo.create(newItem);
          setPriorities([...priorities, created]);
          break;
        case "estados":
          created = await db.estados_reclamo.create(newItem);
          setStatuses([...statuses, created]);
          break;
      }
      setIsAdding(false);
      setNewItem({});
    } catch (error) {
      console.error("Error adding item:", error);
      alert("Error al agregar el elemento.");
    }
  }

  async function handleUpdateItem(target: string) {
    try {
      let updated;
      switch (target) {
        case "mantenimientos":
          updated = await db.tipos_mantenimiento.update(editingItem.id, editingItem);
          setMaintTypes(maintTypes.map(t => t.id === updated.id ? updated : t));
          break;
        case "reparaciones":
          updated = await db.tipos_reparacion.update(editingItem.id, editingItem);
          setRepairTypes(repairTypes.map(t => t.id === updated.id ? updated : t));
          break;
        case "prioridades":
          updated = await db.prioridades_reclamo.update(editingItem.id, editingItem);
          setPriorities(priorities.map(t => t.id === updated.id ? updated : t));
          break;
        case "estados":
          updated = await db.estados_reclamo.update(editingItem.id, editingItem);
          setStatuses(statuses.map(t => t.id === updated.id ? updated : t));
          break;
      }
      setEditingItem(null);
    } catch (error) {
      console.error("Error updating item:", error);
      alert("Error al actualizar el elemento.");
    }
  }

  async function handleDelete(target: string, id: string) {
    if (!confirm("¿Está seguro de que desea eliminar este elemento?")) return;
    try {
      switch (target) {
        case "mantenimientos":
          await db.tipos_mantenimiento.delete(id);
          setMaintTypes(maintTypes.filter(t => t.id !== id));
          break;
        case "reparaciones":
          await db.tipos_reparacion.delete(id);
          setRepairTypes(repairTypes.filter(t => t.id !== id));
          break;
        case "prioridades":
          await db.prioridades_reclamo.delete(id);
          setPriorities(priorities.filter(t => t.id !== id));
          break;
        case "estados":
          await db.estados_reclamo.delete(id);
          setStatuses(statuses.filter(t => t.id !== id));
          break;
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Error al eliminar el elemento.");
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
    { id: "equipos", name: "Equipos", icon: Droplets },
    { id: "parametros", name: "Parámetros", icon: Settings },
    { id: "mantenimientos", name: "Mantenimientos", icon: Wrench },
    { id: "reparaciones", name: "Reparaciones", icon: Wrench },
    { id: "reclamos", name: "Reclamos", icon: Activity },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configuración Técnica</h2>
          <p className="text-zinc-500 mt-1">Gestione todos los parámetros técnicos y configuraciones del sistema.</p>
        </div>
        <button 
          onClick={loadAllData}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-100 transition-colors text-sm font-medium"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Recargar datos
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as ConfigTab);
              setIsAdding(false);
              setEditingItem(null);
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === tab.id 
                ? "bg-emerald-500 text-black" 
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.name}
          </button>
        ))}
      </div>

      {activeTab === "equipos" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
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

      {activeTab === "parametros" && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex gap-3 text-emerald-400">
            <Info className="w-5 h-5 shrink-0" />
            <p className="text-sm">
              Estos valores afectan el cálculo de alertas preventivas y vida útil de componentes en todos los tambos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {configs.map((config) => (
              <div key={config.id} className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-4">
                <div>
                  <h4 className="font-bold text-zinc-100">{config.descripcion}</h4>
                  <p className="text-xs text-zinc-500 font-mono mt-1 uppercase tracking-wider">{config.clave}</p>
                </div>
                
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editValues[config.id] || ""}
                      onChange={(e) => setEditValues({ ...editValues, [config.id]: e.target.value })}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                    <div className="bg-zinc-800 rounded-xl px-4 py-2 flex items-center justify-center text-xs font-bold text-zinc-400 min-w-[60px]">
                      {config.clave.includes('meses') ? 'MESES' : config.clave.includes('dias') ? 'DÍAS' : 'ORD.'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUpdateConfig(config.id)}
                    disabled={savingConfigId === config.id || editValues[config.id] === config.valor}
                    className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:bg-zinc-800 text-black disabled:text-zinc-500 font-bold py-2 rounded-xl transition-all text-sm"
                  >
                    {savingConfigId === config.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(activeTab === "mantenimientos" || activeTab === "reparaciones") && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold tracking-tight capitalize">{activeTab}</h3>
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 bg-emerald-500 text-black px-4 py-2 rounded-xl font-bold transition-all text-sm"
            >
              <Plus className="w-4 h-4" />
              Nuevo
            </button>
          </div>

          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-bottom border-white/5 bg-white/5">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Nombre</th>
                  {activeTab === "mantenimientos" && (
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Frecuencia (Meses)</th>
                  )}
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Descripción</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isAdding && (
                  <tr className="bg-emerald-500/5">
                    <td className="px-6 py-4">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Nombre..."
                        value={newItem.nombre || ""}
                        onChange={(e) => setNewItem({ ...newItem, nombre: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                    {activeTab === "mantenimientos" && (
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          placeholder="Meses..."
                          value={newItem.frecuencia_meses || ""}
                          onChange={(e) => setNewItem({ ...newItem, frecuencia_meses: parseInt(e.target.value) })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        placeholder="Descripción..."
                        value={newItem.descripcion || ""}
                        onChange={(e) => setNewItem({ ...newItem, descripcion: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleAdd(activeTab)} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setIsAdding(false)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {(activeTab === "mantenimientos" ? maintTypes : repairTypes).map((item: any) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      {editingItem?.id === item.id ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingItem.nombre}
                          onChange={(e) => setEditingItem({ ...editingItem, nombre: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                        />
                      ) : (
                        <span className="font-bold text-zinc-200">{item.nombre}</span>
                      )}
                    </td>
                    {activeTab === "mantenimientos" && (
                      <td className="px-6 py-4">
                        {editingItem?.id === item.id ? (
                          <input
                            type="number"
                            value={editingItem.frecuencia_meses || ""}
                            onChange={(e) => setEditingItem({ ...editingItem, frecuencia_meses: parseInt(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                          />
                        ) : (
                          <span className="text-sm text-zinc-400 font-mono">{item.frecuencia_meses || "-"} meses</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      {editingItem?.id === item.id ? (
                        <input
                          type="text"
                          value={editingItem.descripcion || ""}
                          onChange={(e) => setEditingItem({ ...editingItem, descripcion: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                        />
                      ) : (
                        <span className="text-sm text-zinc-500">{item.descripcion || "-"}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {editingItem?.id === item.id ? (
                          <>
                            <button onClick={() => handleUpdateItem(activeTab)} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingItem(null)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => setEditingItem(item)}
                              className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(activeTab, item.id)}
                              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "reclamos" && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-2xl font-bold tracking-tight">Reclamos</h3>
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                <button 
                  onClick={() => setSubTab("prioridades")}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    subTab === "prioridades" ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Prioridades
                </button>
                <button 
                  onClick={() => setSubTab("estados")}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    subTab === "estados" ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Estados
                </button>
              </div>
            </div>
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 bg-emerald-500 text-black px-4 py-2 rounded-xl font-bold transition-all text-sm"
            >
              <Plus className="w-4 h-4" />
              Nuevo
            </button>
          </div>

          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-bottom border-white/5 bg-white/5">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Nombre</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Color</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isAdding && (
                  <tr className="bg-emerald-500/5">
                    <td className="px-6 py-4">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Nombre..."
                        value={newItem.nombre || ""}
                        onChange={(e) => setNewItem({ ...newItem, nombre: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        placeholder="Color (hex)..."
                        value={newItem.color || ""}
                        onChange={(e) => setNewItem({ ...newItem, color: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleAdd(subTab)} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setIsAdding(false)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {(subTab === "prioridades" ? priorities : statuses).map((item: any) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      {editingItem?.id === item.id ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingItem.nombre}
                          onChange={(e) => setEditingItem({ ...editingItem, nombre: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                        />
                      ) : (
                        <span className="font-bold text-zinc-200">{item.nombre}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingItem?.id === item.id ? (
                        <input
                          type="text"
                          value={editingItem.color || ""}
                          onChange={(e) => setEditingItem({ ...editingItem, color: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-zinc-500 font-mono">{item.color || "-"}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {editingItem?.id === item.id ? (
                          <>
                            <button onClick={() => handleUpdateItem(subTab)} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingItem(null)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => setEditingItem(item)}
                              className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(subTab, item.id)}
                              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
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
  );
}
