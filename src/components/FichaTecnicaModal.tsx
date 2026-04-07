import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, Settings, Wrench } from "lucide-react";
import { db } from "../services/db";
import { FichaTecnica, Tambo, Componente } from "../types/supabase";
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
    datos_extra: {}
  });

  const [componentes, setComponentes] = useState<{ tipo: string, cantidad: number }[]>([]);
  const [customFields, setCustomFields] = useState<{ label: string, value: string }[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [tamboData, fichaData, componentesData] = await Promise.all([
          db.tambos.getById(tamboId),
          db.ficha_tecnica.getByTambo(tamboId),
          db.componentes.getByTambo(tamboId)
        ]);

        setTambo(tamboData);
        setComponentes(componentesData.map(c => ({ tipo: c.tipo, cantidad: c.cantidad })));

        if (fichaData) {
          setFicha(fichaData);
          if (fichaData.datos_extra && typeof fichaData.datos_extra === 'object' && !Array.isArray(fichaData.datos_extra)) {
            const fields = Object.entries(fichaData.datos_extra).map(([label, value]) => ({
              label,
              value: String(value)
            }));
            setCustomFields(fields);
          }
        } else {
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

  const addComponente = () => {
    setComponentes([...componentes, { tipo: "", cantidad: 1 }]);
  };

  const updateComponente = (index: number, field: 'tipo' | 'cantidad', value: string | number) => {
    const newComps = [...componentes];
    (newComps[index] as any)[field] = value;
    setComponentes(newComps);
  };

  const removeComponente = (index: number) => {
    setComponentes(componentes.filter((_, i) => i !== index));
  };

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
      // Convert custom fields array to object
      const datosExtra: Record<string, string> = {};
      customFields.forEach(f => {
        if (f.label.trim()) {
          datosExtra[f.label.trim()] = f.value;
        }
      });

      const dataToSave = {
        ...ficha,
        tambo_id: tamboId,
        datos_extra: datosExtra
      };

      // Save ficha técnica
      await db.ficha_tecnica.upsert(dataToSave as any);

      // Save componentes (delete old ones first to keep it simple)
      await db.componentes.deleteByTambo(tamboId);
      const validComps = componentes.filter(c => c.tipo.trim());
      if (validComps.length > 0) {
        await db.componentes.createMany(validComps.map(c => ({
          tambo_id: tamboId,
          tipo: c.tipo.trim(),
          cantidad: c.cantidad
        })));
      }

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
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Settings className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Ficha Técnica</h3>
              <p className="text-sm text-zinc-500">{tambo?.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Basic Info */}
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
          </div>

          {/* Componentes Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400">Componentes del Equipo</h4>
              </div>
              <button
                type="button"
                onClick={addComponente}
                className="flex items-center gap-2 text-xs font-bold bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Agregar componente
              </button>
            </div>

            <div className="space-y-3">
              {componentes.map((comp, index) => (
                <div key={index} className="flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      value={comp.tipo}
                      onChange={(e) => updateComponente(index, 'tipo', e.target.value)}
                      placeholder="Tipo (Ej: Pulsadores)"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <input
                      type="number"
                      value={comp.cantidad}
                      onChange={(e) => updateComponente(index, 'cantidad', parseInt(e.target.value) || 0)}
                      placeholder="Cant."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeComponente(index)}
                    className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {componentes.length === 0 && (
                <p className="text-center py-4 text-zinc-600 text-sm italic border border-dashed border-white/5 rounded-2xl">No hay componentes registrados.</p>
              )}
            </div>
          </div>

          {/* Custom Fields Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400">Campos Personalizados</h4>
              </div>
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
                <p className="text-center py-4 text-zinc-600 text-sm italic border border-dashed border-white/5 rounded-2xl">No hay campos personalizados agregados.</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Observaciones Generales</label>
            <textarea
              value={ficha.observaciones || ""}
              onChange={(e) => setFicha({ ...ficha, observaciones: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors min-h-[100px]"
              placeholder="Notas adicionales sobre el equipo..."
            />
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
