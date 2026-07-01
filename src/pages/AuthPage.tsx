import React, { useState, useEffect } from "react";
import { useAuth } from "../services/AuthContext";
import { supabase } from "../services/supabase";
import { db } from "../services/db";
import { Mail, Lock, User, Droplets, Eye, EyeOff, AlertCircle, Key, CheckCircle2, RefreshCw } from "lucide-react";

export default function AuthPage() {
  const { login, signUp } = useAuth();
  
  // 'login' | 'invite' (accepting user invitation) | 'reset' (performing password reset)
  const [mode, setMode] = useState<'login' | 'invite' | 'reset'>('login');
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // States for invitation status
  const [expired, setExpired] = useState(false);
  const [alreadyActive, setAlreadyActive] = useState(false);
  const [requestEmail, setRequestEmail] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

  // Parse parameters on mount
  useEffect(() => {
    const parseParamsAndHash = async () => {
      setError(null);
      setSuccessMsg(null);
      
      const params = new URLSearchParams(window.location.search);
      // Supabase appends parameters in hash, e.g. #access_token=...&type=invite
      const hashParams = new URLSearchParams(window.location.hash.replace("#", "?"));

      const isRealInvite = hashParams.get("type") === "invite" || hashParams.get("type") === "signup";
      const isSandboxInvite = params.get("invite") === "true";
      const isInvite = isRealInvite || isSandboxInvite;

      const isRealReset = hashParams.get("type") === "recovery";
      const isSandboxReset = params.get("reset") === "true";
      const isReset = isRealReset || isSandboxReset;

      // Handle official Supabase expiration error parameters
      const errorParam = params.get("error") || hashParams.get("error");
      const errorCodeParam = params.get("error_code") || hashParams.get("error_code");
      const errorDescParam = params.get("error_description") || hashParams.get("error_description");

      const isExpired = errorCodeParam === "otp_expired" || 
                        (errorDescParam && errorDescParam.toLowerCase().includes("expire")) ||
                        (errorDescParam && errorDescParam.toLowerCase().includes("invalid"));

      if (isExpired) {
        setExpired(true);
        setError("El enlace de invitación ha expirado o no es válido.");
        return;
      }

      if (isInvite) {
        setMode('invite');
        let emailParam = params.get("email") || "";
        let nombreParam = params.get("nombre") || "";

        // If real Supabase invite, get currently authenticated user from hash
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          emailParam = currentUser.email || "";
          nombreParam = currentUser.user_metadata?.display_name || currentUser.user_metadata?.full_name || nombreParam;
        }

        if (emailParam) {
          setEmail(emailParam);
          // Look up user profile to check if already activated
          try {
            const profileRec = await db.perfiles.getByEmail(emailParam);
            if (profileRec) {
              if (profileRec.nombre) nombreParam = profileRec.nombre;
              if (profileRec.user_id && profileRec.activo) {
                setAlreadyActive(true);
                setSuccessMsg("Esta cuenta de usuario ya se encuentra activa.");
                return;
              }
            }
          } catch (err) {
            console.error("Error al buscar perfil:", err);
          }
        }
        setNombre(nombreParam);
      } else if (isReset) {
        setMode('reset');
        let emailParam = "";
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          emailParam = currentUser.email || "";
        }
        if (emailParam) {
          setEmail(emailParam);
        }
      } else {
        setMode('login');
      }
    };

    parseParamsAndHash();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    if (mode === 'login') {
      if (!email || !password) {
        setError("Por favor complete todos los campos.");
        setLoading(false);
        return;
      }

      try {
        await login(email, password);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Credenciales incorrectas o cuenta inactiva. Por favor intente de nuevo.");
      } finally {
        setLoading(false);
      }
    } 
    else if (mode === 'invite') {
      if (!password || !confirmPassword) {
        setError("Por favor complete todos los campos de contraseña.");
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError("Las contraseñas ingresadas no coinciden.");
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        setLoading(false);
        return;
      }

      try {
        // Retrieve currently authenticated user (session established from the real invite link hash)
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          // Use official Supabase Auth to establish/update password for the user authenticated by the invite
          const { error: updateError } = await supabase.auth.updateUser({ password });
          if (updateError) throw updateError;

          // Update user profile status in database to mark it as Active
          const existingProfile = await db.perfiles.getByEmail(currentUser.email || email);
          if (existingProfile) {
            await db.perfiles.update(existingProfile.id, {
              user_id: currentUser.id,
              activo: true
            });
          }

          setSuccessMsg("¡Cuenta activada con éxito! Bienvenido al sistema.");
          setTimeout(() => {
            window.location.href = "/";
          }, 1500);
        } else {
          // Fallback to sandbox flow where the user isn't logged in yet
          await signUp(email, password, nombre);
          setSuccessMsg("¡Cuenta activada con éxito! Bienvenido al sistema.");
          setTimeout(() => {
            window.location.href = "/";
          }, 1500);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Error al activar la cuenta. Inténtelo de nuevo.");
      } finally {
        setLoading(false);
      }
    } 
    else if (mode === 'reset') {
      if (!password || !confirmPassword) {
        setError("Por favor ingrese y confirme su nueva contraseña.");
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError("Las contraseñas ingresadas no coinciden.");
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        setLoading(false);
        return;
      }

      try {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setSuccessMsg("¡Contraseña restablecida exitosamente! Redirigiendo al sistema...");
        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Error al restablecer la contraseña. Es posible que el enlace haya expirado.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRequestNewLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestLoading(true);
    setRequestSuccess(null);
    setError(null);

    if (!requestEmail) {
      setError("Por favor complete su correo electrónico.");
      setRequestLoading(false);
      return;
    }

    try {
      // Official Supabase API for password reset, which acts as a new password-setting invitation link
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(requestEmail.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/auth?reset=true`
      });
      if (resetError) throw resetError;

      setRequestSuccess("¡Se ha enviado un nuevo enlace para establecer tu contraseña a tu correo!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al solicitar el enlace. Verifique su correo.");
    } finally {
      setRequestLoading(false);
    }
  };

  const handleGoToLogin = () => {
    setExpired(false);
    setAlreadyActive(false);
    setMode('login');
    setError(null);
    setSuccessMsg(null);
    window.history.pushState({}, document.title, window.location.pathname);
  };

  return (
    <div className="min-h-screen bg-[#070707] text-zinc-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Decorative Blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/5 rounded-2xl shadow-2xl p-8 backdrop-blur-sm z-10 transition-all animate-fade-in">
        
        {/* EXPIRED STATE VIEW */}
        {expired ? (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/20 shadow-lg shadow-red-500/5">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">Invitación Expirada</h1>
              <p className="text-zinc-500 text-sm leading-relaxed">
                El enlace de activación ha caducado por motivos de seguridad o ya ha sido utilizado para activar la cuenta.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs text-left">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {requestSuccess && (
              <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl text-xs text-left">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <p>{requestSuccess}</p>
              </div>
            )}

            <form onSubmit={handleRequestNewLink} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
                    <Mail className="w-5 h-5" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="usuario@correo.com"
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={requestLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black py-3 px-4 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
              >
                {requestLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  "Solicitar un nuevo enlace"
                )}
              </button>
            </form>

            <button
              onClick={handleGoToLogin}
              className="text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-colors"
            >
              Volver al inicio de sesión
            </button>
          </div>
        ) : alreadyActive ? (
          /* ALREADY ACTIVE STATE VIEW */
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">Cuenta ya Activa</h1>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Esta cuenta de usuario ya ha sido activada anteriormente y se encuentra lista para iniciar sesión.
              </p>
            </div>

            {successMsg && (
              <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl text-xs text-left">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <p>{successMsg}</p>
              </div>
            )}

            <button
              onClick={handleGoToLogin}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-3 px-4 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-emerald-500/10"
            >
              Iniciar Sesión
            </button>
          </div>
        ) : (
          /* STANDARD LOGIN / INVITE / RESET FORM VIEW */
          <>
            {/* App Logo & Header */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
                {mode === 'login' ? (
                  <Droplets className="text-black w-8 h-8" />
                ) : mode === 'invite' ? (
                  <User className="text-black w-8 h-8" />
                ) : (
                  <Key className="text-black w-8 h-8" />
                )}
              </div>
              
              <h1 className="text-2xl font-bold tracking-tight text-white mb-1" id="auth-title">
                {mode === 'login' && "Sistema de Mantenimiento"}
                {mode === 'invite' && "Activar Cuenta"}
                {mode === 'reset' && "Restablecer Contraseña"}
              </h1>
              
              <p className="text-zinc-500 text-sm leading-relaxed" id="auth-subtitle">
                {mode === 'login' && "Inicia sesión para gestionar el mantenimiento de tus tambos"}
                {mode === 'invite' && (nombre ? `Hola ${nombre}, define tu contraseña para activar tu cuenta` : "Define tu contraseña para activar tu cuenta")}
                {mode === 'reset' && "Ingresa tu nueva contraseña segura para recuperar el acceso"}
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-sm mb-5" id="auth-error">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Success Alert */}
            {successMsg && (
              <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl text-sm mb-5" id="auth-success">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                <p>{successMsg}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Email Display / Field */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
                    <Mail className="w-5 h-5" />
                  </span>
                  <input
                    type="email"
                    required
                    disabled={mode === 'invite' || mode === 'reset'}
                    placeholder="usuario@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full bg-black/40 border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors ${
                      (mode === 'invite' || mode === 'reset') ? 'opacity-60 cursor-not-allowed bg-zinc-900/20' : ''
                    }`}
                  />
                </div>
              </div>

              {/* New Password / Password Field */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  {mode === 'login' ? "Contraseña" : "Nueva Contraseña"}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl pl-11 pr-11 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                    id="toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field (for invite and reset modes) */}
              {(mode === 'invite' || mode === 'reset') && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Confirmar Contraseña
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
                      <Lock className="w-5 h-5" />
                    </span>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl pl-11 pr-11 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                      id="toggle-confirm-password"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black py-3 px-4 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 mt-4"
                id="auth-submit-btn"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {mode === 'login' && "Iniciar Sesión"}
                    {mode === 'invite' && "Activar Cuenta"}
                    {mode === 'reset' && "Actualizar Contraseña"}
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
