import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../services/db";
import { ArrowLeft, Save } from "lucide-react";

export default function NewClientPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    telefono: "",
    email: "",
    ubicacion: "",
    observaciones: ""
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.nombre.trim()) return;

    setLoading(true);
    try {
      const dataToSave = {
        nombre: formData.nombre.trim(),
        telefono: formData.telefono.trim() || null,
        email: formData.email.trim() || null,
        ubicacion: formData.ubicacion.trim() || null,
        observaciones: formData.observaciones.trim() || null,
      };
      const nuevoCliente = await db.clientes.create(dataToSave);
      // After creating client, suggest creating first tambo
      if (confirm(`Cliente "${nuevoCliente.nombre}" creado. ¿Desea crear el primer tambo ahora?`)) {
        navigate(`/tambos/nuevo?clienteId=${nuevoCliente.id}`);
      } else {
        navigate("/clientes");
      }
    } catch (error: any) {
      console.error("Error creating client:", error);
      const message = error.message || "Error desconocido";
      alert(`Error al crear el cliente: ${message}. Verifique la consola para más detalles.`);
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
          <h2 className="text-3xl font-bold tracking-tight">Nuevo Cliente</h2>
          <p className="text-zinc-500">Complete los datos básicos del cliente.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Nombre del Cliente *</label>
          <input
            required
            type="text"
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
            placeholder="Ej: Establecimiento La María"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Teléfono</label>
            <input
              type="tel"
              value={formData.telefono}
              onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="+54 9..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="contacto@ejemplo.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Ubicación</label>
          <input
            type="text"
            value={formData.ubicacion}
            onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
            placeholder="Localidad, Provincia"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Observaciones</label>
          <textarea
            value={formData.observaciones}
            onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
            placeholder="Notas adicionales..."
          />
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
              Guardar Cliente
            </>
          )}
        </button>
      </form>
    </div>
  );
}
