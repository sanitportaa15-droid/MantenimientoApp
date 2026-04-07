import React, { useEffect, useState } from "react";
import { 
  Wrench, 
  Search, 
  Filter, 
  Calendar, 
  ArrowRight,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  MoreVertical
} from "lucide-react";
import { Link } from "react-router-dom";
import { db } from "../services/db";
import { Relevo, Tambo } from "../types/supabase";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "../utils/ui";
import RelevoModal from "../components/RelevoModal";

export default function RelevosPage() {
  const [relevos, setRelevos] = useState<(Relevo & { tambo: Tambo & { clientes: { nombre: string } } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRelevo, setEditingRelevo] = useState<Relevo | null>(null);

  const loadRelevos = async () => {
    try {
      setLoading(true);
      const data = await db.relevos.getAllWithDetails();
      setRelevos(data || []);
    } catch (error) {
      console.error("Error loading relevos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRelevos();

    const subscription = db.relevos.subscribeToChanges(() => {
      loadRelevos();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const filteredRelevos = relevos.filter(r => 
    r.tambo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.tambo.clientes.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.marca_equipo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.tipo_equipo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (relevo: Relevo) => {
    setEditingRelevo(relevo);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Está seguro de que desea eliminar este relevo técnico?")) return;
    try {
      await db.relevos.delete(id);
      // loadRelevos will be called by subscription
    } catch (error) {
      console.error("Error deleting relevo:", error);
      alert("Error al eliminar el relevo");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Relevos Técnicos</h2>
          <p className="text-zinc-500 mt-1">Historial global de relevos técnicos de todos los tambos.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black px-4 py-2 rounded-xl font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Relevo
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por tambo, cliente o marca..."
            className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Relevos List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredRelevos.length > 0 ? (
          filteredRelevos.map((relevo) => (
            <div 
              key={relevo.id}
              className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all group"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Wrench className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Link to={`/tambos/${relevo.tambo_id}`} className="font-bold text-lg hover:text-emerald-400 transition-colors">
                        {relevo.tambo.nombre}
                      </Link>
                      <span className="text-zinc-600">•</span>
                      <span className="text-sm text-zinc-500 font-medium uppercase tracking-wider">{relevo.tambo.clientes.nombre}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(new Date(relevo.fecha_relevo), "PPP", { locale: es })}
                      </span>
                      {relevo.marca_equipo && (
                        <span className="font-medium text-zinc-300">
                          {relevo.marca_equipo} {relevo.tipo_equipo && `- ${relevo.tipo_equipo}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <button 
                    onClick={() => handleEdit(relevo)}
                    className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(relevo.id)}
                    className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Link 
                    to={`/tambos/${relevo.tambo_id}`}
                    className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ml-2"
                  >
                    Ver Tambo
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {relevo.observaciones && (
                <div className="mt-4 p-3 bg-white/[0.02] rounded-xl border border-white/5">
                  <p className="text-sm text-zinc-400 italic line-clamp-2">"{relevo.observaciones}"</p>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-[#0f0f0f] border border-dashed border-white/10 rounded-3xl">
            <Wrench className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-400">No se encontraron relevos</h3>
            <p className="text-zinc-600 max-w-xs mx-auto mt-2">
              {searchTerm ? "Intenta con otros términos de búsqueda." : "Aún no se han registrado relevos técnicos."}
            </p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <RelevoModal
          onClose={() => {
            setIsModalOpen(false);
            setEditingRelevo(null);
          }}
          tamboId={editingRelevo?.tambo_id || ""}
          relevo={editingRelevo || undefined}
          onSuccess={() => {
            setIsModalOpen(false);
            setEditingRelevo(null);
            loadRelevos();
          }}
        />
      )}
    </div>
  );
}
