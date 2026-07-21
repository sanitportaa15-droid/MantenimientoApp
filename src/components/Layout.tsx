import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  Menu, 
  X, 
  ChevronRight,
  Droplets,
  MessageSquare,
  Terminal,
  Settings2,
  Wrench,
  Calendar,
  Package,
  Sparkles,
  LogOut,
  Shield,
  ClipboardList,
  Building2,
  ArrowLeft,
  Brain
} from "lucide-react";
import { cn } from "../utils/ui";
import { useCompany } from "../services/CompanyContext";
import { useAuth } from "../services/AuthContext";
import { setActiveCompanyId } from "../services/db";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { company, refreshCompany } = useCompany();
  const { profile, isSuperAdmin, logout } = useAuth();

  const handleExitInspection = async () => {
    localStorage.removeItem("activeCompanyId");
    setActiveCompanyId("default");
    await refreshCompany();
    window.location.href = "/admin";
  };

  const isInspecting = isSuperAdmin && company && company.id !== "default" && !!localStorage.getItem("activeCompanyId");

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Clientes", path: "/clientes", icon: Users },
    { name: "Tambos", path: "/tambos", icon: Droplets },
    { name: "Próximos", path: "/proximos", icon: Calendar },
    { name: "Órdenes de Trabajo", path: "/ordenes", icon: ClipboardList },
    { name: "Reclamos", path: "/reclamos", icon: MessageSquare },
    { name: "Análisis Técnico", path: "/analisis-tecnico", icon: Terminal },
    { name: "Lavado", path: "/lavado", icon: Sparkles },
    { name: "Diagnóstico IA", path: "/diagnostico-ia", icon: Brain },
    { name: "Configuración Técnica", path: "/config/tecnica", icon: Settings2 }
  ];

  if (profile?.rol === "Administrador" || profile?.rol === "Superadmin") {
    navItems.push({ name: "Usuarios", path: "/usuarios", icon: Shield });
  }

  if (profile?.rol === "Superadmin" && !isInspecting) {
    navItems.push({ name: "Empresas", path: "/empresas", icon: Building2 });
  }

  // Close sidebar on mobile when route changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans flex flex-col">
      {isInspecting && (
        <div className="bg-emerald-500 text-black px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-bold shrink-0 shadow-lg relative z-50">
          <span className="flex items-center gap-2">
            <Building2 className="w-4.5 h-4.5" />
            <span>MODO INSPECCIÓN MULTIEMPRESA: Viendo datos de {company.nombre}</span>
          </span>
          <button
            onClick={handleExitInspection}
            className="bg-black hover:bg-zinc-900 text-white px-3 py-1.5 rounded-xl transition-all font-semibold flex items-center gap-1.5 text-xs shadow-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al Portal Maestro
          </button>
        </div>
      )}

      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between p-4 border-b border-white/5 bg-[#0f0f0f] sticky top-0 z-50">
        <div className="flex items-center gap-2">
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.nombre} className="w-8 h-8 rounded-lg object-contain bg-white/5 p-0.5" />
          ) : (
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Droplets className="text-black w-5 h-5" />
            </div>
          )}
          <span className="font-bold tracking-tight text-lg">{company.nombre}</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-[#0f0f0f] border-r border-white/5 transform transition-transform duration-300 lg:translate-x-0 lg:fixed lg:h-screen lg:overflow-y-auto",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex flex-col min-h-full p-6">
            <div className="hidden lg:flex items-center gap-3 mb-10">
              {company.logo_url ? (
                <img src={company.logo_url} alt={company.nombre} className="w-10 h-10 rounded-xl object-contain bg-white/5 p-1 shadow-lg shadow-emerald-500/10" />
              ) : (
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Droplets className="text-black w-6 h-6" />
                </div>
              )}
              <div>
                <h1 className="font-bold tracking-tight text-lg leading-none break-words max-w-[150px]">{company.nombre}</h1>
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1 font-semibold">Mantenimiento</p>
              </div>
            </div>

            <nav className="space-y-1">
              {navItems
                .filter((item) => item.name !== "Próximos")
                .map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 rounded-xl transition-all group",
                        isActive 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={cn("w-5 h-5", isActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300")} />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      {isActive && <ChevronRight className="w-4 h-4" />}
                    </Link>
                  );
                })}
            </nav>

            {profile && (
              <div className="mt-6 pt-4 border-t border-white/5 space-y-4">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                    {profile.nombre.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate leading-none mb-1">
                      {profile.nombre}
                    </p>
                    <p className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
                      {profile.rol}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => logout()}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all group text-left"
                >
                  <LogOut className="w-4 h-4 text-zinc-500 group-hover:text-red-400 shrink-0" />
                  <span className="font-medium text-xs">Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen lg:ml-64 lg:max-w-[calc(100vw-16rem)]">
          <div className="p-4 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
