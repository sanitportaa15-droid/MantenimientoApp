import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../services/db";
import { Reclamo, ReclamoEstado, MantenimientoTipo } from "../types/supabase";
import { ArrowLeft, Save, CheckCircle2, Camera } from "lucide-react";
import { cn } from "../utils/ui";

export default function ConvertReclamoPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [reclamo, setReclamo] = useState<any>(null);
  const [activeTypes, setActiveTypes] = useState<MantenimientoTipo[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<MantenimientoTipo[]>([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [observaciones, setObservaciones] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const data = await db.reclamos.getById(id!);
        setReclamo(data);
        setObservaciones(`Resuelto desde reclamo: ${data.titulo}\n\n${data.descripcion || ""}`);
        
        const types = await db.tambos.getMantenimientosActivos(data.tambo_id);
        setActiveTypes(types);
      } catch (error) {
        console.error("Error loading reclamo:", error);
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
    if (selectedTipos.length === 0) {
      alert("Por favor, seleccione al menos un tipo de mantenimiento.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create maintenance records
      const records = selectedTipos.map(tipo => ({
        tambo_id: reclamo.tambo_id,
        tipo,
        fecha,
        observaciones: observaciones.trim() || null,
        foto_url: fotoUrl.trim() || null
      }));

      await db.mantenimientos.createMany(records);

      // 2. Mark claim as resolved
      await db.reclamos.update(id!, { estado: ReclamoEstado.RESUELTO });

      alert("Mantenimiento registrado y reclamo resuelto correctamente.");
      navigate("/reclamos");
    } catch (error) {
      console.error("Error converting reclamo:", error);
      alert("Error al procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  const toggleTipo = (tipo: MantenimientoTipo) => {
    setSelectedTipos(prev => 
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
  };

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
          <h2 className="text-3xl font-bold tracking-tight">Resolver Reclamo</h2>
          <p className="text-zinc-500">Registre el mantenimiento realizado para cerrar este reclamo.</p>
        </div>
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 space-y-2">
        <h4 className="text-emerald-400 font-bold uppercase tracking-widest text-xs">Reclamo Original</h4>
        <h3 className="text-xl font-bold">{reclamo.titulo}</h3>
        <p className="text-sm text-zinc-400">{reclamo.tambos.nombre} • {reclamo.tambos.clientes.nombre}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
              Seleccionar Trabajos Realizados ({selectedTipos.length})
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {activeTypes.map(tipo => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => toggleTipo(tipo)}
                  className={cn(
                    "px-4 py-3 rounded-xl text-sm font-medium border text-left transition-all flex items-center justify-between",
                    selectedTipos.includes(tipo)
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                      : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/20"
                  )}
                >
                  <span>{tipo}</span>
                  {selectedTipos.includes(tipo) && <CheckCircle2 className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Fecha del Trabajo</label>
              <input
                required
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">URL de Foto (Opcional)</label>
              <div className="relative">
                <input
                  type="url"
                  value={fotoUrl}
                  onChange={(e) => setFotoUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-10 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="https://..."
                />
                <Camera className="absolute left-3 top-3.5 w-4 h-4 text-zinc-500" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Observaciones Finales</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              placeholder="Detalles del trabajo realizado..."
            />
          </div>
        </div>

        <button
          disabled={loading || selectedTipos.length === 0}
          type="submit"
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-bold py-5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 text-lg"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-6 h-6" />
              Registrar Mantenimiento y Resolver Reclamo
            </>
          )}
        </button>
      </form>
    </div>
  );
}
