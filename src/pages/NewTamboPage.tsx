import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../services/db";
import { Cliente } from "../types/supabase";
import { ArrowLeft, Save } from "lucide-react";

export default function NewTamboPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [formData, setFormData] = useState({
    cliente_id: searchParams.get("clienteId") || "",
    nombre: "",
    vacas_en_ordene: 0,
    bajadas: 0,
    ordenes_por_dia: 2,
    marca_pezonera: "",
    fecha_ultimo_cambio: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    async function loadClientes() {
      const data = await db.clientes.getAll();
      setClientes(data);
    }
    loadClientes();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.cliente_id || !formData.nombre) return;

    setLoading(true);
    try {
      await db.tambos.create(formData);
      navigate("/tambos");
    } catch (error) {
      console.error("Error creating tambo:", error);
      alert("Error al crear el tambo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Nuevo Tambo</h2>
          <p className="text-zinc-500">Configure los parámetros técnicos del tambo.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Cliente *</label>
          <select
            required
            value={formData.cliente_id}
            onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
          >
            <option value="" disabled className="bg-[#0f0f0f]">Seleccionar cliente...</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id} className="bg-[#0f0f0f]">{c.nombre}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Nombre del Tambo *</label>
          <input
            required
            type="text"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
            placeholder="Ej: Tambo Norte"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Vacas en Ordeñe</label>
            <input
              type="number"
              value={formData.vacas_en_ordene}
              onChange={(e) => setFormData({ ...formData, vacas_en_ordene: parseInt(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Bajadas</label>
            <input
              type="number"
              value={formData.bajadas}
              onChange={(e) => setFormData({ ...formData, bajadas: parseInt(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Ordeñes x Día</label>
            <input
              type="number"
              value={formData.ordenes_por_dia}
              onChange={(e) => setFormData({ ...formData, ordenes_por_dia: parseInt(e.target.value) })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Marca Pezonera</label>
            <input
              type="text"
              value={formData.marca_pezonera}
              onChange={(e) => setFormData({ ...formData, marca_pezonera: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Ej: DeLaval, Westfalia..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Fecha Último Cambio</label>
            <input
              type="date"
              value={formData.fecha_ultimo_cambio}
              onChange={(e) => setFormData({ ...formData, fecha_ultimo_cambio: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5" />
              Guardar Tambo
            </>
          )}
        </button>
      </form>
    </div>
  );
}
