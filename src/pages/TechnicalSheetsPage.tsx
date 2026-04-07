import React, { useState, useEffect } from "react";
import { 
  Search, 
  FileText, 
  ChevronRight, 
  Plus, 
  Droplets,
  Settings2,
  Info
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "../services/db";
import { Tambo, Cliente, FichaTecnica } from "../types/supabase";
import { cn } from "../utils/ui";

export default function TechnicalSheetsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tambos, setTambos] = useState<(Tambo & { clienteNombre: string, ficha?: FichaTecnica | null })[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTamboId, setSelectedTamboId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function loadData() {
    try {
      const [allTambos, allFichas] = await Promise.all([
        db.tambos.getAll(),
        db.ficha_tecnica.getAll()
      ]);

      const fichasMap = new Map(allFichas.map(f => [f.tambo_id, f]));

      const combinedData = allTambos.map(t => ({
        ...t,
        clienteNombre: t.clientes?.nombre || "Sin cliente",
        ficha: fichasMap.get(t.id)
      }));

      setTambos(combinedData);
    } catch (error) {
      console.error("Error loading technical sheets:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredTambos = tambos.filter(t => 
    t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditFicha = (tamboId: string) => {
    navigate(`/tambos/editar/${tamboId}`);
  };

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
          <h2 className="text-3xl font-bold tracking-tight">Fichas Técnicas</h2>
          <p className="text-zinc-500 mt-1">Gestión de información estructural y equipamiento de los tambos.</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por tambo o cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0f0f0f] border border-white/5 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:border-emerald-500/50 transition-all shadow-lg shadow-black/20"
          />
        </div>
      </div>

      {/* Tambos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTambos.map((tambo) => (
          <div 
            key={tambo.id}
            className="bg-[#0f0f0f] border border-white/5 rounded-3xl overflow-hidden hover:border-white/20 transition-all group flex flex-col"
          >
            <div className="p-6 flex-1">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                  <Droplets className="w-6 h-6 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                </div>
                {tambo.ficha ? (
                  <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border border-emerald-500/20">
                    Completa
                  </span>
                ) : (
                  <span className="bg-zinc-500/10 text-zinc-500 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border border-white/5">
                    Pendiente
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold mb-1 group-hover:text-emerald-400 transition-colors">{tambo.nombre}</h3>
              <p className="text-sm text-zinc-500 font-medium uppercase tracking-wider mb-6">{tambo.clienteNombre}</p>

              {tambo.ficha ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Equipo:</span>
                    <span className="font-medium text-zinc-300">{tambo.ficha.tipo_equipo || "N/A"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Bajadas:</span>
                    <span className="font-medium text-zinc-300">{tambo.ficha.bajadas || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Pezoneras:</span>
                    <span className="font-medium text-zinc-300 truncate max-w-[150px]">
                      {(tambo.ficha as any)?.pezoneras?.nombre || tambo.ficha.tipo_pezoneras || "N/A"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 bg-white/5 rounded-2xl border border-dashed border-white/10">
                  <Info className="w-8 h-8 text-zinc-700 mb-2" />
                  <p className="text-xs text-zinc-600 font-medium">Sin información técnica registrada</p>
                </div>
              )}
            </div>

            <button
              onClick={() => handleEditFicha(tambo.id)}
              className="w-full p-4 bg-white/5 hover:bg-emerald-500 hover:text-black transition-all flex items-center justify-center gap-2 font-bold text-sm border-t border-white/5"
            >
              {tambo.ficha ? <Settings2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {tambo.ficha ? "Editar Ficha" : "Crear Ficha"}
            </button>
          </div>
        ))}
      </div>

      {filteredTambos.length === 0 && (
        <div className="text-center py-20 bg-[#0f0f0f] border border-dashed border-white/10 rounded-3xl">
          <Search className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
          <p className="text-zinc-500 font-medium">No se encontraron tambos que coincidan con tu búsqueda.</p>
        </div>
      )}

    </div>
  );
}
