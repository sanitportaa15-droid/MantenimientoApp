import { PulsadorModel, EvaluacionDiagnosis, MarcaPulsador } from "../types/aiDiagnosis";

const STORAGE_KEYS = {
  PULSADORES: "ganpor_ai_pulsadores",
  EVALUACIONES: "ganpor_ai_evaluaciones",
  MARCAS: "ganpor_ai_marcas",
};

const DEFAULT_MARCAS: MarcaPulsador[] = [
  { id: "marca-rodeg", nombre: "Rodeg" },
  { id: "marca-delaval", nombre: "DeLaval" },
  { id: "marca-gea", nombre: "GEA" },
  { id: "marca-boumatic", nombre: "BouMatic" },
  { id: "marca-sac", nombre: "SAC" },
  { id: "marca-fullwood-packo", nombre: "Fullwood Packo" },
  { id: "marca-westfalia", nombre: "Westfalia" },
  { id: "marca-milkline", nombre: "Milkline" },
  { id: "marca-interpuls", nombre: "InterPuls" },
  { id: "marca-otra", nombre: "Otra" },
];

const DEFAULT_PULSADORES: PulsadorModel[] = [
  {
    id: "rodeg-rg3",
    marcaId: "marca-rodeg",
    modelo: "RG-3",
    frecuenciaNominal: 60,
    frecuenciaMinima: 58,
    frecuenciaMaxima: 62,
    relacionesPermitidas: "60/40",
    vacioRecomendado: "42 - 50 kPa",
    tolerancias: "+/- 2 ppm, +/- 2%",
    observaciones: "Pulsador neumático Rodeg RG-3 de alta confiabilidad y precisión de ordeño.",
    manualPdfUrl: "",
  },
  {
    id: "delaval-ep100",
    marcaId: "marca-delaval",
    modelo: "EP100",
    frecuenciaNominal: 60,
    frecuenciaMinima: 58,
    frecuenciaMaxima: 62,
    relacionesPermitidas: "60/40, 70/30, 50/50",
    vacioRecomendado: "42 - 48 kPa",
    tolerancias: "+/- 2 ppm, +/- 2% relación",
    observaciones: "Pulsador electrónico de alta precisión. Ampliamente utilizado en sistemas de ordeño en espina de pescado.",
    manualPdfUrl: "",
  },
  {
    id: "westfalia-apex",
    marcaId: "marca-westfalia",
    modelo: "Apex",
    frecuenciaNominal: 60,
    frecuenciaMinima: 55,
    frecuenciaMaxima: 65,
    relacionesPermitidas: "60/40, 50/50",
    vacioRecomendado: "38 - 44 kPa",
    tolerancias: "+/- 3 ppm, +/- 2.5% relación",
    observaciones: "Pulsador electrónico con válvula de diafragma de respuesta rápida. Excelente durabilidad.",
    manualPdfUrl: "",
  },
  {
    id: "boumatic-companion",
    marcaId: "marca-boumatic",
    modelo: "Companion",
    frecuenciaNominal: 60,
    frecuenciaMinima: 57,
    frecuenciaMaxima: 63,
    relacionesPermitidas: "60/40, 65/35",
    vacioRecomendado: "40 - 46 kPa",
    tolerancias: "+/- 2 ppm, +/- 1.5% relación",
    observaciones: "Excelente uniformidad de pulsado. Conexión estándar para mangueras de 1/2 pulgada.",
    manualPdfUrl: "",
  }
];

