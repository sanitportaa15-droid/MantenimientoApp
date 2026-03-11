import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import NewClientPage from "./pages/NewClientPage";
import NewTamboPage from "./pages/NewTamboPage";
import TamboDetailPage from "./pages/TamboDetailPage";
import ConfigPage from "./pages/ConfigPage";
import TambosPage from "./pages/TambosPage";
import { db } from "./services/db";

export default function App() {
  useEffect(() => {
    // Seed default configurations on app load
    db.configuracion.seed().catch(console.error);
  }, []);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/clientes/nuevo" element={<NewClientPage />} />
          <Route path="/tambos" element={<TambosPage />} />
          <Route path="/tambos/nuevo" element={<NewTamboPage />} />
          <Route path="/tambos/:id" element={<TamboDetailPage />} />
          <Route path="/config" element={<ConfigPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
