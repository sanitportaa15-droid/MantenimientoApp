import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import NewClientPage from "./pages/NewClientPage";
import NewTamboPage from "./pages/NewTamboPage";
import TamboDetailPage from "./pages/TamboDetailPage";
import TechnicalConfigPage from "./pages/TechnicalConfigPage";
import TambosPage from "./pages/TambosPage";
import ReclamosPage from "./pages/ReclamosPage";
import NewReclamoPage from "./pages/NewReclamoPage";
import ConvertReclamoPage from "./pages/ConvertReclamoPage";
import TechnicalAnalysisPage from "./pages/TechnicalAnalysisPage";
import TamboTechnicalAnalysisPage from "./pages/TamboTechnicalAnalysisPage";
import MaintenanceStatusPage from "./pages/MaintenanceStatusPage";
import UpcomingPage from "./pages/UpcomingPage";
import InsumosPage from "./pages/InsumosPage";
import LavadoPage from "./pages/LavadoPage";
import WorkOrdersPage from "./pages/WorkOrdersPage";
import WorkOrderDetailPage from "./pages/WorkOrderDetailPage";
import { db } from "./services/db";
import { CompanyProvider, useCompany } from "./services/CompanyContext";
import { AuthProvider, useAuth } from "./services/AuthContext";
import AuthPage from "./pages/AuthPage";
import UsersPage from "./pages/UsersPage";
import EmpresasPage from "./pages/EmpresasPage";
import PortalMaestroPage from "./pages/PortalMaestroPage";

function AppContent() {
  const { user, profile, isSuperAdmin, loading: authLoading, error, logout, retryFetchProfile } = useAuth();
  const { company, loading: companyLoading } = useCompany();
  const location = useLocation();

  if (authLoading || companyLoading) {
    return (
      <div className="min-h-screen bg-[#070707] text-zinc-100 flex flex-col items-center justify-center gap-4 font-sans">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-emerald-500/20" />
        <p className="text-zinc-500 text-sm font-medium">Verificando sesión...</p>
      </div>
    );
  }

  if (error && user) {
    return (
      <div className="min-h-screen bg-[#070707] text-zinc-100 flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center shadow-2xl">
          <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Error de Sesión</h2>
          <p className="text-zinc-400 text-sm mb-6">{error}</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={retryFetchProfile}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Reintentar
            </button>
            <button
              onClick={logout}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const isInspecting = isSuperAdmin && company && company.id !== "default" && !!localStorage.getItem("activeCompanyId");

  // Redirect non-Superadmin away from /admin
  if (!isSuperAdmin && location.pathname.startsWith("/admin")) {
    return <Navigate to="/" replace />;
  }

  // Redirect Superadmin to /admin if logged in, not inspecting, and not already on /admin
  if (isSuperAdmin && !isInspecting && !location.pathname.startsWith("/admin")) {
    return <Navigate to="/admin" replace />;
  }

  // Render isolated Portal Maestro for Superadmin when not inspecting
  if (isSuperAdmin && !isInspecting && location.pathname.startsWith("/admin")) {
    return (
      <Routes>
        <Route path="/admin" element={<PortalMaestroPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  // SaaS License Suspension/Cancellation Guard
  const isSuspended = profile?.rol !== "Superadmin" && (
    company?.estado === "Suspendida" || 
    company?.estado === "Cancelada" || 
    company?.activa === false
  );

  if (isSuspended) {
    return (
      <div className="min-h-screen bg-[#070707] text-zinc-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Background Decorative Blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-md w-full bg-[#0f0f0f] border border-white/5 rounded-2xl p-8 text-center shadow-2xl relative z-10">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">Suscripción Suspendida</h2>
          <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
            La licencia de servicio de su empresa se encuentra inactiva, suspendida o cancelada.
          </p>
          <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
            Comuníquese con el administrador de su cuenta o con el soporte técnico del sistema para reactivar su licencia y recuperar el acceso.
          </p>
          <button
            onClick={() => logout()}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-semibold py-3 px-4 rounded-xl transition-all text-sm border border-white/5"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clientes" element={<ClientsPage />} />
        <Route path="/clientes/nuevo" element={<NewClientPage />} />
        <Route path="/clientes/editar/:id" element={<NewClientPage />} />
        <Route path="/usuarios" element={<UsersPage />} />
        <Route path="/empresas" element={<EmpresasPage />} />
        <Route path="/tambos" element={<TambosPage />} />
        <Route path="/tambos/nuevo" element={<NewTamboPage />} />
        <Route path="/tambos/editar/:id" element={<NewTamboPage />} />
        <Route path="/tambos/:id" element={<TamboDetailPage />} />
        <Route path="/insumos" element={<InsumosPage />} />
        <Route path="/reclamos" element={<ReclamosPage />} />
        <Route path="/reclamos/nuevo" element={<NewReclamoPage />} />
        <Route path="/reclamos/editar/:id" element={<NewReclamoPage />} />
        <Route path="/reclamos/convertir/:id" element={<ConvertReclamoPage />} />
        <Route path="/analisis-tecnico" element={<TechnicalAnalysisPage />} />
        <Route path="/analisis-tecnico/:id" element={<TamboTechnicalAnalysisPage />} />
        <Route path="/mantenimientos-estado" element={<MaintenanceStatusPage />} />
        <Route path="/proximos" element={<UpcomingPage />} />
        <Route path="/ordenes" element={<WorkOrdersPage />} />
        <Route path="/ordenes/:id" element={<WorkOrderDetailPage />} />
        <Route path="/lavado" element={<LavadoPage />} />
        <Route path="/config/tecnica" element={<TechnicalConfigPage />} />
      </Routes>
    </Layout>
  );
}

export default function App() {


  return (
    <AuthProvider>
      <CompanyProvider>
        <Router>
          <AppContent />
        </Router>
      </CompanyProvider>
    </AuthProvider>
  );
}

