import React, { useState, useEffect, useMemo } from "react";
import { 
  Sparkles, 
  Settings2, 
  Plus, 
  Edit2, 
  Copy, 
  Trash2, 
  Calculator, 
  FileText, 
  History, 
  BarChart4, 
  Droplets, 
  Info, 
  Printer, 
  Share2, 
  Calendar, 
  Wrench, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  Download,
  Flame,
  Snowflake,
  ClipboardCheck,
  Send,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db } from "../services/db";
import { Tambo, Cliente, LavadoConfiguracion, LavadoHistorial } from "../types/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface CloroConfigSidecar {
  ordCloroPorcentaje: number;
  ordCloroTiempo: number;
  tanCloroPorcentaje: number;
  tanCloroTiempo: number;
}

function getCloroConfig(configId: string): CloroConfigSidecar {
  try {
    const data = localStorage.getItem(`cloro_config_${configId}`);
    if (data) return JSON.parse(data);
  } catch (e) {}
  return {
    ordCloroPorcentaje: 0.1,
    ordCloroTiempo: 8,
    tanCloroPorcentaje: 0.1,
    tanCloroTiempo: 8
  };
}

function saveCloroConfig(configId: string, values: CloroConfigSidecar) {
  localStorage.setItem(`cloro_config_${configId}`, JSON.stringify(values));
}

interface CloroHistorialSidecar {
  cloroUtilizado: number;
  cloroTiempo: number;
}

function getCloroHistorial(histId: string): CloroHistorialSidecar {
  try {
    const data = localStorage.getItem(`cloro_historial_${histId}`);
    if (data) return JSON.parse(data);
  } catch (e) {}
  return {
    cloroUtilizado: 0,
    cloroTiempo: 0
  };
}

function saveCloroHistorial(histId: string, values: CloroHistorialSidecar) {
  localStorage.setItem(`cloro_historial_${histId}`, JSON.stringify(values));
}

