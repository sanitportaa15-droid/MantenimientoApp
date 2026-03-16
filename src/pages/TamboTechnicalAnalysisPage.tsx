import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  ArrowLeft,
  Calendar,
  Wrench,
  ClipboardList
} from "lucide-react";
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
import { calculateMaintenanceStatus, MaintenanceStatus, calculateReliability, getReliabilityStatus } from "../utils/calculations";
import { format, subMonths, startOfMonth, isAfter, isSameMonth, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "../utils/ui";

export default function TamboTechnicalAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tambo, setTambo] = useState<any>(null);
  const [reclamos, setReclamos] = useState<Reclamo[]>([]);
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [tiposReparacion, setTiposReparacion] = useState<TipoReparacion[]>([]);
  const [configs, setConfigs] = useState<Configuracion[]>([]);
  const [allMaintTypes, setAllMaintTypes] = useState<any[]>([]);
  const [activeTypesNames, setActiveTypesNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const [tamboData, reclamosData, mantenimientosData, tiposData, configsData, maintTypesData, activeNames] = await Promise.all([
          db.tambos.getById(id),
          db.reclamos.getByTambo(id),
          db.mantenimientos.getByTambo(id),
          db.tipos_reparacion.getAll(),
          db.configuracion.getAll(),
          db.tipos_mantenimiento.getAll(),
          db.tambos.getMantenimientosActivos(id)
        ]);
        setTambo(tamboData);
        setReclamos(reclamosData);
        setMantenimientos(mantenimientosData);
        setTiposReparacion(tiposData);
        setConfigs(configsData);
        setAllMaintTypes(maintTypesData);
        setActiveTypesNames(activeNames);
      } catch (error) {
        console.error("Error loading tambo analysis:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const statuses = useMemo(() => {
    if (!tambo || !mantenimientos || !configs || !allMaintTypes) return [];
    const activeTypes = allMaintTypes.filter(t => activeTypesNames.includes(t.nombre));
    return calculateMaintenanceStatus(tambo, mantenimientos, configs, activeTypes);
  }, [tambo, mantenimientos, configs, allMaintTypes, activeTypesNames]);

  const analysis = useMemo(() => {
    if (loading || !tambo || !configs) return null;

    // Reliability Score Calculation using the utility function
    const finalScore = calculateReliability(reclamos, mantenimientos, statuses, configs);
    const relStatus = getReliabilityStatus(finalScore);

    // Charts Data
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
      .sort((a, b) => b.count - a.count);

    const maintCounts: Record<string, number> = {};
    mantenimientos.forEach(m => {
      maintCounts[m.tipo] = (maintCounts[m.tipo] || 0) + 1;
    });

    const commonMaint = Object.entries(maintCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Diagnosis
    const diagnosisMessages = [];
    if (finalScore < 70) diagnosisMessages.push("Estado crítico: Requiere intervención técnica inmediata.");
    
    const overdueCount = statuses.filter(s => s.status === 'rojo').length;
    if (overdueCount > 0) diagnosisMessages.push(`Hay ${overdueCount} mantenimientos vencidos que afectan la confiabilidad.`);
    
    if (reclamos.length > 5) diagnosisMessages.push("Alta frecuencia de reclamos en el último período.");
    if (commonRepairs.length > 0 && commonRepairs[0].count > 3) {
      diagnosisMessages.push(`Falla recurrente detectada: ${commonRepairs[0].name}.`);
    }
    if (diagnosisMessages.length === 0) diagnosisMessages.push("El equipo opera dentro de los parámetros normales.");

    return {
      finalScore,
      relStatus,
      last12Months,
      commonRepairs,
      commonMaint,
      diagnosisMessages
    };
  }, [loading, tambo, reclamos, mantenimientos, statuses, tiposReparacion, configs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!tambo) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Análisis Técnico: {tambo.nombre}</h1>
            <p className="text-zinc-400 mt-1">Diagnóstico interno para {tambo.clientes?.nombre}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <Activity className="w-5 h-5 text-blue-400" />
          <span className="text-blue-400 font-medium">Uso Técnico Interno</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Score & Diagnosis */}
        <div className="space-y-8">
          {/* Reliability Score */}
          <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Activity className="w-24 h-24" />
            </div>
            <h3 className="text-zinc-500 text-sm font-medium uppercase tracking-widest mb-6">Confiabilidad del Equipo</h3>
            <div className="relative inline-flex items-center justify-center mb-6">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-white/5"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={440}
                  strokeDashoffset={440 - (440 * (analysis?.finalScore || 0)) / 100}
                  className={cn(
                    "transition-all duration-1000 ease-out",
                    (analysis?.finalScore || 0) >= 85 ? "text-emerald-500" :
                    (analysis?.finalScore || 0) >= 70 ? "text-amber-500" : "text-red-500"
                  )}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-white">{analysis?.finalScore}</span>
                <span className="text-zinc-500 text-xs">/ 100</span>
              </div>
            </div>
            <div className={cn(
              "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold",
              (analysis?.finalScore || 0) >= 85 ? "bg-emerald-500/10 text-emerald-400" :
              (analysis?.finalScore || 0) >= 70 ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
            )}>
              {analysis?.relStatus.label}
            </div>
          </div>

          {/* Diagnosis */}
          <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-semibold">Diagnóstico Automático</h3>
            </div>
            <div className="space-y-3">
              {analysis?.diagnosisMessages.map((msg, i) => (
                <div key={i} className="flex gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full mt-2 shrink-0",
                    msg.includes("crítico") || msg.includes("vencidos") ? "bg-red-500" : "bg-emerald-500"
                  )} />
                  <p className="text-sm text-zinc-300 leading-relaxed">{msg}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Charts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Claims Trend */}
          <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-semibold">Tendencia de Reclamos (12 meses)</h3>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysis?.last12Months}>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Common Repairs */}
            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Wrench className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-semibold">Fallas Frecuentes</h3>
              </div>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis?.commonRepairs}>
                    <XAxis dataKey="name" hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    />
                    <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Maintenance Frequency */}
            <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Calendar className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold">Mantenimientos</h3>
              </div>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis?.commonMaint}>
                    <XAxis dataKey="name" hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8_px' }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
