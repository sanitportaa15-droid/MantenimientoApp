import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  Calendar, 
  ClipboardList, 
  History, 
  Plus, 
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Camera,
  XCircle,
  Save,
  Edit2,
  HelpCircle,
  Settings2,
  Info,
  Activity,
  Wrench
} from "lucide-react";
import { db } from "../services/db";
import { Tambo, Mantenimiento, Configuracion, Cliente, Reclamo, TipoMantenimiento, FichaTecnica, Componente, Pezonera, TamboComponente } from "../types/supabase";
import { calculateMaintenanceStatus, getGeneralStatus, Status, MaintenanceStatus, calculateComponentQuantity } from "../utils/calculations";
import { cn, formatDate } from "../utils/ui";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type TabType = "info" | "history" | "reclamos" | "technical";

export default function TamboDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tambo, setTambo] = useState<any>(null);
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [reclamos, setReclamos] = useState<Reclamo[]>([]);
  const [catalogComponentes, setCatalogComponentes] = useState<Componente[]>([]);
  const [pezoneras, setPezoneras] = useState<Pezonera[]>([]);
  const [configs, setConfigs] = useState<Configuracion[]>([]);
  const [allMaintTypes, setAllMaintTypes] = useState<TipoMantenimiento[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<MaintenanceStatus[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("info");
  const [showResolvedReclamos, setShowResolvedReclamos] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditDateModalOpen, setIsEditDateModalOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<MaintenanceStatus | null>(null);

  // Technical Sheet Form State
  const [isSavingFicha, setIsSavingFicha] = useState(false);

  useEffect(() => {
    if (id) loadData();

    // Real-time subscriptions
    const mantenimientosSubscription = db.mantenimientos.subscribeToChanges(() => {
      if (id) loadData();
    });

    const configSubscription = db.configuracion.subscribeToChanges(() => {
      if (id) loadData();
    });

    const maintTypesSubscription = db.tipos_mantenimiento.subscribeToChanges(() => {
      if (id) loadData();
    });

    return () => {
      mantenimientosSubscription.unsubscribe();
      configSubscription.unsubscribe();
      maintTypesSubscription.unsubscribe();
    };
  }, [id, showResolvedReclamos]);

  async function loadData() {
    try {
      setLoading(true);
      const [tamboData, mantData, configData, activeTypesNames, reclamosData, allMaintTypesData, catalogComponentesData, pezonerasData] = await Promise.all([
        db.tambos.getById(id!),
        db.mantenimientos.getByTambo(id!),
        db.configuracion.getAll(),
        db.tambos.getMantenimientosActivos(id!),
        db.reclamos.getByTambo(id!, !showResolvedReclamos),
        db.tipos_mantenimiento.getAll(),
        db.componentes.getAll(),
        db.pezoneras.getAll()
      ]);
      
      setTambo(tamboData);
      setMantenimientos(mantData);
      setConfigs(configData);
      setActiveTypes(activeTypesNames);
      setReclamos(reclamosData);
      setAllMaintTypes(allMaintTypesData);
      setCatalogComponentes(catalogComponentesData);
      setPezoneras(pezonerasData);
      
      const activeTypesObjects = allMaintTypesData.filter(t => activeTypesNames.includes(t.nombre));
      const calcStatuses = calculateMaintenanceStatus(tamboData, mantData, configData, activeTypesObjects);
      setStatuses(calcStatuses);
    } catch (error) {
      console.error("Error loading tambo details:", error);
    } finally {
      setLoading(false);
    }
  }

  const generatePDF = async () => {
    console.log("Iniciando generación de PDF para:", tambo?.nombre);
    if (!tambo) {
      console.error("Error: No hay datos del tambo cargados.");
      return;
    }
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFillColor(16, 185, 129); // Emerald 500
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("Reporte Técnico", 20, 20);
      doc.setFontSize(14);
      doc.text("GanPor Mantenimiento", 20, 30);
      
      // Client & Tambo Info
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.text("Información General", 20, 55);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("CLIENTE", 20, 65);
      doc.text("TAMBO", 110, 65);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text(tambo.clientes.nombre, 20, 72);
      doc.text(tambo.nombre, 110, 72);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("VACAS EN ORDEÑE", 20, 82);
      doc.text("BAJADAS", 60, 82);
      doc.text("ORDEÑES/DÍA", 90, 82);
      doc.text("MARCA PEZONERA", 120, 82);
      doc.text("FECHA REPORTE", 165, 82);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(tambo.vacas_en_ordene.toString(), 20, 89);
      doc.text(tambo.bajadas.toString(), 60, 89);
      doc.text(tambo.ordenes_por_dia.toString(), 90, 89);
      doc.text(tambo.marca_pezonera || "N/A", 120, 89);
      doc.text(new Date().toLocaleDateString(), 165, 89);
      
      // Technical Status Table
      doc.setFontSize(16);
      doc.text("Estado Técnico del Equipo", 20, 105);
      
      const statusData = statuses.map(s => [
        s.tipo,
        s.status === "gris" ? "NUNCA REALIZADO" : s.status.toUpperCase(),
        formatDate(s.ultimaFecha),
        formatDate(s.proximaFecha),
        s.diasRestantes !== null ? `${s.diasRestantes} días` : "N/A"
      ]);

      autoTable(doc, {
        startY: 110,
        head: [['Tipo de Mantenimiento', 'Estado', 'Último', 'Próximo', 'Días Rest.'],],
        body: statusData,
        headStyles: { fillColor: [16, 185, 129] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 20, right: 20 }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 15;

      // Maintenance History
      if (finalY > 240) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFontSize(16);
      doc.text("Historial de Mantenimientos", 20, finalY);
      
      const historyData = mantenimientos
        .filter(m => m.fecha !== '1900-01-01')
        .map(m => [
          formatDate(m.fecha),
          m.tipo,
          m.observaciones || "Sin observaciones"
        ]);

      autoTable(doc, {
        startY: finalY + 5,
        head: [['Fecha', 'Tipo', 'Observaciones'],],
        body: historyData,
        headStyles: { fillColor: [71, 85, 105] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 20, right: 20 }
      });

      finalY = (doc as any).lastAutoTable.finalY + 15;

      // Reclamos Section
      if (finalY > 240) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFontSize(16);
      doc.text("Reclamos Registrados", 20, finalY);

      if (reclamos.length === 0) {
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("No hay reclamos registrados", 20, finalY + 10);
        finalY += 20;
      } else {
        const reclamosData = reclamos.map(r => [
          formatDate(r.fecha_reclamo),
          r.titulo,
          r.descripcion || "Sin descripción",
          r.estado
        ]);

        autoTable(doc, {
          startY: finalY + 5,
          head: [['Fecha', 'Título', 'Descripción', 'Estado'],],
          body: reclamosData,
          headStyles: { fillColor: [245, 158, 11] }, // Amber 500
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 20, right: 20 }
        });
        finalY = (doc as any).lastAutoTable.finalY + 15;
      }

      // Observations
      if (tambo.clientes.observaciones) {
        if (finalY > 250) {
          doc.addPage();
          finalY = 20;
        }
        doc.setFontSize(14);
        doc.text("Observaciones del Cliente", 20, finalY);
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        const splitObs = doc.splitTextToSize(tambo.clientes.observaciones, pageWidth - 40);
        doc.text(splitObs, 20, finalY + 7);
        finalY += (splitObs.length * 5) + 15;
      }

      // Photos
      const photos = mantenimientos.filter(m => m.foto_url);
      if (photos.length > 0) {
        if (finalY > 200) {
          doc.addPage();
          finalY = 20;
        }
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.text("Fotografías Registradas", 20, finalY);
        
        let photoX = 20;
        let photoY = finalY + 10;
        
        for (const photo of photos) {
          if (photo.foto_url) {
            try {
              doc.addImage(photo.foto_url, 'JPEG', photoX, photoY, 50, 50);
              photoX += 60;
              if (photoX > pageWidth - 60) {
                photoX = 20;
                photoY += 60;
                if (photoY > 240) {
                  doc.addPage();
                  photoY = 20;
                }
              }
            } catch (e) {
              console.error("Error adding image to PDF:", e);
            }
          }
        }
      }

      doc.save(`Reporte_${tambo.nombre}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Error al generar el PDF:", error);
      alert("Ocurrió un error al generar el PDF. Por favor, revise la consola.");
    }
  };

  if (loading || !tambo) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const generalStatus = getGeneralStatus(statuses);

  const tabs = [
    { id: "info", label: "Información", icon: Info },
    { id: "technical", label: "Ficha Técnica", icon: FileText },
    { id: "history", label: "Historial", icon: History },
    { id: "reclamos", label: "Reclamos", icon: ClipboardList },
  ];

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold tracking-tight">{tambo.nombre}</h2>
              <StatusBadge status={generalStatus} />
            </div>
            <p className="text-zinc-500">{tambo.clientes.nombre}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link 
            to={`/tambos/analisis/${tambo.id}`}
            className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl font-semibold border border-emerald-500/20 transition-colors"
          >
            <Activity className="w-4 h-4" />
            Análisis Técnico
          </Link>
          <Link 
            to={`/tambos/editar/${tambo.id}`}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-semibold border border-white/10 transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            Configurar Equipo
          </Link>
          <button 
            onClick={generatePDF}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-semibold border border-white/10 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Generar Reporte PDF
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black px-4 py-2 rounded-xl font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Registrar Mantenimiento
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 bg-[#0f0f0f] p-1 rounded-2xl border border-white/5 w-fit overflow-x-auto max-w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-emerald-500 text-black"
                  : "text-zinc-500 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "info" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
          {/* Technical Status Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <ClipboardList className="text-emerald-400 w-5 h-5" />
                  Estado Técnico del Equipo
                </h3>
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  {statuses.length} componentes activos
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {statuses.map((s) => (
                  <div key={s.tipo} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-white/10 transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{s.tipo}</p>
                        <button 
                          onClick={() => {
                            setEditingStatus(s);
                            setIsEditDateModalOpen(true);
                          }}
                          className="p-1 hover:bg-white/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Edit2 className="w-3 h-3 text-zinc-500" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                        <span>Último: {s.ultimaFecha ? formatDate(s.ultimaFecha) : 'NUNCA'}</span>
                        <span>•</span>
                        <span>Próximo: {s.proximaFecha ? formatDate(s.proximaFecha) : 'N/A'}</span>
                      </div>
                      {s.frecuenciaLabel && (
                        <div className="text-[9px] text-zinc-600 font-medium italic mt-0.5">
                          {s.frecuenciaLabel}
                        </div>
                      )}
                      {s.tipo === "Cambio de pezoneras" && s.ordenosPorPezonera !== undefined && (
                        <div className="text-[9px] text-zinc-500 mt-1 space-y-0.5 border-t border-white/5 pt-1">
                          <p>Ordeños por pezonera/día: <span className="text-zinc-300 font-bold">{s.ordenosPorPezonera.toFixed(1)}</span></p>
                          <p>Días estimados de duración: <span className="text-zinc-300 font-bold">{s.diasEstimados} días</span></p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={s.status} size="sm" />
                      {s.diasRestantes !== null && (
                        <span className={cn(
                          "text-[10px] font-bold",
                          s.status === "rojo" ? "text-red-400" : s.status === "amarillo" ? "text-amber-400" : "text-emerald-400"
                        )}>
                          {s.diasRestantes} días
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

      <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 md:p-8">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Info className="text-emerald-400 w-5 h-5" />
          Detalles Adicionales
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <InfoItem label="Vacas en ordeñe" value={tambo.vacas_en_ordene.toString()} />
            <InfoItem label="Bajadas" value={tambo.bajadas.toString()} />
            <InfoItem label="Ordeñes por día" value={tambo.ordenes_por_dia.toString()} />
          </div>
          <div className="space-y-4">
            <InfoItem label="Modelo Pezonera" value={tambo.pezoneras?.nombre || "N/A"} />
            <InfoItem label="Brazos Extractores" value={tambo.tiene_brazos_extractores ? "SÍ" : "NO"} />
            <InfoItem label="Fecha de Alta" value={formatDate(tambo.created_at)} />
          </div>
        </div>
      </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 space-y-6">
              <h3 className="text-lg font-bold">Contacto Cliente</h3>
              <div className="space-y-4 text-sm">
                <p className="flex items-center gap-2"><span className="text-zinc-500">Tel:</span> {tambo.clientes.telefono || "N/A"}</p>
                <p className="flex items-center gap-2"><span className="text-zinc-500">Email:</span> {tambo.clientes.email || "N/A"}</p>
                <p className="flex items-center gap-2"><span className="text-zinc-500">Ubicación:</span> {tambo.clientes.ubicacion || "N/A"}</p>
              </div>

              {tambo.clientes.observaciones && (
                <div className="pt-6 border-t border-white/5">
                  <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-2">Observaciones</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed">{tambo.clientes.observaciones}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "technical" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="text-emerald-400 w-6 h-6" />
                Ficha Técnica (Cálculos Automáticos)
              </h3>
              <Link 
                to={`/tambos/editar/${tambo.id}`}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-semibold border border-white/10 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Editar Configuración
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Bajadas</p>
                <p className="text-3xl font-bold text-white">{tambo.bajadas}</p>
              </div>
              <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Pezonera</p>
                <p className="text-3xl font-bold text-white">{tambo.pezoneras?.nombre || "No definida"}</p>
              </div>
              <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Brazos Extractores</p>
                <p className="text-3xl font-bold text-white">{tambo.tiene_brazos_extractores ? "SÍ" : "NO"}</p>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-lg font-bold border-b border-white/5 pb-2">Componentes e Insumos Calculados</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tambo.tambo_componentes?.map((tc: any) => {
                  const qty = calculateComponentQuantity(tc.componentes, tambo, tc.cantidad_manual);
                  return (
                    <div key={tc.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div>
                        <p className="font-bold text-white">{tc.componentes.nombre}</p>
                        <p className="text-xs text-zinc-500">{tc.componentes.tipo}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-400 font-mono">{qty}</p>
                        <p className="text-[10px] text-zinc-600 uppercase font-bold">Unidades</p>
                      </div>
                    </div>
                  );
                })}
                {(!tambo.tambo_componentes || tambo.tambo_componentes.length === 0) && (
                  <div className="col-span-2 py-12 text-center border border-dashed border-white/10 rounded-3xl">
                    <p className="text-zinc-500 italic">No hay componentes configurados para este tambo.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 md:p-8 animate-in fade-in duration-500">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <History className="text-emerald-400 w-5 h-5" />
            Historial de Mantenimientos
          </h3>
          <div className="space-y-4">
            {mantenimientos.filter(m => m.fecha !== '1900-01-01').length === 0 ? (
              <p className="text-zinc-500 text-center py-8 italic">No hay registros de mantenimiento.</p>
            ) : (
              mantenimientos.filter(m => m.fecha !== '1900-01-01').map((m) => (
                <div key={m.id} className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Calendar className="text-emerald-400 w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="font-bold">{m.tipo}</p>
                      <p className="text-xs text-zinc-500 font-mono">{formatDate(m.fecha)}</p>
                    </div>
                    {m.observaciones && <p className="text-sm text-zinc-400 mt-1">{m.observaciones}</p>}
                    {m.foto_url && (
                       <div className="mt-3 rounded-lg overflow-hidden border border-white/10 max-w-xs">
                         <img src={m.foto_url} alt="Mantenimiento" className="w-full h-32 object-cover" referrerPolicy="no-referrer" />
                       </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "reclamos" && (
        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 md:p-8 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <ClipboardList className="text-emerald-400 w-5 h-5" />
              Reclamos del Tambo
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowResolvedReclamos(!showResolvedReclamos)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border",
                  showResolvedReclamos 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/10"
                )}
              >
                {showResolvedReclamos ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                {showResolvedReclamos ? "Viendo Historial" : "Ver Resueltos"}
              </button>
              <Link 
                to="/reclamos/nuevo" 
                className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nuevo Reclamo
              </Link>
            </div>
          </div>
          <div className="space-y-4">
            {reclamos.length === 0 ? (
              <p className="text-zinc-500 text-center py-8 italic">No hay reclamos registrados.</p>
            ) : (
              reclamos.map((r) => (
                <div key={r.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-lg">{r.titulo}</h4>
                      <p className="text-xs text-zinc-500 font-mono">{formatDate(r.fecha_reclamo)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] px-2 py-1 rounded-full font-bold uppercase",
                        r.prioridad === 'Alta' || r.prioridad === 'Urgente' ? "bg-red-500/20 text-red-400" : 
                        r.prioridad === 'Media' ? "bg-amber-500/20 text-amber-400" : 
                        "bg-blue-500/20 text-blue-400"
                      )}>
                        {r.prioridad}
                      </span>
                      <span className={cn(
                        "text-[10px] px-2 py-1 rounded-full font-bold uppercase",
                        r.estado === 'Resuelto' ? "bg-emerald-500/20 text-emerald-400" : 
                        r.estado === 'En proceso' ? "bg-blue-500/20 text-blue-400" : 
                        "bg-zinc-500/20 text-zinc-400"
                      )}>
                        {r.estado}
                      </span>
                    </div>
                  </div>
                  {r.descripcion && (
                    <div className="p-3 bg-black/20 rounded-xl text-sm text-zinc-400 whitespace-pre-wrap">
                      {r.descripcion}
                    </div>
                  )}
                  {r.estado !== 'Resuelto' && (
                    <Link 
                      to={`/reclamos/resolver/${r.id}`}
                      className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-bold"
                    >
                      Resolver Reclamo
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isModalOpen && (
        <MaintenanceModal 
          tamboId={tambo.id} 
          activeTypes={activeTypes}
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => {
            setIsModalOpen(false);
            loadData();
          }} 
        />
      )}

      {isEditDateModalOpen && editingStatus && (
        <EditLastDateModal
          tamboId={tambo.id}
          status={editingStatus}
          mantenimientos={mantenimientos}
          onClose={() => {
            setIsEditDateModalOpen(false);
            setEditingStatus(null);
          }}
          onSuccess={() => {
            setIsEditDateModalOpen(false);
            setEditingStatus(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-zinc-500 text-sm">{label}</span>
      <span className="font-mono font-bold">{value}</span>
    </div>
  );
}

function StatusBadge({ status, size = "md" }: { status: Status, size?: "sm" | "md" }) {
  const styles = {
    verde: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amarillo: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rojo: "bg-red-500/10 text-red-400 border-red-500/20",
    gris: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
  };

  const icons = {
    verde: CheckCircle2,
    amarillo: Clock,
    rojo: AlertCircle,
    gris: HelpCircle
  };

  const Icon = icons[status];

  return (
    <div className={cn(
      "flex items-center gap-1.5 border rounded-full font-bold uppercase tracking-wider",
      styles[status],
      size === "sm" ? "px-2 py-0.5 text-[8px]" : "px-3 py-1 text-[10px]"
    )}>
      <Icon className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {status === "verde" ? "Al día" : status === "amarillo" ? "Próximo" : status === "rojo" ? "Vencido" : "Nunca realizado"}
    </div>
  );
}

function MaintenanceModal({ tamboId, activeTypes, onClose, onSuccess }: { tamboId: string, activeTypes: string[], onClose: () => void, onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [observaciones, setObservaciones] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedTipos.length === 0) {
      alert("Por favor, seleccione al menos un tipo de mantenimiento.");
      return;
    }

    setLoading(true);
    try {
      const records = selectedTipos.map(tipo => ({
        tambo_id: tamboId,
        tipo,
        fecha,
        observaciones: observaciones.trim() || null,
        foto_url: fotoUrl.trim() || null
      }));

      await db.mantenimientos.createMany(records);
      onSuccess();
    } catch (error) {
      console.error("Error creating maintenance records:", error);
      alert("Error al registrar el mantenimiento.");
    } finally {
      setLoading(false);
    }
  }

  const toggleTipo = (tipo: string) => {
    setSelectedTipos(prev => 
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0f0f0f] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-2xl font-bold">Registrar Mantenimiento</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <XCircle className="w-6 h-6 text-zinc-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
              Seleccionar Trabajos Realizados ({selectedTipos.length})
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {activeTypes.map(tipo => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => toggleTipo(tipo)}
                  className={cn(
                    "px-4 py-3 rounded-xl text-sm font-medium border text-left transition-all flex items-center justify-between",
                    selectedTipos.includes(tipo)
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                      : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/20"
                  )}
                >
                  <span>{tipo}</span>
                  {selectedTipos.includes(tipo) && <CheckCircle2 className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Fecha</label>
              <input
                required
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">URL de Foto (Opcional)</label>
              <div className="relative">
                <input
                  type="url"
                  value={fotoUrl}
                  onChange={(e) => setFotoUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-10 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="https://..."
                />
                <Camera className="absolute left-3 top-3.5 w-4 h-4 text-zinc-500" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              placeholder="Detalles del trabajo..."
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl font-bold border border-white/10 hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              disabled={loading || selectedTipos.length === 0}
              type="submit"
              className="flex-[2] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Guardar {selectedTipos.length} Registros
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditLastDateModal({ tamboId, status, mantenimientos, onClose, onSuccess }: { tamboId: string, status: MaintenanceStatus, mantenimientos: Mantenimiento[], onClose: () => void, onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [neverPerformed, setNeverPerformed] = useState(!status.ultimaFecha);
  const [fecha, setFecha] = useState(status.ultimaFecha ? status.ultimaFecha.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const obs = neverPerformed ? "Marcado como nunca realizado" : "Actualización manual de fecha (Registro rápido)";
      
      if (neverPerformed) {
        // If marking as never, delete all previous history for this type
        await db.mantenimientos.deleteByType(tamboId, status.tipo);
      } else {
        // Always INSERT a new record to preserve history and follow "INSERT, no UPDATE" rule
        await db.mantenimientos.create({
          tambo_id: tamboId,
          tipo: status.tipo,
          fecha: fecha,
          observaciones: obs
        });
      }
      onSuccess();
    } catch (error) {
      console.error("Error updating last maintenance date:", error);
      alert("Error al actualizar la fecha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0f0f0f] border border-white/10 rounded-3xl w-full max-w-md p-6 md:p-8 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold">Editar Última Fecha</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <XCircle className="w-6 h-6 text-zinc-500" />
          </button>
        </div>

        <p className="text-sm text-zinc-400">Ajuste la fecha del último mantenimiento para <span className="text-white font-bold">{status.tipo}</span>.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:border-white/20 transition-colors">
              <input
                type="checkbox"
                checked={neverPerformed}
                onChange={(e) => setNeverPerformed(e.target.checked)}
                className="w-5 h-5 rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm font-medium">Nunca realizado todavía</span>
            </label>

            {!neverPerformed && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Fecha Específica</label>
                <input
                  required
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl font-bold border border-white/10 hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              disabled={loading}
              type="submit"
              className="flex-[2] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Guardar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
