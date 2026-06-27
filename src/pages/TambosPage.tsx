import React, { useState, useEffect } from "react";
import { db } from "../services/db";
import { Tambo, Configuracion, TipoMantenimiento } from "../types/supabase";
import { Droplets, Search, Plus, MapPin, User, Trash2, AlertTriangle, X } from "lucide-react";
import { Link } from "react-router-dom";
import { calculateMaintenanceStatus, getGeneralStatus, Status } from "../utils/calculations";
import { cn } from "../utils/ui";

export default function TambosPage() {
  const [loading, setLoading] = useState(true);
  const [tambos, setTambos] = useState<(Tambo & { clienteNombre: string, status: Status })[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingTambo, setDeletingTambo] = useState<(Tambo & { clienteNombre: string }) | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    loadTambos();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  async function loadTambos() {
    try {
      setLoading(true);
      const [tambosData, configs, allMaintTypes, allMantenimientos] = await Promise.all([
        db.tambos.getAll(),
        db.configuracion.getAllWithHidden(),
        db.tipos_mantenimiento.getAll(),
        db.mantenimientos.getAll()
      ]);

      const tambosWithStatus = tambosData.map((t) => {
        const mantenimientos = allMantenimientos.filter(m => m.tambo_id === t.id);
        const statuses = calculateMaintenanceStatus(t, mantenimientos, configs, allMaintTypes);
        const generalStatus = getGeneralStatus(statuses);
        
        // Defensive check for clientes join
        const cliente = Array.isArray(t.clientes) ? t.clientes[0] : t.clientes;
        
        return {
          ...t,
          clienteNombre: cliente?.nombre || "Sin cliente",
          status: generalStatus
        };
      });

      setTambos(tambosWithStatus);
    } catch (error) {
      console.error("Error loading tambos:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deletingTambo) return;
    try {
      setDeleteLoading(true);
      await db.tambos.delete(deletingTambo.id);
      setNotification({
        message: `El tambo "${deletingTambo.nombre}" y todos sus registros asociados han sido eliminados correctamente.`,
        type: "success"
      });
      setDeletingTambo(null);
      await loadTambos();
    } catch (error: any) {
      console.error("Error deleting tambo:", error);
      setNotification({
        message: `Error al eliminar el tambo: ${error.message || "Ocurrió un problema inesperado."}`,
        type: "error"
      });
    } finally {
      setDeleteLoading(false);
    }
  }

  const filteredTambos = tambos.filter(t => 
    t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      {/* Floating Notifications */}
      {notification && (
        <div className={cn(
          "fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl transition-all duration-300 max-w-md animate-in fade-in slide-in-from-top-4",
          notification.type === "success" 
            ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-400" 
            : "bg-red-950/90 border-red-500/30 text-red-400"
        )}>
          {notification.type === "success" ? (
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-white/40 hover:text-white shrink-0 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tambos</h2>
          <p className="text-zinc-500 mt-1">Lista completa de unidades productivas.</p>
        </div>
        <Link to="/tambos/nuevo" className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20">
          <Plus className="w-5 h-5" />
          Nuevo Tambo
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
        <input
          type="text"
          placeholder="Buscar tambo por nombre o cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#0f0f0f] border border-white/5 rounded-2xl px-12 py-4 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTambos.map((tambo) => (
          <Link 
            key={tambo.id} 
            to={`/tambos/${tambo.id}`}
            className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 hover:border-white/20 transition-all group relative overflow-hidden"
          >
            {/* Status Bar */}
            <div className={cn(
              "absolute top-0 left-0 w-full h-1",
              tambo.status === "verde" ? "bg-emerald-500" : 
              tambo.status === "amarillo" ? "bg-amber-500" : 
              tambo.status === "rojo" ? "bg-red-500" : "bg-zinc-500"
            )} />

            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
                <Droplets className="text-zinc-400 w-6 h-6 group-hover:text-emerald-400 transition-colors" />
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={tambo.status} />
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeletingTambo(tambo);
                  }}
                  className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all"
                  title="Eliminar Tambo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h3 className="text-xl font-bold mb-2 group-hover:text-emerald-400 transition-colors">{tambo.nombre}</h3>
            
            <div className="space-y-3 text-sm text-zinc-400 mb-6">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-zinc-600" />
                <span className="font-semibold text-zinc-300">{tambo.clienteNombre}</span>
              </div>
              <div className="flex items-center gap-3">
                <Droplets className="w-4 h-4 text-zinc-600" />
                <span>{tambo.vacas_en_ordene} vacas • {tambo.bajadas} bajadas</span>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 flex justify-between items-center text-xs">
              <span className="text-zinc-500">Marca: {(tambo as any).marca_pezonera || tambo.insumos?.nombre || "N/A"}</span>
              <span className="text-emerald-400 font-bold uppercase tracking-widest">Ver Ficha</span>
            </div>
          </Link>
        ))}
      </div>

      {filteredTambos.length === 0 && (
        <div className="text-center py-20 bg-[#0f0f0f] rounded-3xl border border-dashed border-white/10">
          <Droplets className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-500 font-medium">No se encontraron tambos.</p>
        </div>
      )}

      {/* Confirmation Modal */}
      {deletingTambo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl max-w-md w-full p-6 space-y-6 animate-in zoom-in-95">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">¿Eliminar tambo?</h3>
                <p className="text-zinc-400 text-sm mt-2">
                  Esta acción eliminará de forma permanente el tambo <span className="text-white font-semibold">"{deletingTambo.nombre}"</span> de <span className="text-zinc-300 font-medium">{deletingTambo.clienteNombre}</span>.
                </p>
                <p className="text-red-400/80 text-xs mt-3 bg-red-500/5 border border-red-500/10 p-3 rounded-xl">
                  Se eliminarán todos los datos relacionados: mantenimientos, historial de lavados, configuraciones, fichas técnicas y reclamos asociados. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setDeletingTambo(null)}
                disabled={deleteLoading}
                className="px-5 py-2.5 rounded-xl border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-900 font-semibold text-sm transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-black font-bold text-sm transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-red-500/15"
              >
                {deleteLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  "Eliminar Permanentemente"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const styles = {
    verde: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amarillo: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rojo: "bg-red-500/10 text-red-400 border-red-500/20",
    gris: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
  };

  return (
    <div className={cn(
      "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
      styles[status]
    )}>
      {status === "verde" ? "Al día" : status === "amarillo" ? "Próximo" : status === "rojo" ? "Vencido" : "Nunca realizado"}
    </div>
  );
}
