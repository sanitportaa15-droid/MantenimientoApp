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
  Wrench,
  Package,
  MessageCircle,
  AlertTriangle
} from "lucide-react";
import { db } from "../services/db";
import { Tambo, Mantenimiento, Configuracion, Cliente, Reclamo, TipoMantenimiento, FichaTecnica, Componente, TamboComponente, TamboInsumo, Insumo } from "../types/supabase";
import { calculateMaintenanceStatus, getGeneralStatus, Status, MaintenanceStatus, calculateSupplies, calculateInsumos, InsumoCalculado } from "../utils/calculations";
import { cn, formatDate } from "../utils/ui";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useCompany } from "../services/CompanyContext";


import FichaTecnicaModal from "../components/FichaTecnicaModal";

type TabType = "info" | "history" | "reclamos" | "technical";

export default function TamboDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { company } = useCompany();

  const [loading, setLoading] = useState(true);
  const [tambo, setTambo] = useState<(Tambo & { clientes: Cliente, ficha_tecnica: FichaTecnica | null, insumos: Insumo | null }) | null>(null);
  const [mantenimientos, setMantenimientos] = useState<Mantenimiento[]>([]);
  const [reclamos, setReclamos] = useState<Reclamo[]>([]);
  const [tamboComponentes, setTamboComponentes] = useState<(TamboComponente & { componentes: Componente })[]>([]);
  const [tamboInsumos, setTamboInsumos] = useState<(TamboInsumo & { insumos: Insumo })[]>([]);
  const [calculatedSupplies, setCalculatedSupplies] = useState<InsumoCalculado[]>([]);
  const [calculatedInsumos, setCalculatedInsumos] = useState<InsumoCalculado[]>([]);
  const [configs, setConfigs] = useState<Configuracion[]>([]);
  const [allMaintTypes, setAllMaintTypes] = useState<TipoMantenimiento[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<MaintenanceStatus[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("info");
  const [showResolvedReclamos, setShowResolvedReclamos] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFichaModalOpen, setIsFichaModalOpen] = useState(false);
  const [isEditDateModalOpen, setIsEditDateModalOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<MaintenanceStatus | null>(null);

  // Work Order generation states
  const [isWorkOrderModalOpen, setIsWorkOrderModalOpen] = useState(false);
  const [workOrderStep, setWorkOrderStep] = useState(1); // 1 = Config/Params, 2 = Preview
  const [includeUpcoming, setIncludeUpcoming] = useState(true);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [assignedTech, setAssignedTech] = useState("");
  const [orderPriority, setOrderPriority] = useState("Media");
  const [orderNotes, setOrderNotes] = useState("");
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [isCreatingWorkOrder, setIsCreatingWorkOrder] = useState(false);

  // Technical Sheet Form State
  const [fichaForm, setFichaForm] = useState<Partial<FichaTecnica & { bajadas: number, vacas_en_ordene: number, ordenes_por_dia: number }>>({});
  const [isSavingFicha, setIsSavingFicha] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [newCompTipo, setNewCompTipo] = useState("");
  const [newCompCantidad, setNewCompCantidad] = useState(0);

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
      const [tamboData, mantData, configData, activeTypesNames, reclamosData, allMaintTypesData, tamboCompsData, tamboInsumosData] = await Promise.all([
        db.tambos.getById(id!),
        db.mantenimientos.getByTambo(id!),
        db.configuracion.getAllWithHidden(),
        db.tambos.getMantenimientosActivos(id!),
        db.reclamos.getByTambo(id!, !showResolvedReclamos),
        db.tipos_mantenimiento.getAll(),
        db.tambo_componentes.getByTambo(id!),
        db.tambo_insumos.getByTambo(id!)
      ]);
      
      const ficha = Array.isArray(tamboData.ficha_tecnica) ? tamboData.ficha_tecnica[0] : tamboData.ficha_tecnica;
      const normalizedTambo = { ...tamboData, ficha_tecnica: ficha };
      
      setTambo(normalizedTambo);
      setMantenimientos(mantData);
      console.log("DATOS_RECARGADOS", mantData);
      setConfigs(configData);
      setActiveTypes(activeTypesNames);
      setReclamos(reclamosData);
      setAllMaintTypes(allMaintTypesData);
      setTamboComponentes(tamboCompsData);
      setTamboInsumos(tamboInsumosData);

      try {
        const perfilesData = await db.perfiles.getAll();
        setTecnicos(perfilesData || []);
      } catch (err) {
        console.error("Error loading perfiles for technicians:", err);
      }
      
      const technicalData = {
        ...tamboData,
        bajadas: ficha?.bajadas || tamboData.bajadas || 1,
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

      const supplies = calculateSupplies(technicalData, tamboCompsData);
      setCalculatedSupplies(supplies);

      const insumos = calculateInsumos(technicalData, tamboInsumosData);
      setCalculatedInsumos(insumos);

      // Auto-create technical sheet if it doesn't exist
      if (!ficha) {
        try {
          const newFicha = await db.ficha_tecnica.create({
            tambo_id: id!,
            bajadas: tamboData.bajadas
          });
          setTambo({ ...tamboData, ficha_tecnica: newFicha });
          setFichaForm({
            ...newFicha,
            bajadas: tamboData.bajadas,
            vacas_en_ordene: tamboData.vacas_en_ordene,
            ordenes_por_dia: tamboData.ordenes_por_dia
          });
        } catch (e) {
          console.error("Error creating auto technical sheet:", e);
          // Still set ficha form with tambo data even if creation fails
          setFichaForm({
            bajadas: tamboData.bajadas,
            vacas_en_ordene: tamboData.vacas_en_ordene,
            ordenes_por_dia: tamboData.ordenes_por_dia
          });
        }
      } else {
        setFichaForm({
          ...ficha,
          bajadas: ficha.bajadas || tamboData.bajadas,
          vacas_en_ordene: ficha.vacas_en_ordene || tamboData.vacas_en_ordene,
          ordenes_por_dia: ficha.ordenes_por_dia || tamboData.ordenes_por_dia,
          usa_sello: ficha.usa_sello ?? true,
          usa_turbina: ficha.usa_turbina ?? true,
          usa_guarnicion: ficha.usa_guarnicion ?? true,
          colector_marca: ficha.colector_marca || "",
          tipo_pulsadores: ficha.tipo_pulsadores || "",
          bomba_leche_marca: ficha.bomba_leche_marca || ""
        });
        setTambo({ ...tamboData, ficha_tecnica: ficha });
      }
      
      const calcStatuses = calculateMaintenanceStatus(tamboData, mantData, configData, allMaintTypesData, activeTypesNames);
      
      // Filter to only include active configured maintenance types for this tambo
      const filteredStatuses = calcStatuses.filter(s => {
        return activeTypesNames.some(name => name.toLowerCase().trim() === s.tipo.toLowerCase().trim());
      });
      setStatuses(filteredStatuses);
    } catch (error) {
      console.error("Error loading tambo details:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleAddDynamicField = () => {
    if (!newFieldName.trim()) return;
    const currentExtra = (fichaForm.datos_extra as Record<string, any>) || {};
    setFichaForm({
      ...fichaForm,
      datos_extra: {
        ...currentExtra,
        [newFieldName]: newFieldValue
      }
    });
    setNewFieldName("");
    setNewFieldValue("");
  };

  const handleRemoveDynamicField = (key: string) => {
    const currentExtra = { ...(fichaForm.datos_extra as Record<string, any>) };
    delete currentExtra[key];
    setFichaForm({
      ...fichaForm,
      datos_extra: currentExtra
    });
  };

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
      doc.text(company.nombre === "Sistema de Mantenimiento" ? "Sistema de Mantenimiento" : `${company.nombre} Mantenimiento`, 20, 30);

      
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
      doc.text(tambo.insumos?.nombre || "N/A", 120, 89);
      doc.text(new Date().toLocaleDateString(), 165, 89);

      // Equipment Info
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("BOMBA VACÍO", 20, 99);
      doc.text("BOMBA LECHE", 70, 99);
      doc.text("PULSADORES", 120, 99);
      doc.text("COLECTOR", 165, 99);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(tambo.ficha_tecnica?.bomba_vacio_marca || tambo.ficha_tecnica?.tipo_bomba_vacio || "N/A", 20, 106);
      doc.text(tambo.ficha_tecnica?.bomba_leche_marca || tambo.ficha_tecnica?.tipo_bomba_leche || "N/A", 70, 106);
      doc.text(tambo.ficha_tecnica?.tipo_pulsadores || "N/A", 120, 106);
      doc.text(tambo.ficha_tecnica?.colector_marca || "N/A", 165, 106);
      
      // Technical Status Table
      doc.setFontSize(16);
      doc.text("Estado Técnico del Equipo", 20, 122);
      
      const statusData = statuses.map(s => [
        s.tipo,
        s.status === "gris" ? "SIN REGISTRO" : s.status.toUpperCase(),
        s.ultimaFecha ? formatDate(s.ultimaFecha) : "SIN HISTORIAL",
        s.proximaFecha ? formatDate(s.proximaFecha) : "N/A",
        s.diasRestantes !== null ? `${s.diasRestantes} días` : "N/A"
      ]);

      autoTable(doc, {
        startY: 127,
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

  const handleSaveFicha = async () => {
    if (!tambo?.ficha_tecnica?.id) return;
    try {
      setIsSavingFicha(true);
      
      // Split data for both tables
      const { bajadas, vacas_en_ordene, ordenes_por_dia, ...fichaData } = fichaForm;
      
      // Update Ficha Técnica
      const updatedFicha = await db.ficha_tecnica.update(tambo.ficha_tecnica.id, fichaData);
      
      // Update Tambo (if values changed)
      const updatedTambo = await db.tambos.update(tambo.id, {
        bajadas,
        vacas_en_ordene,
        ordenes_por_dia
      });

      setTambo({ ...updatedTambo, clientes: tambo.clientes, ficha_tecnica: updatedFicha });
      alert("Ficha técnica actualizada correctamente");
      loadData(); // Reload to update statuses
    } catch (error) {
      console.error("Error saving ficha:", error);
      alert("Error al guardar la ficha técnica");
    } finally {
      setIsSavingFicha(false);
    }
  };

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
            type="button"
            onClick={() => {
              setWorkOrderStep(1);
              setIsWorkOrderModalOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            Generar Orden de Trabajo
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
                        {!s.ultimaFecha ? (
                          <span className="text-zinc-500 font-bold normal-case">Sin historial de mantenimiento registrado aún</span>
                        ) : (
                          <>
                            <span>Último: {formatDate(s.ultimaFecha)}</span>
                            <span>•</span>
                            <span>Próximo: {s.proximaFecha ? formatDate(s.proximaFecha) : 'N/A'}</span>
                          </>
                        )}
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
                  <InfoItem label="Marca Pezonera" value={tambo.insumos?.nombre || "N/A"} />
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
                Ficha Técnica del Tambo
              </h3>
              <button
                onClick={() => setIsFichaModalOpen(true)}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black px-6 py-2 rounded-xl font-bold transition-all"
              >
                <Edit2 className="w-4 h-4" />
                Editar Ficha
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-2">Datos de Ordeñe</h4>
                <div className="grid grid-cols-1 gap-4">
                  <InfoItem label="Bajadas" value={tambo.bajadas.toString()} />
                  <InfoItem label="Vacas en Ordeñe" value={tambo.vacas_en_ordene.toString()} />
                  <InfoItem label="Ordeñes por Día" value={tambo.ordenes_por_dia.toString()} />
                  <InfoItem label="Brazos Extractores" value={tambo.tiene_brazos_extractores ? "SÍ" : "NO"} />
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 pb-2">Equipamiento</h4>
                <div className="grid grid-cols-1 gap-4">
                  <InfoItem label="Pezonera" value={tambo.insumos?.nombre || "N/A"} />
                  <InfoItem label="Tipo Equipo" value={tambo.ficha_tecnica?.tipo_equipo || "N/A"} />
                  <InfoItem label="Bomba Vacío" value={tambo.ficha_tecnica?.bomba_vacio_marca || tambo.ficha_tecnica?.tipo_bomba_vacio || "N/A"} />
                  <InfoItem label="Bomba Leche" value={tambo.ficha_tecnica?.bomba_leche_marca || tambo.ficha_tecnica?.tipo_bomba_leche || "N/A"} />
                  {tambo.ficha_tecnica?.colector_marca && (
                    <InfoItem label="Colector" value={tambo.ficha_tecnica.colector_marca} />
                  )}
                </div>
              </div>
            </div>

            {tambo.ficha_tecnica?.observaciones && (
              <div className="mt-8 pt-8 border-t border-white/5">
                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Observaciones Técnicas</h4>
                <p className="text-zinc-400 leading-relaxed whitespace-pre-wrap">{tambo.ficha_tecnica.observaciones}</p>
              </div>
            )}
          </div>

          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 md:p-8">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
              <Package className="text-emerald-400 w-5 h-5" />
              Cálculo Automático de Insumos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {calculatedInsumos.map((insumo, idx) => (
                <div key={idx} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{insumo.nombre}</p>
                    <p className="text-2xl font-mono font-bold text-emerald-400">{insumo.cantidad}</p>
                  </div>
                  <div className="text-[10px] font-bold bg-white/5 px-2 py-1 rounded text-zinc-400 uppercase">
                    {insumo.tipo}
                  </div>
                </div>
              ))}
              {calculatedInsumos.length === 0 && (
                <p className="col-span-full text-center py-8 text-zinc-500 italic">No hay insumos configurados para este tambo.</p>
              )}
            </div>
          </div>

          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 md:p-8">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
              <Wrench className="text-emerald-400 w-5 h-5" />
              Otros Componentes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {calculatedSupplies.map((insumo, idx) => (
                <div key={idx} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{insumo.nombre}</p>
                    <p className="text-2xl font-mono font-bold text-emerald-400">{insumo.cantidad}</p>
                  </div>
                  <div className="text-[10px] font-bold bg-white/5 px-2 py-1 rounded text-zinc-400 uppercase">
                    {insumo.tipo}
                  </div>
                </div>
              ))}
              {calculatedSupplies.length === 0 && (
                <p className="col-span-full text-center py-8 text-zinc-500 italic">No hay otros componentes configurados.</p>
              )}
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

      {isFichaModalOpen && (
        <FichaTecnicaModal 
          tamboId={id!} 
          onClose={() => setIsFichaModalOpen(false)} 
          onSuccess={() => {
            setIsFichaModalOpen(false);
            loadData();
          }} 
        />
      )}

      {isModalOpen && tambo && (
        <MaintenanceModal 
          tambo={tambo}
          configs={configs}
          allMaintTypes={allMaintTypes}
          activeTypes={(() => {
            const set = new Set([...activeTypes]);
            mantenimientos.forEach(m => {
              if (m.tipo?.trim()) set.add(m.tipo.trim());
            });
            return Array.from(set);
          })()}
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

      {isWorkOrderModalOpen && tambo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-3xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-6">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <ClipboardList className="w-6 h-6 text-emerald-400" />
                <h3 className="text-xl font-bold text-white">Generar Orden de Trabajo</h3>
              </div>
              <button 
                onClick={() => {
                  setIsWorkOrderModalOpen(false);
                  setWorkOrderStep(1);
                }}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-4 text-xs font-mono border-b border-white/5 pb-4">
              <span className={cn(
                "px-2.5 py-1 rounded-lg font-bold",
                workOrderStep === 1 ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-400"
              )}>
                1. Parámetros de Selección
              </span>
              <span className="text-zinc-600">→</span>
              <span className={cn(
                "px-2.5 py-1 rounded-lg font-bold",
                workOrderStep === 2 ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-400"
              )}>
                2. Vista Previa de Documento
              </span>
            </div>

            {/* Calculations of order items */}
            {(() => {
              const includedItems = statuses.filter(s => {
                if (s.status === "verde" || s.status === "gris") return false;
                if (onlyOverdue) {
                  return s.status === "rojo";
                }
                if (s.status === "rojo") return true;
                if (s.status === "amarillo") {
                  return includeUpcoming;
                }
                return false;
              }).map(s => ({
                componente: s.tipo,
                trabajo: s.tipo === "Cambio de pezoneras" ? "Sustitución de pezoneras" : `Mantenimiento preventivo de ${s.tipo}`,
                prioridad: s.status === "rojo" ? "Alta" : "Media",
                vencimiento: s.proximaFecha || null,
                observaciones: s.status === "rojo" 
                  ? `VENCIDO (Días excedidos: ${s.diasRestantes !== null ? Math.abs(s.diasRestantes) : ""})` 
                  : `Próximo a vencer (${s.diasRestantes !== null ? s.diasRestantes : ""} días restantes)`
              }));

              if (workOrderStep === 1) {
                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Configuration checks */}
                      <div className="bg-[#151515] p-5 rounded-2xl border border-white/5 space-y-4">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Filtros de Análisis</h4>
                        
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={!onlyOverdue}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setOnlyOverdue(!checked);
                            }}
                            className="mt-1 h-4.5 w-4.5 rounded border-white/10 bg-black text-emerald-500 focus:ring-emerald-500"
                          />
                          <div>
                            <span className="text-sm font-semibold text-white">Incluir Próximos Vencimientos</span>
                            <p className="text-xs text-zinc-500 mt-0.5">Analiza los mantenimientos que vencerán en los próximos 30 días.</p>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={onlyOverdue}
                            onChange={(e) => setOnlyOverdue(e.target.checked)}
                            className="mt-1 h-4.5 w-4.5 rounded border-white/10 bg-black text-emerald-500 focus:ring-emerald-500"
                          />
                          <div>
                            <span className="text-sm font-semibold text-white">Incluir únicamente Vencidos</span>
                            <p className="text-xs text-zinc-500 mt-0.5">Excluye cualquier mantenimiento que aún esté vigente, enfocándose solo en lo atrasado.</p>
                          </div>
                        </label>
                      </div>

                      {/* Technical Assignment & Priority */}
                      <div className="bg-[#151515] p-5 rounded-2xl border border-white/5 space-y-4">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Asignación y Prioridad</h4>
                        
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-400">Técnico Asignado</label>
                          <select
                            value={assignedTech}
                            onChange={(e) => setAssignedTech(e.target.value)}
                            className="w-full bg-black border border-white/5 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">-- No asignado (Elegir más tarde) --</option>
                            {tecnicos.map(t => (
                              <option key={t.id} value={t.nombre || t.email}>{t.nombre || t.email} ({t.rol || "Técnico"})</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs text-zinc-400">Prioridad General de la Orden</label>
                          <select
                            value={orderPriority}
                            onChange={(e) => setOrderPriority(e.target.value)}
                            className="w-full bg-black border border-white/5 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500"
                          >
                            <option value="Baja">Baja</option>
                            <option value="Media">Media</option>
                            <option value="Alta">Alta</option>
                            <option value="Urgente">Urgente</option>
                          </select>
                        </div>
                      </div>

                    </div>

                    {/* General observations */}
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-400">Observaciones o Notas Adicionales para el Técnico</label>
                      <textarea
                        rows={3}
                        placeholder="Escribe aquí las instrucciones de trabajo específicas, fallas recurrentes, o prioridades..."
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        className="w-full bg-black border border-white/5 rounded-2xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500 placeholder:text-zinc-600"
                      />
                    </div>

                    {/* List of analyzed items included */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        Trabajos Analizados para Incluir ({includedItems.length})
                      </h4>
                      
                      {includedItems.length === 0 ? (
                        <div className="p-6 bg-[#151515] border border-white/5 rounded-2xl text-center space-y-2">
                          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto animate-pulse" />
                          <p className="text-sm text-white font-bold">Sin elementos vencidos ni próximos a vencer</p>
                          <p className="text-xs text-zinc-500">
                            El estado de mantenimiento técnico para este tambo está completamente al día. No hay trabajos que requieran acción inmediata.
                          </p>
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-2 border border-white/5 rounded-2xl p-3 bg-black/40">
                          {includedItems.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-[#121212] rounded-xl border border-white/5 text-xs">
                              <div className="space-y-0.5">
                                <p className="font-bold text-white">{it.componente}</p>
                                <p className="text-zinc-500">Trabajo: {it.trabajo}</p>
                              </div>
                              <div className="text-right space-y-0.5">
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold",
                                  it.prioridad === "Alta" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                                )}>
                                  {it.prioridad}
                                </span>
                                <p className="text-[10px] text-zinc-500 mt-0.5">{it.observaciones}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                      <button
                        onClick={() => setIsWorkOrderModalOpen(false)}
                        className="bg-zinc-950 hover:bg-zinc-900 border border-white/5 text-zinc-300 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        disabled={includedItems.length === 0}
                        onClick={() => setWorkOrderStep(2)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-black disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20"
                      >
                        Ver Vista Previa
                      </button>
                    </div>

                  </div>
                );
              }

              // Step 2: Document Preview representation
              return (
                <div className="space-y-6">
                  <div className="bg-white text-zinc-900 p-6 rounded-2xl shadow-xl border border-zinc-200 font-sans text-xs space-y-6 max-h-[50vh] overflow-y-auto">
                    
                    {/* Fake PDF header */}
                    <div className="flex justify-between items-start border-b pb-4 border-zinc-200">
                      <div>
                        <h4 className="text-sm font-bold tracking-tight text-zinc-950 uppercase">{company.nombre || "Sistema"}</h4>
                        <p className="text-[10px] text-zinc-500">Sistemas de Mantenimiento de Ordeño</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-zinc-950">ORDEN DE TRABAJO (PREVISUALIZACIÓN)</p>
                        <p className="font-mono text-emerald-600 font-bold text-[10px] mt-0.5">NÚMERO: OT-AUTO</p>
                        <p className="text-zinc-500 text-[10px]">Fecha: {formatDate(new Date().toISOString())}</p>
                      </div>
                    </div>

                    {/* Fake PDF Details */}
                    <div className="grid grid-cols-2 gap-4 text-[11px] bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                      <div>
                        <p className="font-bold text-zinc-800">CLIENTE / PRODUCTOR:</p>
                        <p className="font-bold text-zinc-950">{tambo.clientes.nombre}</p>
                        <p className="text-zinc-500">Tel: {tambo.clientes.telefono || "-"}</p>
                        <p className="text-zinc-500">Ubicación: {tambo.clientes.ubicacion || "-"}</p>
                      </div>
                      <div>
                        <p className="font-bold text-zinc-800">ESTABLECIMIENTO / TAMBO:</p>
                        <p className="font-bold text-zinc-950">{tambo.nombre}</p>
                        <p className="text-zinc-500">Bajadas (Unidades): {tambo.bajadas || "-"}</p>
                        <p className="text-zinc-500">Técnico Asignado: <strong>{assignedTech || "No asignado aún"}</strong></p>
                      </div>
                    </div>

                    {/* Fake PDF Items Table */}
                    <div className="space-y-2">
                      <p className="font-bold text-zinc-800 text-[11px]">TRABAJOS Y COMPONENTES REQUERIDOS:</p>
                      <table className="w-full text-left border-collapse border border-zinc-200 rounded text-[10px]">
                        <thead>
                          <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-700 font-bold">
                            <th className="p-2">Equipo / Componente</th>
                            <th className="p-2">Trabajo Requerido</th>
                            <th className="p-2">Prioridad</th>
                            <th className="p-2">Vencimiento</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 text-zinc-800">
                          {includedItems.map((it, idx) => (
                            <tr key={idx}>
                              <td className="p-2 font-bold">{it.componente}</td>
                              <td className="p-2">{it.trabajo}</td>
                              <td className="p-2 uppercase font-bold text-amber-600">{it.prioridad}</td>
                              <td className="p-2 font-mono">{it.vencimiento ? formatDate(it.vencimiento) : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Fake PDF Notes */}
                    {orderNotes && (
                      <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-zinc-700">
                        <p className="font-bold text-zinc-800 mb-1 text-[10px] uppercase">Observaciones Adicionales:</p>
                        <p className="text-zinc-600 leading-relaxed whitespace-pre-line">{orderNotes}</p>
                      </div>
                    )}

                    {/* Fake PDF Signatures */}
                    <div className="grid grid-cols-2 gap-8 pt-6">
                      <div className="text-center space-y-2">
                        <div className="border-b border-zinc-300 w-32 mx-auto h-6" />
                        <p className="text-[10px] font-bold text-zinc-700">Firma del productor</p>
                      </div>
                      <div className="text-center space-y-2">
                        <div className="border-b border-zinc-300 w-32 mx-auto h-6" />
                        <p className="text-[10px] font-bold text-zinc-700">Firma del técnico</p>
                      </div>
                    </div>

                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <button
                      disabled={isCreatingWorkOrder}
                      onClick={() => setWorkOrderStep(1)}
                      className="bg-zinc-950 hover:bg-zinc-900 border border-white/5 text-zinc-300 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    >
                      Volver y Modificar
                    </button>
                    
                    <button
                      disabled={isCreatingWorkOrder}
                      onClick={async () => {
                        try {
                          setIsCreatingWorkOrder(true);
                          
                          const newOrderObj = {
                            cliente_id: tambo.cliente_id,
                            tambo_id: tambo.id,
                            fecha: new Date().toISOString().split("T")[0],
                            prioridad: orderPriority,
                            tecnico_asignado: assignedTech || "No asignado",
                            observaciones: orderNotes
                          };

                          const created = await db.ordenesTrabajo.create(newOrderObj, includedItems);
                          
                          setIsWorkOrderModalOpen(false);
                          setWorkOrderStep(1);
                          setOrderNotes("");
                          setAssignedTech("");
                          
                          // Quick prompt to navigate directly
                          if (created && confirm(`¡Orden de Trabajo generada con éxito!\n¿Desea abrir el detalle de la Orden de Trabajo para imprimirla o descargar el PDF?`)) {
                            navigate(`/ordenes/${created.id}`);
                          } else {
                            loadData(); // reload status
                          }
                        } catch (err: any) {
                          console.error("Error creating work order:", err);
                          alert(err?.message || "Ocurrió un error al intentar crear la orden de trabajo en Supabase.");
                        } finally {
                          setIsCreatingWorkOrder(false);
                        }
                      }}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-black px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                    >
                      {isCreatingWorkOrder ? (
                        <>
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          Guardando en Supabase...
                        </>
                      ) : (
                        "Confirmar y Generar Orden de Trabajo"
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
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

function guessEquipoForMantenimiento(tipo: string, ficha: any): string {
  const lower = tipo.toLowerCase().trim();
  if (lower.includes("pezonera")) {
    return ficha?.colector_marca ? `Pezoneras (${ficha.colector_marca})` : "Pezoneras";
  }
  if (lower.includes("manguera") && lower.includes("leche")) {
    return "Mangueras de leche";
  }
  if (lower.includes("manguera") && lower.includes("pulsado")) {
    return "Mangueras de pulsado";
  }
  if (lower.includes("pulsador")) {
    return ficha?.tipo_pulsadores ? `Pulsadores (${ficha.tipo_pulsadores})` : "Pulsadores";
  }
  if (lower.includes("soga")) {
    return "Sogas de retiro";
  }
  if (lower.includes("diafragma") && lower.includes("brazo")) {
    return "Brazos de retiro";
  }
  if (lower.includes("buje")) {
    return "Brazos / Bujes";
  }
  if (lower.includes("sensor")) {
    return "Sensor de leche";
  }
  if (lower.includes("vacio") || lower.includes("vacío")) {
    return ficha?.bomba_vacio_marca ? `Bomba de vacío (${ficha.bomba_vacio_marca})` : "Bomba de vacío";
  }
  if (lower.includes("centrifuga") || lower.includes("centrífuga")) {
    return ficha?.bomba_leche_marca ? `Bomba centrífuga de leche (${ficha.bomba_leche_marca})` : "Bomba centrífuga de leche";
  }
  if (lower.includes("diafragma") && lower.includes("bomba")) {
    return ficha?.bomba_leche_marca ? `Bomba diafragma de leche (${ficha.bomba_leche_marca})` : "Bomba diafragma de leche";
  }
  if (lower.includes("colector")) {
    return ficha?.colector_marca ? `Colector de leche (${ficha.colector_marca})` : "Kit de colector de leche";
  }
  if (lower.includes("caucho")) {
    return "Línea de leche y lavado";
  }
  return ficha?.tipo_equipo || "Equipo de Ordeñe";
}

function calculateNextDate(
  tipo: string,
  fechaStr: string,
  tambo: any,
  configs: Configuracion[],
  allMaintTypes: TipoMantenimiento[]
): string {
  const normTipo = tipo.trim().toLowerCase();
  const isPezonera = normTipo.includes("pezonera");

  if (isPezonera) {
    const configMax = configs.find(c => c.clave === "pezonera_max_ordenes");
    const pezoneraMaxOrdenes = configMax ? parseInt(configMax.valor) || 1200 : 1200;

    const vacas = tambo.vacas_en_ordene || 0;
    const ordenes = tambo.ordenes_por_dia || 0;
    const bajadas = tambo.ficha_tecnica?.bajadas || tambo.bajadas || 1;

    const ordenosPorPezonera = (vacas * ordenes) / bajadas;
    const diasEstimados = ordenosPorPezonera > 0 ? Math.floor(pezoneraMaxOrdenes / ordenosPorPezonera) : 365;

    const [year, month, day] = fechaStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + diasEstimados);
    return formatDate(d);
  } else {
    const tipoObj = allMaintTypes.find(t => t.nombre.toLowerCase().trim() === normTipo);
    let meses = tipoObj?.frecuencia_meses || 12;

    const getMaintConfigKey = (name: string): string | null => {
      const lower = name.toLowerCase();
      if (lower.includes("pezonera")) return "pezoneras_meses";
      if (lower.includes("manguera") && lower.includes("leche")) return "mangueras_leche_meses";
      if (lower.includes("manguera") && lower.includes("pulsado")) return "mangueras_pulsado_meses";
      if (lower.includes("pulsador")) return "pulsadores_meses";
      if (lower.includes("soga")) return "sogas_meses";
      if (lower.includes("diafragma") && lower.includes("brazo")) return "diafragma_brazos_meses";
      if (lower.includes("buje")) return "bujes_meses";
      if (lower.includes("sensor")) return "sensor_leche_meses";
      if (lower.includes("vacio") || lower.includes("vacío")) return "bomba_vacio_meses";
      if (lower.includes("centrifuga") || lower.includes("centrífuga")) return "bomba_centrifuga_leche_meses";
      if (lower.includes("diafragma") && lower.includes("bomba")) return "bomba_diafragma_leche_meses";
      if (lower.includes("colector")) return "kit_colector_leche_meses";
      if (lower.includes("caucho")) return "caucho_linea_leche_y_lavado_meses";
      return null;
    };

    const configKey = getMaintConfigKey(tipo);
    if (configKey) {
      const configObj = configs.find(c => c.clave === configKey);
      if (configObj) {
        meses = parseInt(configObj.valor) || meses;
      }
    }

    const [year, month, day] = fechaStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    d.setMonth(d.getMonth() + meses);
    return formatDate(d);
  }
}

function buildWhatsAppMessage({
  clienteNombre,
  tamboNombre,
  equipos,
  mantenimientosDetalles,
  fechaStr,
  observacionesText,
  tecnicoNombre
}: {
  clienteNombre: string;
  tamboNombre: string;
  equipos: string;
  mantenimientosDetalles: { tipo: string; proximaFecha: string | null | undefined }[];
  fechaStr: string;
  observacionesText: string;
  tecnicoNombre: string;
}) {
  let msg = `✅ *Mantenimiento realizado*\n\n`;
  msg += `*Cliente:* ${clienteNombre}\n`;
  msg += `*Tambo:* ${tamboNombre}\n`;
  msg += `*Equipo:* ${equipos}\n`;
  msg += `*Fecha:* ${fechaStr}\n\n`;

  msg += `Mantenimientos realizados y próximos vencimientos:\n\n`;
  const listItems = mantenimientosDetalles.map(item => {
    const pFecha = item.proximaFecha ? item.proximaFecha : "No definido";
    return `* ${item.tipo}\n  → Próximo cambio: ${pFecha}`;
  }).join("\n\n");
  msg += `${listItems}\n\n`;

  msg += `*Estado:* Al día\n`;
  if (observacionesText) {
    msg += `\n*Observaciones:*\n${observacionesText}\n`;
  }
  if (tecnicoNombre) {
    msg += `\n*Técnico:* ${tecnicoNombre}`;
  }
  return msg;
}

function MaintenanceModal({ 
  tambo, 
  configs, 
  allMaintTypes, 
  activeTypes, 
  onClose, 
  onSuccess 
}: { 
  tambo: Tambo & { clientes: Cliente, ficha_tecnica: FichaTecnica | null, insumos: Insumo | null }, 
  configs: Configuracion[],
  allMaintTypes: TipoMantenimiento[],
  activeTypes: string[], 
  onClose: () => void, 
  onSuccess: () => void 
}) {
  const [loading, setLoading] = useState(false);
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [observaciones, setObservaciones] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [showShareConfirmation, setShowShareConfirmation] = useState(false);
  const [savedRecords, setSavedRecords] = useState<any[]>([]);

  const [tecnicoNombre, setTecnicoNombre] = useState(() => localStorage.getItem("tecnico_nombre") || "");
  const [telefono, setTelefono] = useState(() => tambo.clientes?.telefono || "");
  const [customMessage, setCustomMessage] = useState("");

  useEffect(() => {
    if (tecnicoNombre !== null) {
      localStorage.setItem("tecnico_nombre", tecnicoNombre);
    }
  }, [tecnicoNombre]);

  useEffect(() => {
    if (showShareConfirmation && savedRecords.length > 0) {
      const [year, month, day] = fecha.split('-').map(Number);
      const formattedFecha = formatDate(new Date(year, month - 1, day));

      const equiposStr = savedRecords.map(r => guessEquipoForMantenimiento(r.tipo, tambo.ficha_tecnica)).join(", ");
      const mantenimientosDetalles = savedRecords.map(r => ({
        tipo: r.tipo,
        proximaFecha: calculateNextDate(r.tipo, fecha, tambo, configs, allMaintTypes)
      }));

      const msg = buildWhatsAppMessage({
        clienteNombre: tambo.clientes?.nombre || "N/A",
        tamboNombre: tambo.nombre,
        equipos: equiposStr,
        mantenimientosDetalles,
        fechaStr: formattedFecha,
        observacionesText: observaciones.trim(),
        tecnicoNombre: tecnicoNombre
      });
      setCustomMessage(msg);
    }
  }, [showShareConfirmation, savedRecords, tecnicoNombre, fecha, configs, allMaintTypes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedTipos.length === 0) {
      alert("Por favor, seleccione al menos un tipo de mantenimiento.");
      return;
    }

    setLoading(true);
    try {
      const records = selectedTipos.map(tipo => ({
        tambo_id: tambo.id,
        tipo,
        fecha,
        observaciones: observaciones.trim() || null,
        foto_url: fotoUrl.trim() || null
      }));

      await db.mantenimientos.createMany(records);
      setSavedRecords(records);
      setShowShareConfirmation(true);
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

  const cleanPhone = (phone: string) => {
    return phone.replace(/\D/g, "");
  };

  const cleanTelefono = cleanPhone(telefono);
  const whatsappUrl = cleanTelefono
    ? `https://wa.me/${cleanTelefono}?text=${encodeURIComponent(customMessage)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(customMessage)}`;

  if (showShareConfirmation) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-[#0f0f0f] border border-white/10 rounded-3xl w-full max-w-xl p-6 md:p-8 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" /> Mantenimiento Guardado
            </h3>
            <button onClick={onSuccess} className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <XCircle className="w-6 h-6 text-zinc-500" />
            </button>
          </div>

          <p className="text-sm text-zinc-400">
            El mantenimiento se registró correctamente en el sistema. ¿Deseas compartir el resumen por WhatsApp?
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Teléfono del Cliente
                </label>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="ej: 549341234567"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Nombre del Técnico
                </label>
                <input
                  type="text"
                  value={tecnicoNombre}
                  onChange={(e) => setTecnicoNombre(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Técnico realizador"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Vista previa del Mensaje
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={10}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:border-emerald-500 transition-colors resize-y leading-relaxed"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <button
              onClick={onSuccess}
              className="flex-1 px-6 py-4 rounded-2xl font-bold border border-white/10 hover:bg-white/5 transition-colors text-sm text-zinc-300"
            >
              Cerrar
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setTimeout(() => {
                  onSuccess();
                }, 300);
              }}
              className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-black text-center font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 text-sm"
            >
              <MessageCircle className="w-5 h-5" />
              Compartir por WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

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
        // Find existing maintenance of this type for this tambo to see if we can update it
        const latestMaint = mantenimientos
          .filter(m => m.tipo === status.tipo && m.fecha !== '1900-01-01')
          .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];

        console.log("STATUS_TIPO", status.tipo);
        console.log("FECHA_FORMULARIO", fecha);
        console.log("LATEST_MAINT", latestMaint);
        console.log("ID_UPDATE", latestMaint?.id);

        if (latestMaint) {
          // UPDATE existing maintenance with the new date
          console.log("ANTES_UPDATE", latestMaint);
          const resultadoUpdate = await db.mantenimientos.update(latestMaint.id, {
            fecha: fecha,
            observaciones: obs
          });
          console.log("DESPUES_UPDATE", resultadoUpdate);
        } else {
          // CREATE a new record if no previous record exists
          const nuevoRegistro = await db.mantenimientos.create({
            tambo_id: tamboId,
            tipo: status.tipo,
            fecha: fecha,
            observaciones: obs
          });
          console.log("DESPUES_UPDATE", nuevoRegistro);
        }
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
