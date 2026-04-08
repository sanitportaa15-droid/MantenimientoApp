import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, Settings, Wrench, Package } from "lucide-react";
import { db } from "../services/db";
import { FichaTecnica, Tambo, Componente, TamboComponente, Insumo, TamboInsumo } from "../types/supabase";
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
  const [catalogComponentes, setCatalogComponentes] = useState<Componente[]>([]);
  const [catalogInsumos, setCatalogInsumos] = useState<Insumo[]>([]);
  const [ficha, setFicha] = useState<Partial<FichaTecnica & { tiene_brazos_extractores: boolean }>>({
    tambo_id: tamboId,
    bajadas: 0,
    tiene_brazos_extractores: false,
    tipo_pulsadores: "",
    tipo_bomba_leche: "",
    tipo_bomba_vacio: "",
    bomba_leche_marca: "",
    bomba_leche_tiene_sello: false,
    bomba_leche_tiene_diafragma: false,
    bomba_leche_tiene_turbina: false,
    bomba_vacio_marca: "",
    bomba_vacio_polea: "",
    bomba_vacio_vueltas: "",
    usa_sogas: false,
    usa_diafragmas_brazos: false,
    usa_bujes: false,
    usa_colector_leche: false,
    tipo_equipo: "",
    observaciones: "",
    datos_extra: {}
  });

  const [tamboComponentes, setTamboComponentes] = useState<{ componente_id: string, cantidad_manual: number }[]>([]);
  const [tamboInsumos, setTamboInsumos] = useState<{ insumo_id: string, cantidad_manual: number }[]>([]);
  const [customFields, setCustomFields] = useState<{ label: string, value: string }[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [tamboData, fichaData, tamboCompsData, tamboInsumosData, catalogCompsData, catalogInsumosData] = await Promise.all([
          db.tambos.getById(tamboId),
          db.ficha_tecnica.getByTambo(tamboId),
          db.tambo_componentes.getByTambo(tamboId),
          db.tambo_insumos.getByTambo(tamboId),
          db.componentes.getAll(),
          db.insumos.getAll()
        ]);

        setTambo(tamboData);
        setCatalogComponentes(catalogCompsData);
        setCatalogInsumos(catalogInsumosData);
        
        setTamboComponentes(tamboCompsData.map(c => ({ 
          componente_id: c.componente_id, 
          cantidad_manual: c.cantidad_manual || 0 
        })));

        setTamboInsumos(tamboInsumosData.map(i => ({
          insumo_id: i.insumo_id,
          cantidad_manual: i.cantidad_manual || 0
        })));

        if (fichaData) {
          setFicha({
            ...fichaData,
            tiene_brazos_extractores: tamboData.tiene_brazos_extractores
          });
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
            tiene_brazos_extractores: tamboData.tiene_brazos_extractores
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
    if (catalogComponentes.length > 0) {
      setTamboComponentes([...tamboComponentes, { componente_id: catalogComponentes[0].id, cantidad_manual: 0 }]);
    }
  };

  const updateTamboComponente = (index: number, field: 'componente_id' | 'cantidad_manual', value: string | number) => {
    const newComps = [...tamboComponentes];
    (newComps[index] as any)[field] = value;
    setTamboComponentes(newComps);
  };

  const removeTamboComponente = (index: number) => {
    setTamboComponentes(tamboComponentes.filter((_, i) => i !== index));
  };

  const addInsumo = () => {
    if (catalogInsumos.length > 0) {
      setTamboInsumos([...tamboInsumos, { insumo_id: catalogInsumos[0].id, cantidad_manual: 0 }]);
    }
  };

  const updateTamboInsumo = (index: number, field: 'insumo_id' | 'cantidad_manual', value: string | number) => {
    const newInsumos = [...tamboInsumos];
    (newInsumos[index] as any)[field] = value;
    setTamboInsumos(newInsumos);
  };

  const removeTamboInsumo = (index: number) => {
    setTamboInsumos(tamboInsumos.filter((_, i) => i !== index));
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

      const { tiene_brazos_extractores, ...fichaDataOnly } = ficha;

      const dataToSave = {
        ...fichaDataOnly,
        tambo_id: tamboId,
        datos_extra: datosExtra
      };

      // Save ficha técnica
      await db.ficha_tecnica.upsert(dataToSave as any);

      // Update Tambo basic info
      await db.tambos.update(tamboId, {
        bajadas: ficha.bajadas,
        tiene_brazos_extractores: ficha.tiene_brazos_extractores
      });

      // Save components
      await db.tambo_componentes.deleteByTambo(tamboId);
      if (tamboComponentes.length > 0) {
        await db.tambo_componentes.createMany(tamboComponentes.map(c => ({
          tambo_id: tamboId,
          componente_id: c.componente_id,
          cantidad_manual: c.cantidad_manual
        })));
      }

      // Save insumos
      await db.tambo_insumos.deleteByTambo(tamboId);
      if (tamboInsumos.length > 0) {
        await db.tambo_insumos.createMany(tamboInsumos.map(i => ({
          tambo_id: tamboId,
          insumo_id: i.insumo_id,
          cantidad_manual: i.cantidad_manual
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
          {/* Basic Info & Brazos */}
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

            <div className="md:col-span-2">
              <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:border-white/20 transition-colors">
                <input
                  type="checkbox"
                  checked={ficha.tiene_brazos_extractores || false}
                  onChange={(e) => setFicha({ ...ficha, tiene_brazos_extractores: e.target.checked })}
                  className="w-5 h-5 rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold">¿Tiene Brazos Extractores?</span>
                  <span className="text-[10px] text-zinc-500 uppercase">Afecta el cálculo de pulsadores (Bajadas x 2)</span>
                </div>
              </label>
            </div>
          </div>

          {/* Bomba de Leche Section */}
          <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-500/10 rounded-lg">
                <Settings className="w-4 h-4 text-blue-400" />
              </div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-blue-400">Bomba de Leche</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Marca</label>
                <input
                  type="text"
                  value={ficha.bomba_leche_marca || ""}
                  onChange={(e) => setFicha({ ...ficha, bomba_leche_marca: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                  placeholder="Marca de la bomba"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={ficha.bomba_leche_tiene_sello || false}
                    onChange={(e) => setFicha({ ...ficha, bomba_leche_tiene_sello: e.target.checked })}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-[10px] font-bold uppercase">Sello</span>
                </label>
                <label className="flex flex-col items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={ficha.bomba_leche_tiene_diafragma || false}
                    onChange={(e) => setFicha({ ...ficha, bomba_leche_tiene_diafragma: e.target.checked })}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-[10px] font-bold uppercase">Diafragma</span>
                </label>
                <label className="flex flex-col items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={ficha.bomba_leche_tiene_turbina || false}
                    onChange={(e) => setFicha({ ...ficha, bomba_leche_tiene_turbina: e.target.checked })}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-[10px] font-bold uppercase">Turbina</span>
                </label>
              </div>
            </div>
          </div>

          {/* Bomba de Vacío Section */}
          <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-amber-500/10 rounded-lg">
                <Settings className="w-4 h-4 text-amber-400" />
              </div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-amber-400">Bomba de Vacío</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Marca</label>
                <input
                  type="text"
                  value={ficha.bomba_vacio_marca || ""}
                  onChange={(e) => setFicha({ ...ficha, bomba_vacio_marca: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500/50 transition-colors text-sm"
                  placeholder="Marca"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tamaño Polea</label>
                <input
                  type="text"
                  value={ficha.bomba_vacio_polea || ""}
                  onChange={(e) => setFicha({ ...ficha, bomba_vacio_polea: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500/50 transition-colors text-sm"
                  placeholder="Ej: 150mm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Vueltas</label>
                <input
                  type="text"
                  value={ficha.bomba_vacio_vueltas || ""}
                  onChange={(e) => setFicha({ ...ficha, bomba_vacio_vueltas: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500/50 transition-colors text-sm"
                  placeholder="RPM"
                />
              </div>
            </div>
          </div>

          {/* Pulsadores Section */}
          <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                <Settings className="w-4 h-4 text-emerald-400" />
              </div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400">Pulsadores e Insumos por Bajada</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tipo de Pulsadores</label>
                <input
                  type="text"
                  value={ficha.tipo_pulsadores || ""}
                  onChange={(e) => setFicha({ ...ficha, tipo_pulsadores: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors text-sm"
                  placeholder="Ej: Electrónicos"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={ficha.usa_sogas || false}
                    onChange={(e) => setFicha({ ...ficha, usa_sogas: e.target.checked })}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] font-bold uppercase">Sogas</span>
                </label>
                <label className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={ficha.usa_diafragmas_brazos || false}
                    onChange={(e) => setFicha({ ...ficha, usa_diafragmas_brazos: e.target.checked })}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] font-bold uppercase">Diaf. Brazos</span>
                </label>
                <label className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={ficha.usa_bujes || false}
                    onChange={(e) => setFicha({ ...ficha, usa_bujes: e.target.checked })}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] font-bold uppercase">Bujes</span>
                </label>
                <label className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={ficha.usa_colector_leche || false}
                    onChange={(e) => setFicha({ ...ficha, usa_colector_leche: e.target.checked })}
                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] font-bold uppercase">Colector</span>
                </label>
              </div>
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
              {tamboComponentes.map((comp, index) => {
                const catalogComp = catalogComponentes.find(c => c.id === comp.componente_id);
                return (
                  <div key={index} className="flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex-1 space-y-1">
                      <select
                        value={comp.componente_id}
                        onChange={(e) => updateTamboComponente(index, 'componente_id', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none"
                      >
                        {catalogComponentes.map(c => (
                          <option key={c.id} value={c.id} className="bg-[#0f0f0f]">{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                    {catalogComp?.usa_cantidad_manual && (
                      <div className="w-24 space-y-1">
                        <input
                          type="number"
                          value={comp.cantidad_manual}
                          onChange={(e) => updateTamboComponente(index, 'cantidad_manual', parseInt(e.target.value) || 0)}
                          placeholder="Cant."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                        />
                      </div>
                    )}
                    {!catalogComp?.usa_cantidad_manual && (
                      <div className="w-24 flex items-center justify-center h-10 text-xs text-zinc-500 font-mono">
                        Auto
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeTamboComponente(index)}
                      className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {tamboComponentes.length === 0 && (
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
