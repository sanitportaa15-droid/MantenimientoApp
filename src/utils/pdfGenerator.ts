import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { EvaluacionDiagnosis } from "../types/aiDiagnosis";

/**
 * Generates and downloads the full Technical ISO PDF Report (ISO 5707 / ISO 6690)
 */
export function downloadTechnicalPdf(evalData: EvaluacionDiagnosis) {
  try {
    const doc = new jsPDF();
    const res = evalData.resultadoIA;
    const isoTable = res.evaluacionISO || [];
    const tamboName = evalData.tamboNombre || "Establecimiento";
    const dateStr = evalData.fecha ? new Date(evalData.fecha).toLocaleDateString("es-AR") : new Date().toLocaleDateString("es-AR");

    // Color theme based on state
    let stateColor: [number, number, number] = [34, 197, 94]; // Green
    if (res.estadoGeneral === "Advertencia") stateColor = [234, 179, 8]; // Yellow
    if (res.estadoGeneral === "Fuera de tolerancia") stateColor = [249, 115, 22]; // Orange
    if (res.estadoGeneral === "Crítico") stateColor = [239, 68, 68]; // Red

    // --- Header Banner ---
    doc.setFillColor(24, 24, 27); // Zinc 900
    doc.rect(0, 0, 210, 32, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("GANPOR - DIAGNÓSTICO TÉCNICO DE PULSADO", 14, 15);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(161, 161, 170); // Zinc 400
    doc.text("Evaluación Mecánica y Neumática - Normas ISO 5707:2007 e ISO 6690:2007", 14, 23);

    // --- Status Badge ---
    doc.setFillColor(stateColor[0], stateColor[1], stateColor[2]);
    doc.roundedRect(150, 8, 46, 16, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(res.estadoGeneral.toUpperCase(), 173, 18, { align: "center" });

    let currentY = 40;

    // --- Section 1: Information Block ---
    doc.setDrawColor(228, 228, 231);
    doc.setFillColor(244, 244, 245);
    doc.roundedRect(14, currentY, 182, 24, 2, 2, "FD");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(39, 39, 42);
    doc.text("Establecimiento / Tambo:", 18, currentY + 8);
    doc.text("Fecha de Análisis:", 18, currentY + 17);
    doc.text("Técnico Evaluador:", 110, currentY + 8);
    doc.text("Nivel de Criticidad:", 110, currentY + 17);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(82, 82, 91);
    doc.text(tamboName, 60, currentY + 8);
    doc.text(dateStr, 50, currentY + 17);
    doc.text(evalData.tecnicoNombre || "Técnico Especialista", 145, currentY + 8);
    doc.text(res.nivelCriticidad || "Bajo", 145, currentY + 17);

    currentY += 30;

    // Optional Image embedding
    if (evalData.imagenUrl && evalData.imagenUrl.startsWith("data:image")) {
      try {
        doc.addImage(evalData.imagenUrl, "PNG", 14, currentY, 45, 30);
        doc.setFontSize(8);
        doc.setTextColor(113, 113, 122);
        doc.text("Reporte / Pantalla Analizada", 14, currentY + 34);
        currentY += 38;
      } catch (e) {
        console.warn("Could not render image on PDF:", e);
      }
    }

    // --- Section 2: ISO Parameters Table ---
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(24, 24, 27);
    doc.text("EVALUACIÓN DE PARÁMETROS SEGÚN NORMA ISO 5707 / 6690", 14, currentY);
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
      head: [["Parámetro", "Medido", "Estándar ISO", "Desviación", "Dictamen"]],
      body: tableRows,
      theme: "striped",
      headStyles: {
        fillColor: [39, 39, 42],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [39, 39, 42],
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
          if (val === "Conforme") data.cell.styles.textColor = [34, 197, 94];
          else if (val === "Advertencia") data.cell.styles.textColor = [202, 138, 4];
          else if (val === "Fuera de tolerancia") data.cell.styles.textColor = [234, 88, 12];
          else if (val === "Crítico") data.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // --- Section 3: Possible Causes & Corrective Actions ---
    const posiblesCausas = res.posiblesCausas || [];
    const accionesCorrectivas = res.accionesCorrectivas || res.recomendaciones || [];

    if (posiblesCausas.length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text("POSIBLES CAUSAS TÉCNICAS:", 14, currentY);
      currentY += 5;

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(39, 39, 42);
      for (const causa of posiblesCausas) {
        if (currentY > 270) {
          doc.addPage();
          currentY = 20;
        }
        doc.text(`• ${causa}`, 18, currentY);
        currentY += 4.5;
      }
      currentY += 4;
    }

    if (accionesCorrectivas.length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 197, 94);
      doc.text("ACCIONES CORRECTIVAS RECOMENDADAS:", 14, currentY);
      currentY += 5;

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(39, 39, 42);
      for (const accion of accionesCorrectivas) {
        if (currentY > 270) {
          doc.addPage();
          currentY = 20;
        }
        doc.text(`• ${accion}`, 18, currentY);
        currentY += 4.5;
      }
      currentY += 6;
    }

    // --- Section 4: Non-Technical Producer Summary ---
    if (res.informeProductor) {
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFillColor(244, 244, 245);
      doc.setDrawColor(212, 212, 216);
      doc.roundedRect(14, currentY, 182, 32, 2, 2, "FD");

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(24, 24, 27);
      doc.text("RESUMEN OPERATIVO PARA EL PRODUCTOR:", 18, currentY + 6);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(63, 63, 70);
      doc.text(`¿Qué significa?: ${res.informeProductor.queSignifica}`, 18, currentY + 13, { maxWidth: 174 });
      doc.text(`Recomendación principal: ${res.informeProductor.queSeRecomiendaHacer}`, 18, currentY + 23, { maxWidth: 174 });

      currentY += 38;
    }

    // --- Footer ---
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(161, 161, 170);
    doc.text("Documento técnico de evaluación ISO 5707 / ISO 6690 generado por GANPOR. Sin marcas ni especificaciones comerciales.", 14, 288);

    doc.save(`Diagnostico_ISO_${tamboName.replace(/\s+/g, "_")}_${dateStr.replace(/\//g, "-")}.pdf`);
  } catch (err) {
    console.error("Error al generar el PDF Técnico:", err);
    alert("Error al generar el archivo PDF. Verifique los datos de la evaluación.");
  }
}

/**
 * Generates and downloads the Simplified Producer PDF Report
 */
export function downloadProducerPdf(evalData: EvaluacionDiagnosis) {
  try {
    const doc = new jsPDF();
    const res = evalData.resultadoIA;
    const inf = res.informeProductor || {
      estadoGeneral: res.estadoGeneral,
      queSignifica: res.diagnosticoTecnico,
      queRiesgosExisten: "Verifique las observaciones técnicas de la evaluación.",
      queSeRecomiendaHacer: (res.accionesCorrectivas || res.recomendaciones || []).join(". ")
    };
    const tamboName = evalData.tamboNombre || "Establecimiento";
    const dateStr = evalData.fecha ? new Date(evalData.fecha).toLocaleDateString("es-AR") : new Date().toLocaleDateString("es-AR");

    // Banner Header
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.rect(0, 0, 210, 30, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("GANPOR - INFORME SIMPLIFICADO PARA EL PRODUCTOR", 14, 15);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Establecimiento: ${tamboName}  |  Fecha: ${dateStr}`, 14, 23);

    let currentY = 40;

    // Estado Box
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(14, currentY, 182, 20, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text(`Estado del Pulsador: ${inf.estadoGeneral.toUpperCase()}`, 20, currentY + 12);

    currentY += 28;

    // Block 1: ¿Qué significa este resultado?
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129);
    doc.text("1. ¿Qué significa este resultado?", 14, currentY);
    currentY += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(55, 65, 81);
    doc.text(inf.queSignifica, 14, currentY, { maxWidth: 182 });

    currentY += 20;

    // Block 2: ¿Qué riesgos existen para las vacas?
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(225, 29, 72);
    doc.text("2. ¿Qué riesgos existen para la salud del pezón?", 14, currentY);
    currentY += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(55, 65, 81);
    doc.text(inf.queRiesgosExisten, 14, currentY, { maxWidth: 182 });

    currentY += 20;

    // Block 3: ¿Qué se recomienda hacer?
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235);
    doc.text("3. ¿Qué se recomienda hacer?", 14, currentY);
    currentY += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(55, 65, 81);
    doc.text(inf.queSeRecomiendaHacer, 14, currentY, { maxWidth: 182 });

    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(156, 163, 175);
    doc.text("Informe de lectura directa para el productor. Generado por GANPOR en base a Norma ISO 5707 / 6690.", 14, 280);

    doc.save(`Informe_Productor_${tamboName.replace(/\s+/g, "_")}_${dateStr.replace(/\//g, "-")}.pdf`);
  } catch (err) {
    console.error("Error al generar el PDF del Productor:", err);
    alert("Error al generar el archivo PDF.");
  }
}
