import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { db } from "../services/db";
import { Cliente, TipoMantenimiento, Pezonera, Componente, TamboComponente } from "../types/supabase";
import { ArrowLeft, Save, CheckCircle2, Settings, Package, Plus, Trash2 } from "lucide-react";
import { cn } from "../utils/ui";
import { calculateComponentQuantity } from "../utils/calculations";

export default function NewTamboPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = !!id;
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pezoneras, setPezoneras] = useState<Pezonera[]>([]);
  const [catalogComponentes, setCatalogComponentes] = useState<Componente[]>([]);
  const [allMaintTypes, setAllMaintTypes] = useState<TipoMantenimiento[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [tamboComponentes, setTamboComponentes] = useState<{ componente_id: string, cantidad_manual: number }[]>([]);
  
  const [formData, setFormData] = useState({
    cliente_id: searchParams.get("clienteId") || "",
    nombre: "",
    vacas_en_ordene: 0,
    bajadas: 0,
    ordenes_por_dia: 2,
    pezonera_id: "",
    tiene_brazos_extractores: false,
    fecha_ultimo_cambio: "1900-01-01"
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [clientsData, maintTypesData, pezonerasData, componentsCatalog] = await Promise.all([
          db.clientes.getAll(),
          db.tipos_mantenimiento.getAll(),
          db.pezoneras.getAll(),
          db.componentes.getAll()
        ]);
        setClientes(clientsData);
        setAllMaintTypes(maintTypesData);
        setPezoneras(pezonerasData);
        setCatalogComponentes(componentsCatalog);

        if (isEditing) {
          const [tambo, active, tComps] = await Promise.all([
            db.tambos.getById(id!),
            db.tambos.getMantenimientosActivos(id!),
            db.tambo_componentes.getByTambo(id!)
          ]);
          
          setFormData({
            cliente_id: tambo.cliente_id,
            nombre: tambo.nombre,
            vacas_en_ordene: tambo.vacas_en_ordene,
            bajadas: tambo.bajadas,
            ordenes_por_dia: tambo.ordenes_por_dia,
            pezonera_id: tambo.pezonera_id || "",
            tiene_brazos_extractores: tambo.tiene_brazos_extractores || false,
            fecha_ultimo_cambio: tambo.fecha_ultimo_cambio
          });
          setActiveTypes(active);
          setTamboComponentes(tComps.map(tc => ({
            componente_id: tc.componente_id,
            cantidad_manual: tc.cantidad_manual || 0
          })));
        } else {
          setActiveTypes(maintTypesData.map(t => t.nombre));
        }
      } catch (error) {
        console.error("Error loading data for tambo:", error);
        alert("Error al cargar los datos.");
        navigate("/tambos");
      } finally {
        setInitialLoading(false);
      }
    }
    loadData();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.cliente_id || !formData.nombre) return;

    setLoading(true);
    try {
      let tamboId = id;
      if (isEditing) {
        await db.tambos.update(id!, formData);
      } else {
        const newTambo = await db.tambos.create(formData);
        tamboId = newTambo.id;
      }
      
      await Promise.all([
        db.tambos.setMantenimientosActivos(tamboId!, activeTypes),
        db.tambo_componentes.deleteByTambo(tamboId!),
        db.tambo_componentes.createMany(tamboComponentes.map(tc => ({
          tambo_id: tamboId!,
          componente_id: tc.componente_id,
          cantidad_manual: tc.cantidad_manual
        })))
      ]);
      
      alert(isEditing ? "Tambo actualizado correctamente." : "Tambo creado correctamente.");
      navigate(isEditing ? `/tambos/${id}` : "/tambos");
    } catch (error) {
      console.error("Error saving tambo:", error);
      alert("Error al guardar el tambo.");
    } finally {
      setLoading(false);
    }
  }

  const addComponente = () => {
    setTamboComponentes([...tamboComponentes, { componente_id: "", cantidad_manual: 0 }]);
  };

  const removeComponente = (index: number) => {
    setTamboComponentes(tamboComponentes.filter((_, i) => i !== index));
  };

  const updateTamboComponente = (index: number, field: string, value: any) => {
    const newComps = [...tamboComponentes];
    (newComps[index] as any)[field] = value;
    setTamboComponentes(newComps);
  };

  const calculateQuantity = (compId: string, manualQty: number) => {
    const comp = catalogComponentes.find(c => c.id === compId);
    if (!comp) return 0;
    
    // We need a temporary tambo object for the calculation
    const tempTambo = {
      ...formData,
      id: id || "temp",
      created_at: "",
      marca_pezonera: ""
    } as any;

    return calculateComponentQuantity(comp, tempTambo, manualQty);
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {isEditing ? "Editar Tambo" : "Nuevo Tambo"}
          </h2>
          <p className="text-zinc-500">
            {isEditing ? "Actualice los parámetros técnicos del tambo." : "Configure los parámetros técnicos del tambo."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 space-y-6">
          <h3 className="text-xl font-bold border-b border-white/5 pb-4">Datos Generales</h3>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Cliente *</label>
            <select
              required
              value={formData.cliente_id}
              onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
            >
              <option value="" disabled className="bg-[#0f0f0f]">Seleccionar cliente...</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id} className="bg-[#0f0f0f]">{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Nombre del Tambo *</label>
            <input
              required
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Ej: Tambo Norte"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Vacas en Ordeñe</label>
              <input
                type="number"
                value={formData.vacas_en_ordene}
                onChange={(e) => setFormData({ ...formData, vacas_en_ordene: parseInt(e.target.value) || 0 })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Bajadas</label>
              <input
                type="number"
                value={formData.bajadas}
                onChange={(e) => setFormData({ ...formData, bajadas: parseInt(e.target.value) || 0 })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Ordeñes x Día</label>
              <input
                type="number"
                value={formData.ordenes_por_dia}
                onChange={(e) => setFormData({ ...formData, ordenes_por_dia: parseInt(e.target.value) || 0 })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Modelo de Pezonera (Catálogo)</label>
              <select
                value={formData.pezonera_id}
                onChange={(e) => setFormData({ ...formData, pezonera_id: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
              >
                <option value="" className="bg-[#0f0f0f]">Seleccionar modelo...</option>
                {pezoneras.map(p => (
                  <option key={p.id} value={p.id} className="bg-[#0f0f0f]">{p.nombre} ({p.marca})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-8">
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={formData.tiene_brazos_extractores}
                  onChange={(e) => setFormData({ ...formData, tiene_brazos_extractores: e.target.checked })}
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                <span className="ml-3 text-sm font-medium text-zinc-400 uppercase tracking-wider">Tiene brazos extractores</span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400" />
              <h3 className="text-xl font-bold">Componentes e Insumos</h3>
            </div>
            <button
              type="button"
              onClick={addComponente}
              className="flex items-center gap-2 text-xs font-bold bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Agregar Componente
            </button>
          </div>
          
          <div className="space-y-4">
            {tamboComponentes.map((tc, index) => {
              const comp = catalogComponentes.find(c => c.id === tc.componente_id);
              const isManual = comp?.usa_cantidad_manual;
              const calculatedQty = calculateQuantity(tc.componente_id, tc.cantidad_manual);

              return (
                <div key={index} className="flex flex-col md:flex-row gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-top-2">
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Componente</label>
                    <select
                      value={tc.componente_id}
                      onChange={(e) => updateTamboComponente(index, 'componente_id', e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
                    >
                      <option value="" className="bg-[#0f0f0f]">Seleccionar...</option>
                      {catalogComponentes.map(c => (
                        <option key={c.id} value={c.id} className="bg-[#0f0f0f]">{c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full md:w-32 space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Cantidad</label>
                    {isManual ? (
                      <input
                        type="number"
                        value={tc.cantidad_manual}
                        onChange={(e) => updateTamboComponente(index, 'cantidad_manual', parseInt(e.target.value) || 0)}
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                      />
                    ) : (
                      <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 text-sm text-emerald-400 font-bold font-mono">
                        {calculatedQty}
                      </div>
                    )}
                  </div>

                  <div className="flex items-end pb-1">
                    <button
                      type="button"
                      onClick={() => removeComponente(index)}
                      className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {tamboComponentes.length === 0 && (
              <div className="text-center py-8 border border-dashed border-white/10 rounded-3xl">
                <Package className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
                <p className="text-sm text-zinc-600">No hay componentes configurados para este tambo.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-400" />
              <h3 className="text-xl font-bold">Mantenimientos Activos</h3>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md">
              {activeTypes.length} SELECCIONADOS
            </span>
          </div>
          <p className="text-sm text-zinc-500">Marque los componentes que este equipo posee para habilitar su seguimiento técnico.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allMaintTypes.map(tipo => (
              <button
                key={tipo.id}
                type="button"
                onClick={() => {
                  setActiveTypes(prev => 
                    prev.includes(tipo.nombre) ? prev.filter(t => t !== tipo.nombre) : [...prev, tipo.nombre]
                  );
                }}
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all",
                  activeTypes.includes(tipo.nombre)
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                    : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/20"
                )}
              >
                <span>{tipo.nombre}</span>
                {activeTypes.includes(tipo.nombre) && <CheckCircle2 className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-bold py-5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 text-lg"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-6 h-6" />
              {isEditing ? "Actualizar Tambo" : "Guardar Tambo"}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
