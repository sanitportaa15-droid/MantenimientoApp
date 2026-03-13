import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../services/db";
import { Tambo, ReclamoEstado, ReclamoPrioridad } from "../types/supabase";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import { cn } from "../utils/ui";

export default function NewReclamoPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [tambos, setTambos] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    tambo_id: "",
    titulo: "",
    descripcion: "",
    fecha_reclamo: new Date().toISOString().split('T')[0],
    fecha_programada: "",
    estado: ReclamoEstado.PENDIENTE,
    prioridad: ReclamoPrioridad.MEDIA
  });

  useEffect(() => {
    async function loadData() {
      try {
        const tambosData = await db.tambos.getAll();
        setTambos(tambosData);

        if (isEditing) {
          const reclamo = await db.reclamos.getById(id!);
          setFormData({
            tambo_id: reclamo.tambo_id,
            titulo: reclamo.titulo,
            descripcion: reclamo.descripcion || "",
            fecha_reclamo: reclamo.fecha_reclamo,
            fecha_programada: reclamo.fecha_programada || "",
            estado: reclamo.estado,
            prioridad: reclamo.prioridad
          });
        }
      } catch (error) {
        console.error("Error loading data for reclamo:", error);
        alert("Error al cargar los datos.");
        navigate("/reclamos");
      } finally {
        setInitialLoading(false);
      }
    }
    loadData();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.tambo_id || !formData.titulo) return;

    setLoading(true);
    try {
      const payload = {
        ...formData,
        descripcion: formData.descripcion.trim() || null,
        fecha_programada: formData.fecha_programada || null
      };

      if (isEditing) {
        await db.reclamos.update(id!, payload);
      } else {
        await db.reclamos.create(payload);
      }
      
      alert(isEditing ? "Reclamo actualizado correctamente." : "Reclamo creado correctamente.");
      navigate("/reclamos");
    } catch (error) {
      console.error("Error saving reclamo:", error);
      alert("Error al guardar el reclamo.");
    } finally {
      setLoading(false);
    }
  }

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
          <h2 className="text-3xl font-bold tracking-tight">
            {isEditing ? "Editar Reclamo" : "Nuevo Reclamo"}
          </h2>
          <p className="text-zinc-500">
            {isEditing ? "Actualice los detalles del reclamo." : "Registre una nueva solicitud o problema reportado."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 space-y-6">
          <h3 className="text-xl font-bold border-b border-white/5 pb-4">Detalles del Problema</h3>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Tambo *</label>
            <select
              required
              value={formData.tambo_id}
              onChange={(e) => setFormData({ ...formData, tambo_id: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
            >
              <option value="" disabled className="bg-[#0f0f0f]">Seleccionar tambo...</option>
              {tambos.map(t => (
                <option key={t.id} value={t.id} className="bg-[#0f0f0f]">{t.nombre} ({t.clientes.nombre})</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Título del Problema *</label>
            <input
              required
              type="text"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Ej: Pérdida de vacío en la línea"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Descripción</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              placeholder="Describa el problema reportado..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Prioridad</label>
              <select
                value={formData.prioridad}
                onChange={(e) => setFormData({ ...formData, prioridad: e.target.value as ReclamoPrioridad })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
              >
                {Object.values(ReclamoPrioridad).map(p => (
                  <option key={p} value={p} className="bg-[#0f0f0f]">{p}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Estado</label>
              <select
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value as ReclamoEstado })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
              >
                {Object.values(ReclamoEstado).map(e => (
                  <option key={e} value={e} className="bg-[#0f0f0f]">{e}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Fecha Reporte</label>
              <input
                type="date"
                value={formData.fecha_reclamo}
                onChange={(e) => setFormData({ ...formData, fecha_reclamo: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Fecha Programada (Opcional)</label>
              <input
                type="date"
                value={formData.fecha_programada}
                onChange={(e) => setFormData({ ...formData, fecha_programada: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-bold py-5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 text-lg"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-6 h-6" />
              {isEditing ? "Actualizar Reclamo" : "Guardar Reclamo"}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
