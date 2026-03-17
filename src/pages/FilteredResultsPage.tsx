import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { db } from "../services/db";
import { Tambo, Cliente, TipoMantenimiento, Configuracion } from "../types/supabase";
import { calculateMaintenanceStatus, Status, MaintenanceStatus } from "../utils/calculations";
import { ArrowLeft, Droplets, Calendar, AlertTriangle, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { cn, formatDate } from "../utils/ui";

interface FilteredItem {
  cliente: string;
  tambo: string;
  tamboId: string;
  tipoMantenimiento: string;
  ultimaFecha: string | null;
  estado: Status;
  diasVencido: number | null;
}

export default function FilteredResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const filterType = searchParams.get("type") || "vencidos";
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<FilteredItem[]>([]);

  useEffect(() => {
    async function loadFilteredData() {
      try {
        setLoading(true);
        const [tambos, configs, allMaintTypes] = await Promise.all([
          db.tambos.getAll(),
          db.configuracion.getAllWithHidden(),
          db.tipos_mantenimiento.getAll()
        ]);

        const allItems: FilteredItem[] = [];

        for (const t of tambos) {
          const mantenimientos = await db.mantenimientos.getByTambo(t.id);
          
          // Extract active types from configs
          const activeConfig = configs.find(c => c.clave === `tambo_mantenimientos_${t.id}`);
          let activeTypesNames: string[] = allMaintTypes.map(t => t.nombre);
          if (activeConfig) {
            try {
              activeTypesNames = JSON.parse(activeConfig.valor);
            } catch (e) {
              console.error("Error parsing active types for tambo", t.id);
            }
          }

          const activeTypesObjects = allMaintTypes.filter(type => activeTypesNames.includes(type.nombre));
          const statuses = calculateMaintenanceStatus(t, mantenimientos, configs, activeTypesObjects);

          statuses.forEach(s => {
            allItems.push({
              cliente: t.clientes.nombre,
              tambo: t.nombre,
              tamboId: t.id,
              tipoMantenimiento: s.tipo,
              ultimaFecha: s.ultimaFecha ? s.ultimaFecha.toISOString().split('T')[0] : null,
              estado: s.status,
              diasVencido: s.diasRestantes !== null && s.diasRestantes < 0 ? Math.abs(s.diasRestantes) : null
            });
          });
        }

        let filtered = allItems;
        if (filterType === "vencidos") {
          filtered = allItems.filter(i => i.estado === "rojo");
        } else if (filterType === "proximos") {
          filtered = allItems.filter(i => i.estado === "amarillo");
        } else if (filterType === "al-dia") {
          filtered = allItems.filter(i => i.estado === "verde");
        } else if (filterType === "nunca") {
          filtered = allItems.filter(i => i.estado === "gris");
        }

        setResults(filtered);
      } catch (error) {
        console.error("Error loading filtered data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadFilteredData();
  }, [filterType]);

  const getTitle = () => {
    switch (filterType) {
      case "vencidos": return "Mantenimientos Vencidos";
      case "proximos": return "Mantenimientos Próximos";
      case "al-dia": return "Mantenimientos al Día";
      case "nunca": return "Mantenimientos Nunca Realizados";
      default: return "Resultados Filtrados";
    }
  };

  const getIcon = () => {
    switch (filterType) {
      case "vencidos": return <XCircle className="w-8 h-8 text-red-500" />;
      case "proximos": return <AlertTriangle className="w-8 h-8 text-amber-500" />;
      case "al-dia": return <CheckCircle2 className="w-8 h-8 text-emerald-500" />;
      case "nunca": return <HelpCircle className="w-8 h-8 text-zinc-500" />;
      default: return <Droplets className="w-8 h-8 text-emerald-500" />;
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
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/5 rounded-2xl">
            {getIcon()}
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{getTitle()}</h2>
            <p className="text-zinc-500">Total: {results.length} registros encontrados</p>
          </div>
        </div>
      </div>

      <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-xs font-bold uppercase tracking-wider text-zinc-500">
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Tambo</th>
                <th className="px-6 py-4">Tipo Mantenimiento</th>
                <th className="px-6 py-4">Última Fecha</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Días Vencido</th>
                <th className="px-6 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {results.map((item, index) => (
                <tr key={index} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4 font-medium">{item.cliente}</td>
                  <td className="px-6 py-4">{item.tambo}</td>
                  <td className="px-6 py-4 text-zinc-300">{item.tipoMantenimiento}</td>
                  <td className="px-6 py-4 font-mono text-sm">
                    {item.ultimaFecha ? formatDate(item.ultimaFecha) : "NUNCA"}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={item.estado} />
                  </td>
                  <td className="px-6 py-4 font-mono text-red-400">
                    {item.diasVencido !== null ? `${item.diasVencido} d` : "-"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => navigate(`/tambos/${item.tamboId}`)}
                      className="text-emerald-400 hover:text-emerald-300 text-sm font-bold uppercase tracking-wider"
                    >
                      Ver Tambo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {results.length === 0 && (
          <div className="p-20 text-center">
            <Droplets className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-500 font-medium">No se encontraron resultados para este filtro.</p>
          </div>
        )}
      </div>
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

  const labels = {
    verde: "Al día",
    amarillo: "Próximo",
    rojo: "Vencido",
    gris: "Nunca realizado"
  };

  return (
    <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border", styles[status])}>
      {labels[status]}
    </span>
  );
}
