import React, { useEffect, useState, useMemo } from "react";
import { 
  Calendar, 
  Search, 
  Filter, 
  Package, 
  DollarSign, 
  ArrowRight,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { db } from "../services/db";
import { calculateMaintenanceStatus, MaintenanceStatus, calculateSupplies, calculateInsumos } from "../utils/calculations";
import { format, addDays, isWithinInterval, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { cn, formatDate } from "../utils/ui";
import { Insumo, Tambo } from "../types/supabase";
import { supabase } from "../services/supabase";

type Period = "30" | "60" | "next_month";

interface UpcomingItem extends MaintenanceStatus {
  tamboId: string;
  tamboNombre: string;
  clienteNombre: string;
  cantidad: number;
  tipoInsumo: string;
}

export default function UpcomingPage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("30");
  const [searchTerm, setSearchTerm] = useState("");
  const [tambos, setTambos] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [allMaintTypes, setAllMaintTypes] = useState<any[]>([]);
  const [upcomingData, setUpcomingData] = useState<UpcomingItem[]>([]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const [tambosData, configsData, maintTypesData, allMantenimientos, allTamboComponentes, allTamboInsumos] = await Promise.all([
          db.tambos.getAll(),
          db.configuracion.getAllWithHidden(),
          db.tipos_mantenimiento.getAll(),
          db.mantenimientos.getAll(),
          db.tambo_componentes.getAll(),
          supabase.from("tambo_insumos").select("*, insumos(*)").then(res => res.data || [])
        ]);

        const today = new Date();
        let interval: { start: Date; end: Date };

        if (period === "30") {
          interval = { start: today, end: addDays(today, 30) };
        } else if (period === "60") {
          interval = { start: today, end: addDays(today, 60) };
        } else {
          const nextMonth = addMonths(today, 1);
          interval = { start: startOfMonth(nextMonth), end: endOfMonth(nextMonth) };
        }

        const results: UpcomingItem[] = [];

        for (const t of tambosData) {
          const mantenimientos = allMantenimientos.filter(m => m.tambo_id === t.id);
          const ficha = Array.isArray(t.ficha_tecnica) ? t.ficha_tecnica[0] : t.ficha_tecnica;
          const tamboComponentes = allTamboComponentes.filter((tc: any) => tc.tambo_id === t.id);
          const tamboInsumos = allTamboInsumos.filter((ti: any) => ti.tambo_id === t.id);
          
          const technicalData = {
            ...t,
            vacas_en_ordene: t.vacas_en_ordene || 0,
            bajadas: ficha?.bajadas || t.bajadas || 1,
            ordenes_por_dia: t.ordenes_por_dia || 0,
            tiene_brazos_extractores: t.tiene_brazos_extractores || false,
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

          const activeConfig = configsData.find(c => c.clave === `tambo_mantenimientos_${t.id}`);
          let activeTypesNames: string[] = maintTypesData.map(type => type.nombre);
          if (activeConfig) {
            try {
              activeTypesNames = JSON.parse(activeConfig.valor);
            } catch (e) {
              console.error("Error parsing active types for tambo", t.id);
            }
          }

          const activeTypesObjects = maintTypesData.filter(type => activeTypesNames.includes(type.nombre));
          const statuses = calculateMaintenanceStatus(technicalData, mantenimientos, configsData, activeTypesObjects);

          statuses.forEach(s => {
            if (s.proximaFecha && isWithinInterval(s.proximaFecha, interval)) {
              // Use calculateSupplies and calculateInsumos logic to find relevant supplies for this maintenance type
              const supplies = calculateSupplies(technicalData, tamboComponentes);
              const insumos = calculateInsumos(technicalData, tamboInsumos);
              
              const allPossibleSupplies = [...supplies, ...insumos];
              
              // Find supplies that match the maintenance type name
              const matchingSupplies = allPossibleSupplies.filter(sup => {
                const supName = sup.nombre.toLowerCase().trim();
                const typeName = s.tipo.toLowerCase().trim();
                
                // Reglas de coincidencia mejoradas y específicas
                
                // 1. Pezoneras
                if (typeName.includes("pezonera") && supName.includes("pezonera")) return true;
                
                // 2. Pulsadores y accesorios relacionados
                if (typeName.includes("pulsador")) {
                  if (supName.includes("pulsador") || supName.includes("soga") || supName.includes("diafragma") || supName.includes("buje")) return true;
                }
                
                // 3. Bomba de Leche (específico)
                if (typeName.includes("bomba") && typeName.includes("leche")) {
                  if (supName.includes("sello") || supName.includes("turbina") || (supName.includes("diafragma") && !supName.includes("brazo"))) return true;
                  if (supName.includes("bomba") && supName.includes("leche")) return true;
                }
                
                // 4. Bomba de Vacío / Aceite
                if (typeName.includes("aceite") || (typeName.includes("bomba") && (typeName.includes("vacío") || typeName.includes("vacio")))) {
                  if (supName.includes("aceite") || (supName.includes("bomba") && (supName.includes("vacío") || supName.includes("vacio")))) return true;
                }
                
                // 5. Equipo / General / Colectores
                if (typeName.includes("equipo") || typeName.includes("general") || typeName.includes("mantenimiento")) {
                  if (supName.includes("colector") || supName.includes("buje") || supName.includes("soga") || supName.includes("diafragma")) return true;
                }

                // 6. Coincidencia por nombre directo
                return typeName.includes(supName) || supName.includes(typeName);
              });

              if (matchingSupplies.length > 0) {
                matchingSupplies.forEach(sup => {
                  results.push({
                    tamboId: t.id,
                    tamboNombre: t.nombre,
                    clienteNombre: t.clientes?.nombre || "Sin cliente",
                    cantidad: sup.cantidad,
                    tipoInsumo: sup.nombre.trim(),
                    ...s
                  });
                });
              } else {
                // Fallback for types without direct component match
                results.push({
                  tamboId: t.id,
                  tamboNombre: t.nombre,
                  clienteNombre: t.clientes?.nombre || "Sin cliente",
                  cantidad: 1,
                  tipoInsumo: s.tipo,
                  ...s
                });
              }
            }
          });
        }

        setUpcomingData(results);
        setTambos(tambosData);
        setConfigs(configsData);
        setAllMaintTypes(maintTypesData);
      } catch (error) {
        console.error("Error loading upcoming data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [period]);

  const filteredData = useMemo(() => {
    return upcomingData.filter(item => 
      item.tamboNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tipoInsumo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tipo.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [upcomingData, searchTerm]);

  const summary = useMemo(() => {
    const res: Record<string, { cantidad: number }> = {};
    
    filteredData.forEach(item => {
      if (!res[item.tipoInsumo]) {
        res[item.tipoInsumo] = { cantidad: 0 };
      }
      res[item.tipoInsumo].cantidad += item.cantidad;
    });

    return res;
  }, [filteredData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Próximos Insumos</h2>
          <p className="text-zinc-500">Planificación de compras y mantenimientos preventivos.</p>
        </div>
        <div className="flex items-center gap-2 bg-[#0f0f0f] p-1 rounded-2xl border border-white/5">
          <button
            onClick={() => setPeriod("30")}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all",
              period === "30" ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-white"
            )}
          >
            30 días
          </button>
          <button
            onClick={() => setPeriod("60")}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all",
              period === "60" ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-white"
            )}
          >
            60 días
          </button>
          <button
            onClick={() => setPeriod("next_month")}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all",
              period === "next_month" ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-white"
            )}
          >
            Próximo Mes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Summary Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Package className="text-emerald-400 w-5 h-5" />
                Resumen de Insumos
              </h3>
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  type="text"
                  placeholder="Filtrar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[#1a1a1a] border border-white/5 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-emerald-500/50 w-full"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-zinc-500 text-[10px] uppercase tracking-widest border-b border-white/5">
                    <th className="pb-4 font-bold">Tipo / Insumo</th>
                    <th className="pb-4 font-bold text-right">Cantidad Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {Object.entries(summary).map(([tipo, data]: [string, any]) => (
                    <tr key={tipo} className="group hover:bg-white/5 transition-colors">
                      <td className="py-4">
                        <p className="font-bold text-sm">{tipo}</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">Insumo detectado</p>
                      </td>
                      <td className="py-4 text-right">
                        <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg font-mono font-bold">
                          {data.cantidad}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {Object.keys(summary).length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-12 text-center text-zinc-500 italic">
                        No se detectaron insumos necesarios para este período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail Section */}
          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 md:p-8">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="text-emerald-400 w-5 h-5" />
              Detalle por Tambo
            </h3>
            <div className="space-y-4">
              {filteredData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 group hover:border-white/10 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Calendar className="text-emerald-400 w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{item.tamboNombre}</p>
                      <p className="text-xs text-zinc-500">{item.clienteNombre}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-400">{item.tipoInsumo}</p>
                      <p className="text-[10px] text-zinc-500 uppercase">Cant: {item.cantidad}</p>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <p className="text-xs font-mono font-bold text-white">{format(item.proximaFecha!, "dd/MM/yy")}</p>
                      <p className="text-[10px] text-zinc-500 uppercase">Fecha est.</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <div className="bg-emerald-500 rounded-3xl p-8 text-black shadow-xl shadow-emerald-500/20">
            <div className="flex items-center gap-2 mb-2 opacity-60">
              <Package className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest">Resumen General</span>
            </div>
            <h4 className="text-4xl font-black tracking-tighter mb-1">
              {Object.values(summary).reduce((acc, curr) => acc + (curr as any).cantidad, 0)}
            </h4>
            <p className="text-sm font-bold opacity-60">TOTAL UNIDADES {period === "next_month" ? "PRÓXIMO MES" : `${period} DÍAS`}</p>
            
            <div className="mt-8 pt-6 border-t border-black/10 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold opacity-60">Tambos afectados</span>
                <span className="font-black">{new Set(filteredData.map(d => d.tamboId)).size}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold opacity-60">Tipos de insumos</span>
                <span className="font-black">{Object.keys(summary).length}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Nota Importante</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Los cálculos se basan en la frecuencia de mantenimiento configurada y el uso promedio del equipo (ordeños/día). Esta planificación es solo de cantidades de insumos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
