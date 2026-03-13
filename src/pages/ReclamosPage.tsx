import React, { useState, useEffect } from "react";
import { db } from "../services/db";
import { Reclamo, ReclamoEstado, ReclamoPrioridad } from "../types/supabase";
import { AlertCircle, Calendar, Clock, Filter, Plus, Search, Trash2, CheckCircle2, MoreVertical, Edit2, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn, formatDate } from "../utils/ui";

export default function ReclamosPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reclamos, setReclamos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("Todos");

  useEffect(() => {
    loadReclamos();
  }, []);

  async function loadReclamos() {
    try {
      setLoading(true);
      const data = await db.reclamos.getAll();
      setReclamos(data);
    } catch (error) {
      console.error("Error loading reclamos:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Está seguro de que desea eliminar este reclamo?")) return;
    try {
      await db.reclamos.delete(id);
      setReclamos(reclamos.filter(r => r.id !== id));
    } catch (error) {
      console.error("Error deleting reclamo:", error);
      alert("Error al eliminar el reclamo.");
    }
  }

  async function handleStatusChange(id: string, nuevoEstado: ReclamoEstado) {
    try {
      await db.reclamos.update(id, { estado: nuevoEstado });
      setReclamos(reclamos.map(r => r.id === id ? { ...r, estado: nuevoEstado } : r));
    } catch (error) {
      console.error("Error updating reclamo status:", error);
      alert("Error al actualizar el estado.");
    }
  }

  const filteredReclamos = reclamos.filter(r => {
    const matchesSearch = 
      r.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.tambos.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.tambos.clientes.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEstado = filterEstado === "Todos" || r.estado === filterEstado;
    
    return matchesSearch && matchesEstado;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reclamos</h2>
          <p className="text-zinc-500 mt-1">Gestión de solicitudes y problemas reportados.</p>
        </div>
        <Link to="/reclamos/nuevo" className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20">
          <Plus className="w-5 h-5" />
          Nuevo Reclamo
        </Link>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por título, tambo o cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0f0f0f] border border-white/5 rounded-2xl px-12 py-4 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 bg-[#0f0f0f] border border-white/5 rounded-2xl px-4 py-2">
          <Filter className="w-5 h-5 text-zinc-500" />
          <select 
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-sm font-medium pr-8"
          >
            <option value="Todos">Todos los estados</option>
            {Object.values(ReclamoEstado).map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredReclamos.map((reclamo) => (
          <div 
            key={reclamo.id}
            className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 hover:border-white/20 transition-all group"
          >
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="flex-1 space-y-4">
                <div className="flex items-start justify-between md:justify-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                    reclamo.prioridad === ReclamoPrioridad.URGENTE ? "bg-red-500/10 text-red-400" :
                    reclamo.prioridad === ReclamoPrioridad.ALTA ? "bg-orange-500/10 text-orange-400" :
                    reclamo.prioridad === ReclamoPrioridad.MEDIA ? "bg-amber-500/10 text-amber-400" :
                    "bg-emerald-500/10 text-emerald-400"
                  )}>
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold group-hover:text-emerald-400 transition-colors">{reclamo.titulo}</h3>
                      <PriorityBadge prioridad={reclamo.prioridad} />
                      <StatusBadge estado={reclamo.estado} />
                    </div>
                    <p className="text-sm text-zinc-400 font-medium">
                      {reclamo.tambos.nombre} • <span className="text-zinc-500">{reclamo.tambos.clientes.nombre}</span>
                    </p>
                  </div>
                </div>

                <p className="text-zinc-400 text-sm line-clamp-2">{reclamo.descripcion || "Sin descripción."}</p>

                <div className="flex flex-wrap gap-4 text-xs font-medium text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Reportado: {formatDate(reclamo.fecha_reclamo)}
                  </div>
                  {reclamo.fecha_programada && (
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <Calendar className="w-3.5 h-3.5" />
                      Programado: {formatDate(reclamo.fecha_programada)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex md:flex-col justify-end gap-2 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                {reclamo.estado !== ReclamoEstado.RESUELTO && (
                  <button 
                    onClick={() => navigate(`/reclamos/editar/${reclamo.id}`)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-sm font-bold"
                  >
                    <Edit2 className="w-4 h-4" />
                    Editar
                  </button>
                )}
                {reclamo.estado !== ReclamoEstado.RESUELTO && (
                  <button 
                    onClick={() => navigate(`/reclamos/convertir/${reclamo.id}`)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-colors text-sm font-bold"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Resolver
                  </button>
                )}
                <button 
                  onClick={() => handleDelete(reclamo.id)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors text-sm font-bold"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredReclamos.length === 0 && (
        <div className="text-center py-20 bg-[#0f0f0f] rounded-3xl border border-dashed border-white/10">
          <AlertCircle className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-500 font-medium">No se encontraron reclamos.</p>
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ prioridad }: { prioridad: ReclamoPrioridad }) {
  const styles = {
    [ReclamoPrioridad.BAJA]: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    [ReclamoPrioridad.MEDIA]: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    [ReclamoPrioridad.ALTA]: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    [ReclamoPrioridad.URGENTE]: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", styles[prioridad])}>
      {prioridad}
    </span>
  );
}

function StatusBadge({ estado }: { estado: ReclamoEstado }) {
  const styles = {
    [ReclamoEstado.PENDIENTE]: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    [ReclamoEstado.PROGRAMADO]: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    [ReclamoEstado.EN_PROCESO]: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    [ReclamoEstado.RESUELTO]: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", styles[estado])}>
      {estado}
    </span>
  );
}
