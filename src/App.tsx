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
import { db } from "./services/db";

export default function App() {
  useEffect(() => {
    // Seed default configurations on app load
    db.configuracion.seed().catch(console.error);
    db.pezoneras.seed().catch(console.error);
    db.componentes.seed().catch(console.error);
  }, []);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/clientes/nuevo" element={<NewClientPage />} />
          <Route path="/clientes/editar/:id" element={<NewClientPage />} />
          <Route path="/tambos" element={<TambosPage />} />
          <Route path="/tambos/nuevo" element={<NewTamboPage />} />
          <Route path="/tambos/editar/:id" element={<NewTamboPage />} />
          <Route path="/tambos/:id" element={<TamboDetailPage />} />
          <Route path="/reclamos" element={<ReclamosPage />} />
          <Route path="/reclamos/nuevo" element={<NewReclamoPage />} />
          <Route path="/reclamos/editar/:id" element={<NewReclamoPage />} />
          <Route path="/reclamos/convertir/:id" element={<ConvertReclamoPage />} />
          <Route path="/analisis-tecnico" element={<TechnicalAnalysisPage />} />
          <Route path="/analisis-tecnico/:id" element={<TamboTechnicalAnalysisPage />} />
          <Route path="/mantenimientos-estado" element={<MaintenanceStatusPage />} />
          <Route path="/proximos" element={<UpcomingPage />} />
          <Route path="/config/tecnica" element={<TechnicalConfigPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
