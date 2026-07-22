import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { EvaluacionDiagnosis } from "../types/aiDiagnosis";

/**
 * Helper to determine state colors and badge labels
 */
function getStateColors(estado: string): {
  rgb: [number, number, number];
  hex: string;
  badgeLabel: string;
  symbol: string;
} {
  switch (estado) {
    case "Conforme":
      return { rgb: [16, 185, 129], hex: "#10B981", badgeLabel: "CONFORME", symbol: "🟢" };
    case "Advertencia":
    case "Atención":
      return { rgb: [234, 179, 8], hex: "#EAB308", badgeLabel: "ATENCIÓN", symbol: "🟡" };
    case "Fuera de tolerancia":
      return { rgb: [249, 115, 22], hex: "#F97316", badgeLabel: "DESVIADO", symbol: "🔴" };
    case "Crítico":
      return { rgb: [239, 68, 68], hex: "#EF4444", badgeLabel: "CRÍTICO", symbol: "🔴" };
    default:
      return { rgb: [113, 113, 122], hex: "#71717A", badgeLabel: estado.toUpperCase(), symbol: "⚪" };
  }
}

/**
 * Helper to render the unified GanPor Header
 */
function renderGanporHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  stateTheme: ReturnType<typeof getStateColors>
) {
  // Institutional GanPor Emerald Green Header
  doc.setFillColor(16, 185, 129); // #10B981
  doc.rect(0, 0, 210, 26, "F");

  // Logo / Brand Text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 12, 13);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, 12, 20);

  // Header Status Badge
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(152, 5, 46, 16, 2.5, 2.5, "F");
  doc.setFillColor(stateTheme.rgb[0], stateTheme.rgb[1], stateTheme.rgb[2]);
  doc.roundedRect(153, 6, 44, 14, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(stateTheme.badgeLabel, 175, 15, { align: "center" });
}

/**
 * Generates and downloads the Technical ISO PDF Report (ISO 5707 / ISO 6690)
 */
export function downloadTechnicalPdf(evalData: EvaluacionDiagnosis) {
  try {
    const doc = new jsPDF();
    const res = evalData.resultadoIA;
    const isoTable = res.evaluacionISO || [];
    const tamboName = evalData.tamboNombre || "Establecimiento";
    const dateStr = evalData.fecha ? new Date(evalData.fecha).toLocaleDateString("es-AR") : new Date().toLocaleDateString("es-AR");
    const stateTheme = getStateColors(res.estadoGeneral);

    // Render Unified Header
    renderGanporHeader(
      doc,
      "GANPOR - EVALUACIÓN TÉCNICA DE PULSADO ISO",
      "Informe Técnico Especializado • Normas ISO 5707:2007 / ISO 6690:2007",
      stateTheme
    );

    let currentY = 30;

    // --- Section 1: Information Block ---
    doc.setDrawColor(228, 228, 231);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(12, currentY, 186, 18, 2, 2, "FD");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Establecimiento / Tambo:", 16, currentY + 6);
    doc.text("Fecha de Evaluación:", 16, currentY + 13);
    doc.text("Técnico Evaluador:", 110, currentY + 6);
    doc.text("Nivel de Criticidad:", 110, currentY + 13);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(tamboName, 55, currentY + 6);
    doc.text(dateStr, 48, currentY + 13);
    doc.text(evalData.tecnicoNombre || "Técnico Especialista", 142, currentY + 6);
    doc.text(res.nivelCriticidad || "Bajo", 142, currentY + 13);

    currentY += 22;

    // --- Section 2: Pulsograph Image (if available) ---
    if (evalData.imagenUrl && evalData.imagenUrl.startsWith("data:image")) {
      try {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(16, 185, 129);
        doc.text("IMAGEN / GRÁFICO DEL PULSÓGRAFO ANALIZADO", 12, currentY);
        currentY += 3.5;

        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(12, currentY, 186, 30, 2, 2, "FD");

        doc.addImage(evalData.imagenUrl, "PNG", 16, currentY + 3, 48, 24);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Registro Digital del Pulso Evaluado", 70, currentY + 8);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text("Muestra procesada por el Motor de Reglas ISO GanPor.", 70, currentY + 14);
        doc.text("Parámetros analizados: Vacío, Frecuencia, Relación y Fases A, B, C, D.", 70, currentY + 19);

        currentY += 34;
      } catch (e) {
        console.warn("No se pudo incrustar la imagen en el PDF Técnico:", e);
      }
    }

    // --- Section 3: ISO Parameters Table ---
    if (currentY > 240) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text("PARÁMETROS EVALUADOS SEGÚN NORMA ISO 5707 / 6690", 12, currentY);
    currentY += 3.5;

    const tableRows = isoTable.map((item) => [
      item.canal && item.canal !== "Global" ? `[${item.canal}] ${item.parametro}` : item.parametro,
      item.valorMedido,
      item.valorPermitido,
      item.diferencia,
      item.estado,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Parámetro", "Valor Medido", "Estándar ISO", "Desviación", "Dictamen"]],
      body: tableRows,
      theme: "striped",
      styles: { cellPadding: 1.8, fontSize: 7.5 },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: "bold",
      },
      bodyStyles: {
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30, fontStyle: "bold" },
        2: { cellWidth: 45 },
        3: { cellWidth: 26 },
        4: { cellWidth: 35, fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          const val = String(data.cell.raw);
          if (val === "Conforme") data.cell.styles.textColor = [16, 185, 129];
          else if (val === "Advertencia" || val === "Atención") data.cell.styles.textColor = [202, 138, 4];
          else if (val === "Fuera de tolerancia") data.cell.styles.textColor = [234, 88, 12];
          else if (val === "Crítico") data.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;

    // --- Section 3.5: Multi-Channel Technical Analysis & Comparative Breakdown ---
    if (res.analisisCanal1 || res.analisisCanal2) {
      if (currentY > 230) {
        doc.addPage();
        currentY = 16;
      }

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129);
      doc.text("ANÁLISIS TÉCNICO EXCLUSIVO POR CANAL DE PULSADO", 12, currentY);
      currentY += 4;

      if (res.analisisCanal1) {
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(`• ${res.analisisCanal1.nombreCanal} [Dictamen: ${res.analisisCanal1.estadoCanal}]:`, 14, currentY);
        currentY += 3.5;

        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const splitCh1 = doc.splitTextToSize(res.analisisCanal1.interpretacionExclusiva, 176);
        doc.text(splitCh1, 18, currentY);
        currentY += splitCh1.length * 3 + 3;
      }

      if (res.analisisCanal2) {
        if (currentY > 255) {
          doc.addPage();
          currentY = 16;
        }
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(`• ${res.analisisCanal2.nombreCanal} [Dictamen: ${res.analisisCanal2.estadoCanal}]:`, 14, currentY);
        currentY += 3.5;

        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const splitCh2 = doc.splitTextToSize(res.analisisCanal2.interpretacionExclusiva, 176);
        doc.text(splitCh2, 18, currentY);
        currentY += splitCh2.length * 3 + 3;
      }
    }

    // --- Section 3.6: Comparative Analysis Between Channels ---
    if (res.analisisComparativo) {
      if (currentY > 220) {
        doc.addPage();
        currentY = 16;
      }

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129);
      doc.text("ANÁLISIS COMPARATIVO Y SIMETRÍA INTER-CANAL (ISO 5707)", 12, currentY);
      currentY += 4;

      const compData = res.analisisComparativo;
      const compRows = [
        [compData.diferenciaTa.parametro, compData.diferenciaTa.valorCanal1, compData.diferenciaTa.valorCanal2, compData.diferenciaTa.diferencia, compData.diferenciaTa.esAceptableISO ? "Conforme" : "Desbalance"],
        [compData.diferenciaTb.parametro, compData.diferenciaTb.valorCanal1, compData.diferenciaTb.valorCanal2, compData.diferenciaTb.diferencia, compData.diferenciaTb.esAceptableISO ? "Conforme" : "Desbalance"],
        [compData.diferenciaTc.parametro, compData.diferenciaTc.valorCanal1, compData.diferenciaTc.valorCanal2, compData.diferenciaTc.diferencia, compData.diferenciaTc.esAceptableISO ? "Conforme" : "Desbalance"],
        [compData.diferenciaTd.parametro, compData.diferenciaTd.valorCanal1, compData.diferenciaTd.valorCanal2, compData.diferenciaTd.diferencia, compData.diferenciaTd.esAceptableISO ? "Conforme" : "Desbalance"],
        [compData.diferenciaVacio.parametro, compData.diferenciaVacio.valorCanal1, compData.diferenciaVacio.valorCanal2, compData.diferenciaVacio.diferencia, compData.diferenciaVacio.esAceptableISO ? "Conforme" : "Desbalance"],
        [compData.diferenciaFrecuencia.parametro, compData.diferenciaFrecuencia.valorCanal1, compData.diferenciaFrecuencia.valorCanal2, compData.diferenciaFrecuencia.diferencia, compData.diferenciaFrecuencia.esAceptableISO ? "Conforme" : "Desbalance"],
        [compData.diferenciaRelacion.parametro, compData.diferenciaRelacion.valorCanal1, compData.diferenciaRelacion.valorCanal2, compData.diferenciaRelacion.diferencia, compData.diferenciaRelacion.esAceptableISO ? "Conforme" : "Desbalance"],
      ];

      autoTable(doc, {
        startY: currentY,
        head: [["Parámetro Comparado", "Canal 1", "Canal 2", "Diferencia", "Evaluación"]],
        body: compRows,
        theme: "grid",
        styles: { cellPadding: 1.5, fontSize: 7 },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 7,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 30 },
          2: { cellWidth: 30 },
          3: { cellWidth: 30, fontStyle: "bold" },
          4: { cellWidth: 36, fontStyle: "bold" },
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 4;

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("Conclusión Comparativa entre Canales:", 14, currentY);
      currentY += 3.5;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      const splitCompConc = doc.splitTextToSize(compData.conclusionComparativa, 176);
      doc.text(splitCompConc, 18, currentY);
      currentY += splitCompConc.length * 3 + 4;
    }

    // --- Section 4: Technical Diagnostic Assistant Sections ---
    const causasDetalladas = res.posiblesCausasDetalladas || [];
    const posiblesCausas = res.posiblesCausas || [];
    const planInspeccion = res.planInspeccion || [];
    const impactoPotencial = res.impactoPotencial || [];
    const accionesCorrectivas = res.accionesCorrectivas || res.recomendaciones || [];

    if (currentY > 240) {
      doc.addPage();
      currentY = 16;
    }

    // 1. Análisis de Posibles Causas
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text("ANÁLISIS DE POSIBLES CAUSAS (HIPÓTESIS TÉCNICAS):", 12, currentY);
    currentY += 4;

    if (causasDetalladas.length > 0) {
      for (const item of causasDetalladas) {
        if (currentY > 265) {
          doc.addPage();
          currentY = 16;
        }
        let probTag = "[Alta Probabilidad]";
        if (item.probabilidad === "Media") probTag = "[Probabilidad Media]";
        if (item.probabilidad === "Baja") probTag = "[Probabilidad Baja]";

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text(`• ${item.causa} `, 16, currentY);
        
        const causaWidth = doc.getTextWidth(`• ${item.causa} `);
        if (item.probabilidad === "Alta") doc.setTextColor(220, 38, 38);
        else if (item.probabilidad === "Media") doc.setTextColor(202, 138, 4);
        else doc.setTextColor(37, 99, 235);
        doc.text(probTag, 16 + causaWidth, currentY);
        currentY += 3.5;

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const splitJust = doc.splitTextToSize(`Justificación: ${item.justificacion}`, 174);
        doc.text(splitJust, 20, currentY);
        currentY += splitJust.length * 3 + 2;
      }
    } else if (posiblesCausas.length > 0) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      for (const causa of posiblesCausas) {
        if (currentY > 265) {
          doc.addPage();
          currentY = 16;
        }
        doc.text(`• ${causa}`, 16, currentY);
        currentY += 3.5;
      }
    }
    currentY += 2;

    // 2. Plan de Inspección Recomendado
    if (planInspeccion.length > 0) {
      if (currentY > 240) {
        doc.addPage();
        currentY = 16;
      }
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(37, 99, 235);
      doc.text("PLAN DE INSPECCIÓN RECOMENDADO:", 12, currentY);
      currentY += 4;

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      planInspeccion.forEach((step, idx) => {
        if (currentY > 265) {
          doc.addPage();
          currentY = 16;
        }
        doc.text(`${idx + 1}. ${step}`, 16, currentY);
        currentY += 3.5;
      });
      currentY += 2;
    }

    // 3. Riesgos Operativos e Impacto Potencial
    if (impactoPotencial.length > 0) {
      if (currentY > 240) {
        doc.addPage();
        currentY = 16;
      }
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(217, 119, 6);
      doc.text("IMPACTO POTENCIAL Y RIESGOS OPERATIVOS:", 12, currentY);
      currentY += 4;

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      for (const riesgo of impactoPotencial) {
        if (currentY > 265) {
          doc.addPage();
          currentY = 16;
        }
        doc.text(`• ${riesgo}`, 16, currentY);
        currentY += 3.5;
      }
      currentY += 2;
    }

    // 4. Acciones Correctivas
    if (accionesCorrectivas.length > 0) {
      if (currentY > 240) {
        doc.addPage();
        currentY = 16;
      }
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129);
      doc.text("ACCIONES CORRECTIVAS Y RECOMENDACIONES:", 12, currentY);
      currentY += 4;

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      for (const accion of accionesCorrectivas) {
        if (currentY > 265) {
          doc.addPage();
          currentY = 16;
        }
        doc.text(`• ${accion}`, 16, currentY);
        currentY += 3.5;
      }
      currentY += 3;
    }

    // --- Section 5: Final Conclusion ---
    if (res.informeProductor?.conclusionFinal) {
      if (currentY > 245) {
        doc.addPage();
        currentY = 16;
      }

      const splitConclusion = doc.splitTextToSize(res.informeProductor.conclusionFinal, 178);
      const boxHeight = Math.max(16, splitConclusion.length * 3.5 + 7);

      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(12, currentY, 186, boxHeight, 2, 2, "FD");

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("DICTAMEN Y CONCLUSIÓN FINAL DE EVALUACIÓN:", 16, currentY + 5);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(splitConclusion, 16, currentY + 10);

      currentY += boxHeight + 4;
    }

    // Footer
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text("Documento técnico de evaluación ISO 5707 / ISO 6690 generado por GANPOR. Evaluación profesional.", 12, 288);

    doc.save(`Diagnostico_ISO_Tecnico_${tamboName.replace(/\s+/g, "_")}_${dateStr.replace(/\//g, "-")}.pdf`);
  } catch (err) {
    console.error("Error al generar el PDF Técnico:", err);
    alert("Error al generar el archivo PDF.");
  }
}

