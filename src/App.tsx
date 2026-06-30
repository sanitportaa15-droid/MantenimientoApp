import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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
import { db } from "./services/db";
import { CompanyProvider } from "./services/CompanyContext";
import { AuthProvider, useAuth } from "./services/AuthContext";
import AuthPage from "./pages/AuthPage";
import UsersPage from "./pages/UsersPage";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070707] text-zinc-100 flex flex-col items-center justify-center gap-4 font-sans">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-emerald-500/20" />
        <p className="text-zinc-500 text-sm font-medium">Verificando sesión...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clientes" element={<ClientsPage />} />
        <Route path="/clientes/nuevo" element={<NewClientPage />} />
        <Route path="/clientes/editar/:id" element={<NewClientPage />} />
        <Route path="/usuarios" element={<UsersPage />} />
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
        <Route path="/lavado" element={<LavadoPage />} />
        <Route path="/config/tecnica" element={<TechnicalConfigPage />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  useEffect(() => {
    // Seed default configurations on app load
    db.configuracion.seed().catch(console.error);
    db.insumos.seed().then(() => {
      db.insumos.migratePezoneras().catch(console.error);
    }).catch(console.error);
  }, []);

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

