import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db } from "../services/db";
import { useAuth } from "../services/AuthContext";
import { useCompany } from "../services/CompanyContext";
import { 
  ArrowLeft, 
  Printer, 
  Share2, 
  CheckCircle, 
  Clock, 
  PlayCircle, 
  XCircle, 
  AlertCircle, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Wrench, 
  Calendar, 
  FileText,
  AlertTriangle,
  Info,
  Check,
  Droplets
} from "lucide-react";
import { cn, formatDate } from "../utils/ui";

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { company } = useCompany();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orden, setOrden] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  
  // Finalize UI states
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizingItems, setFinalizingItems] = useState<{[key: string]: { realizado: boolean, observaciones: string }}>({});
  const [generalNotes, setGeneralNotes] = useState("");

  useEffect(() => {
    if (id) {
      loadOrderDetail();
    }
  }, [id]);

  async function loadOrderDetail() {
    try {
      setLoading(true);
      setError(null);
      const data = await db.ordenesTrabajo.getById(id!);
      const itemsList = await db.ordenesTrabajo.getItems(id!);
      
      setOrden(data);
      setItems(itemsList);
      setGeneralNotes(data.observaciones || "");

      // Initialize finalizing items values
      const initialFinalizing: any = {};
      itemsList.forEach((it: any) => {
        initialFinalizing[it.id] = {
          realizado: true, // Default to completed
          observaciones: it.observaciones || ""
        };
      });
      setFinalizingItems(initialFinalizing);
    } catch (err: any) {
      console.error("Error loading order detail:", err);
      setError(err?.message || "Ocurrió un error al obtener los detalles de la orden de trabajo.");
    } finally {
      setLoading(false);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Orden de Trabajo ${orden.numero}`,
        text: `Orden de Trabajo ${orden.numero} para el Tambo ${orden.tambos?.nombre}`,
        url: window.location.href
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Enlace de la Orden de Trabajo copiado al portapapeles.");
    }
  };

  const handleFinalizeConfirm = async () => {
    try {
      setLoading(true);
      
      // Update items status on table
      const itemsUpdates = Object.keys(finalizingItems).map((itemId) => {
        const val = finalizingItems[itemId];
        return {
          id: itemId,
          realizado: val.realizado,
          observaciones: val.observaciones
        };
      });

      // Call database service to complete the order
      await db.ordenesTrabajo.finalize(orden.id, itemsUpdates);

      // Create actual maintenance records for each checked item (Phase 6 requirement)
      const completedItems = items.filter(it => finalizingItems[it.id]?.realizado);
      if (completedItems.length > 0) {
        const newMantenimientos = completedItems.map(it => ({
          tambo_id: orden.tambo_id,
          tipo: it.componente, // Name will be normalized by db.mantenimientos.createMany
          fecha: new Date().toISOString().split("T")[0],
          observaciones: it.observaciones 
            ? `${it.observaciones} (Finalizado en OT: ${orden.numero})` 
            : `Mantenimiento realizado en Orden de Trabajo ${orden.numero}`
        }));
        await db.mantenimientos.createMany(newMantenimientos);
      }

      // Update local state and close finalizing modal
      setIsFinalizing(false);
      await loadOrderDetail();
      alert("La Orden de Trabajo se ha finalizado correctamente. Se actualizaron los mantenimientos del tambo.");
    } catch (err: any) {
      console.error("Error finalizing order:", err);
      alert(err?.message || "Hubo un problema al intentar finalizar la orden.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItemRealizado = (itemId: string) => {
    setFinalizingItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        realizado: !prev[itemId].realizado
      }
    }));
  };

  const handleItemObservacionesChange = (itemId: string, val: string) => {
    setFinalizingItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        observaciones: val
      }
    }));
  };

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case "Finalizada":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-4 h-4" />
            Finalizada
          </span>
        );
      case "En proceso":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <PlayCircle className="w-4 h-4 animate-pulse" />
            En proceso
          </span>
        );
      case "Cancelada":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-4 h-4" />
            Cancelada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            <Clock className="w-4 h-4" />
            Pendiente
          </span>
        );
    }
  };

  // Phase 7: Role based authorization guard
  const isReadOnly = profile?.rol === "Solo lectura";
  const isTech = profile?.rol === "Técnico";
  const isAssignedToMe = orden 
    ? (orden.tecnico_asignado?.toLowerCase() === profile?.nombre?.toLowerCase() || 
       orden.tecnico_asignado?.toLowerCase() === profile?.email?.toLowerCase())
    : false;

  const canFinalize = orden && orden.estado !== "Finalizada" && !isReadOnly && (isTech ? isAssignedToMe : true);

  if (loading && !orden) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-emerald-500/20" />
        <p className="text-zinc-500 text-sm">Cargando detalles de orden...</p>
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
          <h3 className="text-xl font-bold text-white mb-2">Error de Carga</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">{error}</p>
        </div>
        <button 
          onClick={loadOrderDetail}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-black py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
        >
          Reintentar consulta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 print:space-y-6">
      {/* Top action bar: Hidden on Print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <Link 
          to="/ordenes" 
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al historial
        </Link>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 bg-zinc-950 hover:bg-zinc-900 border border-white/5 text-zinc-300 hover:text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            <Share2 className="w-4 h-4" />
            Compartir
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-zinc-950 hover:bg-zinc-900 border border-white/5 text-zinc-300 hover:text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            <Printer className="w-4 h-4" />
            Imprimir / Guardar PDF
          </button>
          
          {canFinalize && (
            <button
              onClick={() => setIsFinalizing(true)}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20"
            >
              <CheckCircle className="w-4 h-4" />
              Finalizar Orden
            </button>
          )}
        </div>
      </div>

      {/* Main Order sheet - fully styled for dark screen and configured for print */}
      <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 space-y-8 print:bg-white print:text-black print:border-none print:shadow-none print:p-0 print:m-0 print:rounded-none">
        
        {/* Print Only Header with logo & company info */}
        <div className="hidden print:flex items-center justify-between border-b pb-6 border-zinc-200">
          <div className="flex items-center gap-3">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.nombre} className="w-14 h-14 object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center text-black font-extrabold text-xl">
                {company.nombre?.slice(0, 2).toUpperCase() || "EM"}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-950">{company.nombre || "Sistema"}</h1>
              <p className="text-xs text-zinc-500">Mantenimiento de Sistemas de Ordeño</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-zinc-900">ORDEN DE TRABAJO</h2>
            <p className="font-mono text-sm font-bold text-emerald-600 mt-1">{orden.numero}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Fecha: {formatDate(orden.fecha)}</p>
          </div>
        </div>

        {/* Screen Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg font-extrabold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                {orden.numero}
              </span>
              <div>{getStatusBadge(orden.estado)}</div>
            </div>
            <p className="text-zinc-500 text-sm">Creado el {formatDate(orden.created_at)}</p>
          </div>
          
          <div className="bg-[#151515] p-3 rounded-2xl border border-white/5 space-y-1">
            <span className="text-xs text-zinc-500 block">Prioridad de Orden:</span>
            <span className={cn(
              "text-sm font-bold uppercase tracking-wider block",
              orden.prioridad === "Urgente" ? "text-red-400" :
              orden.prioridad === "Alta" ? "text-amber-400" :
              orden.prioridad === "Baja" ? "text-zinc-500" : "text-emerald-400"
            )}>
              {orden.prioridad}
            </span>
          </div>
        </div>

        {/* Metadata Details Grid (Producer, Tambo, Tech) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-white/5 pb-8 print:border-zinc-200 print:pb-6">
          
          {/* Col 1: Client Info */}
          <div className="bg-[#151515] p-6 rounded-2xl border border-white/5 space-y-4 print:bg-zinc-50 print:border-none print:p-4">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2 print:text-zinc-700">
              <User className="w-4 h-4 text-emerald-500 print:text-zinc-600" />
              Productor / Cliente
            </h3>
            <div className="space-y-2 text-sm">
              <p className="font-bold text-white print:text-zinc-950 text-base">{orden.clientes?.nombre}</p>
              {orden.clientes?.telefono && (
                <p className="text-zinc-400 print:text-zinc-600 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-zinc-500" />
                  {orden.clientes.telefono}
                </p>
              )}
              {orden.clientes?.email && (
                <p className="text-zinc-400 print:text-zinc-600 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-zinc-500" />
                  {orden.clientes.email}
                </p>
              )}
            </div>
          </div>

          {/* Col 2: Tambo Details */}
          <div className="bg-[#151515] p-6 rounded-2xl border border-white/5 space-y-4 print:bg-zinc-50 print:border-none print:p-4">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2 print:text-zinc-700">
              <Droplets className="w-4 h-4 text-emerald-500 print:text-zinc-600" />
              Establecimiento / Tambo
            </h3>
            <div className="space-y-2 text-sm">
              <p className="font-bold text-white print:text-zinc-950 text-base">{orden.tambos?.nombre}</p>
              <p className="text-zinc-400 print:text-zinc-600 flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-zinc-500" />
                Bajadas (Unidades): {orden.tambos?.bajadas || "No especificado"}
              </p>
              {orden.clientes?.ubicacion && (
                <p className="text-zinc-400 print:text-zinc-600 flex items-center gap-2 line-clamp-1">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                  Dirección: {orden.clientes.ubicacion}
                </p>
              )}
            </div>
          </div>

          {/* Col 3: Tech details */}
          <div className="bg-[#151515] p-6 rounded-2xl border border-white/5 space-y-4 print:bg-zinc-50 print:border-none print:p-4">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2 print:text-zinc-700">
              <User className="w-4 h-4 text-emerald-500 print:text-zinc-600" />
              Responsable Técnico
            </h3>
            <div className="space-y-2 text-sm">
              <p className="font-bold text-white print:text-zinc-950 text-base">{orden.tecnico_asignado || "No asignado"}</p>
              <p className="text-zinc-400 print:text-zinc-600 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                Fecha Programada: {formatDate(orden.fecha)}
              </p>
              <p className="text-zinc-400 print:text-zinc-600 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-zinc-500" />
                Estado: <strong className="text-zinc-300 print:text-zinc-700">{orden.estado}</strong>
              </p>
            </div>
          </div>

        </div>

        {/* Phase 3 Table of work items */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white print:text-zinc-900">Tareas y Trabajos Solicitados</h3>
          
          <div className="overflow-x-auto border border-white/5 rounded-2xl print:border-zinc-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#151515] border-b border-white/5 text-xs text-zinc-400 font-semibold uppercase tracking-wider print:bg-zinc-100 print:text-zinc-800 print:border-zinc-200">
                  <th className="px-6 py-4">Equipo / Componente</th>
                  <th className="px-6 py-4">Trabajo Requerido</th>
                  <th className="px-6 py-4 text-center">Prioridad</th>
                  <th className="px-6 py-4">Vencimiento</th>
                  <th className="px-6 py-4">Observaciones</th>
                  <th className="px-6 py-4 text-center">Realizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-zinc-300 print:divide-zinc-200 print:text-zinc-950">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/1 font-medium print:hover:bg-transparent">
                    <td className="px-6 py-4.5 font-bold text-white print:text-zinc-950">{item.componente}</td>
                    <td className="px-6 py-4.5 text-zinc-400 print:text-zinc-600">{item.trabajo}</td>
                    <td className="px-6 py-4.5 text-center">
                      <span className={cn(
                        "inline-block px-2.5 py-0.5 rounded text-xs font-bold",
                        item.prioridad === "Alta" ? "bg-amber-500/15 text-amber-400 print:text-amber-600" :
                        item.prioridad === "Baja" ? "bg-zinc-500/15 text-zinc-500" :
                        "bg-emerald-500/15 text-emerald-400 print:text-emerald-600"
                      )}>
                        {item.prioridad}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 font-mono text-zinc-400 print:text-zinc-700">
                      {item.vencimiento ? formatDate(item.vencimiento) : "-"}
                    </td>
                    <td className="px-6 py-4.5 text-zinc-500 text-xs italic print:text-zinc-500 max-w-xs truncate">
                      {item.observaciones || "Sin observaciones previas"}
                    </td>
                    <td className="px-6 py-4.5 text-center">
                      {item.realizado ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs">
                          Sí
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-zinc-500 text-xs font-bold border border-white/5">
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* General Observaciones / Notas section */}
        {orden.observaciones && (
          <div className="bg-[#151515] p-6 rounded-2xl border border-white/5 space-y-2 print:bg-zinc-50 print:border-none print:p-4">
            <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider print:text-zinc-700">Observaciones Generales de la Orden</h4>
            <p className="text-sm text-zinc-300 print:text-zinc-800 whitespace-pre-line leading-relaxed">{orden.observaciones}</p>
          </div>
        )}

        {/* Phase 3 Signature elements at the bottom - beautiful print templates */}
        <div className="grid grid-cols-2 gap-12 pt-16 border-t border-white/5 print:border-zinc-200 print:pt-12">
          <div className="text-center space-y-4">
            <div className="border-b border-zinc-500/30 mx-auto w-48 h-12 print:border-zinc-400" />
            <div>
              <p className="text-sm font-bold text-white print:text-zinc-950">Firma del productor</p>
              <p className="text-xs text-zinc-500">{orden.clientes?.nombre}</p>
            </div>
          </div>
          
          <div className="text-center space-y-4">
            <div className="border-b border-zinc-500/30 mx-auto w-48 h-12 print:border-zinc-400" />
            <div>
              <p className="text-sm font-bold text-white print:text-zinc-950">Firma del técnico</p>
              <p className="text-xs text-zinc-500">{orden.tecnico_asignado || "Técnico Responsable"}</p>
            </div>
          </div>
        </div>

      </div>

      {/* Phase 6: Finalize Order Portal / Modal Popup */}
      {isFinalizing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-3xl p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto space-y-6">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                <h3 className="text-xl font-bold text-white">Finalizar Orden {orden.numero}</h3>
              </div>
              <button 
                onClick={() => setIsFinalizing(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl flex gap-3 text-emerald-400 text-sm">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Información de finalización</p>
                <p className="text-zinc-400 text-xs mt-0.5 leading-relaxed">
                  Marque cada tarea completada. Para cada tarea seleccionada como "Realizado", el sistema registrará automáticamente un nuevo historial de mantenimiento en la ficha del tambo.
                </p>
              </div>
            </div>

            {/* List items to check done */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Estado de Tareas del Mantenimiento</h4>
              
              <div className="space-y-3">
                {items.map((item) => {
                  const state = finalizingItems[item.id] || { realizado: true, observaciones: "" };
                  return (
                    <div 
                      key={item.id} 
                      className={cn(
                        "p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4",
                        state.realizado 
                          ? "bg-emerald-500/5 border-emerald-500/20" 
                          : "bg-zinc-950 border-white/5"
                      )}
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{item.componente}</span>
                          <span className="text-xs text-zinc-500">({item.trabajo})</span>
                        </div>
                        
                        {/* Notes input */}
                        <input
                          type="text"
                          placeholder="Notas u observaciones de este componente..."
                          value={state.observaciones}
                          onChange={(e) => handleItemObservacionesChange(item.id, e.target.value)}
                          className="w-full bg-black border border-white/5 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 mt-2"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleItemRealizado(item.id)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start md:self-auto",
                          state.realizado 
                            ? "bg-emerald-500 text-black hover:bg-emerald-600" 
                            : "bg-zinc-800 text-zinc-400 hover:text-white"
                        )}
                      >
                        {state.realizado ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            Realizado
                          </>
                        ) : (
                          "Marcar Realizado"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions button */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
              <button
                onClick={() => setIsFinalizing(false)}
                className="bg-zinc-950 hover:bg-zinc-900 border border-white/5 text-zinc-300 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              >
                Cerrar portal
              </button>
              <button
                onClick={handleFinalizeConfirm}
                className="bg-emerald-500 hover:bg-emerald-600 text-black px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                Confirmar Cierre y Actualizar Mantenimientos
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