export default function LavadoPage() {
  const [activeTab, setActiveTab] = useState<"config" | "calculo" | "historial" | "reportes">("calculo");
  const [tambos, setTambos] = useState<(Tambo & { clientes?: { nombre: string } })[]>([]);
  const [configs, setConfigs] = useState<LavadoConfiguracion[]>([]);
  const [historial, setHistorial] = useState<(LavadoHistorial & { cloro_utilizado?: number; cloro_tiempo?: number })[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for Historial
  const [historyTamboFilter, setHistoryTamboFilter] = useState("");
  const [historyEquipoFilter, setHistoryEquipoFilter] = useState("");
  const [historyDateFilter, setHistoryDateFilter] = useState("");

  // Calculation Tab State
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [activeEquipment, setActiveEquipment] = useState<"ordenadora" | "tanque">("ordenadora");
  const [technicianName, setTechnicianName] = useState(() => localStorage.getItem("last_technician_name") || "");
  const [pdfNotes, setPdfNotes] = useState("");

  // Modal State for config Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editConfigId, setEditConfigId] = useState<string | null>(null);
  
  // Config Form Values
  const [formTamboId, setFormTamboId] = useState("");
  const [formNombreEstablecimiento, setFormNombreEstablecimiento] = useState("");
  const [formObservaciones, setFormObservaciones] = useState("");
  
  // Ordeñadora parameters
  const [formOrdPuestos, setFormOrdPuestos] = useState<number>(12);
  const [formOrdLitrosPorPuesto, setFormOrdLitrosPorPuesto] = useState<number>(10);
  const [formOrdOrdenesDiarios, setFormOrdOrdenesDiarios] = useState<number>(2);
  const [formOrdAlcalinoPorcentaje, setFormOrdAlcalinoPorcentaje] = useState<number>(0.5);
  const [formOrdAcidoPorcentaje, setFormOrdAcidoPorcentaje] = useState<number>(0.5);
  const [formOrdLavadosAcidosSemana, setFormOrdLavadosAcidosSemana] = useState<number>(3);
  
  // Tanque de Frío parameters
  const [formTanCapacidad, setFormTanCapacidad] = useState<number>(5000);
  const [formTanAguaPorcentaje, setFormTanAguaPorcentaje] = useState<number>(2);
  const [formTanAlcalinoPorcentaje, setFormTanAlcalinoPorcentaje] = useState<number>(0.5);
  const [formTanAcidoPorcentaje, setFormTanAcidoPorcentaje] = useState<number>(0.5);
  const [formTanFrecuencia, setFormTanFrecuencia] = useState<string>("Diario");
  const [formTanLavadosAcidosSemana, setFormTanLavadosAcidosSemana] = useState<number>(2);

  // Cloro parameters
  const [formOrdCloroPorcentaje, setFormOrdCloroPorcentaje] = useState<number>(0.1);
  const [formOrdCloroTiempo, setFormOrdCloroTiempo] = useState<number>(8);
  const [formTanCloroPorcentaje, setFormTanCloroPorcentaje] = useState<number>(0.1);
  const [formTanCloroTiempo, setFormTanCloroTiempo] = useState<number>(8);

  // Logo Configurable local state
  const [companyLogoText, setCompanyLogoText] = useState(() => localStorage.getItem("washing_logo_text") || "GanPor Mantenimiento S.R.L.");

  // Load basic data
  const loadData = async () => {
    setLoading(true);
    try {
      const tambosData = await db.tambos.getAll();
      setTambos(tambosData);
      
      const configsData = await db.lavado_configuraciones.getAll();
      setConfigs(configsData);
      
      const histData = await db.lavado_historial.getAll();
      const enrichedHistory = histData.map(h => {
        const sidecar = getCloroHistorial(h.id);
        return {
          ...h,
          cloro_utilizado: sidecar.cloroUtilizado,
          cloro_tiempo: sidecar.cloroTiempo
        };
      });
      setHistorial(enrichedHistory);
      
      // Auto-select first available config on load if not selected
      if (configsData.length > 0 && !selectedConfigId) {
        setSelectedConfigId(configsData[0].id);
      }
    } catch (error) {
      console.error("Error cargando datos de lavado:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync establishment name when formTamboId changes
  useEffect(() => {
    if (formTamboId) {
      const parentTambo = tambos.find(t => t.id === formTamboId);
      if (parentTambo) {
        setFormNombreEstablecimiento(parentTambo.nombre);
      }
    }
  }, [formTamboId, tambos]);

  // Selected config details for calculation
  const selectedConfig = useMemo(() => {
    return configs.find(c => c.id === selectedConfigId) || null;
  }, [configs, selectedConfigId]);

  // Calculations for current selection
  const calcResults = useMemo(() => {
    if (!selectedConfig) return null;

    // Load Cloro config
    const cloro = getCloroConfig(selectedConfig.id);

    // --- ORDEÑADORA ---
    const ordAguaPorLavado = selectedConfig.ord_puestos * selectedConfig.ord_litros_por_puesto;
    const ordAlcalinoPorLavado = ordAguaPorLavado * (selectedConfig.ord_alcalino_porcentaje / 100) * 1000; // in ml/cc
    const ordAcidoPorLavado = ordAguaPorLavado * (selectedConfig.ord_acido_porcentaje / 100) * 1000; // in ml/cc
    const ordCloroPorLavado = ordAguaPorLavado * (cloro.ordCloroPorcentaje / 100) * 1000; // in ml/cc
    
    // Milking orders per day / washes per week
    const ordWeeklyWashes = 7 * selectedConfig.ord_ordenes_diarios;
    const ordWeeklyAcidWashes = selectedConfig.ord_lavados_acidos_semana;

    // Water calculations
    // Normal wash has 2 prepped waters (Alkaline + Chlorine)
    // Acid wash has 3 prepped waters (Alkaline + Acid + Chlorine)
    const ordWeeklyWaterConsum = (ordWeeklyWashes * 2 + ordWeeklyAcidWashes) * ordAguaPorLavado;
    const ordWeeklyAlcalinoConsum = ordWeeklyWashes * ordAlcalinoPorLavado;
    const ordWeeklyAcidoConsum = ordWeeklyAcidWashes * ordAcidoPorLavado;
    const ordWeeklyCloroConsum = ordWeeklyWashes * ordCloroPorLavado;

    const ordMonthlyWaterConsum = ordWeeklyWaterConsum * 4.34;
    const ordMonthlyAlcalinoConsum = ordWeeklyAlcalinoConsum * 4.34;
    const ordMonthlyAcidoConsum = ordWeeklyAcidoConsum * 4.34;
    const ordMonthlyCloroConsum = ordWeeklyCloroConsum * 4.34;

    const ordDailyWaterConsum = ordWeeklyWaterConsum / 7;
    const ordDailyAlcalinoConsum = ordWeeklyAlcalinoConsum / 7;
    const ordDailyAcidoConsum = ordWeeklyAcidoConsum / 7;
    const ordDailyCloroConsum = ordWeeklyCloroConsum / 7;

    // --- TANQUE DE FRÍO ---
    const tanAguaPorLavado = selectedConfig.tan_capacidad * (selectedConfig.tan_agua_porcentaje / 100);
    const tanAlcalinoPorLavado = tanAguaPorLavado * (selectedConfig.tan_alcalino_porcentaje / 100) * 1000; // in ml/cc
    const tanAcidoPorLavado = tanAguaPorLavado * (selectedConfig.tan_acido_porcentaje / 100) * 1000; // in ml/cc
    const tanCloroPorLavado = tanAguaPorLavado * (cloro.tanCloroPorcentaje / 100) * 1000; // in ml/cc

    let tanWashesPerWeek = 7;
    if (selectedConfig.tan_frecuencia === "Cada 2 días") {
      tanWashesPerWeek = 3.5;
    } else if (selectedConfig.tan_frecuencia === "Personalizado") {
      tanWashesPerWeek = 3;
    }

    const tanAcidWashesWeek = Math.min(selectedConfig.tan_lavados_acidos_semana, tanWashesPerWeek);

    // Same logic for Tanque
    const tanWeeklyWaterConsum = (tanWashesPerWeek * 2 + tanAcidWashesWeek) * tanAguaPorLavado;
    const tanWeeklyAlcalinoConsum = tanWashesPerWeek * tanAlcalinoPorLavado;
    const tanWeeklyAcidoConsum = tanAcidWashesWeek * tanAcidoPorLavado;
    const tanWeeklyCloroConsum = tanWashesPerWeek * tanCloroPorLavado;

    const tanDailyWaterConsum = tanWeeklyWaterConsum / 7;
    const tanDailyAlcalinoConsum = tanWeeklyAlcalinoConsum / 7;
    const tanDailyAcidoConsum = tanWeeklyAcidoConsum / 7;
    const tanDailyCloroConsum = tanWeeklyCloroConsum / 7;

    const tanMonthlyWaterConsum = tanWeeklyWaterConsum * 4.34;
    const tanMonthlyAlcalinoConsum = tanWeeklyAlcalinoConsum * 4.34;
    const tanMonthlyAcidoConsum = tanWeeklyAcidoConsum * 4.34;
    const tanMonthlyCloroConsum = tanWeeklyCloroConsum * 4.34;

    return {
      cloro,
      ord: {
        aguaPorLavado: ordAguaPorLavado,
        alcalinoPorLavado: ordAlcalinoPorLavado,
        acidoPorLavado: ordAcidoPorLavado,
        cloroPorLavado: ordCloroPorLavado,
        cloroTiempo: cloro.ordCloroTiempo,
        aguaDiaria: ordDailyWaterConsum,
        alcalinoDiario: ordDailyAlcalinoConsum,
        acidoDiario: ordDailyAcidoConsum,
        cloroDiario: ordDailyCloroConsum,
        semanalAgua: ordWeeklyWaterConsum,
        semanalAlcalino: ordWeeklyAlcalinoConsum,
        semanalAcido: ordWeeklyAcidoConsum,
        semanalCloro: ordWeeklyCloroConsum,
        mensualAgua: ordMonthlyWaterConsum,
        mensualAlcalino: ordMonthlyAlcalinoConsum,
        mensualAcido: ordMonthlyAcidoConsum,
        mensualCloro: ordMonthlyCloroConsum,
      },
      tan: {
        aguaPorLavado: tanAguaPorLavado,
        alcalinoPorLavado: tanAlcalinoPorLavado,
        acidoPorLavado: tanAcidoPorLavado,
        cloroPorLavado: tanCloroPorLavado,
        cloroTiempo: cloro.tanCloroTiempo,
        diarioAgua: tanDailyWaterConsum,
        diarioAlcalino: tanDailyAlcalinoConsum,
        diarioAcido: tanDailyAcidoConsum,
        diarioCloro: tanDailyCloroConsum,
        semanalAgua: tanWeeklyWaterConsum,
        semanalAlcalino: tanWeeklyAlcalinoConsum,
        semanalAcido: tanWeeklyAcidoConsum,
        semanalCloro: tanWeeklyCloroConsum,
        mensualAgua: tanMonthlyWaterConsum,
        mensualAlcalino: tanMonthlyAlcalinoConsum,
        mensualAcido: tanMonthlyAcidoConsum,
        mensualCloro: tanMonthlyCloroConsum,
      }
    };
  }, [selectedConfig, configs]);

  // Open config modal for creation
  const handleAddConfig = () => {
    setEditConfigId(null);
    setFormTamboId("");
    setFormNombreEstablecimiento("");
    setFormObservaciones("");
    setFormOrdPuestos(12);
    setFormOrdLitrosPorPuesto(10);
    setFormOrdOrdenesDiarios(2);
    setFormOrdAlcalinoPorcentaje(0.5);
    setFormOrdAcidoPorcentaje(0.5);
    setFormOrdLavadosAcidosSemana(3);
    setFormTanCapacidad(5000);
    setFormTanAguaPorcentaje(2);
    setFormTanAlcalinoPorcentaje(0.5);
    setFormTanAcidoPorcentaje(0.5);
    setFormTanFrecuencia("Diario");
    setFormTanLavadosAcidosSemana(2);
    setIsModalOpen(true);
  };

  // Open config modal for editing
  const handleEditConfig = (config: LavadoConfiguracion) => {
    setEditConfigId(config.id);
    setFormTamboId(config.tambo_id);
    setFormNombreEstablecimiento(config.nombre_establecimiento);
    setFormObservaciones(config.observaciones || "");
    setFormOrdPuestos(config.ord_puestos);
    setFormOrdLitrosPorPuesto(config.ord_litros_por_puesto);
    setFormOrdOrdenesDiarios(config.ord_ordenes_diarios);
    setFormOrdAlcalinoPorcentaje(config.ord_alcalino_porcentaje);
    setFormOrdAcidoPorcentaje(config.ord_acido_porcentaje);
    setFormOrdLavadosAcidosSemana(config.ord_lavados_acidos_semana);
    setFormTanCapacidad(config.tan_capacidad);
    setFormTanAguaPorcentaje(config.tan_agua_porcentaje);
    setFormTanAlcalinoPorcentaje(config.tan_alcalino_porcentaje);
    setFormTanAcidoPorcentaje(config.tan_acido_porcentaje);
    setFormTanFrecuencia(config.tan_frecuencia);
    setFormTanLavadosAcidosSemana(config.tan_lavados_acidos_semana);
    
    // Load sidecar cloro
    const cloro = getCloroConfig(config.id);
    setFormOrdCloroPorcentaje(cloro.ordCloroPorcentaje);
    setFormOrdCloroTiempo(cloro.ordCloroTiempo);
    setFormTanCloroPorcentaje(cloro.tanCloroPorcentaje);
    setFormTanCloroTiempo(cloro.tanCloroTiempo);

    setIsModalOpen(true);
  };

  // Duplicate a configuration
  const handleDuplicateConfig = async (config: LavadoConfiguracion) => {
    try {
      // Find a tambo_id that doesn't already have a config
      const configuredTamboIds = configs.map(c => c.tambo_id);
      const unconfiguredTambo = tambos.find(t => !configuredTamboIds.includes(t.id));

      const newTamboId = unconfiguredTambo ? unconfiguredTambo.id : "";
      
      setEditConfigId(null); // Create new
      setFormTamboId(newTamboId); // Target new tambo
      setFormNombreEstablecimiento(unconfiguredTambo ? unconfiguredTambo.nombre : `${config.nombre_establecimiento} (Copia)`);
      setFormObservaciones(`${config.observaciones || ""} (Copia Duplicada)`);
      setFormOrdPuestos(config.ord_puestos);
      setFormOrdLitrosPorPuesto(config.ord_litros_por_puesto);
      setFormOrdOrdenesDiarios(config.ord_ordenes_diarios);
      setFormOrdAlcalinoPorcentaje(config.ord_alcalino_porcentaje);
      setFormOrdAcidoPorcentaje(config.ord_acido_porcentaje);
      setFormOrdLavadosAcidosSemana(config.ord_lavados_acidos_semana);
      setFormTanCapacidad(config.tan_capacidad);
      setFormTanAguaPorcentaje(config.tan_agua_porcentaje);
      setFormTanAlcalinoPorcentaje(config.tan_alcalino_porcentaje);
      setFormTanAcidoPorcentaje(config.tan_acido_porcentaje);
      setFormTanFrecuencia(config.tan_frecuencia);
      setFormTanLavadosAcidosSemana(config.tan_lavados_acidos_semana);

      // Load sidecar cloro
      const cloro = getCloroConfig(config.id);
      setFormOrdCloroPorcentaje(cloro.ordCloroPorcentaje);
      setFormOrdCloroTiempo(cloro.ordCloroTiempo);
      setFormTanCloroPorcentaje(cloro.tanCloroPorcentaje);
      setFormTanCloroTiempo(cloro.tanCloroTiempo);

      setIsModalOpen(true);
    } catch (err) {
      console.error("Error al preparar duplicación:", err);
    }
  };

  // Save config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTamboId) {
      alert("Por favor, seleccione un tambo/establecimiento.");
      return;
    }

    if (
      formOrdPuestos <= 0 || formOrdLitrosPorPuesto <= 0 || formOrdOrdenesDiarios <= 0 ||
      formOrdAlcalinoPorcentaje < 0 || formOrdAcidoPorcentaje < 0 || formOrdLavadosAcidosSemana < 0 ||
      formTanCapacidad <= 0 || formTanAguaPorcentaje < 0 || formTanAlcalinoPorcentaje < 0 ||
      formTanAcidoPorcentaje < 0 || formTanLavadosAcidosSemana < 0 ||
      formOrdCloroPorcentaje < 0 || formOrdCloroTiempo < 0 ||
      formTanCloroPorcentaje < 0 || formTanCloroTiempo < 0
    ) {
      alert("Por favor, introduzca valores mayores que cero para capacidades/unidades y no negativos para concentraciones o tiempos.");
      return;
    }

    const payload = {
      tambo_id: formTamboId,
      nombre_establecimiento: formNombreEstablecimiento,
      observaciones: formObservaciones,
      ord_puestos: Number(formOrdPuestos),
      ord_litros_por_puesto: Number(formOrdLitrosPorPuesto),
      ord_ordenes_diarios: Number(formOrdOrdenesDiarios),
      ord_alcalino_porcentaje: Number(formOrdAlcalinoPorcentaje),
      ord_acido_porcentaje: Number(formOrdAcidoPorcentaje),
      ord_lavados_acidos_semana: Number(formOrdLavadosAcidosSemana),
      tan_capacidad: Number(formTanCapacidad),
      tan_agua_porcentaje: Number(formTanAguaPorcentaje),
      tan_alcalino_porcentaje: Number(formTanAlcalinoPorcentaje),
      tan_acido_porcentaje: Number(formTanAcidoPorcentaje),
      tan_frecuencia: formTanFrecuencia,
      tan_lavados_acidos_semana: Number(formTanLavadosAcidosSemana)
    };

    try {
      let configId = editConfigId;
      if (editConfigId) {
        await db.lavado_configuraciones.update(editConfigId, payload);
      } else {
        // Ensure no duplicate configuration for the same tambo
        const exists = configs.some(c => c.tambo_id === formTamboId);
        if (exists) {
          alert("Ya existe una configuración de lavado para este tambo. Edite la existente.");
          return;
        }
        const created = await db.lavado_configuraciones.create(payload);
        configId = created.id;
        setSelectedConfigId(created.id);
      }

      // Save sidecar cloro values
      if (configId) {
        saveCloroConfig(configId, {
          ordCloroPorcentaje: Number(formOrdCloroPorcentaje),
          ordCloroTiempo: Number(formOrdCloroTiempo),
          tanCloroPorcentaje: Number(formTanCloroPorcentaje),
          tanCloroTiempo: Number(formTanCloroTiempo)
        });
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error("Error guardando configuración:", err);
      alert("Error al guardar la configuración.");
    }
  };

  // Delete config
  const handleDeleteConfig = async (id: string) => {
    if (confirm("¿Está seguro de que desea eliminar esta configuración de lavado?")) {
      try {
        await db.lavado_configuraciones.delete(id);
        if (selectedConfigId === id) {
          setSelectedConfigId("");
        }
        await loadData();
      } catch (err) {
        console.error("Error eliminando configuración:", err);
      }
    }
  };

  // Record wash event to history
  const handleRecordWash = async (type: "Normal" | "Con ácido" | "Clorado") => {
    if (!selectedConfig || !calcResults) return;

    const dataObj = activeEquipment === "ordenadora" ? calcResults.ord : calcResults.tan;

    // Values in liters
    const hAgua = dataObj.aguaPorLavado;
    const hAlcalino = type === "Clorado" ? 0 : dataObj.alcalinoPorLavado / 1000; // cc to L
    const hAcido = type === "Con ácido" ? dataObj.acidoPorLavado / 1000 : 0; // cc to L
    const hCloro = dataObj.cloroPorLavado / 1000; // cc to L
    const hCloroTiempo = dataObj.cloroTiempo;

    const payload = {
      tambo_id: selectedConfig.tambo_id,
      fecha: new Date().toISOString().split("T")[0],
      hora: new Date().toLocaleTimeString("es-AR", { hour12: false }).substring(0, 5),
      establecimiento_nombre: selectedConfig.nombre_establecimiento,
      equipo: activeEquipment === "ordenadora" ? "Ordeñadora" : "Tanque de Frío",
      agua_utilizada: parseFloat(hAgua.toFixed(1)),
      alcalino_utilizado: parseFloat(hAlcalino.toFixed(3)),
      acido_utilizado: parseFloat(hAcido.toFixed(3)),
      tipo_lavado: type,
      observaciones: "Registro automático generado desde módulo de cálculo."
    };

    try {
      const created = await db.lavado_historial.create(payload);
      if (created && created.id) {
        saveCloroHistorial(created.id, {
          cloroUtilizado: hCloro,
          cloroTiempo: hCloroTiempo
        });
      }
      alert(`¡Lavado ${type} registrado con éxito en el historial!`);
      await loadData();
    } catch (err) {
      console.error("Error registrando lavado:", err);
      alert("No se pudo registrar en el historial.");
    }
  };

  // Delete history entry
  const handleDeleteHistory = async (id: string) => {
    if (confirm("¿Desea borrar este registro del historial?")) {
      try {
        await db.lavado_historial.delete(id);
        await loadData();
      } catch (err) {
        console.error("Error al borrar registro:", err);
      }
    }
  };

  // Generate PDF report
  const generatePDF = () => {
    if (!selectedConfig || !calcResults) return;

    if (technicianName) {
      localStorage.setItem("last_technician_name", technicianName);
    }
    localStorage.setItem("washing_logo_text", companyLogoText);

    const doc = new jsPDF();
    
    // Theme Colors
    const mDark = [15, 15, 15]; // Slate Dark
    
    // Draw Header
    doc.setFillColor(15, 15, 15);
    doc.rect(0, 0, 210, 38, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(companyLogoText, 14, 18);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(16, 185, 129);
    doc.text("INFORME DE CONTROL Y DOSIFICACIÓN CONSOLIDADO", 14, 28);
    
    // Metadata block
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    // Left Box
    doc.setFont("helvetica", "bold");
    doc.text("Establecimiento:", 14, 48);
    doc.setFont("helvetica", "normal");
    doc.text(selectedConfig.nombre_establecimiento, 48, 48);
    
    doc.setFont("helvetica", "bold");
    doc.text("Fecha de Emisión:", 115, 48);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString("es-AR"), 160, 48);

    doc.setFont("helvetica", "bold");
    doc.text("Técnico Confecciona:", 14, 55);
    doc.setFont("helvetica", "normal");
    doc.text(technicianName || "No especificado", 55, 55);
    
    doc.setFont("helvetica", "bold");
    doc.text("Estado del Reporte:", 115, 55);
    doc.setFont("helvetica", "normal");
    doc.text("Consolidado (Ordeñadora + Tanque)", 160, 55);

    // Separator line
    doc.setDrawColor(220, 220, 220);
    doc.line(14, 62, 196, 62);

    let y = 71;

    // SECTION 1: ORDEÑADORA DE LECHE
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 15, 15);
    doc.text("1. Configuración de Parámetros: Ordeñadora de Leche", 14, y);
    y += 4;

    const ordRows = [
      ["Puestos de la Ordeñadora", `${selectedConfig.ord_puestos} unidades`],
      ["Volumen de Agua por Puesto", `${selectedConfig.ord_litros_por_puesto} Litros`],
      ["Dosis Alcalino Sugerida", `${selectedConfig.ord_alcalino_porcentaje}%`],
      ["Dosis Ácido Sugerida", `${selectedConfig.ord_acido_porcentaje}%`],
      ["Dosis Cloro Sugerida", `${calcResults.cloro.ordCloroPorcentaje}%`],
      ["Tiempo Recirculación Cloro", `${calcResults.cloro.ordCloroTiempo} minutos`],
      ["Ordeños Diarios (lavados)", `${selectedConfig.ord_ordenes_diarios} veces/día`],
      ["Frecuencia Lavado Ácido", `${selectedConfig.ord_lavados_acidos_semana} veces/semana`],
      ["Calculado: Agua por Lavado", `${calcResults.ord.aguaPorLavado.toFixed(1)} L`],
      ["Calculado: Alcalino por Lavado", `${calcResults.ord.alcalinoPorLavado.toFixed(0)} cc -- ${(calcResults.ord.alcalinoPorLavado/1000).toFixed(2)} L`],
      ["Calculado: Ácido por Lavado", `${calcResults.ord.acidoPorLavado.toFixed(0)} cc -- ${(calcResults.ord.acidoPorLavado/1000).toFixed(2)} L`],
      ["Calculado: Cloro por Lavado", `${calcResults.ord.cloroPorLavado.toFixed(0)} cc -- ${(calcResults.ord.cloroPorLavado/1000).toFixed(2)} L`],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Parámetro de Control", "Valor sugerido"]],
      body: ordRows,
      theme: "striped",
      headStyles: { fillColor: [15, 118, 110] }, // Teal dark
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // SECTION 2: TANQUE DE FRÍO
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("2. Configuración de Parámetros: Tanque de Frío", 14, y);
    y += 4;

    const tanRows = [
      ["Capacidad del Tanque de Frío", `${selectedConfig.tan_capacidad} Litros`],
      ["Ratio de Agua para Lavado", `${selectedConfig.tan_agua_porcentaje}%`],
      ["Dosis Alcalino Sugerida", `${selectedConfig.tan_alcalino_porcentaje}%`],
      ["Dosis Ácido Sugerida", `${selectedConfig.tan_acido_porcentaje}%`],
      ["Dosis Cloro Sugerida", `${calcResults.cloro.tanCloroPorcentaje}%`],
      ["Tiempo Recirculación Cloro", `${calcResults.cloro.tanCloroTiempo} minutos`],
      ["Frecuencia de Lavado", `${selectedConfig.tan_frecuencia}`],
      ["Cantidad Lavados Ácidos/Sem", `${selectedConfig.tan_lavados_acidos_semana} veces/semana`],
      ["Calculado: Agua por Lavado", `${calcResults.tan.aguaPorLavado.toFixed(1)} L`],
      ["Calculado: Alcalino por Lavado", `${calcResults.tan.alcalinoPorLavado.toFixed(0)} cc -- ${(calcResults.tan.alcalinoPorLavado/1000).toFixed(2)} L`],
      ["Calculado: Ácido por Lavado", `${calcResults.tan.acidoPorLavado.toFixed(0)} cc -- ${(calcResults.tan.acidoPorLavado/1000).toFixed(2)} L`],
      ["Calculado: Cloro por Lavado", `${calcResults.tan.cloroPorLavado.toFixed(0)} cc -- ${(calcResults.tan.cloroPorLavado/1000).toFixed(2)} L`],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Parámetro de Control", "Valor sugerido"]],
      body: tanRows,
      theme: "striped",
      headStyles: { fillColor: [15, 118, 110] }, // Teal dark
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 }
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Page check helper
    const checkPageOverflow = (neededHeight: number) => {
      if (y + neededHeight > 275) {
        doc.addPage();
        y = 20;
      }
    };

    checkPageOverflow(60);

    // SECTION 3: CONSUMO TOTAL DE PRODUCTOS
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("3. Consumo Total de Productos (Proyecciones Consolidadas)", 14, y);
    y += 4;

    const totRows = [
      [
        "Agua Total",
        `${(calcResults.ord.aguaDiaria + calcResults.tan.diarioAgua).toFixed(1)} L`,
        `${(calcResults.ord.semanalAgua + calcResults.tan.semanalAgua).toFixed(1)} L`,
        `${(calcResults.ord.mensualAgua + calcResults.tan.mensualAgua).toFixed(1)} L`
      ],
      [
        "Alcalino Total",
        `${((calcResults.ord.alcalinoDiario + calcResults.tan.diarioAlcalino)/1000).toFixed(2)} L`,
        `${((calcResults.ord.semanalAlcalino + calcResults.tan.semanalAlcalino)/1000).toFixed(2)} L`,
        `${((calcResults.ord.mensualAlcalino + calcResults.tan.mensualAlcalino)/1000).toFixed(2)} L`
      ],
      [
        "Ácido Total",
        `${((calcResults.ord.acidoDiario + calcResults.tan.diarioAcido)/1000).toFixed(2)} L`,
        `${((calcResults.ord.semanalAcido + calcResults.tan.semanalAcido)/1000).toFixed(2)} L`,
        `${((calcResults.ord.mensualAcido + calcResults.tan.mensualAcido)/1000).toFixed(2)} L`
      ],
      [
        "Cloro Total",
        `${((calcResults.ord.cloroDiario + calcResults.tan.diarioCloro)/1000).toFixed(2)} L`,
        `${((calcResults.ord.semanalCloro + calcResults.tan.semanalCloro)/1000).toFixed(2)} L`,
        `${((calcResults.ord.mensualCloro + calcResults.tan.mensualCloro)/1000).toFixed(2)} L`
      ],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Producto", "Consumo Diario", "Consumo Semanal", "Consumo Mensual"]],
      body: totRows,
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129] }, // Emerald
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 }
    });
    
    // Page 2: Protocols and Operating Instructions
    doc.addPage();
    y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 15, 15);
    doc.text("4. Protocolos Sanitarios e Instrucciones de Lavado", 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text("Protocolo A: Lavado Diario Convencional (Normal)", 14, y);
    y += 6;
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    const normalSteps = [
      "1. Enjuague inicial con abundante agua fría para remover completamente toda la lactosa y biofilm de leche.",
      `2. Preparar el volumen de agua de lavado caliente calculada por el sistema:`,
      `   * Ordeñadora: ${calcResults.ord.aguaPorLavado.toFixed(1)} L de agua.`,
      `   * Tanque de Frío: ${calcResults.tan.aguaPorLavado.toFixed(1)} L de agua.`,
      `3. Agregar la cantidad calculada de detergente alcalino:`,
      `   * Ordeñadora: ${calcResults.ord.alcalinoPorLavado.toFixed(0)} cc (Concentración del ${selectedConfig.ord_alcalino_porcentaje}%).`,
      `   * Tanque de Frío: ${calcResults.tan.alcalinoPorLavado.toFixed(0)} cc (Concentración del ${selectedConfig.tan_alcalino_porcentaje}%).`,
      `4. Recircular la solución alcalina durante el lapso de 8 a 10 minutos (tiempo óptimo sugerido).`,
      "5. Enjuagar con abundante agua fría limpia para remover residuos alcalinos.",
      `6. Preparar de nuevo el volumen de agua calculada e incorporar la dosis calculada de Cloro:`,
      `   * Ordeñadora: Dosificar exactamente ${calcResults.ord.cloroPorLavado.toFixed(0)} cc de cloro (${calcResults.cloro.ordCloroPorcentaje}%).`,
      `   * Tanque de Frío: Dosificar exactamente ${calcResults.tan.cloroPorLavado.toFixed(0)} cc de cloro (${calcResults.cloro.tanCloroPorcentaje}%).`,
      `7. Recircular la mezcla clorada durante el tiempo configurado:`,
      `   * Ordeñadora: ${calcResults.cloro.ordCloroTiempo} minutos.`,
      `   * Tanque de Frío: ${calcResults.cloro.tanCloroTiempo} minutos.`,
      "8. Enjuague final con abundante agua fría limpia."
    ];

    normalSteps.forEach(st => {
      const splitSt = doc.splitTextToSize(st, 180);
      doc.text(splitSt, 18, y);
      y += (splitSt.length * 4);
    });

    y += 4;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(147, 51, 234); // Purple style
    doc.text("Protocolo B: Lavado de Desincrustación Orgánica (Con Ácido)", 14, y);
    y += 6;
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    const acidSteps = [
      "1. Enjuague inicial con abundante agua fría para barrer remanentes de leche.",
      `2. Preparar el volumen de agua de lavado caliente y dosificar detergente alcalino:`,
      `   * Ordeñadora: ${calcResults.ord.aguaPorLavado.toFixed(1)} L + ${calcResults.ord.alcalinoPorLavado.toFixed(0)} cc de alcalino.`,
      `   * Tanque de Frío: ${calcResults.tan.aguaPorLavado.toFixed(1)} L + ${calcResults.tan.alcalinoPorLavado.toFixed(0)} cc de alcalino.`,
      `3. Recircular durante el lapso de 8 a 10 minutos de forma de desengrasar las superficies.`,
      "4. Enjuagar con abundante agua fría.",
      `5. Preparar el volumen de agua regulado y dosificar detergente ácido:`,
      `   * Ordeñadora: ${calcResults.ord.aguaPorLavado.toFixed(1)} L + ${calcResults.ord.acidoPorLavado.toFixed(0)} cc de ácido (${selectedConfig.ord_acido_porcentaje}%).`,
      `   * Tanque de Frío: ${calcResults.tan.aguaPorLavado.toFixed(1)} L + ${calcResults.tan.acidoPorLavado.toFixed(0)} cc de ácido (${selectedConfig.tan_acido_porcentaje}%).`,
      `6. Recircular esta solución desincrustante ácida por un periodo de 8 a 10 minutos.`,
      "7. Enjuagar con abundante agua limpia.",
      `8. Preparar el volumen de agua correspondiente y agregar la dosis calculada de cloro:`,
      `   * Ordeñadora: ${calcResults.ord.aguaPorLavado.toFixed(1)} L + ${calcResults.ord.cloroPorLavado.toFixed(0)} cc de cloro (${calcResults.cloro.ordCloroPorcentaje}%).`,
      `   * Tanque de Frío: ${calcResults.tan.aguaPorLavado.toFixed(1)} L + ${calcResults.tan.cloroPorLavado.toFixed(0)} cc de cloro (${calcResults.cloro.tanCloroPorcentaje}%).`,
      `9. Recircular la solución desinfectante de cloro durante el tiempo configurado:`,
      `   * Ordeñadora: ${calcResults.cloro.ordCloroTiempo} minutos.`,
      `   * Tanque de Frío: ${calcResults.cloro.tanCloroTiempo} minutos.`,
      "10. Enjuague final abundante con agua fría limpia."
    ];

    acidSteps.forEach(st => {
      const splitSt = doc.splitTextToSize(st, 180);
      doc.text(splitSt, 18, y);
      y += (splitSt.length * 4);
    });

    y += 4;
    checkPageOverflow(85);

    // OBSERVATIONS & NOTES
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 15, 15);
    doc.text("5. Notas de Campo del Técnico / Recomendaciones:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    y += 5;
    
    const notesText = pdfNotes || "No se detallaron observaciones técnicas adicionales para esta receta. Se sugiere respetar las temperaturas de recirculación prescritas para mantener la máxima eficiencia de sanitización bacteriológica.";
    const splitNotes = doc.splitTextToSize(notesText, 180);
    doc.text(splitNotes, 16, y);
    y += (splitNotes.length * 4) + 16;

    checkPageOverflow(40);

    // SIGNATURES
    doc.line(20, y, 90, y);
    doc.line(120, y, 190, y);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Firma del Técnico Confecciona", 34, y + 4);
    doc.text("Firma Responsable de Establecimiento", 125, y + 4);

    // SAVE FILE
    doc.save(`Receta_Lavado_Consolidado_${selectedConfig.nombre_establecimiento.replace(/\s+/g, "_")}.pdf`);
  };

  // Share Recipe on WhatsApp
  const shareWhatsApp = () => {
    if (!selectedConfig || !calcResults) return;

    const msg = `*REPORTE CONSOLIDADO DE LAVADO - GANPOR MANTENIMIENTO*%0A` +
      `*Establecimiento:* ${selectedConfig.nombre_establecimiento}%0A%0A` +
      `*1. ORDEÑADORA DE LECHE:*%0A` +
      `- Agua Sugerida: ${calcResults.ord.aguaPorLavado.toFixed(1)} L%0A` +
      `- Alcalino: ${calcResults.ord.alcalinoPorLavado.toFixed(0)} cc%0A` +
      `- Ácido: ${calcResults.ord.acidoPorLavado.toFixed(0)} cc%0A` +
      `- Cloro: ${calcResults.ord.cloroPorLavado.toFixed(0)} cc (${calcResults.cloro.ordCloroTiempo} min)%0A%0A` +
      `*2. TANQUE DE FRÍO:*%0A` +
      `- Agua Sugerida: ${calcResults.tan.aguaPorLavado.toFixed(1)} L%0A` +
      `- Alcalino: ${calcResults.tan.alcalinoPorLavado.toFixed(0)} cc%0A` +
      `- Ácido: ${calcResults.tan.acidoPorLavado.toFixed(0)} cc%0A` +
      `- Cloro: ${calcResults.tan.cloroPorLavado.toFixed(0)} cc (${calcResults.cloro.tanCloroTiempo} min)%0A%0A` +
      `_Toda la información se encuentra consolidada en un único informe técnico._%0A` +
      `Generado el: ${new Date().toLocaleDateString("es-AR")}`;

    window.open(`https://api.whatsapp.com/send?text=${msg}`, "_blank");
  };

  // Share Recipe by Email
  const shareEmail = () => {
    if (!selectedConfig || !calcResults) return;

    const subject = `Receta Lavado Consolidada - ${selectedConfig.nombre_establecimiento}`;
    const body = `REPORTE CONSOLIDADO Y RECETA DE LAVADO SANITARIO\n\n` +
      `Establecimiento: ${selectedConfig.nombre_establecimiento}\n` +
      `Fecha: ${new Date().toLocaleDateString("es-AR")}\n\n` +
      `==========================================\n` +
      `1. DOSIFICACIONES ORDEÑADORA DE LECHE:\n` +
      `- Volumen de Agua Recomendado: ${calcResults.ord.aguaPorLavado.toFixed(1)} L\n` +
      `- Dosis de Alcalino por Lavado: ${calcResults.ord.alcalinoPorLavado.toFixed(0)} cc\n` +
      `- Dosis de Ácido por Lavado: ${calcResults.ord.acidoPorLavado.toFixed(0)} cc\n` +
      `- Dosis de Cloro por Lavado: ${calcResults.ord.cloroPorLavado.toFixed(0)} cc (Recirculación: ${calcResults.cloro.ordCloroTiempo} min)\n\n` +
      `2. DOSIFICACIONES TANQUE DE FRÍO:\n` +
      `- Volumen de Agua Recomendado: ${calcResults.tan.aguaPorLavado.toFixed(1)} L\n` +
      `- Dosis de Alcalino por Lavado: ${calcResults.tan.alcalinoPorLavado.toFixed(0)} cc\n` +
      `- Dosis de Ácido por Lavado: ${calcResults.tan.acidoPorLavado.toFixed(0)} cc\n` +
      `- Dosis de Cloro por Lavado: ${calcResults.tan.cloroPorLavado.toFixed(0)} cc (Recirculación: ${calcResults.cloro.tanCloroTiempo} min)\n\n` +
      `==========================================\n` +
      `3. CONSUMO CONSOLIDADO PROYECTADO ESTABLECIMIENTO:\n` +
      `- Agua Total Diaria: ${(calcResults.ord.aguaDiaria + calcResults.tan.diarioAgua).toFixed(1)} L\n` +
      `- Alcalino Total Diario: ${((calcResults.ord.alcalinoDiario + calcResults.tan.diarioAlcalino)/1000).toFixed(2)} L\n` +
      `- Ácido Total Diario: ${((calcResults.ord.acidoDiario + calcResults.tan.diarioAcido)/1000).toFixed(2)} L\n` +
      `- Cloro Total Diario: ${((calcResults.ord.cloroDiario + calcResults.tan.diarioCloro)/1000).toFixed(2)} L\n\n` +
      `Generado por el departamento de Higiene y Calidad Agropecuaria.`;

    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  // Filtered History List
  const filteredHistory = useMemo(() => {
    return historial.filter(h => {
      const matchTambo = !historyTamboFilter || h.tambo_id === historyTamboFilter;
      const matchEquipo = !historyEquipoFilter || h.equipo === historyEquipoFilter;
      const matchDate = !historyDateFilter || h.fecha === historyDateFilter;
      return matchTambo && matchEquipo && matchDate;
    });
  }, [historial, historyTamboFilter, historyEquipoFilter, historyDateFilter]);

  // Report statistics calculated
  const reportStats = useMemo(() => {
    const totalWater = filteredHistory.reduce((acc, curr) => acc + curr.agua_utilizada, 0);
    const totalAlcalino = filteredHistory.reduce((acc, curr) => acc + curr.alcalino_utilizado, 0);
    const totalAcido = filteredHistory.reduce((acc, curr) => acc + curr.acido_utilizado, 0);
    const totalCloro = filteredHistory.reduce((acc, curr) => acc + (curr.cloro_utilizado || 0), 0);
    const count = filteredHistory.length;

    // Daily average based on unique days
    const uniqueDays = new Set(filteredHistory.map(h => h.fecha)).size || 1;
    const avgWater = totalWater / uniqueDays;

    return {
      water: totalWater,
      alcalino: totalAlcalino,
      acido: totalAcido,
      cloro: totalCloro,
      totalCount: count,
      avgWaterDaily: avgWater
    };
  }, [filteredHistory]);

  return (
    <div className="space-y-8 pb-16 text-zinc-100">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Lavado e Higiene Sanitaria</h1>
              <p className="text-zinc-500 text-sm mt-1">Cálculo de recetas, dosificaciones químicas y registros de limpieza para equipos de ordeño.</p>
            </div>
          </div>
        </div>

        {/* Dynamic global settings controller */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-mono">Encabezado PDF:</span>
          <input 
            type="text" 
            value={companyLogoText} 
            onChange={(e) => setCompanyLogoText(e.target.value)}
            className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-1 text-xs text-zinc-300 font-medium focus:outline-none focus:border-emerald-500 w-48"
            placeholder="Logo Empresa PDF"
          />
        </div>
      </div>

      {/* Main Tabs Navigator */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-1">
        <button
          onClick={() => setActiveTab("calculo")}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-semibold transition-all ${
            activeTab === "calculo" 
              ? "border-b-2 border-emerald-500 text-emerald-400 bg-emerald-500/5" 
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Calculator className="w-4 h-4" />
          Cálculo & Recetas
        </button>
        <button
          onClick={() => setActiveTab("config")}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-semibold transition-all ${
            activeTab === "config" 
              ? "border-b-2 border-emerald-500 text-emerald-400 bg-emerald-500/5" 
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Settings2 className="w-4 h-4" />
          Configuración por Tambo
        </button>
        <button
          onClick={() => setActiveTab("historial")}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-semibold transition-all ${
            activeTab === "historial" 
              ? "border-b-2 border-emerald-500 text-emerald-400 bg-emerald-500/5" 
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <History className="w-4 h-4" />
          Historial de Registros
        </button>
        <button
          onClick={() => setActiveTab("reportes")}
          className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-semibold transition-all ${
            activeTab === "reportes" 
              ? "border-b-2 border-emerald-500 text-emerald-400 bg-emerald-500/5" 
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <BarChart4 className="w-4 h-4" />
          Reportes de Consumo
        </button>
      </div>

      {/* TABS CONTENT PANELS */}
      <div className="mt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            <p className="text-zinc-500 text-sm mt-3 font-medium">Buscando información sanitaria...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* CONFIGURACIÓN TAB */}
            {activeTab === "config" && (
              <motion.div
                key="config-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Gestión de Establecimientos Sanitarios</h2>
                    <p className="text-sm text-zinc-500">Cree o edite los ratios de agua y concentración de químicos por cada establecimiento.</p>
                  </div>
                  <button
                    onClick={handleAddConfig}
                    className="flex items-center gap-2 bg-emerald-500 text-black px-4 py-2.5 rounded-xl font-extrabold text-sm hover:bg-emerald-400 transform hover:scale-[1.02] transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[3px]" />
                    Nueva Configuración
                  </button>
                </div>

                {configs.length === 0 ? (
                  <div className="bg-[#0f0f0f] border border-dashed border-white/10 rounded-2xl p-12 text-center text-zinc-500">
                    <Settings2 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                    <p className="font-semibold text-lg text-zinc-400">Sin configuraciones creadas</p>
                    <p className="text-sm mt-1 max-w-md mx-auto">Para calcular las dosis de alcalino y ácido, primero configure los parámetros de carga para cada tambo.</p>
                    <button
                      onClick={handleAddConfig}
                      className="mt-4 inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-bold"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar mi primera configuración
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {configs.map((config) => (
                      <div 
                        key={config.id} 
                        className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                              {config.nombre_establecimiento}
                            </h3>
                            {config.observaciones && (
                              <p className="text-xs text-zinc-400 mt-1 italic">"{config.observaciones}"</p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditConfig(config)}
                              title="Editar"
                              className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDuplicateConfig(config)}
                              title="Duplicar"
                              className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-emerald-400 transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteConfig(config.id)}
                              title="Eliminar"
                              className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Split parameters visualization */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/5">
                          {/* Ordeñadora configuration box */}
                          <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                            <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                              Ordeñadora
                            </h4>
                            <ul className="space-y-1.5 text-xs text-zinc-300 font-mono">
                              <li className="flex justify-between">
                                <span className="text-zinc-500">Puestos:</span>
                                <span className="font-bold text-white">{config.ord_puestos}</span>
                              </li>
                              <li className="flex justify-between">
                                <span className="text-zinc-500">Agua por Puesto:</span>
                                <span className="font-bold text-white">{config.ord_litros_por_puesto} L</span>
                              </li>
                              <li className="flex justify-between">
                                <span className="text-zinc-500">Ordeños/día:</span>
                                <span className="font-bold text-white">{config.ord_ordenes_diarios}</span>
                              </li>
                              <li className="flex justify-between">
                                <span className="text-zinc-500">% Alcalino / Ácido / Cloro:</span>
                                <span className="font-bold text-emerald-400">{config.ord_alcalino_porcentaje}% / {config.ord_acido_porcentaje}% / {getCloroConfig(config.id).ordCloroPorcentaje}%</span>
                              </li>
                              <li className="flex justify-between">
                                <span className="text-zinc-500">Recirculación Cloro:</span>
                                <span className="font-bold text-teal-400">{getCloroConfig(config.id).ordCloroTiempo} min</span>
                              </li>
                              <li className="flex justify-between border-t border-white/5 pt-1 mt-1">
                                <span className="text-zinc-500">Lavados ácidos:</span>
                                <span className="font-bold text-purple-400">{config.ord_lavados_acidos_semana} /sem</span>
                              </li>
                            </ul>
                          </div>

                          {/* Tanque configuration box */}
                          <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                            <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>
                              Tanque de Frío
                            </h4>
                            <ul className="space-y-1.5 text-xs text-zinc-300 font-mono">
                              <li className="flex justify-between">
                                <span className="text-zinc-500">Capacidad:</span>
                                <span className="font-bold text-white">{config.tan_capacidad} L</span>
                              </li>
                              <li className="flex justify-between">
                                <span className="text-zinc-500">Ratio Agua:</span>
                                <span className="font-bold text-white">{config.tan_agua_porcentaje}%</span>
                              </li>
                              <li className="flex justify-between">
                                <span className="text-zinc-500">Frecuencia:</span>
                                <span className="font-bold text-white">{config.tan_frecuencia}</span>
                              </li>
                              <li className="flex justify-between">
                                <span className="text-zinc-500">% Alcalino / Ácido / Cloro:</span>
                                <span className="font-bold text-emerald-400">{config.tan_alcalino_porcentaje}% / {config.tan_acido_porcentaje}% / {getCloroConfig(config.id).tanCloroPorcentaje}%</span>
                              </li>
                              <li className="flex justify-between">
                                <span className="text-zinc-500">Recirculación Cloro:</span>
                                <span className="font-bold text-teal-400">{getCloroConfig(config.id).tanCloroTiempo} min</span>
                              </li>
                              <li className="flex justify-between border-t border-white/5 pt-1 mt-1">
                                <span className="text-zinc-500">Lavados ácidos:</span>
                                <span className="font-bold text-purple-400">{config.tan_lavados_acidos_semana} /sem</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* CÁLCULO TAB */}
            {activeTab === "calculo" && (
              <motion.div
                key="calculo-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8"
              >
                {/* Left col: Selection and variables overview */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-emerald-400" />
                      Selección de Establecimiento
                    </h2>

                    <div>
                      <label className="block text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-1.5">Tambo a Inspeccionar</label>
                      {configs.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic">No hay tambos configurados. Por favor vaya a la pestaña 'Configuración por Tambo' para añadir uno.</p>
                      ) : (
                        <select
                          value={selectedConfigId}
                          onChange={(e) => setSelectedConfigId(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="">-- Seleccionar Tambo Colector --</option>
                          {configs.map((c) => (
                            <option key={c.id} value={c.id}>{c.nombre_establecimiento}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {selectedConfig && (
                      <div className="pt-2">
                        <label className="block text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-2">Equipo Destino de Higienización</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveEquipment("ordenadora")}
                            className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all text-center ${
                              activeEquipment === "ordenadora" 
                                ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                                : "bg-black border-white/5 text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            Ordeñadora
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveEquipment("tanque")}
                            className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all text-center ${
                              activeEquipment === "tanque" 
                                ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                                : "bg-black border-white/5 text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            Tanque de Frío
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedConfig && (
                    <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-4">
                      <h2 className="text-lg font-bold">Datos para el Reporte PDF</h2>
                      
                      <div>
                        <label className="block text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-1.5">Técnico Responsable</label>
                        <input
                          type="text"
                          value={technicianName}
                          onChange={(e) => setTechnicianName(e.target.value)}
                          placeholder="Nombre del Diseñador/Químico"
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-1.5">Recomendaciones y Observaciones</label>
                        <textarea
                          value={pdfNotes}
                          onChange={(e) => setPdfNotes(e.target.value)}
                          placeholder="Instrucciones específicas, temperaturas..."
                          rows={4}
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right col: Calculations results, recipes and logs */}
                <div className="lg:col-span-8 space-y-6">
                  {!selectedConfig || !calcResults ? (
                    <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-16 text-center text-zinc-500">
                      <Calculator className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                      <h3 className="font-bold text-zinc-400 text-xl">Calculadora de Lavado Lista</h3>
                      <p className="text-sm mt-1 max-w-sm mx-auto">Seleccione una configuración de tambo en el panel lateral para computar las recetas exactas de lavado.</p>
                    </div>
                  ) : (
                    <>
                      {/* STATS BENTO BOARD */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-blue-950/20 to-zinc-950 border border-blue-500/10 rounded-2xl p-5">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-extrabold text-blue-400 tracking-wider uppercase">Enjuague / Dilución</span>
                            <Droplets className="w-4 h-4 text-blue-400" />
                          </div>
                          <p className="text-3xl font-extrabold text-white font-mono">
                            {(activeEquipment === "ordenadora" ? calcResults.ord.aguaPorLavado : calcResults.tan.aguaPorLavado).toFixed(1)}
                            <span className="text-sm font-semibold ml-1">Litros</span>
                          </p>
                          <p className="text-xs text-zinc-500 mt-2">Agua total a mezclar por lavado.</p>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-950/20 to-zinc-950 border border-emerald-500/10 rounded-2xl p-5">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-extrabold text-emerald-400 tracking-wider uppercase">Dosis Alcalino</span>
                            <Flame className="w-4 h-4 text-emerald-400" />
                          </div>
                          <p className="text-3xl font-extrabold text-emerald-400 font-mono">
                            {(activeEquipment === "ordenadora" ? calcResults.ord.alcalinoPorLavado : calcResults.tan.alcalinoPorLavado).toFixed(0)}
                            <span className="text-sm font-semibold ml-1 text-white">cc</span>
                          </p>
                          <p className="text-xs text-zinc-500 mt-2">Equivale a {(activeEquipment === "ordenadora" ? cssLiters(calcResults.ord.alcalinoPorLavado) : cssLiters(calcResults.tan.alcalinoPorLavado))} L de químico.</p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-950/20 to-zinc-950 border border-purple-500/10 rounded-2xl p-5">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-extrabold text-purple-400 tracking-wider uppercase">Dosis Ácido</span>
                            <Snowflake className="w-4 h-4 text-purple-400" />
                          </div>
                          <p className="text-3xl font-extrabold text-purple-400 font-mono">
                            {(activeEquipment === "ordenadora" ? calcResults.ord.acidoPorLavado : calcResults.tan.acidoPorLavado).toFixed(0)}
                            <span className="text-sm font-semibold ml-1 text-white">cc</span>
                          </p>
                          <p className="text-xs text-zinc-500 mt-2">Equivale a {(activeEquipment === "ordenadora" ? cssLiters(calcResults.ord.acidoPorLavado) : cssLiters(calcResults.tan.acidoPorLavado))} L de químico.</p>
                        </div>

                        <div className="bg-gradient-to-br from-teal-950/20 to-zinc-950 border border-teal-500/10 rounded-2xl p-5">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-extrabold text-teal-400 tracking-wider uppercase">Dosis Cloro</span>
                            <Sparkles className="w-4 h-4 text-teal-400" />
                          </div>
                          <p className="text-3xl font-extrabold text-teal-400 font-mono">
                            {(activeEquipment === "ordenadora" ? calcResults.ord.cloroPorLavado : calcResults.tan.cloroPorLavado).toFixed(0)}
                            <span className="text-sm font-semibold ml-1 text-white">cc</span>
                          </p>
                          <p className="text-xs text-zinc-500 mt-2">Circulación por {(activeEquipment === "ordenadora" ? calcResults.cloro.ordCloroTiempo : calcResults.cloro.tanCloroTiempo)} minutos en total.</p>
                        </div>
                      </div>

                      {/* QUICK ACTION ROW SUMMARY */}
                      <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 flex flex-wrap gap-4 items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-white">Acciones Sanitarias y Receta</h3>
                          <p className="text-xs text-zinc-500">Exporte el PDF para el tambo o registre la dosificación en la bitácora histórica.</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={generatePDF}
                            className="flex items-center gap-1.5 bg-zinc-800 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs hover:bg-zinc-700 transition"
                          >
                            <Download className="w-4 h-4" />
                            PDF Receta
                          </button>
                          <button
                            type="button"
                            onClick={shareWhatsApp}
                            className="flex items-center gap-1.5 bg-emerald-600 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs hover:bg-emerald-500 transition"
                          >
                            <Share2 className="w-4 h-4" />
                            WhatsApp
                          </button>
                          <button
                            type="button"
                            onClick={shareEmail}
                            className="flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs hover:bg-blue-500 transition"
                          >
                            <Send className="w-4 h-4" />
                            Email
                          </button>
                        </div>
                      </div>

                      {/* CONSUMPTION MATRIX SUMMARY CARDS */}
                      <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-4">
                        <h3 className="text-sm font-extrabold text-zinc-400 uppercase tracking-wider">Matriz de Consumos Proyectada para {selectedConfig.nombre_establecimiento}</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Daily matrix */}
                          <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                            <span className="text-xs font-semibold text-zinc-500">Estimado Diario:</span>
                            <div className="mt-2 text-xs font-mono space-y-1">
                              <div className="flex justify-between"><span>Agua:</span><span className="text-white font-bold">{activeEquipment === "ordenadora" ? calcResults.ord.aguaDiaria.toFixed(1) : calcResults.tan.diarioAgua.toFixed(1)} L</span></div>
                              <div className="flex justify-between"><span>Alcalino:</span><span className="text-emerald-400 font-bold">{(activeEquipment === "ordenadora" ? calcResults.ord.alcalinoDiario : calcResults.tan.diarioAlcalino).toFixed(0)} cc</span></div>
                              <div className="flex justify-between"><span>Ácido (Prom):</span><span className="text-purple-400 font-bold">{(activeEquipment === "ordenadora" ? calcResults.ord.semanalAcido / 7 : calcResults.tan.semanalAcido / 7).toFixed(0)} cc</span></div>
                              <div className="flex justify-between"><span>Cloro (Prom):</span><span className="text-teal-400 font-bold">{(activeEquipment === "ordenadora" ? calcResults.ord.semanalCloro / 7 : calcResults.tan.semanalCloro / 7).toFixed(0)} cc</span></div>
                            </div>
                          </div>

                          {/* Weekly matrix */}
                          <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                            <span className="text-xs font-semibold text-zinc-500">Estimado Semanal:</span>
                            <div className="mt-2 text-xs font-mono space-y-1">
                              <div className="flex justify-between"><span>Agua:</span><span className="text-white font-bold">{activeEquipment === "ordenadora" ? calcResults.ord.semanalAgua.toFixed(1) : calcResults.tan.semanalAgua.toFixed(1)} L</span></div>
                              <div className="flex justify-between"><span>Alcalino:</span><span className="text-emerald-400 font-bold">{(activeEquipment === "ordenadora" ? calcResults.ord.semanalAlcalino : calcResults.tan.semanalAlcalino).toFixed(0)} cc</span></div>
                              <div className="flex justify-between"><span>Ácido:</span><span className="text-purple-400 font-bold">{(activeEquipment === "ordenadora" ? calcResults.ord.semanalAcido : calcResults.tan.semanalAcido).toFixed(0)} cc</span></div>
                              <div className="flex justify-between"><span>Cloro:</span><span className="text-teal-400 font-bold">{(activeEquipment === "ordenadora" ? calcResults.ord.semanalCloro : calcResults.tan.semanalCloro).toFixed(0)} cc</span></div>
                            </div>
                          </div>

                          {/* Monthly matrix */}
                          <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                            <span className="text-xs font-semibold text-zinc-500">Estimado Mensual:</span>
                            <div className="mt-2 text-xs font-mono space-y-1">
                              <div className="flex justify-between"><span>Agua:</span><span className="text-white font-bold">{activeEquipment === "ordenadora" ? calcResults.ord.mensualAgua.toFixed(1) : calcResults.tan.mensualAgua.toFixed(1)} L</span></div>
                              <div className="flex justify-between"><span>Alcalino:</span><span className="text-emerald-400 font-bold">{(activeEquipment === "ordenadora" ? calcResults.ord.mensualAlcalino : calcResults.tan.mensualAlcalino).toFixed(0)} cc</span></div>
                              <div className="flex justify-between"><span>Ácido:</span><span className="text-purple-400 font-bold">{(activeEquipment === "ordenadora" ? calcResults.ord.mensualAcido : calcResults.tan.mensualAcido).toFixed(0)} cc</span></div>
                              <div className="flex justify-between"><span>Cloro:</span><span className="text-teal-400 font-bold">{(activeEquipment === "ordenadora" ? calcResults.ord.mensualCloro : calcResults.tan.mensualCloro).toFixed(0)} cc</span></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* DETAILED STEPS RECIPES VIEW */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Normal wash recipe container */}
                        <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-4">
                          <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                              <Flame className="w-5 h-5 text-emerald-400" />
                              Protocolo A: Lavado Normal
                            </h3>
                            <button
                              type="button"
                              onClick={() => handleRecordWash("Normal")}
                              className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-extrabold"
                            >
                              Registrar
                            </button>
                          </div>
                          
                          <ol className="space-y-4 text-xs font-semibold text-zinc-300">
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded-md h-fit">1</span>
                              <span>Realizar un <strong>enjuague inicial</strong> con abundante agua fría para remover completamente toda la lactosa y film suelto de leche.</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded-md h-fit">2</span>
                              <span>Preparar la cantidad de agua calculada por el sistema: <strong className="text-blue-400">{(activeEquipment === "ordenadora" ? calcResults.ord.aguaPorLavado : calcResults.tan.aguaPorLavado).toFixed(1)} Litros</strong> de agua caliente a una temperatura recomendada de 55-65°C.</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded-md h-fit">3</span>
                              <span>Agregar la dosis calculada de alcalino: <strong className="text-emerald-400">{(activeEquipment === "ordenadora" ? calcResults.ord.alcalinoPorLavado : calcResults.tan.alcalinoPorLavado).toFixed(0)} cc (ml)</strong> (Concentración del {activeEquipment === "ordenadora" ? selectedConfig.ord_alcalino_porcentaje : selectedConfig.tan_alcalino_porcentaje}%).</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded-md h-fit">4</span>
                              <span>Recircular la mezcla enérgica de alcalino de <strong>8 a 10 minutos</strong>. No superar los 12 minutos para impedir el re-depósito de residuos.</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded-md h-fit">5</span>
                              <span>Completar un <strong>enjuague final</strong> con abundante agua de pozo limpia y fría para desalojar remanentes químicos y alcalinidad.</span>
                            </li>
                          </ol>
                        </div>

                        {/* Acid wash recipe container */}
                        <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-4">
                          <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                              <Snowflake className="w-5 h-5 text-purple-400" />
                              Protocolo B: Lavado con Ácido
                            </h3>
                            <button
                              type="button"
                              onClick={() => handleRecordWash("Con ácido")}
                              className="px-3 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg text-xs font-extrabold"
                            >
                              Registrar
                            </button>
                          </div>
                          
                          <ol className="space-y-4 text-xs font-semibold text-zinc-300">
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-purple-400 bg-purple-500/5 px-2 py-0.5 rounded-md h-fit">1</span>
                              <span>Realizar un <strong>enjuague inicial</strong> veloz con abundante agua fría libre de durezas.</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-purple-400 bg-purple-500/5 px-2 py-0.5 rounded-md h-fit">2</span>
                              <span>Preparar un baño de agua caliente de <strong className="text-blue-400">{(activeEquipment === "ordenadora" ? calcResults.ord.aguaPorLavado : calcResults.tan.aguaPorLavado).toFixed(1)} Litros</strong> y agregar la cantidad de alcalino indicada: <strong className="text-emerald-400">{(activeEquipment === "ordenadora" ? calcResults.ord.alcalinoPorLavado : calcResults.tan.alcalinoPorLavado).toFixed(0)} cc (ml)</strong> para remover grasas.</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-purple-400 bg-purple-500/5 px-2 py-0.5 rounded-md h-fit">3</span>
                              <span>Recircular la solución alcalina durante un periodo continuo de <strong>8 a 10 minutos</strong>. Vaciar o drenar por completo el circuito.</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-purple-400 bg-purple-500/5 px-2 py-0.5 rounded-md h-fit">4</span>
                              <span>Preparar nuevamente un baño de agua de <strong className="text-blue-400">{(activeEquipment === "ordenadora" ? calcResults.ord.aguaPorLavado : calcResults.tan.aguaPorLavado).toFixed(1)} Litros</strong> y dosificar el ácido: <strong className="text-purple-400">{(activeEquipment === "ordenadora" ? calcResults.ord.acidoPorLavado : calcResults.tan.acidoPorLavado).toFixed(0)} cc (ml)</strong> (Concentración del {activeEquipment === "ordenadora" ? selectedConfig.ord_acido_porcentaje : selectedConfig.tan_acido_porcentaje}%).</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-purple-400 bg-purple-500/5 px-2 py-0.5 rounded-md h-fit">5</span>
                              <span>Recircular la mezcla ácida por <strong>8 a 10 minutos</strong> para disolver calcio y piedra de leche. Drenar circuito.</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-purple-400 bg-purple-500/5 px-2 py-0.5 rounded-md h-fit">6</span>
                              <span>Llevar a cabo un prolijo y completo <strong>enjuague final</strong> abundante con agua potable fría.</span>
                            </li>
                          </ol>
                        </div>

                        {/* Chlorine sanitization recipe container */}
                        <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-4">
                          <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                              <Sparkles className="w-5 h-5 text-teal-400" />
                              Protocolo C: Sanitización con Cloro
                            </h3>
                            <button
                              type="button"
                              onClick={() => handleRecordWash("Clorado")}
                              className="px-3 py-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 rounded-lg text-xs font-extrabold"
                            >
                              Registrar
                            </button>
                          </div>
                          
                          <ol className="space-y-4 text-xs font-semibold text-zinc-300">
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-teal-400 bg-teal-500/5 px-2 py-0.5 rounded-md h-fit">1</span>
                              <span>Asegurar que todo el circuito de lavado esté completamente drenado y libre de trazas de detergentes previos.</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-teal-400 bg-teal-500/5 px-2 py-0.5 rounded-md h-fit">2</span>
                              <span>Preparar agua limpia a temperatura ambiente de <strong className="text-blue-400 font-bold">{(activeEquipment === "ordenadora" ? calcResults.ord.aguaPorLavado : calcResults.tan.aguaPorLavado).toFixed(1)} Litros</strong> en el pilón colector.</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-teal-400 bg-teal-500/5 px-2 py-0.5 rounded-md h-fit">3</span>
                              <span>Dosificar la dosis de cloro calculada: <strong className="text-teal-400 font-bold">{(activeEquipment === "ordenadora" ? calcResults.ord.cloroPorLavado : calcResults.tan.cloroPorLavado).toFixed(0)} cc (ml)</strong> (Concentración {activeEquipment === "ordenadora" ? calcResults.cloro.ordCloroPorcentaje : calcResults.cloro.tanCloroPorcentaje}%).</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-teal-400 bg-teal-500/5 px-2 py-0.5 rounded-md h-fit">4</span>
                              <span>Recircular la mezcla clorada continuamente durante <strong className="text-teal-400 font-bold">{activeEquipment === "ordenadora" ? calcResults.cloro.ordCloroTiempo : calcResults.cloro.tanCloroTiempo} minutos</strong> exactos.</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="font-bold font-mono text-teal-400 bg-teal-500/5 px-2 py-0.5 rounded-md h-fit">5</span>
                              <span>Drenar velozmente por gravedad el remanente de solución de cloro para evitar oxidaciones y depósitos.</span>
                            </li>
                          </ol>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* HISTORIAL TAB */}
            {activeTab === "historial" && (
              <motion.div
                key="historial-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Filters Row */}
                <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-5 flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-2">Filtrar por Establecimiento</label>
                    <select
                      value={historyTamboFilter}
                      onChange={(e) => setHistoryTamboFilter(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Todos los Establecimientos --</option>
                      {Array.from(new Set(historial.map(x => x.tambo_id))).map(tId => {
                        const t = tambos.find(y => y.id === tId);
                        return <option key={tId} value={tId || ""}>{t ? t.nombre : tId || "Externo"}</option>;
                      })}
                    </select>
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-2">Filtrar por Equipo</label>
                    <select
                      value={historyEquipoFilter}
                      onChange={(e) => setHistoryEquipoFilter(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Todos los Equipos --</option>
                      <option value="Ordeñadora">Ordeñadora</option>
                      <option value="Tanque de Frío">Tanque de Frío</option>
                    </select>
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-2">Filtrar por Fecha</label>
                    <input
                      type="date"
                      value={historyDateFilter}
                      onChange={(e) => setHistoryDateFilter(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    onClick={() => {
                      setHistoryTamboFilter("");
                      setHistoryEquipoFilter("");
                      setHistoryDateFilter("");
                    }}
                    className="bg-zinc-800 text-zinc-300 hover:text-white px-5 py-2.5 rounded-xl font-bold text-xs"
                  >
                    Restablecer
                  </button>
                </div>

                {/* Grid table */}
                <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-black/40 text-xs font-extrabold text-zinc-400 uppercase tracking-wider">
                          <th className="py-4 px-6">Fecha & Hora</th>
                          <th className="py-4 px-6">Establecimiento</th>
                          <th className="py-4 px-6">Equipo / Aplicación</th>
                          <th className="py-4 px-6 text-right">Agua (L)</th>
                          <th className="py-4 px-6 text-right">Alcalino (L)</th>
                          <th className="py-4 px-6 text-right">Ácido (L)</th>
                          <th className="py-4 px-6 text-right">Cloro (L) / Tiempo</th>
                          <th className="py-4 px-6">Lavado Tipo</th>
                          <th className="py-4 px-6">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-sm">
                        {filteredHistory.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-zinc-500 italic">No se encontraron registros en la bitácora que coincidan con los filtros aplicados.</td>
                          </tr>
                        ) : (
                          filteredHistory.map((item) => (
                            <tr key={item.id} className="hover:bg-white/[0.01]">
                              <td className="py-4 px-6 text-zinc-300 font-mono">
                                {item.fecha.split("-").reverse().join("/")} <span className="text-zinc-500 text-xs ml-1">{item.hora.substring(0, 5)}</span>
                              </td>
                              <td className="py-4 px-6 font-bold text-white">
                                {item.establecimiento_nombre}
                              </td>
                              <td className="py-4 px-6">
                                <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-extrabold ${
                                  item.equipo === "Ordeñadora" 
                                    ? "bg-blue-500/10 text-blue-400" 
                                    : "bg-yellow-500/10 text-yellow-400"
                                }`}>
                                  {item.equipo}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right font-mono font-bold text-zinc-100">
                                {item.agua_utilizada} L
                              </td>
                              <td className="py-4 px-6 text-right font-mono text-emerald-400">
                                {item.alcalino_utilizado} L
                              </td>
                              <td className="py-4 px-6 text-right font-mono text-purple-400">
                                {item.acido_utilizado} L
                              </td>
                              <td className="py-4 px-6 text-right font-mono text-teal-400">
                                <div className="text-right">
                                  <div>{(item.cloro_utilizado ?? 0).toFixed(3)} L</div>
                                  <div className="text-[10px] text-zinc-400">{(item.cloro_tiempo ?? 0)} min</div>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold leading-none ${
                                  item.tipo_lavado === "Normal" 
                                    ? "bg-zinc-800 text-zinc-300" 
                                    : item.tipo_lavado === "Con ácido"
                                      ? "bg-purple-950/20 text-purple-400"
                                      : "bg-teal-950/20 text-teal-400"
                                }`}>
                                  {item.tipo_lavado}
                                </span>
                              </td>
                              <td className="py-4 px-6">
                                <button
                                  onClick={() => handleDeleteHistory(item.id)}
                                  className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
                                  title="Borrar registro"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* REPORTES TAB */}
            {activeTab === "reportes" && (
              <motion.div
                key="reportes-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Stats Header Metrics summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
                    <span className="text-xs text-zinc-500 font-extrabold uppercase tracking-wider">Lavados Realizados</span>
                    <p className="text-4xl font-extrabold text-white mt-1 font-mono">{reportStats.totalCount}</p>
                    <p className="text-xs text-zinc-600 mt-2">Suma de lavados en bitácora.</p>
                  </div>

                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
                    <span className="text-xs text-zinc-500 font-extrabold uppercase tracking-wider">Agua Consumida</span>
                    <p className="text-4xl font-extrabold text-blue-400 mt-1 font-mono">{reportStats.water.toFixed(1)} L</p>
                    <p className="text-xs text-zinc-600 mt-2">Consumidos en diluciones totales.</p>
                  </div>

                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
                    <span className="text-xs text-zinc-500 font-extrabold uppercase tracking-wider font-bold">Consumo Alcalino</span>
                    <p className="text-4xl font-extrabold text-emerald-400 mt-1 font-mono">{reportStats.alcalino.toFixed(3)} L</p>
                    <p className="text-xs text-zinc-600 mt-2">Detergente concentrado alcalino.</p>
                  </div>

                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
                    <span className="text-xs text-zinc-500 font-extrabold uppercase tracking-wider">Consumo de Ácido</span>
                    <p className="text-4xl font-extrabold text-purple-400 mt-1 font-mono">{reportStats.acido.toFixed(3)} L</p>
                    <p className="text-xs text-zinc-600 mt-2">Detergente desincrustante ácido.</p>
                  </div>
                </div>

                {/* Sub reports grouping charts or stats */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Consumption analysis breakdown */}
                  <div className="lg:col-span-7 bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 space-y-6">
                    <div>
                      <h3 className="text-lg font-bold">Consumo Realizado por Establecimiento</h3>
                      <p className="text-xs text-zinc-500">Agrupación totalizada de agua y detergentes.</p>
                    </div>

                    <div className="space-y-4">
                      {Array.from(new Set(historial.map(x => x.establecimiento_nombre))).map(name => {
                        const items = historial.filter(h => h.establecimiento_nombre === name);
                        const waterSum = items.reduce((a,c) => a + c.agua_utilizada, 0);
                        const chemSum = items.reduce((a,c) => a + c.alcalino_utilizado + c.acido_utilizado, 0);
                        const countWash = items.length;

                        // Calculate percentage of water used relative to total water
                        const pctOfTotal = reportStats.water ? (waterSum / reportStats.water) * 100 : 0;

                        return (
                          <div key={name} className="bg-black/25 p-4 rounded-xl border border-white/5 space-y-2">
                            <div className="flex justify-between items-center text-sm font-semibold">
                              <span className="text-white">{name} <span className="text-xs text-zinc-500 font-normal">({countWash} lavados)</span></span>
                              <span className="text-zinc-300 font-mono">{waterSum.toFixed(0)} L (Agua)</span>
                            </div>
                            
                            {/* Bar container */}
                            <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min(pctOfTotal, 100)}%` }}
                              />
                            </div>
                            
                            <div className="flex justify-between items-center text-xs text-zinc-500">
                              <span>Participación en el consumo total: {pctOfTotal.toFixed(1)}%</span>
                              <span className="font-mono text-emerald-400">Total Químicos: {chemSum.toFixed(2)} L</span>
                            </div>
                          </div>
                        );
                      })}

                      {historial.length === 0 && (
                        <p className="text-xs text-zinc-500 italic text-center py-6">Rellene la bitácora para proyectar informes de participación.</p>
                      )}
                    </div>
                  </div>

                  {/* Cleanings protocol share */}
                  <div className="lg:col-span-5 bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-bold">Proporción de Protocolos</h3>
                      <p className="text-xs text-zinc-500">Relación de lavados con o sin ácido desincrustante.</p>
                    </div>

                    <div className="py-8 space-y-4">
                      {(() => {
                        const normalCount = historial.filter(h => h.tipo_lavado === "Normal").length;
                        const acidCount = historial.filter(h => h.tipo_lavado === "Con ácido").length;
                        const total = normalCount + acidCount || 1;
                        
                        const normPct = (normalCount / total) * 100;
                        const acidPct = (acidCount / total) * 100;

                        return (
                          <div className="space-y-6">
                            <div className="flex items-center justify-center gap-12">
                              <div className="text-center">
                                <span className="text-xs text-zinc-500 font-bold block uppercase tracking-wider">Lavado Normal</span>
                                <span className="text-2xl font-extrabold text-zinc-300 block mt-1">{normalCount}</span>
                                <span className="text-xs text-zinc-500 font-mono">{normPct.toFixed(1)}%</span>
                              </div>
                              <div className="text-center">
                                <span className="text-xs text-purple-400 font-bold block uppercase tracking-wider">Con Ácido</span>
                                <span className="text-2xl font-extrabold text-purple-400 block mt-1">{acidCount}</span>
                                <span className="text-xs text-zinc-500 font-mono">{acidPct.toFixed(1)}%</span>
                              </div>
                            </div>

                            {/* Dual stacked progress bar */}
                            <div className="w-full bg-zinc-900 rounded-full h-4 overflow-hidden flex">
                              <div className="bg-zinc-600 h-full" style={{ width: `${normPct}%` }} title={`Normal: ${normPct.toFixed(1)}%`} />
                              <div className="bg-purple-500 h-full" style={{ width: `${acidPct}%` }} title={`Con Ácido: ${acidPct.toFixed(1)}%`} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="bg-black/20 p-4 rounded-xl border border-white/5 text-xs text-zinc-400 leading-relaxed text-center">
                      <span className="font-bold text-white block mb-1">Manejo óptimo sugerido:</span>
                      La relación de desincrustación ácida debe rondar entre el 30% al 45% del total de ciclos semanales para descartar incrustaciones minerales duras.
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* FORM MODAL (CREATE / EDIT CONFIGURATION) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f0f0f] border border-white/10 rounded-2xl max-w-4xl w-full p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h3 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                  <Settings2 className="w-5 h-5" />
                  {editConfigId ? "Editar Configuración Sanitaria" : "Nueva Configuración Sanitaria"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 px-3 bg-zinc-900 text-zinc-400 hover:text-white rounded-lg text-xs font-bold border border-white/5 hover:border-white/10"
                >
                  Cerrar
                </button>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-6">
                {/* Section A: General Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-zinc-400 uppercase tracking-wider">Seleccionar Tambo Origen</label>
                    <select
                      value={formTamboId}
                      onChange={(e) => setFormTamboId(e.target.value)}
                      disabled={!!editConfigId}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-55"
                      required
                    >
                      <option value="">-- Seleccionar Tambo --</option>
                      {tambos.map(t => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-extrabold text-zinc-400 uppercase tracking-wider">Nombre del Establecimiento</label>
                    <input
                      type="text"
                      value={formNombreEstablecimiento}
                      onChange={(e) => setFormNombreEstablecimiento(e.target.value)}
                      placeholder="Ej: Establecimiento La Irene"
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <label className="block text-xs font-extrabold text-zinc-400 uppercase tracking-wider">Observaciones Generales</label>
                    <input
                      type="text"
                      value={formObservaciones}
                      onChange={(e) => setFormObservaciones(e.target.value)}
                      placeholder="Marcas de detergentes recomendadas o pautas..."
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Section B: Equipment Configuration side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Ordeñadora configuration inputs */}
                  <div className="bg-black/30 p-5 rounded-2xl border border-white/5 space-y-4">
                    <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2 border-b border-white/5 pb-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Configuración de Ordeñadora
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">Cantidad de Puestos</label>
                        <input
                          type="number"
                          value={formOrdPuestos}
                          onChange={(e) => setFormOrdPuestos(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">Lts Agua por Puesto</label>
                        <input
                          type="number"
                          step="0.1"
                          value={formOrdLitrosPorPuesto}
                          onChange={(e) => setFormOrdLitrosPorPuesto(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">Ordeños Diarios (lavados)</label>
                        <input
                          type="number"
                          value={formOrdOrdenesDiarios}
                          onChange={(e) => setFormOrdOrdenesDiarios(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">Lavados Ácidos / Semana</label>
                        <input
                          type="number"
                          value={formOrdLavadosAcidosSemana}
                          onChange={(e) => setFormOrdLavadosAcidosSemana(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">% Alcalino Sugerido</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formOrdAlcalinoPorcentaje}
                          onChange={(e) => setFormOrdAlcalinoPorcentaje(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">% Ácido Sugerido</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formOrdAcidoPorcentaje}
                          onChange={(e) => setFormOrdAcidoPorcentaje(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">% Cloro Sugerido</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={formOrdCloroPorcentaje}
                          onChange={(e) => setFormOrdCloroPorcentaje(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">Tiempo Recirculación Cloro (min)</label>
                        <input
                          type="number"
                          value={formOrdCloroTiempo}
                          onChange={(e) => setFormOrdCloroTiempo(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tanque de frío configuration inputs */}
                  <div className="bg-black/30 p-5 rounded-2xl border border-white/5 space-y-4">
                    <h4 className="text-sm font-bold text-yellow-400 flex items-center gap-2 border-b border-white/5 pb-2">
                       <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                      Configuración de Tanque de Frío
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">Capacidad del Tanque (litros)</label>
                        <input
                          type="number"
                          value={formTanCapacidad}
                          onChange={(e) => setFormTanCapacidad(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">% Agua Necesario</label>
                        <input
                          type="number"
                          step="0.1"
                          value={formTanAguaPorcentaje}
                          onChange={(e) => setFormTanAguaPorcentaje(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">Frecuencia de Lavado</label>
                        <select
                          value={formTanFrecuencia}
                          onChange={(e) => setFormTanFrecuencia(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        >
                          <option value="Diario">Diario</option>
                          <option value="Cada 2 días">Cada 2 días</option>
                          <option value="Personalizado">Personalizado</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">Lavados Ácidos / Semana</label>
                        <input
                          type="number"
                          value={formTanLavadosAcidosSemana}
                          onChange={(e) => setFormTanLavadosAcidosSemana(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">% Alcalino Sugerido</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formTanAlcalinoPorcentaje}
                          onChange={(e) => setFormTanAlcalinoPorcentaje(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">% Ácido Sugerido</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formTanAcidoPorcentaje}
                          onChange={(e) => setFormTanAcidoPorcentaje(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">% Cloro Sugerido</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={formTanCloroPorcentaje}
                          onChange={(e) => setFormTanCloroPorcentaje(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 font-semibold mb-1">Tiempo Recirculación Cloro (min)</label>
                        <input
                          type="number"
                          value={formTanCloroTiempo}
                          onChange={(e) => setFormTanCloroTiempo(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-white/5 pt-5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-sm font-bold border border-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2.5 rounded-xl font-extrabold text-sm transition-all"
                  >
                    Guardar Parámetros
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper formatting function
function cssLiters(cc: number): string {
  return (cc / 1000).toFixed(2);
}
