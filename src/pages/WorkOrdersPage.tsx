import React, { useState, useEffect } from "react";
import { db } from "../services/db";
import { OrdenTrabajo } from "../types/supabase";
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Droplets, 
  ArrowRight, 
  AlertCircle, 
  Trash2, 
  CheckCircle, 
  Clock, 
  PlayCircle, 
  XCircle,
  FileText
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn, formatDate } from "../utils/ui";
import { useAuth } from "../services/AuthContext";

export default function WorkOrdersPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("Todas");

  useEffect(() => {
    loadWorkOrders();
  }, []);

  async function loadWorkOrders() {
    try {
      setLoading(true);
      setError(null);
      const data = await db.ordenesTrabajo.getAll();
      setOrdenes(data);
    } catch (err: any) {
      console.error("Error al cargar ordenes de trabajo:", err);
      setError(err?.message || "Error al intentar obtener las órdenes de trabajo. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("¿Está seguro de que desea eliminar esta Orden de Trabajo? Esta acción es irreversible.")) return;

    try {
      await db.ordenesTrabajo.delete(id);
      setOrdenes(prev => prev.filter(o => o.id !== id));
    } catch (err: any) {
      console.error("Error al eliminar orden de trabajo:", err);
      alert(err?.message || "Ocurrió un error al intentar eliminar la orden de trabajo.");
    }
  }

  const filteredOrdenes = ordenes.filter(o => {
    const num = o.numero || "";
    const clientName = o.clientes?.nombre || "";
    const tamboName = o.tambos?.nombre || "";
    const tech = o.tecnico_asignado || "";
    const dateStr = o.fecha || "";

    const matchesSearch = 
      num.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tamboName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tech.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dateStr.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEstado = filterEstado === "Todas" || o.estado === filterEstado;

    // Technician role visibility check (Fase 7: "Técnico: Puede visualizar únicamente las asignadas")
    const isTech = profile?.rol === "Técnico";
    const isAssignedToMe = isTech ? (
      tech.toLowerCase() === profile?.nombre?.toLowerCase() || 
      tech.toLowerCase() === profile?.email?.toLowerCase()
    ) : true;

    return matchesSearch && matchesEstado && isAssignedToMe;
  });

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case "Finalizada":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5" />
            Finalizada
          </span>
        );
      case "En proceso":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <PlayCircle className="w-3.5 h-3.5 animate-pulse" />
            En proceso
          </span>
        );
      case "Cancelada":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Cancelada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            <Clock className="w-3.5 h-3.5" />
            Pendiente
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Urgente":
        return <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Urgente</span>;
      case "Alta":
        return <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Alta</span>;
      case "Baja":
        return <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Baja</span>;
      default:
        return <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Media</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-emerald-500/20" />
        <p className="text-zinc-500 text-sm">Cargando historial de órdenes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-md mx-auto p-8 bg-[#0f0f0f] border border-white/5 rounded-3xl space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20">
          <AlertCircle className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white mb-2">Error de Conexión</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">{error}</p>
        </div>
        <button 
          onClick={loadWorkOrders}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-black py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
        >
          Reintentar consulta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Órdenes de Trabajo</h2>
          <p className="text-zinc-500 mt-1">Gestión, descarga, impresión y cierre de órdenes de mantenimiento.</p>
        </div>
        <div className="text-xs font-mono text-zinc-500 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
          Rol: {profile?.rol}
        </div>
      </div>

      {/* Controls: Search and Filters */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por número, cliente, tambo, técnico o fecha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0f0f0f] border border-white/5 rounded-2xl px-12 py-4 focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600 text-zinc-200"
            />
          </div>
          
          {/* State filter buttons */}
          <div className="flex flex-wrap items-center gap-2 bg-[#0f0f0f] p-1.5 rounded-2xl border border-white/5 self-start lg:self-auto">
            {["Todas", "Pendiente", "En proceso", "Finalizada", "Cancelada"].map((est) => (
              <button
                key={est}
                onClick={() => setFilterEstado(est)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                  filterEstado === est 
                    ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/10" 
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                )}
              >
                {est}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid listing */}
      {filteredOrdenes.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-12 bg-[#0f0f0f] border border-white/5 rounded-3xl space-y-4">
          <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-600 border border-white/5">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-white">No se encontraron órdenes de trabajo</h4>
            <p className="text-zinc-500 text-sm mt-1 max-w-sm mx-auto">
              {searchTerm || filterEstado !== "Todas" 
                ? "Prueba cambiando los filtros de búsqueda para encontrar lo que buscas."
                : "Puedes generar una nueva orden de trabajo accediendo a la ficha de cualquier Tambo en el sistema."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrdenes.map((orden) => (
            <Link 
              key={orden.id} 
              to={`/ordenes/${orden.id}`}
              className="group bg-[#0f0f0f] border border-white/5 hover:border-emerald-500/20 rounded-3xl p-6 transition-all hover:bg-[#121212] flex flex-col justify-between space-y-6 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/1 rounded-full blur-2xl group-hover:bg-emerald-500/5 transition-all" />
              
              <div className="space-y-4">
                {/* Number & Priority */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-emerald-400">{orden.numero}</span>
                  {getPriorityBadge(orden.prioridad)}
                </div>

                {/* Main titles */}
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                    {orden.tambos?.nombre || "Tambo Desconocido"}
                  </h3>
                  <p className="text-sm text-zinc-500 mt-0.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    {orden.clientes?.nombre || "Cliente Desconocido"}
                  </p>
                </div>

                <hr className="border-white/5" />

                {/* Metadatas */}
                <div className="space-y-2.5 text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-zinc-500" />
                    <span>Fecha: {formatDate(orden.fecha)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-zinc-500" />
                    <span>Técnico: <strong className="text-zinc-300">{orden.tecnico_asignado || "No asignado"}</strong></span>
                  </div>
                </div>
              </div>

              {/* Status and Action bar */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div>{getStatusBadge(orden.estado)}</div>
                
                <div className="flex items-center gap-2">
                  {profile?.rol !== "Solo lectura" && profile?.rol !== "Técnico" && (
                    <button
                      onClick={(e) => handleDelete(orden.id, e)}
                      className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                      title="Eliminar Orden de Trabajo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:bg-emerald-500 group-hover:text-black transition-all">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
