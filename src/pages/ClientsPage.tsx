import React, { useState, useEffect } from "react";
import { db } from "../services/db";
import { Cliente } from "../types/supabase";
import { Users, Phone, Mail, MapPin, Plus, Search, ChevronRight, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function ClientsPage() {
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadClientes();
  }, []);

  async function loadClientes() {
    try {
      setLoading(true);
      const data = await db.clientes.getAll();
      setClientes(data);
    } catch (error) {
      console.error("Error loading clients:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Estás seguro de que deseas eliminar al cliente "${name}"? Esta acción también eliminará todos sus tambos y mantenimientos asociados.`)) {
      return;
    }

    try {
      setDeletingId(id);
      await db.clientes.delete(id);
      setClientes(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error("Error deleting client:", error);
      alert("Error al eliminar el cliente.");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredClientes = clientes.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
          <p className="text-zinc-500 mt-1">Gestión de establecimientos y propietarios.</p>
        </div>
        <Link to="/clientes/nuevo" className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/20">
          <Plus className="w-5 h-5" />
          Nuevo Cliente
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
        <input
          type="text"
          placeholder="Buscar cliente por nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#0f0f0f] border border-white/5 rounded-2xl px-12 py-4 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClientes.map((cliente) => (
          <div key={cliente.id} className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 hover:border-white/20 transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <Users className="text-emerald-400 w-6 h-6" />
              </div>
              <Link to={`/tambos/nuevo?clienteId=${cliente.id}`} className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 hover:underline">
                + Agregar Tambo
              </Link>
            </div>

            <h3 className="text-xl font-bold mb-4 group-hover:text-emerald-400 transition-colors">{cliente.nombre}</h3>
            
            <div className="space-y-3 text-sm text-zinc-400">
              {cliente.telefono && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-zinc-600" />
                  <span>{cliente.telefono}</span>
                </div>
              )}
              {cliente.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-zinc-600" />
                  <span className="truncate">{cliente.email}</span>
                </div>
              )}
              {cliente.ubicacion && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-zinc-600" />
                  <span>{cliente.ubicacion}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-center">
              <span className="text-xs text-zinc-500 font-medium">Registrado: {new Date(cliente.created_at).toLocaleDateString()}</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleDelete(cliente.id, cliente.nombre)}
                  disabled={deletingId === cliente.id}
                  className="p-2 hover:bg-red-500/10 text-zinc-600 hover:text-red-500 rounded-lg transition-colors disabled:opacity-50"
                  title="Eliminar cliente"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <ChevronRight className="w-5 h-5 text-zinc-600" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredClientes.length === 0 && (
        <div className="text-center py-20 bg-[#0f0f0f] rounded-3xl border border-dashed border-white/10">
          <Users className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-500 font-medium">No se encontraron clientes.</p>
        </div>
      )}
    </div>
  );
}
