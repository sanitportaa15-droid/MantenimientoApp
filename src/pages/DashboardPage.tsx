import React, { useEffect, useState } from "react";
import { 
  Plus, 
  Users, 
  Droplets, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  ArrowRight,
  HelpCircle,
  MessageSquare,
  Wrench,
  AlertCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { db, normalizeMaintenanceName } from "../services/db";
import { Cliente, Tambo, Configuracion, Mantenimiento, ReclamoEstado, TipoMantenimiento } from "../types/supabase";
import { calculateMaintenanceStatus, getGeneralStatus, Status } from "../utils/calculations";
import { cn } from "../utils/ui";

function getActiveMaintenanceNames(tamboId: string, configs: Configuracion[]): string[] {
  const defaultMaintNames = [
    "Bomba centrífuga de leche",
    "Bomba de vacío",
    "Bomba diafragma de leche",
    "Cambio de bujes",
    "Cambio de diafragma de los brazos",
    "Cambio de pezoneras",
    "Cambio de sogas",
    "Caucho línea de leche y lavado",
    "Kit de colector de leche",
    "Mangueras de leche",
    "Mangueras de pulsado",
    "Pulsadores",
    "Sensor de leche"
  ].map(normalizeMaintenanceName);

  const configRow = configs.find(c => c.clave === `tambo_mantenimientos_${tamboId}`);
  if (configRow) {
    try {
      const parsed = JSON.parse(configRow.valor);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeMaintenanceName);
      }
    } catch (e) {
      // ignore
    }
  }
  return defaultMaintNames;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [stats, setStats] = useState({
    clientes: 0,
    tambos: 0,
    alDia: 0,
    proximos: 0,
    vencidos: 0,
    nunca: 0
  });
  const [reclamosStats, setReclamosStats] = useState({
    pendientes: 0,
    programados: 0,
    resueltos: 0
  });
  const [tambosList, setTambosList] = useState<(Tambo & { clienteNombre: string, status: Status })[]>([]);
  const [recentReclamos, setRecentReclamos] = useState<any[]>([]);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);
        const [clientes, tambos, configs, reclamos, allMaintTypes, allMantenimientos] = await Promise.all([
          db.clientes.getAll(),
          db.tambos.getAll(),
          db.configuracion.getAllWithHidden(),
          db.reclamos.getAll(),
          db.tipos_mantenimiento.getAll(),
          db.mantenimientos.getAll()
        ]);

        const tambosWithStatus = tambos.map((t) => {
          const mantenimientos = allMantenimientos.filter(m => m.tambo_id === t.id);
          const statuses = calculateMaintenanceStatus(t, mantenimientos, configs, allMaintTypes);
          const activeNames = getActiveMaintenanceNames(t.id, configs);
          const filteredStatuses = statuses.filter(s => {
            return activeNames.some(name => name.toLowerCase().trim() === s.tipo.toLowerCase().trim());
          });
          const generalStatus = getGeneralStatus(filteredStatuses);
          
          // Defensive check for clientes join
          const cliente = Array.isArray(t.clientes) ? t.clientes[0] : t.clientes;
          
          return {
            ...t,
            clienteNombre: cliente?.nombre || "Sin cliente",
            status: generalStatus
          };
        });

        let countAlDia = 0;
        let countProximos = 0;
        let countVencidos = 0;
        let countNunca = 0;

        for (const t of tambos) {
          const mantenimientos = allMantenimientos.filter(m => m.tambo_id === t.id);
          const statuses = calculateMaintenanceStatus(t, mantenimientos, configs, allMaintTypes);
          const activeNames = getActiveMaintenanceNames(t.id, configs);
          const filteredStatuses = statuses.filter(s => {
            return activeNames.some(name => name.toLowerCase().trim() === s.tipo.toLowerCase().trim());
          });

          filteredStatuses.forEach(s => {
            if (s.status === "verde") countAlDia++;
            else if (s.status === "amarillo") countProximos++;
            else if (s.status === "rojo") countVencidos++;
            else if (s.status === "gris") countNunca++;
          });
        }

        setStats({
          clientes: clientes.length,
          tambos: tambos.length,
          alDia: countAlDia,
          proximos: countProximos,
          vencidos: countVencidos,
          nunca: countNunca
        });

        setReclamosStats({
          pendientes: reclamos.filter(r => r.estado === ReclamoEstado.PENDIENTE).length,
          programados: reclamos.filter(r => r.estado === ReclamoEstado.PROGRAMADO).length,
          resueltos: reclamos.filter(r => r.estado === ReclamoEstado.RESUELTO).length
        });

        setRecentReclamos(reclamos.filter(r => r.estado !== ReclamoEstado.RESUELTO).slice(0, 3));
        setTambosList(tambosWithStatus);
      } catch (err: any) {
        console.error("Error loading dashboard:", err);
        setError(err?.message || "Error al cargar la información del panel. Comprueba tu conexión o vuelve a iniciar sesión.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();

    // Real-time subscriptions
    const mantenimientosSubscription = db.mantenimientos.subscribeToChanges(() => {
      loadDashboard();
    });

    const configSubscription = db.configuracion.subscribeToChanges(() => {
      loadDashboard();
    });

    const maintTypesSubscription = db.tipos_mantenimiento.subscribeToChanges(() => {
      loadDashboard();
    });

    const tambosSubscription = db.tambos.subscribeToChanges(() => {
      loadDashboard();
    });

    const reclamosSubscription = db.reclamos.subscribeToChanges(() => {
      loadDashboard();
    });

    return () => {
      mantenimientosSubscription.unsubscribe();
      configSubscription.unsubscribe();
      maintTypesSubscription.unsubscribe();
      tambosSubscription.unsubscribe();
      reclamosSubscription.unsubscribe();
    };
  }, [retryCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
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
          <h3 className="text-xl font-bold text-white mb-2">Error al cargar el panel</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">{error}</p>
        </div>
        <button 
          onClick={() => setRetryCount(prev => prev + 1)}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-black py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
        >
          Reintentar consulta
        </button>
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
          <Link to="/reclamos/nuevo" className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-4 py-2 rounded-xl font-semibold border border-amber-500/20 transition-colors">
            <Plus className="w-4 h-4" />
            Nuevo Reclamo
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard label="Clientes" value={stats.clientes} icon={Users} color="zinc" to="/clientes" />
        <StatCard label="Tambos" value={stats.tambos} icon={Droplets} color="zinc" to="/tambos" />
        <StatCard label="Al día" value={stats.alDia} icon={CheckCircle2} color="emerald" to="/mantenimientos-estado?status=verde" />
        <StatCard label="Próximos" value={stats.proximos} icon={AlertTriangle} color="amber" to="/mantenimientos-estado?status=amarillo" />
        <StatCard label="Vencidos" value={stats.vencidos} icon={XCircle} color="red" to="/mantenimientos-estado?status=rojo" />
        <StatCard label="Sin datos" value={stats.nunca} icon={HelpCircle} color="zinc" to="/mantenimientos-estado?status=gris" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tambos List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-bold">Estado Técnico del Equipo</h3>
            <Link to="/tambos" className="text-emerald-400 text-sm font-medium flex items-center gap-1 hover:underline">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tambosList.slice(0, 4).map((tambo) => (
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
                  <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md font-bold text-[10px]">VER DETALLES</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Reclamos Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-bold">Reclamos</h3>
            <Link to="/reclamos" className="text-emerald-400 text-sm font-medium flex items-center gap-1 hover:underline">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl overflow-hidden">
            <div className="grid grid-cols-3 border-b border-white/5">
              <div className="p-4 text-center border-r border-white/5">
                <p className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Pendientes</p>
                <p className="text-xl font-bold font-mono">{reclamosStats.pendientes}</p>
              </div>
              <div className="p-4 text-center border-r border-white/5">
                <p className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Programados</p>
                <p className="text-xl font-bold font-mono text-blue-400">{reclamosStats.programados}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Resueltos</p>
                <p className="text-xl font-bold font-mono text-emerald-400">{reclamosStats.resueltos}</p>
              </div>
            </div>

            <div className="p-2 space-y-2">
              {recentReclamos.length > 0 ? (
                recentReclamos.map(r => (
                  <Link 
                    key={r.id} 
                    to="/reclamos"
                    className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-2xl transition-colors group"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      r.estado === ReclamoEstado.PENDIENTE ? "bg-zinc-500/10 text-zinc-400" : "bg-blue-500/10 text-blue-400"
                    )}>
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate group-hover:text-emerald-400 transition-colors">{r.titulo}</p>
                      <p className="text-[10px] text-zinc-500 font-medium uppercase truncate">
                        {Array.isArray(r.tambos) ? r.tambos[0]?.nombre : r.tambos?.nombre}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-emerald-400 transition-colors" />
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-zinc-600 text-sm">No hay reclamos activos</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, to }: { label: string, value: number, icon: any, color: "zinc" | "emerald" | "amber" | "red", to?: string }) {
  const colors = {
    zinc: "text-zinc-400 bg-zinc-400/10",
    emerald: "text-emerald-400 bg-emerald-400/10",
    amber: "text-amber-400 bg-amber-400/10",
    red: "text-red-400 bg-red-400/10"
  };

  const content = (
    <>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", colors[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold mt-1 font-mono">{value}</p>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-5 hover:border-white/20 transition-all hover:shadow-xl hover:shadow-black/40 group">
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-5">
      {content}
    </div>
  );
}

function StatusIndicator({ status }: { status: Status }) {
  const styles = {
    verde: "bg-emerald-500 shadow-emerald-500/50",
    amarillo: "bg-amber-500 shadow-amber-500/50",
    rojo: "bg-red-500 shadow-red-500/50",
    gris: "bg-zinc-500 shadow-zinc-500/50"
  };

  return (
    <div className={cn("w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]", styles[status])} />
  );
}
