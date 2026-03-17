import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { db } from "../services/db";
import { Cliente, TipoMantenimiento } from "../types/supabase";
import { ArrowLeft, Save, CheckCircle2 } from "lucide-react";
import { cn } from "../utils/ui";

export default function NewTamboPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = !!id;
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [allMaintTypes, setAllMaintTypes] = useState<TipoMantenimiento[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    cliente_id: searchParams.get("clienteId") || "",
    nombre: "",
    vacas_en_ordene: 0,
    bajadas: 0,
    ordenes_por_dia: 2,
    marca_pezonera: "",
    fecha_ultimo_cambio: "1900-01-01" // Default to never performed for the global field
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [clientsData, maintTypesData] = await Promise.all([
          db.clientes.getAll(),
          db.tipos_mantenimiento.getAll()
        ]);
        setClientes(clientsData);
        setAllMaintTypes(maintTypesData);

        if (isEditing) {
          const [tambo, active] = await Promise.all([
            db.tambos.getById(id!),
            db.tambos.getMantenimientosActivos(id!)
          ]);
          
          setFormData({
            cliente_id: tambo.cliente_id,
            nombre: tambo.nombre,
            vacas_en_ordene: tambo.vacas_en_ordene,
            bajadas: tambo.bajadas,
            ordenes_por_dia: tambo.ordenes_por_dia,
            marca_pezonera: tambo.marca_pezonera || "",
            fecha_ultimo_cambio: tambo.fecha_ultimo_cambio
          });
          setActiveTypes(active);
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
      
      await db.tambos.setMantenimientosActivos(tamboId!, activeTypes);
      
      alert(isEditing ? "Tambo actualizado correctamente." : "Tambo creado correctamente.");
      navigate(isEditing ? `/tambos/${id}` : "/tambos");
    } catch (error) {
      console.error("Error saving tambo:", error);
      alert("Error al guardar el tambo.");
    } finally {
      setLoading(false);
    }
  }

  const toggleType = (tipo: string) => {
    setActiveTypes(prev => 
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
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
              <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Marca Pezonera</label>
              <input
                type="text"
                value={formData.marca_pezonera}
                onChange={(e) => setFormData({ ...formData, marca_pezonera: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="Ej: DeLaval, Westfalia..."
              />
            </div>
          </div>
        </div>

        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h3 className="text-xl font-bold">Mantenimientos Activos</h3>
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
                onClick={() => toggleType(tipo.nombre)}
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
