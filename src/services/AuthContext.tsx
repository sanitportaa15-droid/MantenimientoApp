import React, { createContext, useContext, useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { db, setActiveCompanyId, setActiveUserRole } from "./db";
import { Perfil } from "../types/supabase";

interface AuthContextType {
  user: User | null;
  profile: Perfil | null;
  isSuperAdmin: boolean;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  login: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, nombre: string, companyName?: string) => Promise<any>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Omit<Perfil, 'id' | 'created_at'>>) => Promise<Perfil>;
  retryFetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Perfil | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userRef = React.useRef<User | null>(null);
  const profileRef = React.useRef<Perfil | null>(null);

  const setUserAndRef = (u: User | null) => {
    setUser(u);
    userRef.current = u;
  };

  const setProfileAndRef = (p: Perfil | null) => {
    setProfile(p);
    profileRef.current = p;
  };

  // Sync user profile from database
  const fetchProfile = async (u: User) => {
    setError(null);
    console.log("Paso 6: Iniciando fetchProfile para usuario ID:", u.id, "Email:", u.email);
    try {
      let isSA = false;
      try {
        let superAdminRec = await db.super_administradores.getByUserId(u.id);
        if (!superAdminRec && u.email) {
          superAdminRec = await db.super_administradores.getByEmail(u.email);
          if (superAdminRec && !superAdminRec.user_id && u.id) {
            await db.super_administradores.update(superAdminRec.id, { user_id: u.id });
          }
        }
        isSA = !!superAdminRec;
      } catch (err) {
        console.warn("No se pudo verificar el estado de Superadmin:", err);
      }
      setIsSuperAdmin(isSA);

      const getProfileTask = (async () => {
        // 1. Get profile by user_id
        console.log("Paso 7: Ejecutando db.perfiles.getByUserId para id:", u.id);
        console.time("Supabase: db.perfiles.getByUserId");
        let p;
        try {
          p = await db.perfiles.getByUserId(u.id);
          console.log("Paso 8: db.perfiles.getByUserId resuelto con perfil:", p);
        } catch (error) {
          console.log("Paso 8 - ERROR: db.perfiles.getByUserId falló con:", error);
          throw error;
        } finally {
          console.timeEnd("Supabase: db.perfiles.getByUserId");
        }
        
        // 2. If no profile exists, check if there's an invitation or profile by email
        if (!p && u.email) {
          console.log("Paso 9: Ejecutando db.perfiles.getByEmail para email:", u.email);
          console.time("Supabase: db.perfiles.getByEmail");
          try {
            p = await db.perfiles.getByEmail(u.email);
            console.log("Paso 10: db.perfiles.getByEmail resuelto con perfil:", p);
          } catch (error) {
            console.log("Paso 10 - ERROR: db.perfiles.getByEmail falló con:", error);
            throw error;
          } finally {
            console.timeEnd("Supabase: db.perfiles.getByEmail");
          }

          if (p) {
            // Link invited/existing profile to this newly authenticated user
            console.log("Paso 11: Ejecutando db.perfiles.update para vincular perfil id:", p.id);
            console.time("Supabase: db.perfiles.update (Link existing profile)");
            try {
              p = await db.perfiles.update(p.id, { user_id: u.id, rol: "Administrador" });
              console.log("Paso 12: db.perfiles.update resuelto con perfil:", p);
            } catch (error) {
              console.log("Paso 12 - ERROR: db.perfiles.update falló con:", error);
              throw error;
            } finally {
              console.timeEnd("Supabase: db.perfiles.update (Link existing profile)");
            }
          }
        }

        // 3. Fallback: If absolutely no profile exists, auto-provision a profile
        // connected to the existing "GanPor" company to ensure no broken state
        if (!p && u.email && !isSA) {
          let targetCompanyId = "d1a58a74-9f93-4e8c-8c08-0123456789ab"; // default ID
          try {
            console.log("Paso 13: Ejecutando consulta de empresa_identidad en fetchProfile");
            console.time("Supabase: select * from empresa_identidad");
            const { data: companies, error: companiesError } = await (supabase.from("empresa_identidad") as any).select("*");
            console.timeEnd("Supabase: select * from empresa_identidad");

            if (companiesError) {
              console.log("Paso 14 - ERROR: select * from empresa_identidad falló con:", companiesError);
            } else {
              console.log("Paso 14: Consulta de empresa_identidad resuelta con:", companies);
            }

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
            console.log("Paso 14 - ERROR EXCEPCIÓN: select * from empresa_identidad lanzó:", e);
            console.error("Error finding existing GanPor company:", e);
          }

          console.log("Paso 15: Ejecutando db.perfiles.create para aprovisionar perfil para usuario id:", u.id);
          console.time("Supabase: db.perfiles.create (Provision profile)");
          try {
            p = await db.perfiles.create({
              user_id: u.id,
              empresa_id: targetCompanyId,
              nombre: u.email.split("@")[0],
              email: u.email,
              rol: "Administrador",
              activo: true
            });
            console.log("Paso 16: db.perfiles.create resuelto con perfil:", p);
          } catch (error) {
            console.log("Paso 16 - ERROR: db.perfiles.create falló con:", error);
            throw error;
          } finally {
            console.timeEnd("Supabase: db.perfiles.create (Provision profile)");
          }
        }
        return p;
      })();

      const p = await getProfileTask;
      let finalProfile: Perfil | null = p;

      if (!finalProfile) {
        if (isSA) {
          finalProfile = {
            id: "superadmin-profile",
            user_id: u.id,
            empresa_id: null,
            nombre: u.email?.split("@")[0] || "Superadmin",
            email: u.email || "",
            rol: "Superadmin",
            activo: true,
            created_at: new Date().toISOString(),
            ultimo_acceso: new Date().toISOString()
          };
        } else {
          throw new Error("No se pudo recuperar ni crear un perfil para este usuario.");
        }
      } else {
        if (isSA) {
          // Self-heal: If in-database profile still has an enterprise or incorrect role, update it!
          if (finalProfile.empresa_id !== null || finalProfile.rol !== "Superadmin") {
            const healedProfile = { ...finalProfile, rol: "Superadmin" as const, empresa_id: null };
            db.perfiles.update(finalProfile.id, { empresa_id: null, rol: "Superadmin" }).catch(err => {
              console.error("Error auto-sanando perfil del Superadmin en base de datos:", err);
            });
            finalProfile = healedProfile;
          } else {
            finalProfile = { ...finalProfile, rol: "Superadmin" as const, empresa_id: null };
          }
        }
      }

      setProfileAndRef(finalProfile);
      setLoading(false);
      console.log("Paso 17: fetchProfile finalizado con éxito. Perfil cargado:", finalProfile);
      
      // Update last login timestamp asynchronously
      if (finalProfile && finalProfile.id !== "superadmin-profile") {
        db.perfiles.updateUltimoAcceso(finalProfile.id).catch(err => {
          console.error("Error al actualizar ultimo_acceso del perfil:", err);
        });
      }

      // Sync active company and role in db services to make sure queries load correct tenant and enforce permissions
      if (finalProfile && finalProfile.empresa_id) {
        setActiveCompanyId(finalProfile.empresa_id);
      } else if (isSA) {
        const storedCompanyId = localStorage.getItem("activeCompanyId");
        if (storedCompanyId) {
          setActiveCompanyId(storedCompanyId);
        } else {
          setActiveCompanyId("default");
        }
      }
      if (finalProfile && finalProfile.rol) {
        setActiveUserRole(finalProfile.rol);
      }
    } catch (err: any) {
      console.log("Paso 18 - ERROR GLOBAL en fetchProfile:", err);
      console.error("Error fetching user profile:", err);
      setError(err?.message || "Ocurrió un error inesperado al verificar tu sesión.");
      setProfileAndRef(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let initialSessionFetched = false;

    // Check active session on mount
    console.log("Paso 1: Iniciando getSession() en el mount de AuthContext");
    console.time("Supabase: getSession");
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.timeEnd("Supabase: getSession");
      if (!isMounted) {
        console.log("Paso 2 (Desmontado): getSession() resuelto pero componente desmontado");
        return;
      }
      const currentUser = session?.user ?? null;
      console.log("Paso 2: getSession() resuelto con usuario:", currentUser ? currentUser.email : "ninguno", "ID:", currentUser ? currentUser.id : "ninguno");
      setUserAndRef(currentUser);
      if (currentUser) {
        fetchProfile(currentUser)
          .catch((err) => console.error("Error fetching profile on mount:", err))
          .finally(() => {
            initialSessionFetched = true;
            if (isMounted) setLoading(false);
          });
      } else {
        initialSessionFetched = true;
        if (isMounted) setLoading(false);
      }
    }).catch((err) => {
      console.timeEnd("Supabase: getSession");
      console.log("Paso 3 - ERROR: getSession() falló con:", err);
      console.error("Error getting session on mount:", err);
      initialSessionFetched = true;
      if (isMounted) setLoading(false);
    });

    // Listen for auth changes
    console.log("Paso 4: Registrando listener onAuthStateChange");
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        console.log("Paso 5 (Desmontado): onAuthStateChange disparado pero componente desmontado");
        return;
      }
      const currentUser = session?.user ?? null;
      console.log("Paso 5: onAuthStateChange disparado con evento:", event, "usuario:", currentUser ? currentUser.email : "ninguno");
      
      // Ignore INITIAL_SESSION as it's fully handled by getSession()
      if (event === "INITIAL_SESSION") {
        console.log("Paso 5b: Ignorando INITIAL_SESSION en onAuthStateChange porque ya lo maneja getSession()");
        return;
      }

      // Ignore SIGNED_IN during initial mount load if getSession is still running
      if (event === "SIGNED_IN" && !initialSessionFetched) {
        console.log("Paso 5c: Ignorando SIGNED_IN inicial en onAuthStateChange porque getSession() está en progreso");
        return;
      }

      // Handle only expected events: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED
      const allowedEvents = ["SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED", "USER_UPDATED"];
      if (!allowedEvents.includes(event)) {
        console.log("Paso 5d: Ignorando evento no permitido:", event);
        return;
      }

      // If SIGNED_OUT, clean state immediately and return
      if (event === "SIGNED_OUT") {
        setUserAndRef(null);
        setProfileAndRef(null);
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      // Update user state immediately (non-blocking)
      setUserAndRef(currentUser);

      // Rule 1: Do not reload profile on TOKEN_REFRESHED if profile is already loaded in memory and matches the user
      if (event === "TOKEN_REFRESHED" && profileRef.current && currentUser && profileRef.current.user_id === currentUser.id) {
        console.log("Paso 5e: TOKEN_REFRESHED recibido. El perfil ya existe en memoria y coincide con el usuario. Omitiendo fetchProfile()");
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      // Rule 2 & 3: Do not use await fetchProfile() directly in the callback. Run it in a decoupled way
      // so this callback ends immediately, freeing the Supabase token refresh execution path.
      if (currentUser) {
        console.log("Paso 5f: Ejecutando fetchProfile() desacoplado para evento:", event);
        setTimeout(() => {
          if (!isMounted) return;
          // Only fetch if still mounted and user matches
          if (userRef.current?.id === currentUser.id) {
            // Rule 4 & 5: Check again if profile already exists in memory and matches the user
            if (profileRef.current && profileRef.current.user_id === currentUser.id) {
              console.log("Paso 5g (Desacoplado): Omitiendo fetchProfile porque el perfil ya está cargado para este usuario");
              setLoading(false);
              return;
            }
            fetchProfile(currentUser).catch((err) => {
              console.error("Error fetching profile asynchronously:", err);
            });
          }
        }, 0);
      } else {
        setProfileAndRef(null);
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      console.log("Paso 28: Desmontando AuthProvider, desuscribiendo listener");
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      localStorage.removeItem("activeCompanyId");
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
        setProfileAndRef(updated);
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

        setProfileAndRef(finalProfile);
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
      localStorage.removeItem("activeCompanyId");
      setActiveCompanyId("default");
      await supabase.auth.signOut();
      setUserAndRef(null);
      setProfileAndRef(null);
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
      setProfileAndRef(updated);
      return updated;
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  };

  const clearError = () => setError(null);

  const retryFetchProfile = async () => {
    if (user) {
      setLoading(true);
      await fetchProfile(user);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, isSuperAdmin, loading, error, clearError, login, signUp, logout, updateProfile, retryFetchProfile }}>
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
