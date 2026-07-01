import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Calendar, 
  BarChart3, 
  Settings, 
  Plus, 
  Search, 
  Eye, 
  Edit2, 
  UserPlus, 
  Trash2, 
  Power, 
  PowerOff, 
  ArrowLeft, 
  Droplets, 
  RefreshCw, 
  AlertCircle,
  Sparkles,
  LogOut,
  Clock,
  ShieldAlert,
  ChevronRight,
  ShieldCheck,
  Send,
  RotateCcw,
  XCircle,
  Copy,
  ExternalLink,
  CheckCircle,
  Mail
} from "lucide-react";
import { useAuth } from "../services/AuthContext";
import { useCompany } from "../services/CompanyContext";
import { db, setActiveCompanyId } from "../services/db";
import { EmpresaIdentidad, Perfil, SuperAdministrador } from "../types/supabase";
import { supabase } from "../services/supabase";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";

type TabType = "dashboard" | "empresas" | "licencias" | "usuarios" | "estadisticas" | "superadmins";

export default function PortalMaestroPage() {
  const { user, profile, logout } = useAuth();
  const { refreshCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<EmpresaIdentidad[]>([]);
  const [profiles, setProfiles] = useState<Perfil[]>([]);
  const [superAdmins, setSuperAdmins] = useState<SuperAdministrador[]>([]);
  const [globalTambosCount, setGlobalTambosCount] = useState(0);
  const [globalClientesCount, setGlobalClientesCount] = useState(0);
  const [saasStats, setSaasStats] = useState<Record<string, { usersCount: number; tambosCount: number; clientesCount: number; lastAccess: string | null }>>({});
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState(false);

  // Form states
  const [selectedCompany, setSelectedCompany] = useState<EmpresaIdentidad | null>(null);
  const [nombre, setNombre] = useState("");
  const [plan, setPlan] = useState("Demo");
  const [estado, setEstado] = useState("Activa");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [activa, setActiva] = useState(true);

  // First admin registration form
  const [adminNombre, setAdminNombre] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [submittingAdmin, setSubmittingAdmin] = useState(false);

  // New superadmin state
  const [superAdminEmail, setSuperAdminEmail] = useState("");

  // Edit User states
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<Perfil | null>(null);
  const [editUserNombre, setEditUserNombre] = useState("");
  const [editUserEmpresaId, setEditUserEmpresaId] = useState("");
  const [editUserRol, setEditUserRol] = useState<'Superadmin' | 'Administrador' | 'Supervisor' | 'Técnico' | 'Solo lectura'>("Solo lectura");
  const [editUserActivo, setEditUserActivo] = useState(true);

  // Global user invitation states
  const [isGlobalInviteModalOpen, setIsGlobalInviteModalOpen] = useState(false);
  const [globalInviteNombre, setGlobalInviteNombre] = useState("");
  const [globalInviteEmail, setGlobalInviteEmail] = useState("");
  const [globalInviteRol, setGlobalInviteRol] = useState<'Administrador' | 'Supervisor' | 'Técnico' | 'Solo lectura'>("Solo lectura");
  const [globalInviteEmpresaId, setGlobalInviteEmpresaId] = useState("default");
  const [globalInviteSubmitting, setGlobalInviteSubmitting] = useState(false);

  // Simulated email modal states
  const [invitedUser, setInvitedUser] = useState<Perfil | null>(null);
  const [copied, setCopied] = useState(false);

  // UI Messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load companies
      const comps = await db.empresa_identidad.getAll();
      setCompanies(comps);

      // 2. Load global profiles
      const profs = await db.perfiles.getAllGlobal();
      setProfiles(profs);

      // 3. Load superadministrators
      let sAdmins: SuperAdministrador[] = [];
      try {
        sAdmins = await db.super_administradores.getAll();
        setSuperAdmins(sAdmins);
      } catch (err) {
        console.warn("No se pudo obtener superadministradores (quizás la tabla no existe):", err);
      }

      // 4. Load global metrics
      const allTambos = await db.tambos.getAllGlobal();
      setGlobalTambosCount(allTambos.length);

      const allClientes = await db.clientes.getAllGlobal();
      setGlobalClientesCount(allClientes.length);

      // Group statistics by company
      const statsMap: Record<string, { usersCount: number; tambosCount: number; clientesCount: number; lastAccess: string | null }> = {};
      
      comps.forEach(c => {
        statsMap[c.id] = {
          usersCount: 0,
          tambosCount: 0,
          clientesCount: 0,
          lastAccess: null
        };
      });

      // Count profiles per company
      profs.forEach(p => {
        if (p.rol === "Superadmin") return; // Exclude superadmins from company stats
        if (p.empresa_id && statsMap[p.empresa_id]) {
          statsMap[p.empresa_id].usersCount += 1;
          
          if (p.ultimo_acceso) {
            const pAccess = new Date(p.ultimo_acceso);
            const currentLastAccess = statsMap[p.empresa_id].lastAccess;
            if (!currentLastAccess || pAccess > new Date(currentLastAccess)) {
              statsMap[p.empresa_id].lastAccess = p.ultimo_acceso;
            }
          }
        }
      });

      // Count tambos per company
      allTambos.forEach(t => {
        if (t.empresa_id && statsMap[t.empresa_id]) {
          statsMap[t.empresa_id].tambosCount += 1;
        }
      });

      // Count clients per company
      allClientes.forEach(cl => {
        if (cl.empresa_id && statsMap[cl.empresa_id]) {
          statsMap[cl.empresa_id].clientesCount += 1;
        }
      });

      setSaasStats(statsMap);
    } catch (err: any) {
      console.error("Error al cargar datos globales del SaaS:", err);
      setError("No se pudieron cargar todas las métricas globales del SaaS.");
    } finally {
      setLoading(false);
    }
  };

  // Companies CRUD handlers
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
      loadAllData();
    } catch (err: any) {
      console.error("Error creando empresa:", err);
      setError(err.message || "Error al registrar la empresa.");
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setError(null);
    setSuccess(null);
    try {
      await db.empresa_identidad.update(selectedCompany.id, {
        nombre,
        plan,
        estado: estado as any,
        fecha_inicio: fechaInicio ? new Date(fechaInicio).toISOString() : new Date().toISOString(),
        fecha_vencimiento: fechaVencimiento ? new Date(fechaVencimiento).toISOString() : null,
        activa
      });
      setSuccess(`Empresa "${nombre}" actualizada correctamente.`);
      setIsEditModalOpen(false);
      loadAllData();
    } catch (err: any) {
      console.error("Error editando empresa:", err);
      setError(err.message || "Error al actualizar la empresa.");
    }
  };

  const toggleCompanyStatus = async (company: EmpresaIdentidad) => {
    setError(null);
    setSuccess(null);
    const updatedStatus = company.activa ? false : true;
    const newEstado = updatedStatus ? "Activa" : "Suspendida";
    
    const confirmMsg = updatedStatus 
      ? `¿Está seguro de reactivar la empresa "${company.nombre}"?`
      : `¿Está seguro de suspender la empresa "${company.nombre}"? El acceso a todos sus usuarios quedará bloqueado.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await db.empresa_identidad.update(company.id, {
        activa: updatedStatus,
        estado: newEstado
      });
      setSuccess(`La empresa "${company.nombre}" fue ${updatedStatus ? "reactivada" : "suspendida"}.`);
      loadAllData();
    } catch (err: any) {
      console.error("Error al alternar estado de empresa:", err);
      setError("Error al modificar el estado de la empresa.");
    }
  };

  const handleCreateCompanyAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setError(null);
    setSuccess(null);
    setSubmittingAdmin(true);

    try {
      // Create user auth account
      const { data, error: authError } = await supabase.auth.signUp({
        email: adminEmail.trim(),
        password: adminPassword,
        options: {
          data: {
            display_name: adminNombre.trim()
          }
        }
      });

      if (authError) throw authError;

      if (!data.user) {
        throw new Error("No se pudo dar de alta la credencial de autenticación.");
      }

      // Check if profile already exists for this email
      let existingProfile = await db.perfiles.getByEmail(adminEmail);
      if (existingProfile) {
        // Update
        await db.perfiles.update(existingProfile.id, {
          user_id: data.user.id,
          empresa_id: selectedCompany.id,
          nombre: adminNombre.trim(),
          rol: "Administrador",
          activo: true
        });
      } else {
        // Create profile
        await db.perfiles.createGlobal({
          user_id: data.user.id,
          empresa_id: selectedCompany.id,
          nombre: adminNombre.trim(),
          email: adminEmail.trim(),
          rol: "Administrador",
          activo: true
        });
      }

      setSuccess(`Administrador "${adminNombre}" registrado con éxito para "${selectedCompany.nombre}".`);
      setIsAdminModalOpen(false);
      loadAllData();
    } catch (err: any) {
      console.error("Error asignando administrador:", err);
      setError(err.message || "No se pudo registrar el Administrador de la empresa.");
    } finally {
      setSubmittingAdmin(false);
    }
  };

  // Inspect company (Ver empresa)
  const handleInspectCompany = async (company: EmpresaIdentidad) => {
    const confirmView = window.confirm(
      `¿Está seguro que desea inspeccionar temporalmente la empresa "${company.nombre}"?\n\nSerá redirigido al panel del sistema de dicha empresa.`
    );
    if (!confirmView) return;

    try {
      localStorage.setItem("activeCompanyId", company.id);
      setActiveCompanyId(company.id);
      await refreshCompany();
      // Redirect to maintenance app home page
      window.location.href = "/";
    } catch (err) {
      console.error("Error ingresando a la empresa:", err);
      alert("No se pudo iniciar el modo de inspección.");
    }
  };

  // Toggle user profile status
  const handleToggleUserStatus = async (userProfile: Perfil) => {
    if (userProfile.user_id === user?.id) {
      alert("No puedes desactivar tu propia cuenta.");
      return;
    }
    const newStatus = !userProfile.activo;
    if (!window.confirm(`¿Seguro que desea ${newStatus ? 'activar' : 'desactivar'} el usuario "${userProfile.nombre}"?`)) {
      return;
    }
    try {
      await db.perfiles.update(userProfile.id, { activo: newStatus });
      setSuccess(`Estado del usuario "${userProfile.nombre}" actualizado.`);
      loadAllData();
    } catch (err) {
      console.error(err);
      setError("Error al cambiar estado de usuario.");
    }
  };

  const handleOpenEditUser = (userProfile: Perfil) => {
    setSelectedUserProfile(userProfile);
    setEditUserNombre(userProfile.nombre);
    setEditUserEmpresaId(userProfile.empresa_id || "default");
    setEditUserRol(userProfile.rol);
    setEditUserActivo(userProfile.activo);
    setIsEditUserModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserProfile) return;
    setError(null);
    setSuccess(null);

    // Count active admins per company BEFORE edit
    const activeAdminsBefore: Record<string, number> = {};
    companies.forEach(c => {
      activeAdminsBefore[c.id] = 0;
    });
    profiles.forEach(p => {
      if (p.activo && p.rol === "Administrador" && p.empresa_id) {
        activeAdminsBefore[p.empresa_id] = (activeAdminsBefore[p.empresa_id] || 0) + 1;
      }
    });

    // Count active admins per company AFTER edit
    const activeAdminsAfter: Record<string, number> = {};
    companies.forEach(c => {
      activeAdminsAfter[c.id] = 0;
    });
    profiles.forEach(p => {
      const isThisUser = p.id === selectedUserProfile.id;
      const prospectiveCompanyId = isThisUser ? (editUserEmpresaId === "default" ? null : editUserEmpresaId) : p.empresa_id;
      const prospectiveRol = isThisUser ? editUserRol : p.rol;
      const prospectiveActivo = isThisUser ? editUserActivo : p.activo;

      if (prospectiveActivo && prospectiveRol === "Administrador" && prospectiveCompanyId) {
        activeAdminsAfter[prospectiveCompanyId] = (activeAdminsAfter[prospectiveCompanyId] || 0) + 1;
      }
    });

    // Count prospective profiles count per company to know which companies actually have users in prospective state
    const prospectiveProfilesCountPerCompany: Record<string, number> = {};
    companies.forEach(c => {
      prospectiveProfilesCountPerCompany[c.id] = 0;
    });
    profiles.forEach(p => {
      const isThisUser = p.id === selectedUserProfile.id;
      const prospectiveCompanyId = isThisUser ? (editUserEmpresaId === "default" ? null : editUserEmpresaId) : p.empresa_id;
      if (prospectiveCompanyId) {
        prospectiveProfilesCountPerCompany[prospectiveCompanyId] = (prospectiveProfilesCountPerCompany[prospectiveCompanyId] || 0) + 1;
      }
    });

    // Check if any company is left with 0 active admins while it has at least one user in the prospective state
    for (const comp of companies) {
      const hasProspectiveUsers = prospectiveProfilesCountPerCompany[comp.id] > 0;
      const hasActiveAdminsAfter = activeAdminsAfter[comp.id] > 0;

      if (hasProspectiveUsers && !hasActiveAdminsAfter) {
        setError(`No se puede guardar: la empresa "${comp.nombre}" debe tener al menos un Administrador activo.`);
        return;
      }
    }

    try {
      const updatedEmpresaId = editUserEmpresaId === "default" ? null : editUserEmpresaId;
      await db.perfiles.update(selectedUserProfile.id, {
        nombre: editUserNombre,
        empresa_id: updatedEmpresaId,
        rol: editUserRol,
        activo: editUserActivo
      });
      setSuccess(`Usuario "${editUserNombre}" actualizado correctamente.`);
      setIsEditUserModalOpen(false);
      loadAllData();
    } catch (err: any) {
      console.error("Error editando usuario:", err);
      setError(err.message || "Error al actualizar el usuario.");
    }
  };

  // Superadministrators handlers
  const handleAddSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!superAdminEmail.trim()) return;

    try {
      await db.super_administradores.create(superAdminEmail.trim());
      setSuccess(`Superadministrador pre-registrado para el correo "${superAdminEmail.trim()}". Al registrarse o iniciar sesión, adquirirá todos los permisos.`);
      setSuperAdminEmail("");
      setIsSuperAdminModalOpen(false);
      loadAllData();
    } catch (err: any) {
      console.error("Error agregando superadministrador:", err);
      setError("Error al registrar superadministrador. Verifique si el correo ya existe.");
    }
  };

  const handleToggleSuperAdmin = async (admin: SuperAdministrador) => {
    if (admin.email === user?.email) {
      alert("No puedes suspender tu propio acceso superadministrador.");
      return;
    }
    const nextStatus = !admin.activo;
    if (!window.confirm(`¿Está seguro de ${nextStatus ? 'habilitar' : 'suspender'} el acceso al Superadministrador "${admin.email}"?`)) {
      return;
    }
    try {
      await db.super_administradores.update(admin.id, { activo: nextStatus });
      setSuccess(`Estado del Superadministrador "${admin.email}" actualizado.`);
      loadAllData();
    } catch (err) {
      console.error("Error actualizando superadmin:", err);
      setError("No se pudo cambiar el estado del superadministrador.");
    }
  };

  const handleDeleteSuperAdmin = async (admin: SuperAdministrador) => {
    if (admin.email === user?.email) {
      alert("No puedes eliminar tu propio acceso superadministrador.");
      return;
    }
    if (!window.confirm(`¿Está seguro de eliminar definitivamente al Superadministrador "${admin.email}"?`)) {
      return;
    }
    try {
      await db.super_administradores.delete(admin.id);
      setSuccess(`Superadministrador "${admin.email}" eliminado.`);
      loadAllData();
    } catch (err) {
      console.error("Error eliminando superadmin:", err);
      setError("No se pudo eliminar el superadministrador.");
    }
  };

  // Global user invitation and reset handlers
  const handleGlobalInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setGlobalInviteSubmitting(true);

    if (!globalInviteNombre.trim() || !globalInviteEmail.trim()) {
      setError("Por favor ingrese el nombre y correo electrónico.");
      setGlobalInviteSubmitting(false);
      return;
    }

    try {
      const emailExists = await db.perfiles.getByEmail(globalInviteEmail.trim());
      if (emailExists) {
        throw new Error("Ya existe un usuario o invitación registrada con este correo electrónico.");
      }

      const targetEmpresaId = globalInviteEmpresaId === "default" ? null : globalInviteEmpresaId;

      const newUser = await db.perfiles.create({
        nombre: globalInviteNombre.trim(),
        email: globalInviteEmail.trim().toLowerCase(),
        rol: globalInviteRol as any,
        activo: true,
        empresa_id: targetEmpresaId,
        user_id: null // Pending activation
      });

      setSuccess(`Invitación para "${globalInviteNombre.trim()}" creada con éxito.`);
      setIsGlobalInviteModalOpen(false);
      loadAllData();
      
      // Trigger simulated email mockup display
      setInvitedUser(newUser);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al crear la invitación global.");
    } finally {
      setGlobalInviteSubmitting(false);
    }
  };

  const handleCancelInvitation = async (id: string, name: string) => {
    if (!window.confirm(`¿Seguro que desea cancelar la invitación de "${name}"? Se eliminará el registro pendiente.`)) {
      return;
    }
    try {
      await db.perfiles.delete(id);
      setSuccess(`Invitación para "${name}" cancelada.`);
      loadAllData();
    } catch (err) {
      console.error("Error al cancelar invitación:", err);
      setError("No se pudo cancelar la invitación.");
    }
  };

  const handleSendPasswordRecovery = async (userProfile: Perfil) => {
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(userProfile.email, {
        redirectTo: `${window.location.origin}/auth?reset=true`
      });
      if (resetErr) throw resetErr;
      setSuccess(`Se ha enviado la solicitud de recuperación oficial a ${userProfile.email}.`);
    } catch (err: any) {
      console.error("Error al enviar recuperación:", err);
      setError("No se pudo enviar la solicitud de recuperación: " + (err.message || err));
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Charts data preparation
  const getPlanData = () => {
    const counts: Record<string, number> = {};
    companies.forEach(c => {
      const p = c.plan || "Básico";
      counts[p] = (counts[p] || 0) + 1;
    });
    const COLORS = ["#10b981", "#06b6d4", "#f59e0b", "#ef4444", "#8b5cf6"];
    return Object.keys(counts).map((key, i) => ({
      name: key,
      value: counts[key],
      color: COLORS[i % COLORS.length]
    }));
  };

  const getResourceData = () => {
    return companies.map(c => ({
      name: c.nombre,
      Usuarios: saasStats[c.id]?.usersCount || 0,
      Tambos: saasStats[c.id]?.tambosCount || 0,
      Clientes: saasStats[c.id]?.clientesCount || 0
    })).slice(0, 10); // top 10 for readability
  };

  // Filtered lists
  const filteredCompanies = companies.filter(c => {
    const matchesSearch = c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPlan = planFilter === "" || c.plan === planFilter;
    const matchesStatus = statusFilter === "" || 
                         (statusFilter === "Activa" && c.activa) || 
                         (statusFilter === "Suspendida" && !c.activa) ||
                         (statusFilter === "Demo" && c.estado === "Demo");
    return matchesSearch && matchesPlan && matchesStatus;
  });

  const filteredProfiles = profiles.filter(p => {
    // Exclude superadministrators from the global company users table
    if (p.rol === "Superadmin") return false;
    const matchesSearch = p.nombre.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                          p.email.toLowerCase().includes(userSearchQuery.toLowerCase());
    const matchesRole = roleFilter === "" || p.role === roleFilter || p.rol === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-[#070707] text-zinc-100 flex font-sans">
      
      {/* Sidebar de Portal Maestro */}
      <aside className="w-64 bg-[#0a0a0a] border-r border-white/5 flex flex-col justify-between p-6 shrink-0 h-screen sticky top-0">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Building2 className="text-black w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-base leading-none">Portal Maestro</h1>
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 mt-1 font-semibold block">Superadmin SaaS</span>
            </div>
          </div>

          {/* Menú de Navegación */}
          <nav className="space-y-1.5">
            {[
              { id: "dashboard", name: "Dashboard General", icon: LayoutDashboard },
              { id: "empresas", name: "Empresas", icon: Building2 },
              { id: "licencias", name: "Licencias y Planes", icon: Calendar },
              { id: "usuarios", name: "Usuarios Globales", icon: Users },
              { id: "superadmins", name: "Superadministradores", icon: ShieldCheck },
              { id: "estadisticas", name: "Estadísticas", icon: BarChart3 }
            ].map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabType)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                    isActive 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm" 
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
                  }`}
                >
                  <item.icon className={`w-4.5 h-4.5 ${isActive ? "text-emerald-400" : "text-zinc-500"}`} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Sidebar */}
        <div className="border-t border-white/5 pt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
              PM
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{profile?.nombre || "Superadministrador"}</p>
              <p className="text-[9px] text-zinc-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-3.5 py-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all text-xs font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 min-h-screen p-8 overflow-y-auto max-w-[calc(100vw-16rem)]">
        
        {/* Banner de Mensajes */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-start gap-3 text-sm">
            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{success}</p>
          </div>
        )}

        {/* LOADING STATE */}
        {loading ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-zinc-500 text-sm font-medium">Cargando base de datos global de Portal Maestro...</p>
          </div>
        ) : (
          <>
            {/* ==================== 1. TAB: DASHBOARD GENERAL ==================== */}
            {activeTab === "dashboard" && (
              <div className="space-y-8 animate-fade-in">
                {/* Header */}
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">Dashboard General SaaS</h2>
                  <p className="text-zinc-400 text-sm mt-1">Suscripción global, actividad del sistema y métricas agregadas.</p>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-4 right-4 w-10 h-10 bg-emerald-500/5 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Empresas Registradas</p>
                    <h3 className="text-3xl font-bold text-white mt-2">{companies.length}</h3>
                    <div className="mt-4 flex items-center gap-3 text-xs">
                      <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono font-medium">
                        {companies.filter(c => c.activa).length} Activas
                      </span>
                      <span className="text-zinc-500">
                        {companies.filter(c => !c.activa).length} Inactivas
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-4 right-4 w-10 h-10 bg-blue-500/5 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Usuarios Globales</p>
                    <h3 className="text-3xl font-bold text-white mt-2">{profiles.length}</h3>
                    <div className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{profiles.filter(p => p.ultimo_acceso).length} han accedido al sistema</span>
                    </div>
                  </div>

                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-4 right-4 w-10 h-10 bg-purple-500/5 rounded-lg flex items-center justify-center">
                      <Droplets className="w-5 h-5 text-purple-400" />
                    </div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Tambos del Sistema</p>
                    <h3 className="text-3xl font-bold text-white mt-2">{globalTambosCount}</h3>
                    <p className="text-xs text-zinc-500 mt-4">Unidades operativas agropecuarias activas</p>
                  </div>

                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-4 right-4 w-10 h-10 bg-yellow-500/5 rounded-lg flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-yellow-400" />
                    </div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Clientes Totales</p>
                    <h3 className="text-3xl font-bold text-white mt-2">{globalClientesCount}</h3>
                    <p className="text-xs text-zinc-500 mt-4">Productores agropecuarios integrados</p>
                  </div>
                </div>

                {/* Recent Companies and Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Latest Companies Table Preview */}
                  <div className="lg:col-span-2 bg-[#0a0a0a] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Altas de Empresas Recientes</h4>
                      <button onClick={() => setActiveTab("empresas")} className="text-xs text-emerald-400 hover:underline">Ver todas</button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/5 text-zinc-500 font-semibold uppercase">
                            <th className="py-2.5">Empresa</th>
                            <th className="py-2.5">Plan</th>
                            <th className="py-2.5">Estado</th>
                            <th className="py-2.5 text-right">Métricas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {companies.slice(0, 5).map(c => (
                            <tr key={c.id} className="hover:bg-white/2 animate-row">
                              <td className="py-3 font-semibold text-white">{c.nombre}</td>
                              <td className="py-3 text-zinc-400">{c.plan || "Básico"}</td>
                              <td className="py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  c.activa ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                }`}>
                                  {c.activa ? "Activa" : "Suspendida"}
                                </span>
                              </td>
                              <td className="py-3 text-right font-mono text-zinc-500">
                                {saasStats[c.id]?.usersCount || 0}U | {saasStats[c.id]?.tambosCount || 0}T
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Quick Actions Panel */}
                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Acciones Directas</h4>
                      <div className="space-y-3">
                        <button
                          onClick={handleOpenCreate}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/5"
                        >
                          <Plus className="w-4 h-4" />
                          Registrar Nueva Empresa
                        </button>
                        <button
                          onClick={() => {
                            if (companies.length > 0) {
                              handleOpenAdmin(companies[0]);
                            } else {
                              alert("Debe registrar al menos una empresa primero.");
                            }
                          }}
                          className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 py-2.5 px-4 rounded-xl text-xs font-semibold border border-white/5 transition-all flex items-center justify-center gap-2"
                        >
                          <UserPlus className="w-4 h-4" />
                          Crear Administrador de Empresa
                        </button>
                        <button
                          onClick={() => setIsSuperAdminModalOpen(true)}
                          className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 py-2.5 px-4 rounded-xl text-xs font-semibold border border-white/5 transition-all flex items-center justify-center gap-2"
                        >
                          <ShieldAlert className="w-4 h-4" />
                          Agregar Superadministrador
                        </button>
                      </div>
                    </div>
                    <div className="border-t border-white/5 pt-4 mt-6 text-center text-[10px] text-zinc-600">
                      Portal Maestro v2.0 - Seguridad Absoluta
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ==================== 2. TAB: EMPRESAS ==================== */}
            {activeTab === "empresas" && (
              <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">Gestión de Empresas</h2>
                    <p className="text-zinc-400 text-sm mt-1">Aprobación de licencias, suspensión y creación de cuentas administradoras.</p>
                  </div>
                  <button
                    onClick={handleOpenCreate}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10"
                  >
                    <Plus className="w-4 h-4" />
                    Nueva Empresa
                  </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#0f0f0f] p-4 rounded-2xl border border-white/5">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Buscar empresa por nombre o email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <select
                      value={planFilter}
                      onChange={(e) => setPlanFilter(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-emerald-500/50"
                    >
                      <option value="">Todos los planes</option>
                      <option value="Demo">Plan Demo</option>
                      <option value="Básico">Plan Básico</option>
                      <option value="Premium">Plan Premium</option>
                    </select>
                  </div>
                  <div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-emerald-500/50"
                    >
                      <option value="">Todos los estados</option>
                      <option value="Activa">Estado: Activa</option>
                      <option value="Suspendida">Estado: Suspendida</option>
                      <option value="Demo">Estado: Demo</option>
                    </select>
                  </div>
                </div>

                {/* Companies List Table */}
                <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-black/20 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          <th className="p-4 pl-6">Empresa</th>
                          <th className="p-4">Métricas del Sistema</th>
                          <th className="p-4">Último Acceso</th>
                          <th className="p-4">Plan / Licencia</th>
                          <th className="p-4">Vencimiento</th>
                          <th className="p-4">Estado</th>
                          <th className="p-4 pr-6 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs text-zinc-300">
                        {filteredCompanies.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-zinc-500">
                              No se encontraron empresas registradas.
                            </td>
                          </tr>
                        ) : (
                          filteredCompanies.map(c => {
                            const stats = saasStats[c.id] || { usersCount: 0, tambosCount: 0, clientesCount: 0, lastAccess: null };
                            return (
                              <tr key={c.id} className="hover:bg-white/2 transition-colors animate-row">
                                <td className="p-4 pl-6">
                                  <div className="font-semibold text-white">{c.nombre}</div>
                                  <div className="text-[10px] text-zinc-500 mt-0.5">{c.email || "Sin correo"}</div>
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-col gap-1">
                                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-zinc-500" /> {stats.usersCount} Usuarios</span>
                                    <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-zinc-500" /> {stats.tambosCount} Tambos</span>
                                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-zinc-500" /> {stats.clientesCount} Clientes</span>
                                  </div>
                                </td>
                                <td className="p-4 font-mono text-zinc-400">
                                  {stats.lastAccess ? (
                                    <div className="flex flex-col">
                                      <span>{new Date(stats.lastAccess).toLocaleDateString()}</span>
                                      <span className="text-[10px] text-zinc-600 mt-0.5">{new Date(stats.lastAccess).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                  ) : "Sin accesos"}
                                </td>
                                <td className="p-4">
                                  <div className="font-semibold text-white">{c.plan || "Básico"}</div>
                                  <div className="text-[10px] text-zinc-500 mt-0.5">Suscripción SaaS</div>
                                </td>
                                <td className="p-4 font-mono">
                                  {c.fecha_vencimiento ? (
                                    <span className={new Date(c.fecha_vencimiento) < new Date() ? "text-red-400 font-bold" : "text-zinc-400"}>
                                      {new Date(c.fecha_vencimiento).toLocaleDateString()}
                                    </span>
                                  ) : "Ilimitada"}
                                </td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    c.activa ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                  }`}>
                                    {c.activa ? "Activa" : "Suspendida"}
                                  </span>
                                </td>
                                <td className="p-4 pr-6 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleInspectCompany(c)}
                                      className="p-1.5 hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-400 rounded-lg transition-all"
                                      title="Ver Empresa (Inspección)"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenAdmin(c)}
                                      className="p-1.5 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg transition-all"
                                      title="Asignar Administrador"
                                    >
                                      <UserPlus className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenEdit(c)}
                                      className="p-1.5 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg transition-all"
                                      title="Editar Licencia"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => toggleCompanyStatus(c)}
                                      className={`p-1.5 rounded-lg transition-all ${
                                        c.activa 
                                          ? "hover:bg-red-500/10 text-zinc-400 hover:text-red-400" 
                                          : "hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-400"
                                      }`}
                                      title={c.activa ? "Suspender Empresa" : "Reactivar Empresa"}
                                    >
                                      {c.activa ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
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
              </div>
            )}

            {/* ==================== 3. TAB: LICENCIAS ==================== */}
            {activeTab === "licencias" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">Licencias y Suscripciones SaaS</h2>
                  <p className="text-zinc-400 text-sm mt-1">Control de vencimientos de contratos y planificación de renovación de servicios.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Summary */}
                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">Resumen de Contratos</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Licencias Totales</span>
                        <span className="font-bold text-white font-mono">{companies.length}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Suscripciones Demo</span>
                        <span className="font-bold text-yellow-500 font-mono">{companies.filter(c => c.plan === "Demo" || c.estado === "Demo").length}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Suscripciones Básicas</span>
                        <span className="font-bold text-blue-400 font-mono">{companies.filter(c => c.plan === "Básico").length}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Suscripciones Premium</span>
                        <span className="font-bold text-emerald-400 font-mono">{companies.filter(c => c.plan === "Premium").length}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500">Vencidas / Suspendidas</span>
                        <span className="font-bold text-red-500 font-mono">
                          {companies.filter(c => !c.activa || (c.fecha_vencimiento && new Date(c.fecha_vencimiento) < new Date())).length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expiring Soon */}
                  <div className="lg:col-span-2 bg-[#0a0a0a] border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">Próximos Vencimientos (Menos de 30 días)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/5 text-zinc-500 uppercase">
                            <th className="py-2">Empresa</th>
                            <th className="py-2">Plan</th>
                            <th className="py-2">Fecha Vencimiento</th>
                            <th className="py-2 text-right">Días Restantes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {companies
                            .filter(c => c.fecha_vencimiento)
                            .map(c => {
                              const diffTime = new Date(c.fecha_vencimiento!).getTime() - new Date().getTime();
                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                              return { ...c, days: diffDays };
                            })
                            .sort((a, b) => a.days - b.days)
                            .map(c => (
                              <tr key={c.id} className="hover:bg-white/2">
                                <td className="py-3 font-semibold text-white">{c.nombre}</td>
                                <td className="py-3 text-zinc-400">{c.plan}</td>
                                <td className="py-3 font-mono text-zinc-500">{new Date(c.fecha_vencimiento!).toLocaleDateString()}</td>
                                <td className="py-3 text-right font-mono font-bold">
                                  <span className={c.days < 0 ? "text-red-500" : c.days <= 15 ? "text-yellow-500" : "text-emerald-500"}>
                                    {c.days < 0 ? `Vencida (${Math.abs(c.days)}d)` : `${c.days} días`}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== 4. TAB: USUARIOS GLOBALES ==================== */}
            {activeTab === "usuarios" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">Usuarios Globales de SaaS</h2>
                    <p className="text-zinc-400 text-sm mt-1">Supervisión, deshabilitación y control de perfiles registrados de todas las empresas del ecosistema.</p>
                  </div>
                  <button
                    onClick={() => {
                      setGlobalInviteNombre("");
                      setGlobalInviteEmail("");
                      setGlobalInviteRol("Solo lectura");
                      setGlobalInviteEmpresaId("default");
                      setIsGlobalInviteModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-xl shadow-lg shadow-emerald-500/10 transition-all self-start sm:self-auto"
                    id="btn-global-invite-modal"
                  >
                    <UserPlus className="w-4 h-4" />
                    Invitar Usuario
                  </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#0f0f0f] p-4 rounded-2xl border border-white/5">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Buscar por nombre o email..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-emerald-500/50"
                    >
                      <option value="">Todos los roles</option>
                      <option value="Administrador">Administrador</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Técnico">Técnico</option>
                      <option value="Solo lectura">Solo lectura</option>
                    </select>
                  </div>
                </div>

                {/* Users Table */}
                <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-black/20 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          <th className="p-4 pl-6">Nombre</th>
                          <th className="p-4">Email</th>
                          <th className="p-4">Empresa</th>
                          <th className="p-4">Rol</th>
                          <th className="p-4">Estado de Activación</th>
                          <th className="p-4">Fecha de Creación</th>
                          <th className="p-4">Último Acceso</th>
                          <th className="p-4 pr-6 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs text-zinc-300">
                        {filteredProfiles.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-zinc-500">
                              No se encontraron usuarios que coincidan con la búsqueda.
                            </td>
                          </tr>
                        ) : (
                          filteredProfiles.map(p => {
                            const comp = companies.find(c => c.id === p.empresa_id);
                            const isPending = !p.user_id;
                            return (
                              <tr key={p.id} className="hover:bg-white/2 transition-colors animate-row" id={`row-global-user-${p.id}`}>
                                <td className="p-4 pl-6 font-semibold text-white">
                                  {p.nombre}
                                </td>
                                <td className="p-4 text-zinc-400 font-mono text-[11px]">
                                  {p.email}
                                </td>
                                <td className="p-4">
                                  <div className="text-zinc-300 font-medium">{comp ? comp.nombre : "Sin Empresa (Global)"}</div>
                                </td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                                    p.rol === "Superadmin" ? "bg-red-500/10 text-red-400" :
                                    p.rol === "Administrador" ? "bg-blue-500/10 text-blue-400" :
                                    p.rol === "Supervisor" ? "bg-purple-500/10 text-purple-400" : "bg-zinc-500/10 text-zinc-400"
                                  }`}>
                                    {p.rol}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 w-fit ${
                                    isPending
                                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                      : p.activo
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                                  }`}>
                                    {isPending ? (
                                      <>
                                        <Clock className="w-3 h-3" />
                                        Pendiente de activación
                                      </>
                                    ) : p.activo ? (
                                      <>
                                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                                        Activo
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="w-3 h-3 text-red-400" />
                                        Inactivo
                                      </>
                                    )}
                                  </span>
                                </td>
                                <td className="p-4 text-zinc-400 font-mono">
                                  {p.created_at ? new Date(p.created_at).toLocaleDateString() : "Sin fecha"}
                                </td>
                                <td className="p-4 font-mono text-zinc-400">
                                  {p.ultimo_acceso ? new Date(p.ultimo_acceso).toLocaleString() : "Nunca"}
                                </td>
                                <td className="p-4 pr-6 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {isPending ? (
                                      <>
                                        <button
                                          onClick={() => setInvitedUser(p)}
                                          className="p-1.5 hover:bg-amber-500/10 text-amber-500 rounded-lg transition-all"
                                          title="Ver / Reenviar invitación por correo"
                                          id={`btn-global-resend-${p.id}`}
                                        >
                                          <Send className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleCancelInvitation(p.id, p.nombre)}
                                          className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-all"
                                          title="Cancelar Invitación"
                                          id={`btn-global-cancel-${p.id}`}
                                        >
                                          <XCircle className="w-4 h-4" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => handleSendPasswordRecovery(p)}
                                          className="p-1.5 hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-400 rounded-lg transition-all"
                                          title="Enviar recuperación de contraseña"
                                          id={`btn-global-recover-${p.id}`}
                                        >
                                          <RotateCcw className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleToggleUserStatus(p)}
                                          disabled={p.user_id === user?.id}
                                          className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${
                                            p.activo
                                              ? "border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10"
                                              : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10"
                                          } disabled:opacity-50`}
                                        >
                                          {p.activo ? "Bloquear" : "Activar"}
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() => handleOpenEditUser(p)}
                                      className="p-1.5 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg transition-all"
                                      title="Editar Usuario"
                                      id={`btn-global-edit-${p.id}`}
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
              </div>
            )}

            {/* ==================== 5. TAB: ESTADÍSTICAS ==================== */}
            {activeTab === "estadisticas" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">Estadísticas de Uso Global</h2>
                  <p className="text-zinc-400 text-sm mt-1">Análisis visual de la distribución de licencias, recursos del sistema y planes contratados.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Chart 1: Company Plans */}
                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 h-96 flex flex-col justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">Estructura de Planes Contratados</h3>
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getPlanData()}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {getPlanData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} />
                          <Legend verticalAlign="bottom" align="center" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2: Resource Allocation */}
                  <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-6 h-96 flex flex-col justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">Distribución de Recursos por Empresa</h3>
                    <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={getResourceData()}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis dataKey="name" stroke="#666" fontSize={10} />
                          <YAxis stroke="#666" fontSize={10} />
                          <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} />
                          <Legend />
                          <Bar dataKey="Usuarios" fill="#06b6d4" />
                          <Bar dataKey="Tambos" fill="#10b981" />
                          <Bar dataKey="Clientes" fill="#f59e0b" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== 6. TAB: SUPERADMINISTRADORES ==================== */}
            {activeTab === "superadmins" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">Superadministradores del Portal Maestro</h2>
                    <p className="text-zinc-400 text-sm mt-1">Gestión de accesos y credenciales de los Superadministradores del sistema SaaS.</p>
                  </div>
                  <button
                    onClick={() => {
                      setSuperAdminEmail("");
                      setIsSuperAdminModalOpen(true);
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10"
                  >
                    <Plus className="w-4 h-4" />
                    Nuevo Superadministrador
                  </button>
                </div>

                {/* Table of Superadmins */}
                <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-black/20 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          <th className="p-4 pl-6">Superadministrador</th>
                          <th className="p-4">UserID en Auth</th>
                          <th className="p-4">Fecha de Alta</th>
                          <th className="p-4">Estado de Acceso</th>
                          <th className="p-4 pr-6 text-right">Operaciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs text-zinc-300">
                        {superAdmins.map(admin => (
                          <tr key={admin.id} className="hover:bg-white/2 transition-colors animate-row">
                            <td className="p-4 pl-6 font-semibold text-white">
                              {admin.email}
                              {admin.email === user?.email && (
                                <span className="ml-2 bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-mono font-medium">
                                  Tú
                                </span>
                              )}
                            </td>
                            <td className="p-4 font-mono text-zinc-500">{admin.user_id || "No vinculado aún"}</td>
                            <td className="p-4 text-zinc-400">{new Date(admin.created_at).toLocaleDateString()}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                admin.activo ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                              }`}>
                                {admin.activo ? "Activo" : "Suspendido"}
                              </span>
                            </td>
                            <td className="p-4 pr-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleToggleSuperAdmin(admin)}
                                  disabled={admin.email === user?.email}
                                  className={`p-1.5 rounded-lg transition-all ${
                                    admin.activo 
                                      ? "hover:bg-red-500/10 text-zinc-400 hover:text-red-400" 
                                      : "hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-400"
                                  } disabled:opacity-50`}
                                  title={admin.activo ? "Suspender Acceso" : "Habilitar Acceso"}
                                >
                                  {admin.activo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => handleDeleteSuperAdmin(admin)}
                                  disabled={admin.email === user?.email}
                                  className="p-1.5 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg transition-all disabled:opacity-50"
                                  title="Eliminar Superadministrador"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </main>

      {/* ==================== MODALS ==================== */}

      {/* 1. Modal: Crear Empresa */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl w-full max-w-md p-6 overflow-hidden shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Registrar Nueva Empresa</h3>
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Nombre Comercial</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Tambo Oro Verde"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Plan Contratado</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="Demo">Demo</option>
                    <option value="Básico">Básico</option>
                    <option value="Premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Estado de Cuenta</label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
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
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Inicio de Licencia</label>
                  <input
                    type="date"
                    required
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Vencimiento (Opcional)</label>
                  <input
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="activa"
                  checked={activa}
                  onChange={(e) => setActiva(e.target.checked)}
                  className="rounded border-zinc-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-zinc-900"
                />
                <label htmlFor="activa" className="text-xs font-medium text-zinc-300">Empresa de alta y activa para login</label>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-bold transition-all"
                >
                  Registrar Empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Editar Empresa y Licencia */}
      {isEditModalOpen && selectedCompany && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl w-full max-w-md p-6 overflow-hidden shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Editar Empresa / Licencia</h3>
            <form onSubmit={handleUpdateCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Nombre Comercial</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Plan Contratado</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="Demo">Demo</option>
                    <option value="Básico">Básico</option>
                    <option value="Premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Estado de Cuenta</label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
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
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Inicio de Licencia</label>
                  <input
                    type="date"
                    required
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Vencimiento (Opcional)</label>
                  <input
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="edit-activa"
                  checked={activa}
                  onChange={(e) => setActiva(e.target.checked)}
                  className="rounded border-zinc-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-zinc-900"
                />
                <label htmlFor="edit-activa" className="text-xs font-medium text-zinc-300">Empresa de alta y activa para login</label>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-bold transition-all"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Asignar Administrador de Empresa */}
      {isAdminModalOpen && selectedCompany && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl w-full max-w-md p-6 overflow-hidden shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">Asignar Administrador</h3>
            <p className="text-zinc-500 text-xs mb-4">Crea la primera credencial administradora para la empresa: <strong className="text-white">{selectedCompany.nombre}</strong></p>
            <form onSubmit={handleCreateCompanyAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  value={adminNombre}
                  onChange={(e) => setAdminNombre(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Correo Electrónico (Login)</label>
                <input
                  type="email"
                  required
                  placeholder="correo@tambo.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Contraseña</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingAdmin}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  {submittingAdmin ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                  Registrar Administrador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal: Crear Superadministrador */}
      {isSuperAdminModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl w-full max-w-md p-6 overflow-hidden shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Crear Superadministrador</h3>
            <p className="text-zinc-500 text-xs mb-4">Introduce el correo electrónico que tendrá acceso absoluto a la gestión multiempresa del Portal Maestro.</p>
            <form onSubmit={handleAddSuperAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="superadmin@sistema.com"
                  value={superAdminEmail}
                  onChange={(e) => setSuperAdminEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsSuperAdminModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-bold transition-all"
                >
                  Pre-autorizar Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal: Editar Usuario Global */}
      {isEditUserModalOpen && selectedUserProfile && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl w-full max-w-md p-6 overflow-hidden shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-2">Editar Usuario</h3>
            <p className="text-zinc-500 text-xs mb-4">
              Modifica los datos globales del perfil de <strong className="text-white">{selectedUserProfile.email}</strong>.
            </p>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={editUserNombre}
                  onChange={(e) => setEditUserNombre(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Empresa</label>
                <select
                  value={editUserEmpresaId}
                  onChange={(e) => setEditUserEmpresaId(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="default">Sin Empresa (Global)</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Rol en el Sistema</label>
                <select
                  value={editUserRol}
                  onChange={(e) => setEditUserRol(e.target.value as any)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="Administrador">Administrador</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Técnico">Técnico</option>
                  <option value="Solo lectura">Solo lectura</option>
                  {selectedUserProfile.rol === "Superadmin" && (
                    <option value="Superadmin">Superadmin (Sin Empresa)</option>
                  )}
                </select>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="edit-user-activo"
                  checked={editUserActivo}
                  onChange={(e) => setEditUserActivo(e.target.checked)}
                  disabled={selectedUserProfile.user_id === user?.id}
                  className="rounded border-zinc-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-zinc-900 disabled:opacity-50"
                />
                <label htmlFor="edit-user-activo" className="text-xs font-medium text-zinc-300">Usuario activo para login</label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsEditUserModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-bold transition-all"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Invitar Usuario Global */}
      {isGlobalInviteModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl w-full max-w-md p-6 overflow-hidden shadow-2xl animate-fade-in relative">
            <button
              onClick={() => setIsGlobalInviteModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-lg transition-all"
            >
              <XCircle className="w-5 h-5" />
            </button>
            
            <h3 className="text-lg font-bold text-white mb-2">Invitar Usuario Global</h3>
            <p className="text-zinc-500 text-xs mb-4">
              Crea un perfil de usuario en estado "Pendiente de activación" asignado a una empresa específica o global.
            </p>
            <form onSubmit={handleGlobalInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  value={globalInviteNombre}
                  onChange={(e) => setGlobalInviteNombre(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="usuario@empresa.com"
                  value={globalInviteEmail}
                  onChange={(e) => setGlobalInviteEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Asignar a Empresa</label>
                <select
                  value={globalInviteEmpresaId}
                  onChange={(e) => setGlobalInviteEmpresaId(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="default">Sin Empresa (Global)</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Rol en el Sistema</label>
                <select
                  value={globalInviteRol}
                  onChange={(e) => setGlobalInviteRol(e.target.value as any)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="Administrador">Administrador (Gestión total de la empresa)</option>
                  <option value="Supervisor">Supervisor (Parámetros técnicos y configuraciones)</option>
                  <option value="Técnico">Técnico (Ingreso de registros y mantenimientos)</option>
                  <option value="Solo lectura">Solo lectura (Reportes y visualizaciones)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsGlobalInviteModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={globalInviteSubmitting}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                >
                  {globalInviteSubmitting ? "Enviando..." : "Crear Invitación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: Buzón de Correo Simulado para Superadmin */}
      {invitedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0b0c10] border border-amber-500/30 rounded-3xl shadow-2xl shadow-amber-500/5 overflow-hidden animate-fade-in">
            {/* Header / Top Ribbon */}
            <div className="bg-gradient-to-r from-amber-600/20 via-[#12131a] to-amber-600/20 px-6 py-4 border-b border-amber-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <Mail className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider font-mono">Portal Maestro - Buzón Simulado</span>
              </div>
              <button
                onClick={() => setInvitedUser(null)}
                className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded-lg transition-all"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Simulated Envelope Details */}
            <div className="p-6 bg-[#12131a]/80 space-y-4 text-xs text-zinc-400 border-b border-white/5">
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <span className="font-semibold text-zinc-500">De:</span>
                <span className="text-zinc-300 font-medium">Portal Maestro SaaS &lt;no-reply@saas-mantenimiento.com&gt;</span>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <span className="font-semibold text-zinc-500">Para:</span>
                <span className="text-emerald-400 font-mono font-medium">{invitedUser.email}</span>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <span className="font-semibold text-zinc-500">Asunto:</span>
                <span className="text-white font-bold">🔑 Invitación para unirte al Sistema de Mantenimiento</span>
              </div>
            </div>

            {/* Email Body Mockup */}
            <div className="p-8 bg-black/60 flex flex-col items-center">
              <div className="w-full max-w-md bg-[#0f111a] border border-white/5 rounded-2xl p-8 space-y-6 text-sm text-zinc-300 shadow-inner">
                <div className="text-center pb-4 border-b border-white/5">
                  <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Invitación del Administrador SaaS</h3>
                </div>

                <div className="space-y-4 text-xs">
                  <p>Hola <strong>{invitedUser.nombre}</strong>,</p>
                  <p className="leading-relaxed">
                    Un Superadministrador del sistema te ha invitado a formar parte de nuestra plataforma de mantenimiento en la empresa: <strong>{
                      companies.find(c => c.id === invitedUser.empresa_id)?.nombre || "Sin Empresa (Global)"
                    }</strong> con el rol de <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-200 rounded font-mono">{invitedUser.rol}</span>.
                  </p>
                  <p>
                    Para activar tu cuenta de usuario y definir tu contraseña segura de ingreso, haz clic en el siguiente enlace:
                  </p>
                </div>

                <div className="text-center py-2">
                  <a
                    href={`${window.location.origin}/auth?invite=true&email=${encodeURIComponent(invitedUser.email)}&nombre=${encodeURIComponent(invitedUser.nombre)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl shadow-lg shadow-amber-500/10 transition-all text-xs"
                  >
                    Establecer Contraseña
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <div className="pt-4 border-t border-white/5 text-center text-[10px] text-zinc-500 leading-relaxed">
                  Enlace manual de activación:
                  <div className="mt-2 p-2 bg-black/50 border border-white/5 rounded-lg font-mono select-all break-all text-left text-zinc-400">
                    {`${window.location.origin}/auth?invite=true&email=${encodeURIComponent(invitedUser.email)}&nombre=${encodeURIComponent(invitedUser.nombre)}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Sandbox Actions Footer */}
            <div className="p-6 bg-[#0f111a] border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-zinc-400 text-center sm:text-left max-w-sm">
                <span className="text-amber-500 font-bold">Modo Sandbox Superadmin:</span> Permite activar la cuenta de manera rápida para pruebas de flujos.
              </p>
              
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-center">
                <button
                  onClick={() => handleCopyLink(`${window.location.origin}/auth?invite=true&email=${encodeURIComponent(invitedUser.email)}&nombre=${encodeURIComponent(invitedUser.nombre)}`)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 border border-white/5 text-zinc-300 font-medium text-xs rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copiado" : "Copiar Enlace"}
                </button>
                <a
                  href={`${window.location.origin}/auth?invite=true&email=${encodeURIComponent(invitedUser.email)}&nombre=${encodeURIComponent(invitedUser.nombre)}`}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-xs rounded-xl hover:bg-amber-500 hover:text-black transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Probar Activación
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
