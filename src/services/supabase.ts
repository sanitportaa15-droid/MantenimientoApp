import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/supabase";

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

console.log("SUPABASE URL:", supabaseUrl);
console.log("SUPABASE KEY:", supabaseKey?.substring(0, 20));

// Combine two AbortSignals to respect both the original signal and our timeout signal
const combineSignals = (signal1?: AbortSignal, signal2?: AbortSignal): AbortSignal | undefined => {
  if (!signal1) return signal2;
  if (!signal2) return signal1;
  
  const controller = new AbortController();
  
  const onAbort = () => {
    controller.abort();
    cleanup();
  };
  
  const cleanup = () => {
    signal1.removeEventListener('abort', onAbort);
    signal2.removeEventListener('abort', onAbort);
  };
  
  if (signal1.aborted || signal2.aborted) {
    controller.abort();
    return controller.signal;
  }
  
  signal1.addEventListener('abort', onAbort);
  signal2.addEventListener('abort', onAbort);
  
  return controller.signal;
};

const DEFAULT_TIMEOUT_MS = 15000; // 15 seconds

const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let attempts = 0;
  const maxAttempts = 2; // Retry once

  const executeWithTimeout = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, DEFAULT_TIMEOUT_MS);

    const mergedInit = {
      ...init,
      signal: combineSignals(init?.signal, controller.signal)
    };

    try {
      const response = await fetch(input, mergedInit as any);
      return response;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error("La consulta de base de datos tardó demasiado (Timeout). Comprueba tu conexión a internet.");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const response = await executeWithTimeout();
      
      // If unauthorized (e.g. JWT expired), try to force getSession to refresh token, then retry the request once
      if (response.status === 401 && attempts < maxAttempts) {
        console.warn("Recibido error 401 (Sesión expirada). Intentando renovar token...");
        try {
          if (typeof supabase !== 'undefined' && supabase && supabase.auth) {
            await supabase.auth.getSession();
          }
        } catch (refreshErr) {
          console.error("Error al refrescar sesión durante el reintento:", refreshErr);
        }
        continue;
      }
      
      return response;
    } catch (err: any) {
      if (attempts >= maxAttempts) {
        throw err;
      }
      console.warn(`La consulta de Supabase falló (intento ${attempts}/${maxAttempts}), reintentando... Error:`, err);
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  throw new Error("No se pudo conectar con la base de datos después de múltiples reintentos.");
};

export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      fetch: customFetch
    }
  }
);
