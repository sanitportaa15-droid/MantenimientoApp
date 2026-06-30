import React, { createContext, useContext, useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { db, setActiveCompanyId, setActiveUserRole } from "./db";
import { Perfil } from "../types/supabase";

interface AuthContextType {
  user: User | null;
  profile: Perfil | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, nombre: string, companyName?: string) => Promise<any>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Omit<Perfil, 'id' | 'created_at'>>) => Promise<Perfil>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync user profile from database
  const fetchProfile = async (u: User) => {
    try {
      // 1. Get profile by user_id
      let p = await db.perfiles.getByUserId(u.id);
      
      // 2. If no profile exists, check if there's an invitation or profile by email
      if (!p && u.email) {
        p = await db.perfiles.getByEmail(u.email);
        if (p) {
          // Link invited/existing profile to this newly authenticated user
          p = await db.perfiles.update(p.id, { user_id: u.id, rol: "Administrador" });
        }
      }

      // 3. Fallback: If absolutely no profile exists, auto-provision a profile
      // connected to the existing "GanPor" company to ensure no broken state
      if (!p && u.email) {
        let targetCompanyId = "d1a58a74-9f93-4e8c-8c08-0123456789ab"; // default ID
        try {
          const { data: companies } = await (supabase.from("empresa_identidad") as any).select("*");
          if (companies && companies.length > 0) {
            // Find one with "ganpor" in its name
            const ganporComp = companies.find((c: any) => 
              c.nombre && c.nombre.toLowerCase().includes("ganpor")
            );
            if (ganporComp) {
              targetCompanyId = ganporComp.id;
            } else {
              // Fallback to the first company found
              targetCompanyId = companies[0].id;
            }
          }
        } catch (e) {
          console.error("Error finding existing GanPor company:", e);
        }

        p = await db.perfiles.create({
          user_id: u.id,
          empresa_id: targetCompanyId,
          nombre: u.email.split("@")[0],
          email: u.email,
          rol: "Administrador",
          activo: true
        });
      }

      setProfile(p);
      
      // Sync active company and role in db services to make sure queries load correct tenant and enforce permissions
      if (p) {
        if (p.empresa_id) {
          setActiveCompanyId(p.empresa_id);
        }
        if (p.rol) {
          setActiveUserRole(p.rol);
        }
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        setLoading(true);
        await fetchProfile(currentUser);
        setLoading(false);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      
      // Verify profile is active
      if (data.user) {
        const p = await db.perfiles.getByUserId(data.user.id);
        if (p && !p.activo) {
          await supabase.auth.signOut();
          throw new Error("Su cuenta de usuario ha sido desactivada por el administrador.");
        }
      }
      
      return data;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, nombre: string, companyName?: string) => {
    setLoading(true);
    try {
      // 1. Check if email is already pre-invited
      const existingInvite = await db.perfiles.getByEmail(email);

      // 2. Perform Supabase registration
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: nombre
          }
        }
      });
      if (error) throw error;

      if (!data.user) {
        throw new Error("No se pudo crear el usuario.");
      }

      const userId = data.user.id;

      if (existingInvite) {
        // Link pre-existing invitation
        const updated = await db.perfiles.update(existingInvite.id, { 
          user_id: userId,
          nombre: nombre // update with their preferred name
        });
        setProfile(updated);
        if (updated && updated.empresa_id) {
          setActiveCompanyId(updated.empresa_id);
        }
      } else {
        // Create new company if provided, otherwise default to "GanPor"
        let empresaId = "d1a58a74-9f93-4e8c-8c08-0123456789ab"; // Default GanPor
        let userRol: 'Administrador' | 'Supervisor' | 'Técnico' | 'Solo lectura' = "Administrador";

        if (companyName && companyName.trim() !== "") {
          // Creating a new tenant company!
          const newCompany = await db.empresa_identidad.save({
            nombre: companyName.trim(),
            logo_url: null,
            color_principal: "#10b981",
            color_secundario: "#06b6d4",
            email: email,
            telefono: "",
            direccion: "",
            sitio_web: ""
          });
          empresaId = newCompany.id;
        } else {
          // Search for existing "GanPor" company dynamically to avoid duplicate or new company creation
          try {
            const { data: companies } = await (supabase.from("empresa_identidad") as any).select("*");
            if (companies && companies.length > 0) {
              const ganporComp = companies.find((c: any) => 
                c.nombre && c.nombre.toLowerCase().includes("ganpor")
              );
              if (ganporComp) {
                empresaId = ganporComp.id;
              } else {
                empresaId = companies[0].id;
              }
            }
          } catch (e) {
            console.error("Error finding existing GanPor company in signUp:", e);
          }
        }

        // Check if profile already exists for this email/userId to ensure idempotency
        let existingProfile = await db.perfiles.getByEmail(email);
        if (!existingProfile) {
          existingProfile = await db.perfiles.getByUserId(userId);
        }

        let finalProfile;
        if (existingProfile) {
          finalProfile = await db.perfiles.update(existingProfile.id, {
            user_id: userId,
            empresa_id: empresaId,
            rol: userRol,
            activo: true
          });
        } else {
          finalProfile = await db.perfiles.create({
            user_id: userId,
            empresa_id: empresaId,
            nombre,
            email,
            rol: userRol,
            activo: true
          });
        }

        setProfile(finalProfile);
        setActiveCompanyId(empresaId);
      }

      return data;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: Partial<Omit<Perfil, 'id' | 'created_at'>>) => {
    if (!profile) throw new Error("No authenticated profile found.");
    try {
      const updated = await db.perfiles.update(profile.id, data);
      setProfile(updated);
      return updated;
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, signUp, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
