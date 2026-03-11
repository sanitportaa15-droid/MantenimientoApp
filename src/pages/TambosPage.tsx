import React, { useState, useEffect } from "react";
import { db } from "../services/db";
import { Tambo, Configuracion, MantenimientoTipo } from "../types/supabase";
import { Droplets, Search, Plus, MapPin, User } from "lucide-react";
import { Link } from "react-router-dom";
import { calculateMaintenanceStatus, getGeneralStatus, Status } from "../utils/calculations";
import { cn } from "../utils/ui";

export default function TambosPage() {
  const [loading, setLoading] = useState(true);
  const [tambos, setTambos] = useState<(Tambo & { clienteNombre: string, status: Status })[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadTambos();
  }, []);

  async function loadTambos() {
    try {
      setLoading(true);
      const [tambosData, configs] = await Promise.all([
        db.tambos.getAll(),
        db.configuracion.getAllWithHidden()
      ]);

      const tambosWithStatus = await Promise.all(tambosData.map(async (t) => {
        const mantenimientos = await db.mantenimientos.getByTambo(t.id);
        
        // Extract active types from configs
        const activeConfig = configs.find(c => c.clave === `tambo_mantenimientos_${t.id}`);
        let activeTypes = Object.values(MantenimientoTipo);
        if (activeConfig) {
          try {
            activeTypes = JSON.parse(activeConfig.valor);
          } catch (e) {
            console.error("Error parsing active types for tambo", t.id);
          }
        }

        const statuses = calculateMaintenanceStatus(t, mantenimientos, configs, activeTypes);
        const generalStatus = getGeneralStatus(statuses);
        return {
          ...t,
          clienteNombre: t.clientes.nombre,
          status: generalStatus
        };
      }));

      setTambos(tambosWithStatus);
    } catch (error) {
      console.error("Error loading tambos:", error);
    } finally {
      setLoading(false);
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
    <div className="space-y-8">
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
              <StatusBadge status={tambo.status} />
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
              <span className="text-zinc-500">Marca: {tambo.marca_pezonera || "N/A"}</span>
              <span className="bg-white/5 px-2 py-1 rounded-md text-zinc-300 font-mono">
                {tambo.fecha_ultimo_cambio === '1900-01-01' ? "NUNCA" : (tambo.fecha_ultimo_cambio ? new Date(tambo.fecha_ultimo_cambio).toLocaleDateString() : "Sin fecha")}
              </span>
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
