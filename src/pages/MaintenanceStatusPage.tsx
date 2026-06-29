import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  HelpCircle,
  Search,
  Filter
} from "lucide-react";
import { db } from "../services/db";
import { calculateMaintenanceStatus, Status } from "../utils/calculations";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "../utils/ui";

export default function MaintenanceStatusPage() {
  const [searchParams] = useSearchParams();
  const filterStatus = searchParams.get("status") as Status | null;
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [tambos, configs, allMaintTypes, allMantenimientos] = await Promise.all([
          db.tambos.getAll(),
          db.configuracion.getAllWithHidden(),
          db.tipos_mantenimiento.getAll(),
          db.mantenimientos.getAll()
        ]);

        const allStatuses: any[] = [];

        for (const t of tambos) {
          const mantenimientos = allMantenimientos.filter(m => m.tambo_id === t.id);
          const statuses = calculateMaintenanceStatus(t, mantenimientos, configs, allMaintTypes);
          
          // Defensive check for clientes join
          const cliente = Array.isArray(t.clientes) ? t.clientes[0] : t.clientes;
          const clienteNombre = cliente?.nombre || "Sin cliente";

          statuses.forEach(s => {
            if (!filterStatus || s.status === filterStatus) {
              allStatuses.push({
                tamboId: t.id,
                tamboNombre: t.nombre,
                clienteNombre: clienteNombre,
                ...s
              });
            }
          });
        }

        setData(allStatuses);
      } catch (error) {
        console.error("Error loading maintenance status data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    // Real-time subscription
    const mantenimientosSubscription = db.mantenimientos.subscribeToChanges(() => {
      loadData();
    });

    const configSubscription = db.configuracion.subscribeToChanges(() => {
      loadData();
    });

    const maintTypesSubscription = db.tipos_mantenimiento.subscribeToChanges(() => {
      loadData();
    });

    return () => {
      mantenimientosSubscription.unsubscribe();
      configSubscription.unsubscribe();
      maintTypesSubscription.unsubscribe();
    };
  }, [filterStatus]);

  const filteredData = useMemo(() => {
    return data.filter(item => 
      item.tamboNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tipo.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const getStatusConfig = (status: Status) => {
    switch (status) {
      case "verde": return { label: "Al día", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" };
      case "amarillo": return { label: "Próximo", icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" };
      case "rojo": return { label: "Vencido", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" };
      case "gris": return { label: "Nunca realizado", icon: HelpCircle, color: "text-zinc-400", bg: "bg-zinc-500/10" };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const currentStatus = filterStatus ? getStatusConfig(filterStatus) : null;

  const showPrintButton = filterStatus === "rojo" || filterStatus === "amarillo";

  const getPrintTitle = () => {
    if (filterStatus === "rojo") return "Listado de Mantenimientos Vencidos";
    if (filterStatus === "amarillo") return "Listado de Próximos Mantenimientos";
    return "Listado de Mantenimientos";
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = getPrintTitle();
    window.print();
    document.title = originalTitle;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 hover:bg-white/5 rounded-lg transition-colors no-print">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {currentStatus ? `Mantenimientos: ${currentStatus.label}` : "Estado de Mantenimientos"}
            </h2>
            <p className="text-zinc-500 text-sm">Listado detallado para planificación técnica.</p>
          </div>
        </div>
        {showPrintButton && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-emerald-500/10 shrink-0 no-print"
          >
            🖨️ Imprimir listado
          </button>
        )}
      </div>

      <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden no-print">
        <div className="p-4 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              placeholder="Buscar por tambo, cliente o tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#1a1a1a] border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-500" />
            <span className="text-sm text-zinc-500">Filtrado por: {currentStatus?.label || "Todos"}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-white/5">
                <th className="px-6 py-4 font-semibold">Cliente / Tambo</th>
                <th className="px-6 py-4 font-semibold">Tipo de Mantenimiento</th>
                <th className="px-6 py-4 font-semibold">Última Fecha</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 font-semibold text-right">
                  {filterStatus === "amarillo" ? "Días Restantes" : filterStatus === "rojo" ? "Días Vencido" : "Días Vencido / Restantes"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredData.length > 0 ? (
                filteredData.map((item, index) => {
                  const status = getStatusConfig(item.status);
                  const Icon = status.icon;

                  return (
                    <tr key={`${item.tamboId}-${index}`} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <Link to={`/tambos/${item.tamboId}`} className="font-medium text-white hover:text-emerald-400 transition-colors">
                          {item.tamboNombre}
                        </Link>
                        <div className="text-xs text-zinc-500">{item.clienteNombre}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-zinc-300">{item.tipo}</div>
                        {item.frecuenciaLabel && (
                          <div className="text-[10px] text-zinc-500 italic">{item.frecuenciaLabel}</div>
                        )}
                        {item.tipo === "Cambio de pezoneras" && item.ordenosPorPezonera !== undefined && (
                          <div className="text-[9px] text-zinc-600 mt-0.5">
                            {item.ordenosPorPezonera.toFixed(1)} ord/día • {item.diasEstimados} días dur.
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-zinc-400">
                          {item.ultimaFecha ? format(item.ultimaFecha, "dd/MM/yyyy") : "NUNCA"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold", status.bg, status.color)}>
                          <Icon className="w-3 h-3" />
                          {status.label.toUpperCase()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {item.diasRestantes !== null ? (
                          item.diasRestantes < 0 ? (
                            <span className="text-sm font-bold text-red-400">{Math.abs(item.diasRestantes)} días</span>
                          ) : item.diasRestantes > 0 ? (
                            <span className="text-sm font-bold text-amber-400">{item.diasRestantes} días</span>
                          ) : (
                            <span className="text-sm font-bold text-emerald-400">Hoy</span>
                          )
                        ) : (
                          <span className="text-sm text-zinc-600">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    No se encontraron mantenimientos con este criterio.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Area - Clean Black & White format */}
      <div className="hidden print:block print-only text-black bg-white p-4 w-full">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            .print-only, .print-only * {
              visibility: visible !important;
            }
            .print-only {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              display: block !important;
              background-color: white !important;
              color: black !important;
            }
            @page {
              margin: 1.5cm;
              size: auto;
            }
          }
        `}} />
        
        <div style={{ borderBottom: "2px solid black", paddingBottom: "12px", marginBottom: "20px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: "0 0 6px 0", color: "black", fontFamily: "sans-serif" }}>
            {getPrintTitle()}
          </h1>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "black", fontFamily: "sans-serif" }}>
            <span><strong>Fecha y hora de impresión:</strong> {new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</span>
            <span><strong>Cantidad total de registros impresos:</strong> {filteredData.length}</span>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", color: "black", fontFamily: "sans-serif" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid black", borderTop: "2px solid black" }}>
              <th style={{ padding: "8px", border: "1px solid black", textAlign: "left", fontWeight: "bold" }}>Cliente</th>
              <th style={{ padding: "8px", border: "1px solid black", textAlign: "left", fontWeight: "bold" }}>Tambo</th>
              <th style={{ padding: "8px", border: "1px solid black", textAlign: "left", fontWeight: "bold" }}>Tipo de mantenimiento</th>
              <th style={{ padding: "8px", border: "1px solid black", textAlign: "left", fontWeight: "bold" }}>Última fecha</th>
              <th style={{ padding: "8px", border: "1px solid black", textAlign: "left", fontWeight: "bold" }}>Estado</th>
              <th style={{ padding: "8px", border: "1px solid black", textAlign: "right", fontWeight: "bold" }}>
                {filterStatus === "rojo" ? "Días vencido" : filterStatus === "amarillo" ? "Días restantes" : "Días vencido / restantes"}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => {
              const formattedDate = item.ultimaFecha ? format(item.ultimaFecha, "dd/MM/yyyy") : "NUNCA";
              const statusLabel = item.status === "verde" ? "Al día" 
                : item.status === "amarillo" ? "Próximo" 
                : item.status === "rojo" ? "Vencido" 
                : "Nunca realizado";
                
              let diasLabel = "-";
              if (item.diasRestantes !== null) {
                if (item.diasRestantes < 0) {
                  diasLabel = `${Math.abs(item.diasRestantes)} días`;
                } else if (item.diasRestantes > 0) {
                  diasLabel = `${item.diasRestantes} días`;
                } else {
                  diasLabel = "Hoy";
                }
              }

              return (
                <tr key={index} style={{ borderBottom: "1px solid black" }}>
                  <td style={{ padding: "8px", border: "1px solid black" }}>{item.clienteNombre}</td>
                  <td style={{ padding: "8px", border: "1px solid black" }}>{item.tamboNombre}</td>
                  <td style={{ padding: "8px", border: "1px solid black" }}>
                    <strong>{item.tipo}</strong>
                    {item.frecuenciaLabel && (
                      <div style={{ fontSize: "9px", color: "#333", fontStyle: "italic", marginTop: "2px" }}>{item.frecuenciaLabel}</div>
                    )}
                  </td>
                  <td style={{ padding: "8px", border: "1px solid black" }}>{formattedDate}</td>
                  <td style={{ padding: "8px", border: "1px solid black" }}>{statusLabel.toUpperCase()}</td>
                  <td style={{ padding: "8px", border: "1px solid black", textAlign: "right", fontWeight: "bold" }}>{diasLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
