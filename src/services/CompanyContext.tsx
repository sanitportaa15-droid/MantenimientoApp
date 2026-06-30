import React, { createContext, useContext, useState, useEffect } from "react";
import { db, setActiveCompanyId } from "./db";
import { EmpresaIdentidad } from "../types/supabase";
import { useAuth } from "./AuthContext";

interface CompanyContextType {
  company: EmpresaIdentidad;
  loading: boolean;
  refreshCompany: () => Promise<void>;
  updateCompany: (data: Omit<EmpresaIdentidad, 'id' | 'created_at'> & { id?: string }) => Promise<EmpresaIdentidad>;
}

const defaultEmpresa: EmpresaIdentidad = {
  id: "default",
  nombre: "Sistema de Mantenimiento",
  logo_url: null,
  color_principal: "#10b981",
  color_secundario: "#06b6d4",
  email: "",
  telefono: "",
  direccion: "",
  sitio_web: ""
};

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [company, setCompany] = useState<EmpresaIdentidad>(defaultEmpresa);
  const [loading, setLoading] = useState(true);

  const refreshCompany = async () => {
    try {
      const data = await db.empresa_identidad.get();
      setCompany(data);
      if (data && data.id) {
        setActiveCompanyId(data.id);
      }
    } catch (error) {
      console.error("Error loading company identity:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateCompany = async (data: Omit<EmpresaIdentidad, 'id' | 'created_at'> & { id?: string }) => {
    try {
      const updated = await db.empresa_identidad.save({
        ...data,
        id: company.id === "default" ? undefined : company.id
      });
      setCompany(updated);
      if (updated && updated.id) {
        setActiveCompanyId(updated.id);
      }
      return updated;
    } catch (error) {
      console.error("Error updating company identity:", error);
      throw error;
    }
  };

  useEffect(() => {
    refreshCompany();
  }, [profile?.empresa_id]);

  useEffect(() => {
    if (company?.nombre) {
      document.title = company.nombre;
    } else {
      document.title = "Sistema de Mantenimiento";
    }

    // Set custom theme colors if configured
    if (company?.color_principal) {
      document.documentElement.style.setProperty('--color-primary', company.color_principal);
    } else {
      document.documentElement.style.removeProperty('--color-primary');
    }

    if (company?.color_secundario) {
      document.documentElement.style.setProperty('--color-secondary', company.color_secundario);
    } else {
      document.documentElement.style.removeProperty('--color-secondary');
    }
  }, [company]);

  return (
    <CompanyContext.Provider value={{ company, loading, refreshCompany, updateCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
}
