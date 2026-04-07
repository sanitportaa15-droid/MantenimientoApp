import React, { useState, useEffect } from "react";
import { XCircle, Save, Plus, Trash2 } from "lucide-react";
import { db } from "../services/db";
import { Relevo, Tambo } from "../types/supabase";
import { cn } from "../utils/ui";

interface RelevoModalProps {
  tamboId?: string;
  relevo?: Relevo | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface CustomField {
  label: string;
  value: string;
}

export default function RelevoModal({ tamboId: initialTamboId, relevo, onClose, onSuccess }: RelevoModalProps) {
  const [loading, setLoading] = useState(false);
  const [tambos, setTambos] = useState<(Tambo & { clientes: { nombre: string } })[]>([]);
  const [selectedTamboId, setSelectedTamboId] = useState(initialTamboId || "");
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [tipoPezoneras, setTipoPezoneras] = useState("");
  const [tipoPulsadores, setTipoPulsadores] = useState("");
  const [tipoEquipo, setTipoEquipo] = useState("");
  const [marcaEquipo, setMarcaEquipo] = useState("");
  const [bajadas, setBajadas] = useState<number | "">("");
  const [vacasEnOrdene, setVacasEnOrdene] = useState<number | "">("");
  const [ordenesPorDia, setOrdenesPorDia] = useState<number | "">("");
  const [observaciones, setObservaciones] = useState("");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  useEffect(() => {
    db.tambos.getAll().then(setTambos).catch(console.error);
  }, []);

  // Auto-complete logic
  useEffect(() => {
    if (selectedTamboId && !relevo) {
      const tambo = tambos.find(t => t.id === selectedTamboId);
      if (tambo) {
        setBajadas(tambo.bajadas);
        setVacasEnOrdene(tambo.vacas_en_ordene);
        setOrdenesPorDia(tambo.ordenes_por_dia);
        setTipoPezoneras(tambo.marca_pezonera || "");
      }
    }
  }, [selectedTamboId, tambos, relevo]);

  useEffect(() => {
    if (relevo) {
      setSelectedTamboId(relevo.tambo_id);
      setFecha(relevo.fecha_relevo);
      setTipoPezoneras(relevo.tipo_pezoneras || "");
      setTipoPulsadores(relevo.tipo_pulsadores || "");
      setTipoEquipo(relevo.tipo_equipo || "");
      setMarcaEquipo(relevo.marca_equipo || "");
      setBajadas(relevo.bajadas || "");
      setVacasEnOrdene(relevo.vacas_en_ordene || "");
      setOrdenesPorDia(relevo.ordenes_por_dia || "");
      setObservaciones(relevo.observaciones || "");
      
      if (relevo.datos_extra) {
        try {
          const fields = typeof relevo.datos_extra === 'string' 
            ? JSON.parse(relevo.datos_extra) 
            : relevo.datos_extra;
          if (Array.isArray(fields)) {
            setCustomFields(fields);
          }
        } catch (e) {
          console.error("Error parsing custom fields:", e);
        }
      }
    }
  }, [relevo]);

  const addCustomField = () => {
    setCustomFields([...customFields, { label: "", value: "" }]);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const updateCustomField = (index: number, field: keyof CustomField, value: string) => {
    const newFields = [...customFields];
    newFields[index][field] = value;
    setCustomFields(newFields);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!selectedTamboId) {
      alert("Por favor, seleccione un tambo.");
      return;
    }

    setLoading(true);

    try {
      const data = {
        tambo_id: selectedTamboId,
        fecha_relevo: fecha,
        tipo_pezoneras: tipoPezoneras.trim() || null,
        tipo_pulsadores: tipoPulsadores.trim() || null,
        tipo_equipo: tipoEquipo.trim() || null,
        marca_equipo: marcaEquipo.trim() || null,
        bajadas: bajadas === "" ? null : Number(bajadas),
        vacas_en_ordene: vacasEnOrdene === "" ? null : Number(vacasEnOrdene),
        ordenes_por_dia: ordenesPorDia === "" ? null : Number(ordenesPorDia),
        observaciones: observaciones.trim() || null,
        datos_extra: customFields.length > 0 ? customFields : null
      };

      if (relevo) {
        await db.relevos.update(relevo.id, data);
      } else {
        await db.relevos.create(data);
      }
      onSuccess();
    } catch (error) {
      console.error("Error saving relevo:", error);
      alert("Error al guardar el relevo técnico.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0f0f0f] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-2xl font-bold">{relevo ? "Editar Relevo Técnico" : "Nuevo Relevo Técnico"}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <XCircle className="w-6 h-6 text-zinc-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Seleccionar Tambo</label>
              <select
                required
                value={selectedTamboId}
                onChange={(e) => setSelectedTamboId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="" className="bg-[#0f0f0f]">Seleccionar tambo...</option>
                {tambos.map(t => (
                  <option key={t.id} value={t.id} className="bg-[#0f0f0f]">
                    {t.nombre} - {t.clientes.nombre}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Fecha del Relevo</label>
              <input
                required
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Tipo de Equipo</label>
              <input
                type="text"
                value={tipoEquipo}
                onChange={(e) => setTipoEquipo(e.target.value)}
                placeholder="Ej: Espina de pescado, Rotativo..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Marca del Equipo</label>
              <input
                type="text"
                value={marcaEquipo}
                onChange={(e) => setMarcaEquipo(e.target.value)}
                placeholder="Marca del equipo..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Tipo de Pezoneras</label>
              <input
                type="text"
                value={tipoPezoneras}
                onChange={(e) => setTipoPezoneras(e.target.value)}
                placeholder="Modelo o tipo..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Tipo de Pulsadores</label>
              <input
                type="text"
                value={tipoPulsadores}
                onChange={(e) => setTipoPulsadores(e.target.value)}
                placeholder="Modelo o tipo..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Cantidad de Bajadas</label>
              <input
                type="number"
                value={bajadas}
                onChange={(e) => setBajadas(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Número de bajadas..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Vacas en Ordeñe</label>
              <input
                type="number"
                value={vacasEnOrdene}
                onChange={(e) => setVacasEnOrdene(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Número de vacas..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Ordeños por Día</label>
              <input
                type="number"
                value={ordenesPorDia}
                onChange={(e) => setOrdenesPorDia(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Ej: 2 o 3..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Campos Personalizados</label>
              <button
                type="button"
                onClick={addCustomField}
                className="flex items-center gap-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Agregar Campo
              </button>
            </div>
            
            <div className="space-y-3">
              {customFields.map((field, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateCustomField(index, "label", e.target.value)}
                    placeholder="Nombre (Ej: Vacío)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <input
                    type="text"
                    value={field.value}
                    onChange={(e) => updateCustomField(index, "value", e.target.value)}
                    placeholder="Valor (Ej: 42 kPa)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => removeCustomField(index)}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {customFields.length === 0 && (
                <p className="text-xs text-zinc-600 italic">No hay campos personalizados agregados.</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Observaciones Generales</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              placeholder="Estado general, notas técnicas..."
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
              disabled={loading}
              type="submit"
              className="flex-[2] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {relevo ? "Actualizar Relevo" : "Guardar Relevo Técnico"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
