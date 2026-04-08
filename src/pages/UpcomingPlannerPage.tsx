import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  Search, 
  Filter, 
  ChevronRight, 
  Droplets, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Package,
  Wrench,
  Info
} from "lucide-react";
import { db } from "../services/db";
import { Tambo, Mantenimiento, FichaTecnica, TipoMantenimiento, Configuracion } from "../types/supabase";
import { format, addDays, isBefore, isAfter, differenceInDays, parseISO, startOfMonth, endOfMonth, addMonths, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "../utils/ui";
import { calculateMaintenanceStatus, calculateSupplies, calculateInsumos } from "../utils/calculations";
import { supabase } from "../services/supabase";

interface UpcomingNeed {
  tamboId: string;
  tamboNombre: string;
  clienteNombre: string;
  tipo: string;
  insumo: string;
  cantidad: number;
  fechaEstimada: Date;
  diasRestantes: number;
  prioridad: "baja" | "media" | "alta";
}

export default function UpcomingPlannerPage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"30" | "60" | "next_month">("30");
  const [needs, setNeeds] = useState<UpcomingNeed[]>([]);
  const [groupedNeeds, setGroupedNeeds] = useState<{ insumo: string, total: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"todos" | "pezoneras" | "otros">("todos");

  async function calculateUpcoming() {
    setLoading(true);
    try {
      const [tambos, fichas, mantenimientos, tiposMantenimiento, configs, allTamboComponentes, allTamboInsumos] = await Promise.all([
        db.tambos.getAll(),
        db.ficha_tecnica.getAll(),
        db.mantenimientos.getAll(),
        db.tipos_mantenimiento.getAll(),
        db.configuracion.getAllWithHidden(),
        db.tambo_componentes.getAll(),
        supabase.from("tambo_insumos").select("*, insumos(*)").then(res => res.data || [])
      ]);

      const fichasMap = new Map(fichas.map(f => [f.tambo_id, f]));
      const pezoneraMaxOrdenes = parseInt(configs.find(c => c.clave === "pezonera_max_ordenes")?.valor || "3200");
      
      const upcomingNeeds: UpcomingNeed[] = [];
      const now = new Date();
      
      let interval: { start: Date; end: Date };
      if (period === "30") {
        interval = { start: now, end: addDays(now, 30) };
      } else if (period === "60") {
        interval = { start: now, end: addDays(now, 60) };
      } else {
        const nextMonth = addMonths(now, 1);
        interval = { start: startOfMonth(nextMonth), end: endOfMonth(nextMonth) };
      }

      for (const tambo of tambos) {
        const tamboMantenimientos = mantenimientos.filter(m => m.tambo_id === tambo.id);
        const tamboComps = allTamboComponentes.filter((tc: any) => tc.tambo_id === tambo.id);
        const tamboIns = allTamboInsumos.filter((ti: any) => ti.tambo_id === tambo.id);

        const ficha = fichasMap.get(tambo.id);
        const technicalData = {
          ...tambo,
          vacas_en_ordene: tambo.vacas_en_ordene || 0,
          bajadas: ficha?.bajadas || tambo.bajadas || 1,
          ordenes_por_dia: tambo.ordenes_por_dia || 2,
          tiene_brazos_extractores: tambo.tiene_brazos_extractores || false,
          bomba_leche_tiene_sello: ficha?.bomba_leche_tiene_sello || false,
          bomba_leche_tiene_diafragma: ficha?.bomba_leche_tiene_diafragma || false,
          bomba_leche_tiene_turbina: ficha?.bomba_leche_tiene_turbina || false,
          usa_sogas: ficha?.usa_sogas || false,
          usa_diafragmas_brazos: ficha?.usa_diafragmas_brazos || false,
          usa_bujes: ficha?.usa_bujes || false,
          usa_colector_leche: ficha?.usa_colector_leche || false,
          colector_marca: ficha?.colector_marca || "",
          tipo_pulsadores: ficha?.tipo_pulsadores || "",
          bomba_leche_marca: ficha?.bomba_leche_marca || ""
        };

        const activeConfig = configs.find(c => c.clave === `tambo_mantenimientos_${tambo.id}`);
        let activeTypesNames: string[] = tiposMantenimiento.map(type => type.nombre);
        if (activeConfig) {
          try {
            activeTypesNames = JSON.parse(activeConfig.valor);
          } catch (e) {
            console.error("Error parsing active types for tambo", tambo.id);
          }
        }

        const activeTypesObjects = tiposMantenimiento.filter(type => activeTypesNames.includes(type.nombre));
        const statuses = calculateMaintenanceStatus(technicalData, tamboMantenimientos, configs, activeTypesObjects);

        statuses.forEach(s => {
          if (s.proximaFecha && isWithinInterval(s.proximaFecha, interval)) {
            const supplies = calculateSupplies(technicalData, tamboComps);
            const insumos = calculateInsumos(technicalData, tamboIns);
            
            const allPossibleSupplies = [...supplies, ...insumos];
            
            const matchingSupplies = allPossibleSupplies.filter(sup => {
              const supName = sup.nombre.toLowerCase();
              const typeName = s.tipo.toLowerCase();
              
              // Reglas de coincidencia mejoradas
              if (typeName.includes("pezonera") && supName.includes("pezonera")) return true;
              if (typeName.includes("pulsador") && (supName.includes("pulsador") || supName.includes("soga") || supName.includes("diafragma") || supName.includes("buje"))) return true;
              if (typeName.includes("bomba") && (supName.includes("bomba") || supName.includes("aceite") || supName.includes("sello") || supName.includes("diafragma") || supName.includes("turbina"))) return true;
              if (typeName.includes("equipo") && (supName.includes("colector") || supName.includes("buje") || supName.includes("soga") || supName.includes("diafragma"))) return true;
              
              return typeName.includes(supName) || supName.includes(typeName);
            });

            if (matchingSupplies.length > 0) {
              matchingSupplies.forEach(sup => {
                upcomingNeeds.push({
                  tamboId: tambo.id,
                  tamboNombre: tambo.nombre,
                  clienteNombre: tambo.clientes?.nombre || "Sin cliente",
                  tipo: "Insumo",
                  insumo: sup.nombre,
                  cantidad: sup.cantidad,
                  fechaEstimada: s.proximaFecha!,
                  diasRestantes: s.diasRestantes || 0,
                  prioridad: (s.diasRestantes || 0) < 7 ? "alta" : (s.diasRestantes || 0) < 15 ? "media" : "baja"
                });
              });
            } else {
              upcomingNeeds.push({
                tamboId: tambo.id,
                tamboNombre: tambo.nombre,
                clienteNombre: tambo.clientes?.nombre || "Sin cliente",
                tipo: "Mantenimiento",
                insumo: s.tipo,
                cantidad: 1,
                fechaEstimada: s.proximaFecha!,
                diasRestantes: s.diasRestantes || 0,
                prioridad: (s.diasRestantes || 0) < 7 ? "alta" : (s.diasRestantes || 0) < 15 ? "media" : "baja"
              });
            }
          }
        });
      }

      // Sort by date
      upcomingNeeds.sort((a, b) => a.fechaEstimada.getTime() - b.fechaEstimada.getTime());
      setNeeds(upcomingNeeds);

      // Group by supply
      const grouped = upcomingNeeds.reduce((acc, need) => {
        const key = need.insumo;
        acc[key] = (acc[key] || 0) + need.cantidad;
        return acc;
      }, {} as Record<string, number>);

      setGroupedNeeds(Object.entries(grouped).map(([insumo, total]) => ({ insumo, total })));

    } catch (error) {
      console.error("Error calculating upcoming needs:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    calculateUpcoming();
  }, [period]);

  const filteredNeeds = needs.filter(n => {
    const matchesSearch = n.tamboNombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         n.insumo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "todos" || 
                       (filterType === "pezoneras" && n.insumo.toLowerCase().includes("pezonera")) ||
                       (filterType === "otros" && !n.insumo.toLowerCase().includes("pezonera"));
    return matchesSearch && matchesType;
  });

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
          <h2 className="text-3xl font-bold tracking-tight">Planificador de Próximos</h2>
          <p className="text-zinc-500 mt-1">Estimación de insumos y mantenimientos necesarios por período.</p>
        </div>
      </div>

      {/* Summary Grouped */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {groupedNeeds.slice(0, 4).map((group, idx) => (
          <div key={idx} className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">{group.insumo}</p>
              <p className="text-2xl font-bold font-mono">{group.total}</p>
            </div>
          </div>
        ))}
        {groupedNeeds.length === 0 && (
          <div className="lg:col-span-4 bg-[#0f0f0f] border border-white/5 rounded-2xl p-5 text-center text-zinc-500 text-sm italic">
            No se detectaron necesidades masivas para este período.
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por tambo o insumo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0f0f0f] border border-white/5 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:border-emerald-500/50 transition-all shadow-lg shadow-black/20"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="bg-[#0f0f0f] border border-white/5 rounded-2xl px-4 py-4 text-sm font-bold focus:outline-none focus:border-emerald-500/50 transition-all appearance-none min-w-[160px]"
          >
            <option value="30">Próximos 30 días</option>
            <option value="60">Próximos 60 días</option>
            <option value="next_month">Próximo mes</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-[#0f0f0f] border border-white/5 rounded-2xl px-4 py-4 text-sm font-bold focus:outline-none focus:border-emerald-500/50 transition-all appearance-none min-w-[160px]"
          >
            <option value="todos">Todos los tipos</option>
            <option value="pezoneras">Solo Pezoneras</option>
            <option value="otros">Otros Mantenimientos</option>
          </select>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl overflow-hidden shadow-xl shadow-black/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Tambo / Cliente</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Insumo / Tarea</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Cantidad</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Fecha Estimada</th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredNeeds.map((need, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors">{need.tamboNombre}</span>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{need.clienteNombre}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        need.tipo === "Insumo" ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400"
                      )}>
                        {need.tipo === "Insumo" ? <Package className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                      </div>
                      <span className="font-medium text-zinc-300">{need.insumo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="font-mono font-bold text-lg">{need.cantidad}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="font-medium text-zinc-300">{format(need.fechaEstimada, "dd/MM/yyyy")}</span>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">En {need.diasRestantes} días</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                      need.prioridad === "alta" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                      need.prioridad === "media" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    )}>
                      {need.prioridad === "alta" ? <AlertTriangle className="w-3 h-3" /> :
                       need.prioridad === "media" ? <Clock className="w-3 h-3" /> :
                       <CheckCircle2 className="w-3 h-3" />}
                      {need.prioridad === "alta" ? "Urgente" :
                       need.prioridad === "media" ? "Próximo" :
                       "Planificado"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredNeeds.length === 0 && (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-8 h-8 text-zinc-700" />
            </div>
            <h4 className="text-xl font-bold text-zinc-400 mb-2">No hay necesidades detectadas</h4>
            <p className="text-zinc-600 max-w-md mx-auto">
              No se encontraron insumos o mantenimientos que requieran atención en el período seleccionado.
            </p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-6 flex gap-4">
        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
          <Info className="w-5 h-5 text-blue-400" />
        </div>
        <div className="space-y-2">
          <h4 className="font-bold text-blue-400">¿Cómo se calculan estas fechas?</h4>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Para las <strong>pezoneras</strong>, utilizamos la fórmula técnica basada en el uso real: 
            <code className="mx-2 bg-white/5 px-2 py-1 rounded text-blue-300 font-mono">3200 / ((vacas × ordeños) / bajadas)</code>.
            Para otros componentes, se utiliza la frecuencia en meses configurada en el sistema desde el último mantenimiento realizado.
          </p>
        </div>
      </div>
    </div>
  );
}
