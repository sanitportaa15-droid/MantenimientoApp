import React, { useState, useEffect } from "react";
import { db } from "../services/db";
import { Configuracion, TipoMantenimiento, TipoReparacion, PrioridadReclamo, EstadoReclamo } from "../types/supabase";
import { Save, RefreshCw, Info, Plus, Edit2, Trash2, X, Check, Settings, Wrench, AlertTriangle, Activity } from "lucide-react";
import { cn } from "../utils/ui";

type ConfigTab = "parametros" | "mantenimientos" | "reparaciones" | "prioridades" | "estados";

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState<ConfigTab>("parametros");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  
  // Data states
  const [configs, setConfigs] = useState<Configuracion[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [maintTypes, setMaintTypes] = useState<TipoMantenimiento[]>([]);
  const [repairTypes, setRepairTypes] = useState<TipoReparacion[]>([]);
  const [priorities, setPriorities] = useState<PrioridadReclamo[]>([]);
  const [statuses, setStatuses] = useState<EstadoReclamo[]>([]);

  // UI states for adding/editing
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newItem, setNewItem] = useState<any>({});

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

      const [configData, maintData, repairData, priorityData, statusData] = await Promise.all([
        db.configuracion.getAll(),
        db.tipos_mantenimiento.getAll(),
        db.tipos_reparacion.getAll(),
        db.prioridades_reclamo.getAll(),
        db.estados_reclamo.getAll()
      ]);

      setConfigs(configData);
      setMaintTypes(maintData);
      setRepairTypes(repairData);
      setPriorities(priorityData);
      setStatuses(statusData);

      const values: Record<string, string> = {};
      configData.forEach(c => {
        values[c.id] = c.valor;
      });
      setEditValues(values);
    } catch (error) {
      console.error("Error loading config data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Generic handlers for catalogs
  async function handleAdd() {
    try {
      let created;
      switch (activeTab) {
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

  async function handleUpdateItem() {
    try {
      let updated;
      switch (activeTab) {
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

  async function handleDelete(id: string) {
    if (!confirm("¿Está seguro de que desea eliminar este elemento?")) return;
    try {
      switch (activeTab) {
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

  async function handleUpdateConfig(id: string) {
    const config = configs.find(c => c.id === id);
    if (!config) return;
    
    const newValue = editValues[id];
    if (newValue === config.valor) return;

    setSavingId(id);
    try {
      await db.configuracion.update(config.clave, newValue);
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, valor: newValue } : c));
      alert("Configuración guardada correctamente.");
    } catch (error) {
      console.error("Error updating config:", error);
      alert("Error al guardar la configuración.");
    } finally {
      setSavingId(null);
    }
  }

  const tabs = [
    { id: "parametros", name: "Parámetros", icon: Settings },
    { id: "mantenimientos", name: "Mantenimientos", icon: Tool },
    { id: "reparaciones", name: "Reparaciones", icon: Wrench },
    { id: "prioridades", name: "Prioridades", icon: AlertTriangle },
    { id: "estados", name: "Estados", icon: Activity },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configuración del Sistema</h2>
          <p className="text-zinc-500 mt-1">Administre los parámetros globales y catálogos de la aplicación.</p>
        </div>
        <button 
          onClick={loadAllData}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-100 transition-colors text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Recargar todo
        </button>
      </div>

      {/* Tabs */}
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

      {activeTab === "parametros" && (
        <div className="space-y-6">
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
                    disabled={savingId === config.id || editValues[config.id] === config.valor}
                    className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:bg-zinc-800 text-black disabled:text-zinc-500 font-bold py-2 rounded-xl transition-all text-sm"
                  >
                    {savingId === config.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab !== "parametros" && (
        <div className="space-y-6">
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
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Descripción / Color</th>
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
                        placeholder={activeTab === "estados" || activeTab === "prioridades" ? "Color (hex)..." : "Descripción..."}
                        value={newItem.descripcion || newItem.color || ""}
                        onChange={(e) => setNewItem({ 
                          ...newItem, 
                          [activeTab === "estados" || activeTab === "prioridades" ? "color" : "descripcion"]: e.target.value 
                        })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={handleAdd} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setIsAdding(false)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {(activeTab === "mantenimientos" ? maintTypes : 
                  activeTab === "reparaciones" ? repairTypes : 
                  activeTab === "prioridades" ? priorities : statuses).map((item: any) => (
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
                          value={editingItem.descripcion || editingItem.color || ""}
                          onChange={(e) => setEditingItem({ 
                            ...editingItem, 
                            [activeTab === "estados" || activeTab === "prioridades" ? "color" : "descripcion"]: e.target.value 
                          })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          {item.color && (
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          )}
                          <span className="text-sm text-zinc-500">{item.descripcion || item.color || "-"}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {editingItem?.id === item.id ? (
                          <>
                            <button onClick={handleUpdateItem} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
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
                              onClick={() => handleDelete(item.id)}
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