/**
 * Generates and downloads the Full Professional Producer PDF Report
 */
export function downloadProducerPdf(evalData: EvaluacionDiagnosis) {
  try {
    const doc = new jsPDF();
    const res = evalData.resultadoIA;
    const isoTable = res.evaluacionISO || [];
    const inf = res.informeProductor || {
      estadoGeneral: res.estadoGeneral,
      queSignifica: res.diagnosticoTecnico,
      queRiesgosExisten: "Verifique las observaciones técnicas de la evaluación.",
      queSeRecomiendaHacer: (res.accionesCorrectivas || res.recomendaciones || []).join(". "),
      interpretacion: res.diagnosticoTecnico,
      conclusionFinal: "Evaluación procesada según estándar normativo ISO 5707 / 6690."
    };
    const tamboName = evalData.tamboNombre || "Establecimiento";
    const dateStr = evalData.fecha ? new Date(evalData.fecha).toLocaleDateString("es-AR") : new Date().toLocaleDateString("es-AR");
    const stateTheme = getStateColors(res.estadoGeneral);

    // Render Unified GanPor Header
    renderGanporHeader(
      doc,
      "GANPOR - INFORME DE PULSADO PARA EL PRODUCTOR",
      "Diagnóstico Operativo y Recomendaciones • Normas ISO 5707 / ISO 6690",
      stateTheme
    );

    let currentY = 30;

    // --- Section 1: Information Block ---
    doc.setDrawColor(228, 228, 231);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(12, currentY, 186, 18, 2, 2, "FD");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Establecimiento / Tambo:", 16, currentY + 6);
    doc.text("Fecha de Evaluación:", 16, currentY + 13);
    doc.text("Evaluador Asignado:", 110, currentY + 6);
    doc.text("Estado del Pulsador:", 110, currentY + 13);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(tamboName, 55, currentY + 6);
    doc.text(dateStr, 48, currentY + 13);
    doc.text(evalData.tecnicoNombre || "Técnico Especialista", 142, currentY + 6);
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(stateTheme.rgb[0], stateTheme.rgb[1], stateTheme.rgb[2]);
    doc.text(res.estadoGeneral, 142, currentY + 13);

    currentY += 22;

    // --- Section 2: Pulsograph Image (if available) ---
    if (evalData.imagenUrl && evalData.imagenUrl.startsWith("data:image")) {
      try {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(16, 185, 129);
        doc.text("IMAGEN ANALIZADA DEL PULSÓGRAFO", 12, currentY);
        currentY += 3.5;

        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(12, currentY, 186, 30, 2, 2, "FD");

        doc.addImage(evalData.imagenUrl, "PNG", 16, currentY + 3, 48, 24);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Registro Gráfico del Pulso Evaluado", 70, currentY + 8);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text("Esta imagen corresponde al registro capturado en la sala de ordeño.", 70, currentY + 14);
        doc.text("El análisis determina la estabilidad y el confort para las ubres.", 70, currentY + 19);

        currentY += 34;
      } catch (e) {
        console.warn("No se pudo incrustar la imagen en el PDF del Productor:", e);
      }
    }

    // --- Section 3: Measured Values Table for Producer ---
    if (currentY > 240) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text("TABLA DE VALORES MEDIDOS Y COMPARACIÓN ISO", 12, currentY);
    currentY += 3.5;

    const producerTableRows = isoTable.map((item) => {
      let icon = "🟢 Conforme";
      if ((item.estado as string) === "Advertencia" || (item.estado as string) === "Atención") icon = "🟡 Atención";
      if (item.estado === "Fuera de tolerancia") icon = "🔴 Desviado";
      if (item.estado === "Crítico") icon = "🔴 Crítico";

      return [
        item.canal && item.canal !== "Global" ? `[${item.canal}] ${item.parametro}` : item.parametro,
        item.valorMedido,
        item.valorPermitido,
        icon
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [["Parámetro de Pulsado", "Valor Medido", "Rango Estándar ISO", "Dictamen"]],
      body: producerTableRows,
      theme: "striped",
      styles: { cellPadding: 1.8, fontSize: 7.5 },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: "bold",
      },
      bodyStyles: {
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 35, fontStyle: "bold" },
        2: { cellWidth: 50 },
        3: { cellWidth: 41, fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const val = String(data.cell.raw);
          if (val.includes("Conforme")) data.cell.styles.textColor = [16, 185, 129];
          else if (val.includes("Atención")) data.cell.styles.textColor = [202, 138, 4];
          else if (val.includes("Desviado")) data.cell.styles.textColor = [234, 88, 12];
          else if (val.includes("Crítico")) data.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;

    // --- Section 4: Interpretation of Diagnosis ---
    if (currentY > 235) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text("INTERPRETACIÓN DEL DIAGNÓSTICO", 12, currentY);
    currentY += 4;

    const textInterp = inf.interpretacion || inf.queSignifica;
    const splitInterp = doc.splitTextToSize(textInterp, 178);
    const box1Height = Math.max(14, splitInterp.length * 3.5 + 6);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(12, currentY, 186, box1Height, 2, 2, "FD");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Impacto en la Bajada de Leche y Ordeño Diario:", 16, currentY + 5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(splitInterp, 16, currentY + 9.5);

    currentY += box1Height + 4;

    // Box 2: Health & Comfort
    if (inf.queRiesgosExisten) {
      if (currentY > 245) {
        doc.addPage();
        currentY = 16;
      }

      const splitRiesgos = doc.splitTextToSize(inf.queRiesgosExisten, 178);
      const box2Height = Math.max(14, splitRiesgos.length * 3.5 + 6);

      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(254, 202, 202);
      doc.roundedRect(12, currentY, 186, box2Height, 2, 2, "FD");

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text("Salud del Pezón y Bienestar Animal:", 16, currentY + 5);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(127, 29, 29);
      doc.text(splitRiesgos, 16, currentY + 9.5);

      currentY += box2Height + 4;
    }

    // --- Section 5: Causes and Inspection Plan for Producer ---
    const causasSencillas = inf.posiblesCausasSencillas || (res.posiblesCausasDetalladas || []).map(c => c.justificacionProductor || c.causa);
    const planSencillo = inf.planInspeccionSencillo || res.planInspeccion || [];

    if (causasSencillas.length > 0) {
      if (currentY > 240) {
        doc.addPage();
        currentY = 16;
      }
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text("POSIBLES CAUSAS Y ORIGEN DEL DESVÍO:", 12, currentY);
      currentY += 4;

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      for (const causa of causasSencillas) {
        if (currentY > 265) {
          doc.addPage();
          currentY = 16;
        }
        doc.text(`• ${causa}`, 16, currentY);
        currentY += 3.5;
      }
      currentY += 2;
    }

    if (planSencillo.length > 0) {
      if (currentY > 240) {
        doc.addPage();
        currentY = 16;
      }
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(37, 99, 235);
      doc.text("PLAN DE INSPECCIÓN RECOMENDADO EN SALA:", 12, currentY);
      currentY += 4;

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      planSencillo.forEach((step, idx) => {
        if (currentY > 265) {
          doc.addPage();
          currentY = 16;
        }
        doc.text(`${idx + 1}. ${step}`, 16, currentY);
        currentY += 3.5;
      });
      currentY += 2;
    }

    // --- Section 6: Recommendations & Actions ---
    if (currentY > 240) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text("RECOMENDACIONES DE MANTENIMIENTO Y ACCIONES:", 12, currentY);
    currentY += 4;

    const acciones = res.accionesCorrectivas || res.recomendaciones || [inf.queSeRecomiendaHacer];

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(22, 101, 52);

    for (const acc of acciones) {
      if (currentY > 265) {
        doc.addPage();
        currentY = 16;
      }
      const splitAcc = doc.splitTextToSize(`• ${acc}`, 178);
      doc.text(splitAcc, 16, currentY);
      currentY += splitAcc.length * 3.5 + 2;
    }

    currentY += 3;

    // --- Section 7: Final Conclusion ---
    if (inf.conclusionFinal) {
      if (currentY > 245) {
        doc.addPage();
        currentY = 16;
      }

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129);
      doc.text("CONCLUSIÓN FINAL DEL INFORME:", 12, currentY);
      currentY += 4;

      const splitConc = doc.splitTextToSize(inf.conclusionFinal, 178);
      const concHeight = Math.max(16, splitConc.length * 3.5 + 7);

      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(12, currentY, 186, concHeight, 2, 2, "FD");

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("Resumen General del Servicio:", 16, currentY + 5);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text(splitConc, 16, currentY + 10);

      currentY += concHeight + 4;
    }

    // --- Footer ---
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text("Informe profesional para el productor generado por GANPOR en base a Norma ISO 5707 / ISO 6690.", 12, 288);

    doc.save(`Informe_Productor_${tamboName.replace(/\s+/g, "_")}_${dateStr.replace(/\//g, "-")}.pdf`);
  } catch (err) {
    console.error("Error al generar el PDF del Productor:", err);
    alert("Error al generar el archivo PDF.");
  }
}
