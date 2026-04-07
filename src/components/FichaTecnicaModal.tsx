import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Save } from "lucide-react";
import { db } from "../services/db";
import { FichaTecnica, Tambo } from "../types/supabase";
import { cn } from "../utils/ui";

interface FichaTecnicaModalProps {
  tamboId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FichaTecnicaModal({ tamboId, onClose, onSuccess }: FichaTecnicaModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tambo, setTambo] = useState<Tambo | null>(null);
  const [ficha, setFicha] = useState<Partial<FichaTecnica>>({
    tambo_id: tamboId,
    bajadas: 0,
    tipo_pezoneras: "",
    marca_pezoneras: "",
    tipo_pulsadores: "",
    tipo_bomba_leche: "",
    tipo_bomba_vacio: "",
    tipo_equipo: "",
    observaciones: "",
    datos_extra: []
  });

  const [customFields, setCustomFields] = useState<{ label: string, value: string }[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [tamboData, fichaData] = await Promise.all([
          db.tambos.getById(tamboId),
          db.ficha_tecnica.getByTambo(tamboId)
        ]);

        setTambo(tamboData);
        if (fichaData) {
          setFicha(fichaData);
          if (fichaData.datos_extra && Array.isArray(fichaData.datos_extra)) {
            setCustomFields(fichaData.datos_extra as any);
          }
        } else {
          // Default values from tambo if ficha doesn't exist
          setFicha(prev => ({
            ...prev,
            bajadas: tamboData.bajadas,
            marca_pezoneras: tamboData.marca_pezonera
          }));
        }
      } catch (error) {
        console.error("Error loading ficha técnica:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [tamboId]);

  const addCustomField = () => {
    setCustomFields([...customFields, { label: "", value: "" }]);
  };

  const updateCustomField = (index: number, field: 'label' | 'value', value: string) => {
    const newFields = [...customFields];
    newFields[index][field] = value;
    setCustomFields(newFields);
  };

  const removeCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const dataToSave = {
        ...ficha,
        tambo_id: tamboId,
        datos_extra: customFields.filter(f => f.label.trim() !== "")
      };

      await db.ficha_tecnica.upsert(dataToSave as any);
      onSuccess();
    } catch (error) {
      console.error("Error saving ficha técnica:", error);
      alert("Error al guardar la ficha técnica");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#0f0f0f] border border-white/10 rounded-3xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0f0f0f] border border-white/10 rounded-3xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div>
            <h3 className="text-xl font-bold">Ficha Técnica</h3>
            <p className="text-sm text-zinc-500">{tambo?.nombre}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Cantidad de Bajadas</label>
              <input
                type="number"
                value={ficha.bajadas || ""}
                onChange={(e) => setFicha({ ...ficha, bajadas: parseInt(e.target.value) || 0 })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors"
                placeholder="Ej: 12"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tipo de Equipo</label>
              <select
                value={ficha.tipo_equipo || ""}
                onChange={(e) => setFicha({ ...ficha, tipo_equipo: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none"
              >
                <option value="">Seleccionar tipo</option>
                <option value="Espina de pescado">Espina de pescado</option>
                <option value="Brete a la par">Brete a la par</option>
                <option value="Tándem">Tándem</option>
                <option value="Rotativo">Rotativo</option>
                <option value="Línea media">Línea media</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tipo de Pezoneras</label>
              <input
                type="text"
                value={ficha.tipo_pezoneras || ""}
                onChange={(e) => setFicha({ ...ficha, tipo_pezoneras: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors"
                placeholder="Ej: Irlanda"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Marca de Pezoneras</label>
              <input
                type="text"
                value={ficha.marca_pezoneras || ""}
                onChange={(e) => setFicha({ ...ficha, marca_pezoneras: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors"
                placeholder="Ej: Milkrite"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tipo de Pulsadores</label>
              <input
                type="text"
                value={ficha.tipo_pulsadores || ""}
                onChange={(e) => setFicha({ ...ficha, tipo_pulsadores: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors"
                placeholder="Ej: Electrónicos"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Bomba de Leche</label>
              <input
                type="text"
                value={ficha.tipo_bomba_leche || ""}
                onChange={(e) => setFicha({ ...ficha, tipo_bomba_leche: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors"
                placeholder="Ej: Centrífuga"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Bomba de Vacío</label>
              <input
                type="text"
                value={ficha.tipo_bomba_vacio || ""}
                onChange={(e) => setFicha({ ...ficha, tipo_bomba_vacio: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors"
                placeholder="Ej: 1500 lts"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Observaciones</label>
            <textarea
              value={ficha.observaciones || ""}
              onChange={(e) => setFicha({ ...ficha, observaciones: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors min-h-[100px]"
              placeholder="Notas adicionales sobre el equipo..."
            />
          </div>

          {/* Custom Fields */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400">Campos Personalizados</h4>
              <button
                type="button"
                onClick={addCustomField}
                className="flex items-center gap-2 text-xs font-bold bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Agregar campo
              </button>
            </div>

            <div className="space-y-3">
              {customFields.map((field, index) => (
                <div key={index} className="flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-200">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateCustomField(index, 'label', e.target.value)}
                    placeholder="Nombre (Ej: Vacío)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                  <input
                    type="text"
                    value={field.value}
                    onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                    placeholder="Valor (Ej: 42 kPa)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => removeCustomField(index)}
                    className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {customFields.length === 0 && (
                <p className="text-center py-4 text-zinc-600 text-sm italic">No hay campos personalizados agregados.</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-zinc-400 hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-black px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Guardar Ficha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
