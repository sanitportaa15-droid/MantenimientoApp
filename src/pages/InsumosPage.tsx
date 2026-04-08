import React, { useState, useEffect } from "react";
import { db } from "../services/db";
import { Insumo } from "../types/supabase";
import { Plus, Edit2, Trash2, Save, X, Package } from "lucide-react";
import { cn } from "../utils/ui";

export default function InsumosPage() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    tipo: "consumible",
    usa_brazos: false,
    cantidad_por_bajada: 0,
    usa_cantidad_manual: false
  });

  useEffect(() => {
    loadInsumos();
  }, []);

  async function loadInsumos() {
    try {
      setLoading(true);
      const data = await db.insumos.getAll();
      setInsumos(data);
    } catch (error) {
      console.error("Error al cargar insumos:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(insumo: Insumo) {
    setEditingInsumo(insumo);
    setFormData({
      nombre: insumo.nombre,
      tipo: insumo.tipo,
      usa_brazos: insumo.usa_brazos,
      cantidad_por_bajada: insumo.cantidad_por_bajada,
      usa_cantidad_manual: insumo.usa_cantidad_manual
    });
    setIsModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de eliminar este insumo?")) return;
    try {
      await db.insumos.delete(id);
      loadInsumos();
    } catch (error) {
      alert("Error al eliminar insumo");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingInsumo) {
        await db.insumos.update(editingInsumo.id, formData);
      } else {
        await db.insumos.create(formData);
      }
      setIsModalOpen(false);
      setEditingInsumo(null);
      setFormData({
        nombre: "",
        tipo: "consumible",
        usa_brazos: false,
        cantidad_por_bajada: 0,
        usa_cantidad_manual: false
      });
      loadInsumos();
    } catch (error) {
      alert("Error al guardar insumo. El nombre debe ser único.");
    }
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Catálogo de Insumos</h2>
          <p className="text-zinc-500 mt-1">Gestiona los insumos y sus reglas de cálculo para los reportes técnicos.</p>
        </div>
        <button
          onClick={() => {
            setEditingInsumo(null);
            setFormData({
              nombre: "",
              tipo: "consumible",
              usa_brazos: false,
              cantidad_por_bajada: 0,
              usa_cantidad_manual: false
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-5 h-5" />
          Nuevo Insumo
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      ) : (
        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-zinc-500 text-[10px] uppercase tracking-widest border-b border-white/5">
                  <th className="px-8 py-5 font-bold">Nombre</th>
                  <th className="px-8 py-5 font-bold">Tipo</th>
                  <th className="px-8 py-5 font-bold">Usa Brazos</th>
                  <th className="px-8 py-5 font-bold">Cant. por Bajada</th>
                  <th className="px-8 py-5 font-bold">Cant. Manual</th>
                  <th className="px-8 py-5 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {insumos.map((insumo) => (
                  <tr key={insumo.id} className="group hover:bg-white/5 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                          <Package className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">{insumo.nombre}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm text-zinc-400 capitalize bg-white/5 px-3 py-1 rounded-lg font-medium">
                        {insumo.tipo}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-2 py-1 rounded-md",
                        insumo.usa_brazos ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-500"
                      )}>
                        {insumo.usa_brazos ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="font-mono text-sm text-zinc-300">
                        {insumo.usa_brazos ? insumo.cantidad_por_bajada : "-"}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-2 py-1 rounded-md",
                        insumo.usa_cantidad_manual ? "bg-amber-500/10 text-amber-400" : "bg-zinc-500/10 text-zinc-500"
                      )}>
                        {insumo.usa_cantidad_manual ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(insumo)}
                          className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(insumo.id)}
                          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {insumos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-zinc-600 italic">
                      No hay insumos registrados en el catálogo
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/5">
              <h2 className="text-xl font-bold text-white">
                {editingInsumo ? "Editar Insumo" : "Nuevo Insumo"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl text-zinc-400 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Nombre del Insumo</label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  placeholder="Ej: Pezoneras"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Categoría / Tipo</label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none"
                >
                  <option value="consumible">Consumible</option>
                  <option value="equipo">Equipo</option>
                  <option value="repuesto">Repuesto</option>
                </select>
              </div>
              
              <div className="space-y-4 pt-2">
                <div 
                  onClick={() => setFormData({ ...formData, usa_brazos: !formData.usa_brazos, usa_cantidad_manual: !formData.usa_brazos ? false : formData.usa_cantidad_manual })}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all",
                    formData.usa_brazos ? "bg-emerald-500/10 border-emerald-500/20" : "bg-white/5 border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                      formData.usa_brazos ? "bg-emerald-500 border-emerald-500" : "border-zinc-700"
                    )}>
                      {formData.usa_brazos && <Save className="w-3 h-3 text-black" />}
                    </div>
                    <span className="text-sm font-bold">Cálculo por bajadas (o brazos)</span>
                  </div>
                </div>

                {formData.usa_brazos && (
                  <div className="pl-8 animate-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Cantidad por bajada</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.cantidad_por_bajada}
                      onChange={(e) => setFormData({ ...formData, cantidad_por_bajada: parseInt(e.target.value) || 0 })}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                  </div>
                )}

                <div 
                  onClick={() => setFormData({ ...formData, usa_cantidad_manual: !formData.usa_cantidad_manual, usa_brazos: !formData.usa_cantidad_manual ? false : formData.usa_brazos })}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all",
                    formData.usa_cantidad_manual ? "bg-amber-500/10 border-amber-500/20" : "bg-white/5 border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                      formData.usa_cantidad_manual ? "bg-amber-500 border-amber-500" : "border-zinc-700"
                    )}>
                      {formData.usa_cantidad_manual && <Save className="w-3 h-3 text-black" />}
                    </div>
                    <span className="text-sm font-bold">Cantidad manual (fija por tambo)</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-white/10 text-zinc-400 rounded-2xl font-bold hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-emerald-500 text-black rounded-2xl font-bold hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Save className="w-4 h-4" />
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
