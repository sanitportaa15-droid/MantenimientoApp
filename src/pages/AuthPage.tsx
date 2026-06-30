import React, { useState } from "react";
import { useAuth } from "../services/AuthContext";
import { Mail, Lock, User, Building2, Droplets, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function AuthPage() {
  const { login, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [isNewCompany, setIsNewCompany] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    if (!email || !password) {
      setError("Por favor complete todos los campos obligatorios.");
      setLoading(false);
      return;
    }

    if (!isLogin && !nombre) {
      setError("Por favor ingrese su nombre.");
      setLoading(false);
      return;
    }

    if (!isLogin && isNewCompany && !companyName) {
      setError("Por favor ingrese el nombre de la empresa a crear.");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signUp(
          email, 
          password, 
          nombre, 
          isNewCompany ? companyName : undefined
        );
        setSuccessMsg("¡Registro exitoso! Ya puedes iniciar sesión.");
        setIsLogin(true);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error inesperado. Inténtelo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070707] text-zinc-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Decorative Blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/5 rounded-2xl shadow-2xl p-8 backdrop-blur-sm z-10 transition-all">
        {/* App Logo & Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
            <Droplets className="text-black w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            Sistema de Mantenimiento
          </h1>
          <p className="text-zinc-500 text-sm">
            {isLogin 
              ? "Inicia sesión para gestionar el mantenimiento de tus tambos" 
              : "Crea tu cuenta profesional para tu empresa o únete a una"
            }
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 bg-black/40 p-1.5 rounded-xl mb-6 border border-white/5">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError(null);
            }}
            className={`py-2 text-sm font-medium rounded-lg transition-all ${
              isLogin 
                ? "bg-emerald-500 text-black shadow-md" 
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError(null);
            }}
            className={`py-2 text-sm font-medium rounded-lg transition-all ${
              !isLogin 
                ? "bg-emerald-500 text-black shadow-md" 
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-sm mb-5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl text-sm mb-5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
            <p>{successMsg}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field (Sign up only) */}
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Nombre Completo
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
                  <User className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Email Field */}
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
              Contraseña
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
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Multi-tenant Company Configuration (Sign up only) */}
          {!isLogin && (
            <div className="pt-2 border-t border-white/5 mt-4 space-y-4">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isNewCompany}
                  onChange={(e) => setIsNewCompany(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 bg-zinc-900 border-white/10 focus:ring-0 focus:ring-offset-0"
                />
                <span className="text-sm font-medium text-zinc-300">
                  ¿Registrar una nueva empresa?
                </span>
              </label>

              {isNewCompany ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Nombre de la Empresa / Organización
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
                      <Building2 className="w-5 h-5" />
                    </span>
                    <input
                      type="text"
                      required={isNewCompany}
                      placeholder="Ej. Tambo Don Luis"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 rounded-xl p-3 text-xs text-zinc-400 leading-relaxed">
                  Te registrarás como usuario. Si has recibido una invitación de tu administrador, asegúrate de usar el mismo correo electrónico para asociar tu perfil.
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black py-3 px-4 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : isLogin ? (
              "Iniciar Sesión"
            ) : (
              "Registrarse"
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="text-center mt-6 pt-4 border-t border-white/5">
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest font-semibold">
            GanPor Mantenimientos de Tambos
          </p>
        </div>
      </div>
    </div>
  );
}
