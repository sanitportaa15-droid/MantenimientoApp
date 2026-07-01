import React, { useState, useEffect } from "react";
import { useAuth } from "../services/AuthContext";
import { useCompany } from "../services/CompanyContext";
import { db, setActiveCompanyId } from "../services/db";
import { EmpresaIdentidad, Perfil } from "../types/supabase";
import { createClient } from "@supabase/supabase-js";
import { 
  Building2, 
  Plus, 
  Edit2, 
  Check, 
  X, 
  Shield, 
  Search, 
  UserPlus, 
  Calendar, 
  AlertCircle, 
  Eye, 
  RefreshCw,
  Clock,
  Layers,
  Lock
} from "lucide-react";

// Temporary non-persistent Supabase client to register users without replacing current session
const tempSupabase = createClient(
  (import.meta as any).env.VITE_SUPABASE_URL || "",
  (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "",
  { auth: { persistSession: false } }
);

export default function EmpresasPage() {
  const { profile } = useAuth();
  const { refreshCompany } = useCompany();
  
  const [companies, setCompanies] = useState<EmpresaIdentidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals / Forms States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Form Fields - Company Create/Edit
  const [selectedCompany, setSelectedCompany] = useState<EmpresaIdentidad | null>(null);
  const [nombre, setNombre] = useState("");
  const [plan, setPlan] = useState("Demo");
  const [estado, setEstado] = useState<'Activa' | 'Demo' | 'Suspendida' | 'Cancelada'>("Demo");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [activa, setActiva] = useState(true);

  // Form Fields - First Admin User
  const [adminNombre, setAdminNombre] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [submittingAdmin, setSubmittingAdmin] = useState(false);

  const [activeInspectingId, setActiveInspectingId] = useState<string | null>(
    localStorage.getItem("activeCompanyId") || null
  );

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await db.empresa_identidad.getAll();
      setCompanies(data);
    } catch (err: any) {
      console.error(err);
      setError("No se pudieron cargar las empresas.");
    } finally {
      setLoading(false);
    }
  };

  if (profile?.rol !== "Superadmin") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center py-12 px-4 text-center font-sans">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">Acceso Denegado</h2>
          <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
            Esta sección es exclusiva para el **Superadministrador** del sistema SaaS.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center w-full px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl shadow-lg shadow-emerald-500/10 transition-all text-sm"
          >
            Volver al Dashboard
          </a>
        </div>
      </div>
    );
  }

  const handleOpenCreate = () => {
    setNombre("");
    setPlan("Demo");
    setEstado("Demo");
    setFechaInicio(new Date().toISOString().split("T")[0]);
    setFechaVencimiento("");
    setActiva(true);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (company: EmpresaIdentidad) => {
    setSelectedCompany(company);
    setNombre(company.nombre);
    setPlan(company.plan || "Básico");
    setEstado(company.estado || "Activa");
    setFechaInicio(company.fecha_inicio ? company.fecha_inicio.split("T")[0] : "");
    setFechaVencimiento(company.fecha_vencimiento ? company.fecha_vencimiento.split("T")[0] : "");
    setActiva(company.activa !== undefined ? company.activa : true);
    setIsEditModalOpen(true);
  };

  const handleOpenAdmin = (company: EmpresaIdentidad) => {
    setSelectedCompany(company);
    setAdminNombre("");
    setAdminEmail("");
    setAdminPassword("");
    setIsAdminModalOpen(true);
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const newComp = await db.empresa_identidad.create({
        nombre,
        plan,
        estado,
        fecha_inicio: fechaInicio ? new Date(fechaInicio).toISOString() : new Date().toISOString(),
        fecha_vencimiento: fechaVencimiento ? new Date(fechaVencimiento).toISOString() : null,
        activa
      });
      setSuccess(`Empresa "${newComp.nombre}" creada con éxito.`);
      setIsCreateModalOpen(false);
      loadCompanies();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Error al crear la empresa.");
    }
  };

  const handleEditCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setError(null);
    setSuccess(null);
    try {
      await db.empresa_identidad.update(selectedCompany.id, {
        nombre,
        plan,
        estado,
        fecha_inicio: fechaInicio ? new Date(fechaInicio).toISOString() : new Date().toISOString(),
        fecha_vencimiento: fechaVencimiento ? new Date(fechaVencimiento).toISOString() : null,
        activa
      });
      setSuccess(`Empresa "${nombre}" actualizada con éxito.`);
      setIsEditModalOpen(false);
      loadCompanies();
      // If inspecting this company, refresh context
      if (activeInspectingId === selectedCompany.id) {
        refreshCompany();
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Error al actualizar la empresa.");
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setError(null);
    setSuccess(null);
    setSubmittingAdmin(true);

    try {
      // 1. Pre-create profile in database to associate with correct company when trigger fires
      await db.perfiles.createGlobal({
        user_id: null, // to be updated by trigger on signUp
        empresa_id: selectedCompany.id,
        nombre: adminNombre,
        email: adminEmail,
        rol: "Administrador",
        activo: true
      });

      // 2. Sign up in Supabase using the non-persistent client
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
        options: {
          data: {
            nombre: adminNombre,
          }
        }
      });

      if (authError) {
        throw authError;
      }

      setSuccess(`Administrador "${adminNombre}" registrado para la empresa "${selectedCompany.nombre}".`);
      setIsAdminModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Error al registrar el usuario Administrador.");
    } finally {
      setSubmittingAdmin(false);
    }
  };

  const handleInspectCompany = async (companyId: string) => {
    setActiveCompanyId(companyId);
    setActiveInspectingId(companyId);
    localStorage.setItem("activeCompanyId", companyId);
    await refreshCompany();
    setSuccess("Inspeccionando la empresa seleccionada. Ahora puedes ver sus datos en el sistema.");
  };

  const handleClearInspection = async () => {
    setActiveCompanyId("");
    setActiveInspectingId(null);
    localStorage.removeItem("activeCompanyId");
    await refreshCompany();
    setSuccess("Modo inspección desactivado. Volviendo a la vista global.");
  };

  const filteredCompanies = companies.filter(c => 
    c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.plan && c.plan.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Control de Empresas y Licencias
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Gestión centralizada del SaaS, planes de facturación y control de suscripciones.
          </p>
        </div>
        <div className="flex gap-2">
          {activeInspectingId && (
            <button
              onClick={handleClearInspection}
              className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Detener Inspección
            </button>
          )}
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10"
          >
            <Plus className="w-4 h-4" />
            Nueva Empresa
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-start gap-3 text-sm">
          <Check className="w-5 h-5 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {/* Search & Stats */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre de empresa o plan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/30 transition-all"
          />
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500 font-mono">
          <span>Total: {companies.length}</span>
          <span>•</span>
          <span>Activas: {companies.filter(c => c.estado === 'Activa' && c.activa).length}</span>
          <span>•</span>
          <span>Demo: {companies.filter(c => c.estado === 'Demo').length}</span>
          <span>•</span>
          <span>Suspendidas: {companies.filter(c => c.estado === 'Suspendida').length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/5 bg-black/20 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <th className="p-4 pl-6">Empresa</th>
                <th className="p-4">Plan / Licencia</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Vencimiento</th>
                <th className="p-4 pr-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-zinc-300">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    Cargando empresas...
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    No se encontraron empresas registradas.
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((c) => {
                  const isInspectingThis = activeInspectingId === c.id;
                  return (
                    <tr 
                      key={c.id} 
                      className={`hover:bg-white/[0.01] transition-colors ${
                        isInspectingThis ? "bg-emerald-500/5 border-l-2 border-l-emerald-500" : ""
                      }`}
                    >
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center font-bold text-white shadow-md border border-white/5 shrink-0">
                            {c.nombre.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              {c.nombre}
                              {isInspectingThis && (
                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold font-sans">
                                  INSPECCIONANDO
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5 font-mono">ID: {c.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-zinc-500" />
                          <span className="font-medium text-white">{c.plan || "Básico"}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                          c.estado === "Activa" 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : c.estado === "Demo"
                            ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                            : c.estado === "Suspendida"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            c.estado === "Activa" 
                              ? "bg-emerald-500"
                              : c.estado === "Demo"
                              ? "bg-cyan-500"
                              : c.estado === "Suspendida"
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`} />
                          {c.estado || "Activa"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                          <Calendar className="w-4 h-4 text-zinc-500" />
                          <span>
                            {c.fecha_vencimiento 
                              ? new Date(c.fecha_vencimiento).toLocaleDateString() 
                              : "Permanente"
                            }
                          </span>
                        </div>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isInspectingThis ? (
                            <button
                              onClick={() => handleInspectCompany(c.id)}
                              className="p-2 hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-400 rounded-lg transition-all"
                              title="Inspeccionar Datos"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={handleClearInspection}
                              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all"
                              title="Detener Inspección"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenAdmin(c)}
                            className="p-2 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg transition-all"
                            title="Asignar Administrador"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="p-2 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg transition-all"
                            title="Editar Licencia"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Building2 className="text-emerald-500" />
              Nueva Empresa
            </h2>
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Nombre de la Empresa
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Tambo Santa Fe"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Plan
                  </label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  >
                    <option value="Demo">Demo</option>
                    <option value="Básico">Básico</option>
                    <option value="Premium">Premium</option>
                    <option value="Corporativo">Corporativo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Estado
                  </label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as any)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  >
                    <option value="Activa">Activa</option>
                    <option value="Demo">Demo</option>
                    <option value="Suspendida">Suspendida</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    F. Inicio
                  </label>
                  <input
                    type="date"
                    required
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    F. Vencimiento
                  </label>
                  <input
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={activa}
                    onChange={(e) => setActiva(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-zinc-900 border-white/10 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-sm font-medium text-zinc-300">
                    Licencia Habilitada / Activa
                  </span>
                </label>
              </div>

              <div className="pt-4 border-t border-white/5 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-sm font-bold transition-colors shadow-lg shadow-emerald-500/10"
                >
                  Crear Empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LICENSE MODAL */}
      {isEditModalOpen && selectedCompany && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Edit2 className="text-emerald-500 w-5 h-5" />
              Editar Licencia: {selectedCompany.nombre}
            </h2>
            <form onSubmit={handleEditCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Nombre de la Empresa
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Tambo Santa Fe"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Plan
                  </label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  >
                    <option value="Demo">Demo</option>
                    <option value="Básico">Básico</option>
                    <option value="Premium">Premium</option>
                    <option value="Corporativo">Corporativo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Estado
                  </label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as any)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  >
                    <option value="Activa">Activa</option>
                    <option value="Demo">Demo</option>
                    <option value="Suspendida">Suspendida</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    F. Inicio
                  </label>
                  <input
                    type="date"
                    required
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    F. Vencimiento
                  </label>
                  <input
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={activa}
                    onChange={(e) => setActiva(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-zinc-900 border-white/10 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-sm font-medium text-zinc-300">
                    Licencia Habilitada / Activa
                  </span>
                </label>
              </div>

              <div className="pt-4 border-t border-white/5 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-sm font-bold transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE FIRST ADMIN USER MODAL */}
      {isAdminModalOpen && selectedCompany && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAdminModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <UserPlus className="text-emerald-500" />
              Primer Administrador
            </h2>
            <p className="text-xs text-zinc-500 mb-6">
              Crear el usuario Administrador inicial para la empresa <strong className="text-zinc-300">{selectedCompany.nombre}</strong>.
            </p>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Santiago Porta"
                  value={adminNombre}
                  onChange={(e) => setAdminNombre(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@empresa.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Contraseña de Acceso
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              <div className="pt-4 border-t border-white/5 flex gap-2 justify-end">
                <button
                  type="button"
                  disabled={submittingAdmin}
                  onClick={() => setIsAdminModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-55 rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingAdmin}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/10 flex items-center gap-2"
                >
                  {submittingAdmin ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    "Registrar Admin"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
