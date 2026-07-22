import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { EvaluacionDiagnosis } from "../types/aiDiagnosis";

/**
 * Helper to determine state colors
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

    // --- Header Banner (GanPor Institutional Emerald Green) ---
    doc.setFillColor(16, 185, 129); // #10B981
    doc.rect(0, 0, 210, 32, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("GANPOR - EVALUACIÓN TÉCNICA DE PULSADO ISO", 14, 15);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Informe Técnico de Pulsado - Normas ISO 5707:2007 / ISO 6690:2007", 14, 23);

    // Header Status Badge
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(148, 7, 48, 18, 3, 3, "F");
    doc.setFillColor(stateTheme.rgb[0], stateTheme.rgb[1], stateTheme.rgb[2]);
    doc.roundedRect(149, 8, 46, 16, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(stateTheme.badgeLabel, 172, 18, { align: "center" });

    let currentY = 40;

    // --- Section 1: Information Block ---
    doc.setDrawColor(228, 228, 231);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, currentY, 182, 24, 2, 2, "FD");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Establecimiento / Tambo:", 18, currentY + 8);
    doc.text("Fecha de Evaluación:", 18, currentY + 17);
    doc.text("Técnico Evaluador:", 110, currentY + 8);
    doc.text("Nivel de Criticidad:", 110, currentY + 17);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(tamboName, 60, currentY + 8);
    doc.text(dateStr, 53, currentY + 17);
    doc.text(evalData.tecnicoNombre || "Técnico Especialista", 145, currentY + 8);
    doc.text(res.nivelCriticidad || "Bajo", 145, currentY + 17);

    currentY += 30;

    // --- Section 2: Pulsograph Image (if available) ---
    if (evalData.imagenUrl && evalData.imagenUrl.startsWith("data:image")) {
      try {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(16, 185, 129);
        doc.text("IMAGEN / GRÁFICO DEL PULSÓGRAFO ANALIZADO", 14, currentY);
        currentY += 4;

        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(14, currentY, 182, 44, 2, 2, "FD");

        doc.addImage(evalData.imagenUrl, "PNG", 18, currentY + 4, 60, 36);

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Registro Digital del Pulso", 85, currentY + 12);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text("Captura analizada por el Motor de Reglas ISO GanPor.", 85, currentY + 18);
        doc.text("Parámetros extraídos: Frecuencia, Relación, Tiempos ta, tb, tc, td, Vacío.", 85, currentY + 24);

        currentY += 50;
      } catch (e) {
        console.warn("No se pudo incrustar la imagen en el PDF Técnico:", e);
      }
    }

    // --- Section 3: ISO Parameters Table ---
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text("PARÁMETROS EVALUADOS SEGÚN NORMA ISO 5707 / 6690", 14, currentY);
    currentY += 4;

    const tableRows = isoTable.map((item) => [
      item.parametro,
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
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30, fontStyle: "bold" },
        2: { cellWidth: 45 },
        3: { cellWidth: 25 },
        4: { cellWidth: 32, fontStyle: "bold" },
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

    currentY = (doc as any).lastAutoTable.finalY + 8;

    // --- Section 4: Causes & Actions ---
    const posiblesCausas = res.posiblesCausas || [];
    const accionesCorrectivas = res.accionesCorrectivas || res.recomendaciones || [];

    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    if (posiblesCausas.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text("POSIBLES CAUSAS TÉCNICAS:", 14, currentY);
      currentY += 4.5;

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      for (const causa of posiblesCausas) {
        if (currentY > 270) {
          doc.addPage();
          currentY = 20;
        }
        doc.text(`• ${causa}`, 18, currentY);
        currentY += 4;
      }
      currentY += 3;
    }

    if (accionesCorrectivas.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129);
      doc.text("ACCIONES CORRECTIVAS RECOMENDADAS:", 14, currentY);
      currentY += 4.5;

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      for (const accion of accionesCorrectivas) {
        if (currentY > 270) {
          doc.addPage();
          currentY = 20;
        }
        doc.text(`• ${accion}`, 18, currentY);
        currentY += 4;
      }
      currentY += 5;
    }

    // --- Section 5: Final Conclusion ---
    if (res.informeProductor?.conclusionFinal) {
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, currentY, 182, 24, 2, 2, "FD");

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("DICTAMEN Y CONCLUSIÓN FINAL DE EVALUACIÓN:", 18, currentY + 6);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      const splitConclusion = doc.splitTextToSize(res.informeProductor.conclusionFinal, 174);
      doc.text(splitConclusion, 18, currentY + 12);

      currentY += 28;
    }

    // Footer
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text("Documento técnico de evaluación ISO 5707 / ISO 6690 generado por GANPOR. Evaluación profesional imparcial.", 14, 288);

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

    // --- Header Banner (GanPor Institutional Emerald Green) ---
    doc.setFillColor(16, 185, 129); // #10B981
    doc.rect(0, 0, 210, 32, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("GANPOR - INFORME DE PULSADO PARA EL PRODUCTOR", 14, 15);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Evaluación del Sistema de Pulsación - Normas ISO 5707 / ISO 6690", 14, 23);

    // Header Status Badge
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(148, 7, 48, 18, 3, 3, "F");
    doc.setFillColor(stateTheme.rgb[0], stateTheme.rgb[1], stateTheme.rgb[2]);
    doc.roundedRect(149, 8, 46, 16, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(stateTheme.badgeLabel, 172, 18, { align: "center" });

    let currentY = 40;

    // --- Section 1: Information Block ---
    doc.setDrawColor(228, 228, 231);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, currentY, 182, 24, 2, 2, "FD");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Establecimiento / Tambo:", 18, currentY + 8);
    doc.text("Fecha de Evaluación:", 18, currentY + 17);
    doc.text("Evaluador:", 110, currentY + 8);
    doc.text("Estado del Pulsador:", 110, currentY + 17);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(tamboName, 60, currentY + 8);
    doc.text(dateStr, 53, currentY + 17);
    doc.text(evalData.tecnicoNombre || "Técnico Especialista", 130, currentY + 8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(stateTheme.rgb[0], stateTheme.rgb[1], stateTheme.rgb[2]);
    doc.text(res.estadoGeneral, 148, currentY + 17);

    currentY += 30;

    // --- Section 2: Pulsograph Image (if available) ---
    if (evalData.imagenUrl && evalData.imagenUrl.startsWith("data:image")) {
      try {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(16, 185, 129);
        doc.text("IMAGEN ANALIZADA DEL PULSÓGRAFO", 14, currentY);
        currentY += 4;

        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(14, currentY, 182, 44, 2, 2, "FD");

        doc.addImage(evalData.imagenUrl, "PNG", 18, currentY + 4, 60, 36);

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Gráfico del Pulso Evaluado", 85, currentY + 12);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text("Esta imagen corresponde al registro capturado en la sala de ordeño.", 85, currentY + 18);
        doc.text("El diagnóstico evalúa si las fases de ordeño y descanso protegen la ubre.", 85, currentY + 24);

        currentY += 50;
      } catch (e) {
        console.warn("No se pudo incrustar la imagen en el PDF del Productor:", e);
      }
    }

    // --- Section 3: Measured Values Table for Producer ---
    if (currentY > 220) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text("TABLA DE VALORES MEDIDOS Y ESTADO", 14, currentY);
    currentY += 4;

    const producerTableRows = isoTable.map((item) => {
      let icon = "🟢 Conforme";
      if ((item.estado as string) === "Advertencia" || (item.estado as string) === "Atención") icon = "🟡 Atención";
      if (item.estado === "Fuera de tolerancia") icon = "🔴 Desviado";
      if (item.estado === "Crítico") icon = "🔴 Crítico";

      return [
        item.parametro,
        item.valorMedido,
        item.valorPermitido,
        icon
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [["Parámetro de Pulsado", "Valor Medido", "Rango Estándar ISO", "Estado"]],
      body: producerTableRows,
      theme: "striped",
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 35, fontStyle: "bold" },
        2: { cellWidth: 50 },
        3: { cellWidth: 37, fontStyle: "bold" },
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

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // --- Section 4: Interpretation of Diagnosis ---
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text("INTERPRETACIÓN DEL DIAGNÓSTICO", 14, currentY);
    currentY += 5;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);

    // Box 1: ¿Qué significa?
    const textInterp = inf.interpretacion || inf.queSignifica;
    const splitInterp = doc.splitTextToSize(textInterp, 172);
    const box1Height = Math.max(18, splitInterp.length * 4.5 + 8);

    doc.roundedRect(14, currentY, 182, box1Height, 2, 2, "FD");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("¿Cómo impacta en el ordeño diario?:", 18, currentY + 6);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(splitInterp, 18, currentY + 12);

    currentY += box1Height + 6;

    // Box 2: Riesgos para la salud
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    const textRiesgos = inf.queRiesgosExisten;
    const splitRiesgos = doc.splitTextToSize(textRiesgos, 172);
    const box2Height = Math.max(18, splitRiesgos.length * 4.5 + 8);

    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(14, currentY, 182, box2Height, 2, 2, "FD");

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text("Salud de la Ubre y Bienestar Animal:", 18, currentY + 6);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(127, 29, 29);
    doc.text(splitRiesgos, 18, currentY + 12);

    currentY += box2Height + 8;

    // --- Section 5: Recommendations & Actions ---
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text("RECOMENDACIONES DE MANTENIMIENTO Y ACCIONES", 14, currentY);
    currentY += 5;

    const acciones = res.accionesCorrectivas || res.recomendaciones || [inf.queSeRecomiendaHacer];

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(22, 101, 52);

    for (const acc of acciones) {
      const splitAcc = doc.splitTextToSize(`• ${acc}`, 172);
      const accHeight = splitAcc.length * 4.5 + 4;

      if (currentY + accHeight > 270) {
        doc.addPage();
        currentY = 20;
      }

      doc.roundedRect(14, currentY, 182, accHeight, 2, 2, "FD");
      doc.text(splitAcc, 18, currentY + 5);
      currentY += accHeight + 3;
    }

    currentY += 5;

    // --- Section 6: Final Conclusion ---
    if (inf.conclusionFinal) {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129);
      doc.text("CONCLUSIÓN FINAL DEL INFORME", 14, currentY);
      currentY += 5;

      const splitConc = doc.splitTextToSize(inf.conclusionFinal, 172);
      const concHeight = Math.max(20, splitConc.length * 4.5 + 8);

      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, currentY, 182, concHeight, 2, 2, "FD");

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("Resumen General del Servicio:", 18, currentY + 6);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text(splitConc, 18, currentY + 12);

      currentY += concHeight + 8;
    }

    // --- Footer ---
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text("Informe profesional para el productor generado por GANPOR en base a Norma ISO 5707 / ISO 6690.", 14, 288);

    doc.save(`Informe_Productor_${tamboName.replace(/\s+/g, "_")}_${dateStr.replace(/\//g, "-")}.pdf`);
  } catch (err) {
    console.error("Error al generar el PDF del Productor:", err);
    alert("Error al generar el archivo PDF.");
  }
}