const DEFAULT_EVALUACIONES: EvaluacionDiagnosis[] = [
  {
    id: "eval-1",
    fecha: "2026-07-15T10:30:00.000Z",
    tecnicoNombre: "Santi Porta",
    tecnicoEmail: "santiportaa15@gmail.com",
    tamboId: "tambo-1",
    tamboNombre: "El Ceibo",
    equipoNombre: "Fosa 12 Bajadas",
    tipoDiagnostico: "Pulsógrafo",
    pulsadorId: "delaval-ep100",
    pulsadorMarca: "DeLaval",
    pulsadorModelo: "EP100",
    imagenUrl: "",
    estado: "Aprobado",
    informeSimplificado: "La evaluación del pulsador DeLaval EP100 en El Ceibo arrojó excelentes resultados. Se midió una frecuencia de 59.8 ppm (nominal 60 ppm) y una relación de 59.5/40.5, valores que están perfectamente dentro de los parámetros recomendados para evitar daño en los pezones.",
    resultadoIA: {
      estadoGeneral: "Conforme",
      nivelCriticidad: "Bajo",
      nivelConfianza: 96,
      calidadImagen: "Alta",
      datosExtraidos: {
        frecuenciaMedida: 59.8,
        relacionMedida: "59.5/40.5",
        vacioMedido: "44.5 kPa",
      },
      comparacionEspecificaciones: "La frecuencia medida (59.8 ppm) está dentro de la tolerancia permitida (+/- 2 ppm) con respecto al nominal (60 ppm). La relación de pulsación medida (59.5/40.5) coincide casi exactamente con la relación permitida de 60/40.",
      hallazgos: [
        "Curva de transición (fase b y d) con pendiente uniforme y suave.",
        "Vacío estable durante la fase de ordeño.",
        "Ausencia de filtraciones en la línea de pulsado."
      ],
      diagnosticoTecnico: "El pulsador EP100 opera bajo condiciones óptimas de trabajo. Se observa una excelente correspondencia entre los tiempos de ordeño y masaje, garantizando una correcta estimulación y salud de la ubre.",
      posiblesCausas: [],
      recomendaciones: [
        "Mantener el plan de mantenimiento preventivo semestral.",
        "Limpieza rutinaria de los filtros de aire del pulsador."
      ],
    },
  },
  {
    id: "eval-2",
    fecha: "2026-07-18T15:45:00.000Z",
    tecnicoNombre: "Santi Porta",
    tecnicoEmail: "santiportaa15@gmail.com",
    tamboId: "tambo-2",
    tamboNombre: "La Querencia",
    equipoNombre: "Línea Media 8 Bajadas",
    tipoDiagnostico: "Pulsógrafo",
    pulsadorId: "westfalia-apex",
    pulsadorMarca: "Westfalia",
    pulsadorModelo: "Apex",
    imagenUrl: "",
    estado: "Pendiente",
    resultadoIA: {
      estadoGeneral: "Advertencia",
      nivelCriticidad: "Medio",
      nivelConfianza: 89,
      calidadImagen: "Alta",
      datosExtraidos: {
        frecuenciaMedida: 66.2,
        relacionMedida: "67/33",
        vacioMedido: "45.0 kPa",
      },
      comparacionEspecificaciones: "La frecuencia medida (66.2 ppm) excede el máximo nominal permitido de 65 ppm. La relación de pulsación medida (67/33) se desvía del estándar configurado de 60/40, acortando significativamente la fase de masaje (fase d).",
      hallazgos: [
        "Frecuencia de pulsado elevada (66.2 ppm frente a los 60 ppm nominales).",
        "Tiempos de masaje deficientes (33% en lugar de 40%).",
        "Nivel de vacío en el límite superior recomendado (45 kPa)."
      ],
      diagnosticoTecnico: "La sobrefrecuencia y la distorsión de la relación de pulsado limitan el tiempo disponible para el masaje y descanso del pezón. Esto puede originar hiperqueratosis en la punta del pezón e incrementar la tasa de mastitis subclínica si no se corrige prontamente.",
      posiblesCausas: [
        "Falla o descalibración de la tarjeta electrónica de control.",
        "Suciedad acumulada en el solenoide o restrictor de aire.",
        "Filtros de aire obstruidos."
      ],
      recomendaciones: [
        "Calibrar la tarjeta de control para restablecer la frecuencia a 60 ppm.",
        "Desarmar y limpiar el solenoide del pulsador con alcohol isopropílico.",
        "Reemplazar el cartucho de filtro de aire del pulsador.",
        "Volver a medir y evaluar con pulsógrafo tras el mantenimiento."
      ],
    },
  }
];

