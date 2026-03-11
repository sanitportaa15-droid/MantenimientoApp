import React, { useEffect, useState } from "react";
import { 
  Plus, 
  Users, 
  Droplets, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { db } from "../services/db";
import { Cliente, Tambo, Configuracion, Mantenimiento } from "../types/supabase";
import { calculateMaintenanceStatus, getGeneralStatus, Status } from "../utils/calculations";
import { cn } from "../utils/ui";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    clientes: 0,
    tambos: 0,
    alDia: 0,
    proximos: 0,
    vencidos: 0
  });
  const [tambosList, setTambosList] = useState<(Tambo & { clienteNombre: string, status: Status })[]>([]);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [clientes, tambos, configs] = await Promise.all([
          db.clientes.getAll(),
          db.tambos.getAll(),
          db.configuracion.getAll()
        ]);

        const tambosWithStatus = await Promise.all(tambos.map(async (t) => {
          const mantenimientos = await db.mantenimientos.getByTambo(t.id);
          const statuses = calculateMaintenanceStatus(t, mantenimientos, configs);
          const generalStatus = getGeneralStatus(statuses);
          return {
            ...t,
            clienteNombre: t.clientes.nombre,
            status: generalStatus
          };
        }));

        setStats({
          clientes: clientes.length,
          tambos: tambos.length,
          alDia: tambosWithStatus.filter(t => t.status === "verde").length,
          proximos: tambosWithStatus.filter(t => t.status === "amarillo").length,
          vencidos: tambosWithStatus.filter(t => t.status === "rojo").length
        });

        setTambosList(tambosWithStatus);
      } catch (error) {
        console.error("Error loading dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

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
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-zinc-500 mt-1">Resumen general del estado técnico de los tambos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/clientes/nuevo" className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black px-4 py-2 rounded-xl font-semibold transition-colors">
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </Link>
          <Link to="/tambos/nuevo" className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-semibold border border-white/10 transition-colors">
            <Plus className="w-4 h-4" />
            Nuevo Tambo
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Clientes" value={stats.clientes} icon={Users} color="zinc" />
        <StatCard label="Tambos" value={stats.tambos} icon={Droplets} color="zinc" />
        <StatCard label="Al día" value={stats.alDia} icon={CheckCircle2} color="emerald" />
        <StatCard label="Próximos" value={stats.proximos} icon={AlertTriangle} color="amber" />
        <StatCard label="Vencidos" value={stats.vencidos} icon={XCircle} color="red" />
      </div>

      {/* Tambos List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xl font-bold">Estado Técnico del Equipo</h3>
          <Link to="/tambos" className="text-emerald-400 text-sm font-medium flex items-center gap-1 hover:underline">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tambosList.map((tambo) => (
            <Link 
              key={tambo.id} 
              to={`/tambos/${tambo.id}`}
              className="group bg-[#0f0f0f] border border-white/5 rounded-2xl p-5 hover:border-white/20 transition-all hover:shadow-xl hover:shadow-black/40"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-lg group-hover:text-emerald-400 transition-colors">{tambo.nombre}</h4>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{tambo.clienteNombre}</p>
                </div>
                <StatusIndicator status={tambo.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold">Vacas</p>
                  <p className="font-mono font-medium">{tambo.vacas_en_ordene}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold">Bajadas</p>
                  <p className="font-mono font-medium">{tambo.bajadas}</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
                <span>Último cambio: {tambo.fecha_ultimo_cambio || 'N/A'}</span>
                <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md font-bold">DETALLES</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string, value: number, icon: any, color: "zinc" | "emerald" | "amber" | "red" }) {
  const colors = {
    zinc: "text-zinc-400 bg-zinc-400/10",
    emerald: "text-emerald-400 bg-emerald-400/10",
    amber: "text-amber-400 bg-amber-400/10",
    red: "text-red-400 bg-red-400/10"
  };

  return (
    <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-5">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", colors[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold mt-1 font-mono">{value}</p>
    </div>
  );
}

function StatusIndicator({ status }: { status: Status }) {
  const styles = {
    verde: "bg-emerald-500 shadow-emerald-500/50",
    amarillo: "bg-amber-500 shadow-amber-500/50",
    rojo: "bg-red-500 shadow-red-500/50"
  };

  return (
    <div className={cn("w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]", styles[status])} />
  );
}
