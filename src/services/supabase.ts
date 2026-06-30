import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/supabase";

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

console.log("SUPABASE URL:", supabaseUrl);
console.log("SUPABASE KEY:", supabaseKey?.substring(0, 20));

const rawSupabase = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-key"
);

// Wrapper for Query Builders to log exact queries
function wrapBuilder(builder: any, tableName: string, querySteps: string[] = []): any {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === 'then' && typeof target[prop] === 'function') {
        const originalThen = target[prop];
        return function(onfulfilled: any, onrejected: any) {
          const startTime = performance.now();
          const screen = window.location.pathname;
          const queryString = `${tableName}.${querySteps.join('.')}`;
          console.log(`[QUERY_START] Pantalla: ${screen} | Consulta: ${queryString}`);
          
          return originalThen.call(target, 
            (res: any) => {
              const duration = (performance.now() - startTime).toFixed(1);
              if (res && res.error) {
                console.error(`[QUERY_ERROR] Pantalla: ${screen} | Consulta: ${queryString} | Duración: ${duration}ms | Error:`, res.error);
              } else {
                console.log(`[QUERY_SUCCESS] Pantalla: ${screen} | Consulta: ${queryString} | Duración: ${duration}ms`);
              }
              if (onfulfilled) return onfulfilled(res);
              return res;
            },
            (err: any) => {
              const duration = (performance.now() - startTime).toFixed(1);
              console.error(`[QUERY_FAILED] Pantalla: ${screen} | Consulta: ${queryString} | Duración: ${duration}ms | Excepción:`, err);
              if (onrejected) return onrejected(err);
              throw err;
            }
          );
        };
      }

      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return function(...args: any[]) {
          const argStr = args.map(a => {
            if (typeof a === 'object') {
              try {
                return JSON.stringify(a);
              } catch (e) {
                return '[Object]';
              }
            }
            return String(a);
          }).join(', ');
          const step = `${String(prop)}(${argStr})`;
          const result = value.apply(target, args);
          if (result && (typeof result === 'object' || typeof result === 'function')) {
            return wrapBuilder(result, tableName, [...querySteps, step]);
          }
          return result;
        };
      }
      return value;
    }
  });
}

// Wrapper for auth to log sessions and state changes
const wrappedAuth = new Proxy(rawSupabase.auth, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value === 'function') {
      return function(...args: any[]) {
        const startTime = performance.now();
        const screen = window.location.pathname;
        const authCall = `auth.${String(prop)}`;
        console.log(`[AUTH_START] Pantalla: ${screen} | Llamada: ${authCall}`);
        
        if (prop === 'onAuthStateChange') {
          const originalCallback = args[0];
          args[0] = function(event: any, session: any) {
            console.log(`[AUTH_EVENT] Pantalla: ${screen} | Evento: ${event} | Usuario: ${session?.user?.email || 'ninguno'}`);
            return originalCallback(event, session);
          };
        }

        const result = value.apply(target, args);
        
        if (result instanceof Promise) {
          return result.then(
            (res: any) => {
              const duration = (performance.now() - startTime).toFixed(1);
              if (res && res.error) {
                console.error(`[AUTH_ERROR] Pantalla: ${screen} | Llamada: ${authCall} | Duración: ${duration}ms | Error:`, res.error);
              } else {
                console.log(`[AUTH_SUCCESS] Pantalla: ${screen} | Llamada: ${authCall} | Duración: ${duration}ms`);
              }
              return res;
            },
            (err: any) => {
              const duration = (performance.now() - startTime).toFixed(1);
              console.error(`[AUTH_FAILED] Pantalla: ${screen} | Llamada: ${authCall} | Duración: ${duration}ms | Excepción:`, err);
              throw err;
            }
          );
        }
        
        return result;
      };
    }
    return value;
  }
});

// Main Supabase client proxy to intercept all calls
export const supabase = new Proxy(rawSupabase, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return function(tableName: string) {
        const builder = rawSupabase.from(tableName);
        return wrapBuilder(builder, tableName);
      };
    }
    if (prop === 'auth') {
      return wrappedAuth;
    }
    return Reflect.get(target, prop, receiver);
  }
}) as any;
