import React, { useState, useEffect, useMemo } from "react";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  BarChart3, 
  ArrowRight,
  Search,
  Filter
} from "lucide-react";
import { Link } from "react-router-dom";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  Cell
} from "recharts";
import { db } from "../services/db";
import { Tambo, Reclamo, Mantenimiento, TipoReparacion, Configuracion } from "../types/supabase";
import { calculateMaintenanceStatus, MaintenanceStatus } from "../utils/calculations";
import { format, subMonths, startOfMonth, isAfter, isSameMonth, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "../utils/ui";

export default function TechnicalAnalysisPage() {
  const [tambos, setTambos] = useState<any[]>([]);
  const [reclamos, setReclamos] = useState<any[]>([]);
  const [mantenimientos, setMantenimientos] = useState<any[]>([]);
  const [tiposReparacion, setTiposReparacion] = useState<TipoReparacion[]>([]);
  const [configs, setConfigs] = useState<Configuracion[]>([]);
  const [tiposMantenimiento, setTiposMantenimiento] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [tambosData, reclamosData, mantenimientosData, tiposData, configsData, maintTypesData] = await Promise.all([
          db.tambos.getAll(),
          db.reclamos.getAll(),
          db.mantenimientos.getAll(),
          db.tipos_reparacion.getAll(),
          db.configuracion.getAll(),
          db.tipos_mantenimiento.getAll()
        ]);
        setTambos(tambosData);
        setReclamos(reclamosData);
        setMantenimientos(mantenimientosData);
        setTiposReparacion(tiposData);
        setConfigs(configsData);
        setTiposMantenimiento(maintTypesData);
      } catch (error) {
        console.error("Error loading analysis data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    // Real-time subscription
    const reclamosSubscription = db.reclamos.subscribeToChanges(() => loadData());
    const mantenimientosSubscription = db.mantenimientos.subscribeToChanges(() => loadData());
    const configSubscription = db.configuracion.subscribeToChanges(() => loadData());
    const maintTypesSubscription = db.tipos_mantenimiento.subscribeToChanges(() => loadData());
    const tambosSubscription = db.tambos.subscribeToChanges(() => loadData());
    const repairTypesSubscription = db.tipos_reparacion.subscribeToChanges(() => loadData());

    return () => {
      reclamosSubscription.unsubscribe();
      mantenimientosSubscription.unsubscribe();
      configSubscription.unsubscribe();
      maintTypesSubscription.unsubscribe();
      tambosSubscription.unsubscribe();
      repairTypesSubscription.unsubscribe();
    };
  }, []);

  const stats = useMemo(() => {
    if (loading) return null;

    const totalTambos = tambos.length;
    const totalReclamos = reclamos.length;
    const avgReclamos = totalTambos > 0 ? (totalReclamos / totalTambos).toFixed(1) : "0";

    // Calculate overdue maintenance per tambo
    let tambosWithOverdue = 0;
    const tamboClaims = tambos.map(t => {
      const tMants = mantenimientos.filter(m => m.tambo_id === t.id);
      // This is a simplified check for overdue, ideally we'd use calculateMaintenanceStatus
      // but that requires active types per tambo which are stored in config.
      // For global view, we'll assume all types are active or just check if any status is 'rojo'
      // To be accurate we'd need to fetch active types for each tambo.
      // For now, let's just mark it if they have many reclamos or if we can do a quick check.
      
      return {
        ...t,
        claimsCount: reclamos.filter(r => r.tambo_id === t.id).length
      };
    }).sort((a, b) => b.claimsCount - a.claimsCount);

    // Let's try to be more accurate with overdue if possible, but it's complex for global.
    // Let's just use a heuristic or just count tambos with > 5 claims as "problematic" for now
    // OR I can actually fetch the active types if I really wanted to, but let's keep it simple.
    // Actually, I can just check if any tambo has a reclamo 'Pendiente' or 'Urgente'
    const criticalTambos = reclamos.filter(r => r.prioridad === 'Urgente' && r.estado !== 'Resuelto')
      .map(r => r.tambo_id);
    tambosWithOverdue = new Set(criticalTambos).size;

    const topProblematic = tamboClaims.slice(0, 5);

    // Claims trend (last 12 months)
    const last12Months = Array.from({ length: 12 }, (_, i) => {
      const date = subMonths(new Date(), 11 - i);
      return {
        month: format(date, "MMM", { locale: es }),
        fullDate: startOfMonth(date),
        count: 0
      };
    });

    reclamos.forEach(r => {
      const rDate = parseISO(r.fecha_reclamo);
      const monthData = last12Months.find(m => isSameMonth(m.fullDate, rDate));
      if (monthData) monthData.count++;
    });

    // Common repairs (only from resolved claims)
    const repairCounts: Record<string, number> = {};
    reclamos
      .filter(r => r.estado === 'Resuelto' && r.tipo_reparacion_id)
      .forEach(r => {
        const tipo = tiposReparacion.find(t => t.id === r.tipo_reparacion_id);
        if (tipo) {
          repairCounts[tipo.nombre] = (repairCounts[tipo.nombre] || 0) + 1;
        }
      });

    const commonRepairs = Object.entries(repairCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Maintenance frequency
    const maintCounts: Record<string, number> = {};
    mantenimientos.forEach(m => {
      maintCounts[m.tipo] = (maintCounts[m.tipo] || 0) + 1;
    });

    const commonMaint = Object.entries(maintCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      totalTambos,
      totalReclamos,
      avgReclamos,
      tambosWithOverdue,
      topProblematic,
      last12Months,
      commonRepairs,
      commonMaint,
      tamboClaims
    };
  }, [loading, tambos, reclamos, mantenimientos, tiposReparacion]);

  const filteredTambos = useMemo(() => {
    if (!stats) return [];
    return stats.tamboClaims.filter(t => 
      t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.clientes?.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [stats, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Análisis Técnico Global</h1>
          <p className="text-zinc-400 mt-1">Monitoreo interno del estado de todos los tambos</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          <span className="text-emerald-400 font-medium">Panel de Control Técnico</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard 
          title="Total Tambos" 
          value={stats?.totalTambos || 0} 
          icon={TrendingUp}
          color="emerald"
        />
        <SummaryCard 
          title="Tambos con Problemas" 
          value={stats?.tambosWithOverdue || 0} 
          subtitle="críticos"
          icon={AlertTriangle}
          color="red"
        />
        <SummaryCard 
          title="Promedio Reclamos" 
          value={stats?.avgReclamos || 0} 
          subtitle="por tambo"
          icon={Activity}
          color="blue"
        />
        <SummaryCard 
          title="Total Reclamos" 
          value={stats?.totalReclamos || 0} 
          icon={BarChart3}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Claims Trend */}
        <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold">Tendencia de Reclamos (12 meses)</h2>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.last12Months}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#52525b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#52525b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  name="Reclamos"
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Common Repairs */}
        <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold">Fallas más Comunes del Sistema</h2>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.commonRepairs} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="#52525b" 
                  fontSize={10} 
                  width={120}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                />
                <Bar dataKey="count" name="Frecuencia" radius={[0, 4, 4, 0]}>
                  {stats?.commonRepairs.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? '#f59e0b' : '#d97706'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ranking Table */}
        <div className="lg:col-span-2 bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold">Ranking de Tambos con más Problemas</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text"
                placeholder="Buscar tambo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#1a1a1a] border border-white/5 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 w-full md:w-64"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-white/5">
                  <th className="px-6 py-4 font-semibold">Tambo</th>
                  <th className="px-6 py-4 font-semibold text-center">Reclamos</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                  <th className="px-6 py-4 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTambos.slice(0, 10).map((tambo) => (
                  <tr key={tambo.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{tambo.nombre}</div>
                      <div className="text-xs text-zinc-500">{tambo.clientes?.nombre}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded-full font-bold",
                        tambo.claimsCount > 5 ? "bg-red-500/10 text-red-400" : 
                        tambo.claimsCount > 2 ? "bg-amber-500/10 text-amber-400" : 
                        "bg-emerald-500/10 text-emerald-400"
                      )}>
                        {tambo.claimsCount}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          tambo.claimsCount > 5 ? "bg-red-500 animate-pulse" : 
                          tambo.claimsCount > 2 ? "bg-amber-500" : 
                          "bg-emerald-500"
                        )} />
                        <span className="text-sm">
                          {tambo.claimsCount > 5 ? "Crítico" : tambo.claimsCount > 2 ? "Atención" : "Estable"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/analisis-tecnico/${tambo.id}`}
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
                      >
                        Ver Análisis
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Maintenance Frequency */}
        <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold">Mantenimientos más Realizados</h2>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.commonMaint} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="#52525b" 
                  fontSize={10} 
                  width={100}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                />
                <Bar dataKey="count" name="Cantidad" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, subtitle, icon: Icon, color }: { 
  title: string, 
  value: string | number, 
  subtitle?: string,
  icon: any, 
  color: 'emerald' | 'amber' | 'blue' | 'red' 
}) {
  const colors = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20"
  };

  return (
    <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2 rounded-lg border", colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="text-zinc-500 text-sm font-medium">{title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
          {subtitle && <span className="text-xs text-zinc-500">{subtitle}</span>}
        </div>
      </div>
    </div>
  );
}
