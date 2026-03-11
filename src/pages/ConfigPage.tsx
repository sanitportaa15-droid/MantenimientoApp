import React, { useState, useEffect } from "react";
import { db } from "../services/db";
import { Configuracion } from "../types/supabase";
import { Save, RefreshCw, Info } from "lucide-react";
import { cn } from "../utils/ui";

export default function ConfigPage() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Configuracion[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    try {
      setLoading(true);
      await db.configuracion.seed(); // Ensure defaults exist
      const data = await db.configuracion.getAll();
      setConfigs(data);
      const values: Record<string, string> = {};
      data.forEach(c => {
        values[c.id] = c.valor;
      });
      setEditValues(values);
    } catch (error) {
      console.error("Error loading configs:", error);
    } finally {
      setLoading(false);
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
