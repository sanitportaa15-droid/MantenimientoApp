import React, { useState, useEffect } from "react";
import { db } from "../services/db";
import { Configuracion } from "../types/supabase";
import { Save, RefreshCw, Info, Plus, Edit2, Trash2, X, Check } from "lucide-react";
import { cn } from "../utils/ui";
import { TipoReparacion } from "../types/supabase";

export default function ConfigPage() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Configuracion[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [repairTypes, setRepairTypes] = useState<TipoReparacion[]>([]);
  const [isAddingRepairType, setIsAddingRepairType] = useState(false);
  const [editingRepairType, setEditingRepairType] = useState<TipoReparacion | null>(null);
  const [newRepairType, setNewRepairType] = useState({ nombre: "", descripcion: "" });

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    try {
      setLoading(true);
      await db.configuracion.seed(); // Ensure defaults exist
      await db.tipos_reparacion.seed(); // Ensure repair types exist
      const [configData, repairData] = await Promise.all([
        db.configuracion.getAll(),
        db.tipos_reparacion.getAll()
      ]);
      setConfigs(configData);
      setRepairTypes(repairData);
      const values: Record<string, string> = {};
      configData.forEach(c => {
        values[c.id] = c.valor;
      });
      setEditValues(values);
    } catch (error) {
      console.error("Error loading configs:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddRepairType() {
    if (!newRepairType.nombre.trim()) return;
    try {
      const created = await db.tipos_reparacion.create(newRepairType);
      setRepairTypes([...repairTypes, created]);
      setNewRepairType({ nombre: "", descripcion: "" });
      setIsAddingRepairType(false);
    } catch (error) {
      console.error("Error adding repair type:", error);
      alert("Error al agregar el tipo de reparación.");
    }
  }

  async function handleUpdateRepairType() {
    if (!editingRepairType || !editingRepairType.nombre.trim()) return;
    try {
      const updated = await db.tipos_reparacion.update(editingRepairType.id, {
        nombre: editingRepairType.nombre,
        descripcion: editingRepairType.descripcion
      });
      setRepairTypes(repairTypes.map(t => t.id === updated.id ? updated : t));
      setEditingRepairType(null);
    } catch (error) {
      console.error("Error updating repair type:", error);
      alert("Error al actualizar el tipo de reparación.");
    }
  }

  async function handleDeleteRepairType(id: string) {
    if (!confirm("¿Está seguro de que desea eliminar este tipo de reparación?")) return;
    try {
      await db.tipos_reparacion.delete(id);
      setRepairTypes(repairTypes.filter(t => t.id !== id));
    } catch (error) {
      console.error("Error deleting repair type:", error);
      alert("Error al eliminar el tipo de reparación.");
    }
  }

  async function handleUpdate(id: string) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
        <p className="text-zinc-500 mt-1">Ajuste las constantes del sistema para los cálculos de mantenimiento.</p>
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex gap-3 text-emerald-400">
        <Info className="w-5 h-5 shrink-0" />
        <p className="text-sm">
          Los cambios realizados aquí se aplicarán automáticamente a todos los cálculos de alertas y estados técnicos de los tambos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                onClick={() => handleUpdate(config.id)}
                disabled={savingId === config.id || editValues[config.id] === config.valor}
                className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:bg-zinc-800 text-black disabled:text-zinc-500 font-bold py-2 rounded-xl transition-all text-sm"
              >
                {savingId === config.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold tracking-tight">Tipos de Reparación</h3>
            <p className="text-zinc-500 mt-1">Administre las categorías de fallas técnicas.</p>
          </div>
          <button
            onClick={() => setIsAddingRepairType(true)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-bold transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Tipo
          </button>
        </div>

        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-bottom border-white/5 bg-white/5">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Nombre</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Descripción</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isAddingRepairType && (
                <tr className="bg-emerald-500/5">
                  <td className="px-6 py-4">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Nombre..."
                      value={newRepairType.nombre}
                      onChange={(e) => setNewRepairType({ ...newRepairType, nombre: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      placeholder="Descripción..."
                      value={newRepairType.descripcion}
                      onChange={(e) => setNewRepairType({ ...newRepairType, descripcion: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={handleAddRepairType} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setIsAddingRepairType(false)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {repairTypes.map((type) => (
                <tr key={type.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    {editingRepairType?.id === type.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={editingRepairType.nombre}
                        onChange={(e) => setEditingRepairType({ ...editingRepairType, nombre: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    ) : (
                      <span className="font-bold text-zinc-200">{type.nombre}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingRepairType?.id === type.id ? (
                      <input
                        type="text"
                        value={editingRepairType.descripcion || ""}
                        onChange={(e) => setEditingRepairType({ ...editingRepairType, descripcion: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    ) : (
                      <span className="text-sm text-zinc-500">{type.descripcion || "-"}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {editingRepairType?.id === type.id ? (
                        <>
                          <button onClick={handleUpdateRepairType} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingRepairType(null)} className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => setEditingRepairType(type)}
                            className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteRepairType(type.id)}
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

      <div className="flex justify-center pt-8">
        <button 
          onClick={loadConfigs}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-100 transition-colors text-sm font-medium"
        >
          <RefreshCw className={cn("w-4 h-4", savingId && "animate-spin")} />
          Recargar configuraciones
        </button>
      </div>
    </div>
  );
}