export const aiDiagnosisStorage = {
  getMarcas(): MarcaPulsador[] {
    const data = localStorage.getItem(STORAGE_KEYS.MARCAS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.MARCAS, JSON.stringify(DEFAULT_MARCAS));
      return DEFAULT_MARCAS;
    }
    try {
      const parsed: MarcaPulsador[] = JSON.parse(data);
      let modified = false;
      DEFAULT_MARCAS.forEach(dm => {
        if (!parsed.some(p => p.nombre.toLowerCase() === dm.nombre.toLowerCase())) {
          parsed.push(dm);
          modified = true;
        }
      });
      if (modified) {
        localStorage.setItem(STORAGE_KEYS.MARCAS, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return DEFAULT_MARCAS;
    }
  },

  getPulsadores(): PulsadorModel[] {
    const marcas = this.getMarcas();
    const data = localStorage.getItem(STORAGE_KEYS.PULSADORES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.PULSADORES, JSON.stringify(DEFAULT_PULSADORES));
      return DEFAULT_PULSADORES;
    }
    try {
      const parsed: any[] = JSON.parse(data);
      let needsMigration = false;

      const migratedList: PulsadorModel[] = parsed.map((item) => {
        if (item.marcaId) {
          return item as PulsadorModel;
        }

        needsMigration = true;
        const oldMarcaName = item.marca || "Otra";
        let foundBrand = marcas.find(m => m.nombre.toLowerCase() === oldMarcaName.toLowerCase());
        if (!foundBrand) {
          foundBrand = marcas.find(m => m.nombre.toLowerCase() === "otra");
        }

        const { marca, ...rest } = item;
        return {
          ...rest,
          marcaId: foundBrand ? foundBrand.id : "marca-otra",
        } as PulsadorModel;
      });

      if (needsMigration) {
        localStorage.setItem(STORAGE_KEYS.PULSADORES, JSON.stringify(migratedList));
      }

      const hasRodeg = migratedList.some(p => p.id === "rodeg-rg3" || (p.marcaId === "marca-rodeg" && p.modelo.toLowerCase() === "rg-3"));
      if (!hasRodeg) {
        const rodeg = DEFAULT_PULSADORES.find(p => p.id === "rodeg-rg3");
        if (rodeg) {
          migratedList.unshift(rodeg);
          localStorage.setItem(STORAGE_KEYS.PULSADORES, JSON.stringify(migratedList));
        }
      }

      return migratedList;
    } catch {
      return DEFAULT_PULSADORES;
    }
  },

  addPulsador(pulsador: Omit<PulsadorModel, "id"> & { id?: string }): PulsadorModel {
    const list = this.getPulsadores();
    const newPulsador: PulsadorModel = {
      ...pulsador,
      id: pulsador.id || `pulsador_${Date.now()}`,
    };
    list.push(newPulsador);
    localStorage.setItem(STORAGE_KEYS.PULSADORES, JSON.stringify(list));
    return newPulsador;
  },

  updatePulsador(id: string, updatedData: Partial<PulsadorModel>): PulsadorModel {
    const list = this.getPulsadores();
    const index = list.findIndex(p => p.id === id);
    if (index === -1) throw new Error("Pulsador no encontrado");
    
    const updated = { ...list[index], ...updatedData };
    list[index] = updated;
    localStorage.setItem(STORAGE_KEYS.PULSADORES, JSON.stringify(list));
    return updated;
  },

  deletePulsador(id: string): void {
    const list = this.getPulsadores();
    const filtered = list.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PULSADORES, JSON.stringify(filtered));
  },

  getEvaluaciones(): EvaluacionDiagnosis[] {
    const data = localStorage.getItem(STORAGE_KEYS.EVALUACIONES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.EVALUACIONES, JSON.stringify(DEFAULT_EVALUACIONES));
      return DEFAULT_EVALUACIONES;
    }
    try {
      return JSON.parse(data);
    } catch {
      return DEFAULT_EVALUACIONES;
    }
  },

  addEvaluacion(evaluacion: EvaluacionDiagnosis): void {
    const list = this.getEvaluaciones();
    list.unshift(evaluacion);
    localStorage.setItem(STORAGE_KEYS.EVALUACIONES, JSON.stringify(list));
  },

  saveEvaluacion(evaluacion: EvaluacionDiagnosis): void {
    this.addEvaluacion(evaluacion);
  },

  updateEvaluacion(id: string, updatedData: Partial<EvaluacionDiagnosis>): EvaluacionDiagnosis {
    const list = this.getEvaluaciones();
    const index = list.findIndex(e => e.id === id);
    if (index === -1) throw new Error("Evaluación no encontrada");

    const updated = { ...list[index], ...updatedData };
    list[index] = updated;
    localStorage.setItem(STORAGE_KEYS.EVALUACIONES, JSON.stringify(list));
    return updated;
  },

  deleteEvaluacion(id: string): void {
    const list = this.getEvaluaciones();
    const filtered = list.filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.EVALUACIONES, JSON.stringify(filtered));
  }
};
