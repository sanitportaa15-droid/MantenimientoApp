import React, { useState, useEffect } from "react";
import { useAuth } from "../services/AuthContext";
import { db } from "../services/db";
import { supabase } from "../services/supabase";
import { Perfil } from "../types/supabase";
import { 
  UserPlus, 
  Mail, 
  Shield, 
  Trash2, 
  Edit2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  X, 
  AlertTriangle,
  Send,
  RotateCcw,
  Copy,
  ExternalLink,
  CheckCircle2,
  Lock
} from "lucide-react";

export default function UsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [empresaNombre, setEmpresaNombre] = useState("tu empresa");
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Perfil | null>(null);
  
  // Form fields
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<'Administrador' | 'Supervisor' | 'Técnico' | 'Solo lectura'>("Solo lectura");
  const [activo, setActivo] = useState(true);
  
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Invitation simulated email modal
  const [invitedUser, setInvitedUser] = useState<Perfil | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Success / notification alert state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      if (profile?.empresa_id) {
        const u = await db.perfiles.getByEmpresaId(profile.empresa_id);
        setUsers(u || []);
      }
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [profile]);

  useEffect(() => {
    if (profile?.empresa_id) {
      supabase.from("empresa_identidad")
        .select("nombre")
        .eq("id", profile.empresa_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.nombre) {
            setEmpresaNombre(data.nombre);
          }
        });
    }
  }, [profile]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setNombre("");
    setEmail("");
    setRol("Solo lectura");
    setActivo(true);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user: Perfil) => {
    setEditingUser(user);
    setNombre(user.nombre);
    setEmail(user.email);
    setRol(user.rol as any);
    setActivo(user.activo);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setActionLoading(true);

    if (!nombre.trim() || !email.trim()) {
      setErrorMsg("Todos los campos son obligatorios.");
      setActionLoading(false);
      return;
    }

    try {
      if (editingUser) {
        // Edit existing user profile
        if (editingUser.id === profile?.id && !activo) {
          throw new Error("No puede desactivar su propio usuario administrador.");
        }
        
        await db.perfiles.update(editingUser.id, {
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          rol,
          activo
        });
        
        showToast(`Usuario "${nombre.trim()}" actualizado correctamente.`);
        setIsModalOpen(false);
        loadUsers();
      } else {
        // Invite new user (create pre-invite profile record with user_id = null)
        const emailExists = await db.perfiles.getByEmail(email);
        if (emailExists) {
          throw new Error("Ya existe un usuario o invitación registrada con este correo electrónico.");
        }

        const newUser = await db.perfiles.create({
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          rol,
          activo,
          empresa_id: profile?.empresa_id || null,
          user_id: null // Pending activation
        });

        setIsModalOpen(false);
        loadUsers();
        
        // Trigger the high-fidelity simulated invitation email display modal
        setInvitedUser(newUser);
        showToast(`Invitación creada para "${nombre.trim()}".`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Ocurrió un error al guardar la información del usuario.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (id === profile?.id) {
      alert("No puede eliminarse a sí mismo.");
      return;
    }

    if (confirm(`¿Está seguro de que desea eliminar al usuario "${name}"? Esta acción no se puede deshacer.`)) {
      try {
        await db.perfiles.delete(id);
        showToast(`Usuario "${name}" eliminado.`);
        loadUsers();
      } catch (err) {
        console.error("Error al eliminar usuario:", err);
        showToast("Ocurrió un error al intentar eliminar el usuario.", 'error');
      }
    }
  };

  const handleCancelInvitation = async (id: string, name: string) => {
    if (confirm(`¿Está seguro de que desea cancelar la invitación de "${name}"? El colaborador no podrá activar su cuenta y el registro pendiente será eliminado.`)) {
      try {
        await db.perfiles.delete(id);
        showToast(`Invitación para "${name}" cancelada exitosamente.`);
        loadUsers();
      } catch (err) {
        console.error("Error al cancelar invitación:", err);
        showToast("Ocurrió un error al intentar cancelar la invitación.", 'error');
      }
    }
  };

  const toggleUserActive = async (user: Perfil) => {
    if (user.id === profile?.id) {
      alert("No puede cambiar el estado de su propio usuario administrador.");
      return;
    }

    try {
      await db.perfiles.update(user.id, { activo: !user.activo });
      showToast(`Estado de "${user.nombre}" actualizado.`);
      loadUsers();
    } catch (err) {
      console.error("Error al cambiar estado de usuario:", err);
      showToast("Error al cambiar el estado del usuario.", 'error');
    }
  };

  const handleSendPasswordRecovery = async (user: Perfil) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth?reset=true`
      });
      if (error) throw error;
      showToast(`Se ha enviado la solicitud oficial de restablecimiento a ${user.email}.`);
    } catch (err: any) {
      console.error("Error al enviar recuperación de contraseña:", err);
      showToast(err.message || "Error al enviar recuperación de contraseña.", 'error');
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter users based on search query
  const filteredUsers = users.filter(u => 
    u.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.rol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl animate-fade-in ${
          notification.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          <span className="text-xs font-medium">{notification.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Gestión de Usuarios
          </h1>
          <p className="text-sm text-zinc-400">
            Crea, invita y gestiona los roles y accesos de los colaboradores de tu empresa.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/10 transition-all self-start sm:self-auto"
          id="btn-invitar-usuario"
        >
          <UserPlus className="w-4 h-4" />
          Invitar Usuario
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
          <Search className="w-5 h-5" />
        </span>
        <input
          type="text"
          placeholder="Buscar por nombre, correo o rol..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
          id="search-usuarios"
        />
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Cargando colaboradores...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl p-12 text-center">
          <p className="text-zinc-500 text-sm">
            {searchQuery ? "No se encontraron usuarios que coincidan con la búsqueda." : "No hay usuarios registrados en la empresa."}
          </p>
        </div>
      ) : (
        <div className="bg-[#0f0f0f] border border-white/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Usuario</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Correo Electrónico</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Rol</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Estado de Activación</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((user) => {
                  const isPending = !user.user_id;
                  const isMe = user.id === profile?.id;
                  
                  return (
                    <tr key={user.id} className="hover:bg-white/[0.01] transition-colors" id={`row-usuario-${user.id}`}>
                      {/* Name column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-semibold text-sm ${
                            isPending 
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}>
                            {user.nombre.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-white flex items-center gap-2">
                              {user.nombre}
                              {isMe && (
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-medium">
                                  Tú
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-zinc-500 block">
                              Miembro desde {new Date(user.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </td>
                      
                      {/* Email column */}
                      <td className="px-6 py-4 text-sm text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-4 h-4 text-zinc-500" />
                          {user.email}
                        </span>
                      </td>
                      
                      {/* Role Column */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                          user.rol === 'Administrador' 
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                            : user.rol === 'Supervisor'
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            : user.rol === 'Técnico'
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                        }`}>
                          <Shield className="w-3.5 h-3.5" />
                          {user.rol}
                        </span>
                      </td>
                      
                      {/* Status Column */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                          isPending
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : user.activo
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}>
                          {isPending ? (
                            <>
                              <Clock className="w-3.5 h-3.5" />
                              Pendiente de activación
                            </>
                          ) : user.activo ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                              Activo
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-red-400" />
                              Inactivo
                            </>
                          )}
                        </span>
                      </td>
                      
                      {/* Actions Column */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Resend Invitation (Only for pending users) */}
                          {isPending ? (
                            <>
                              <button
                                onClick={() => setInvitedUser(user)}
                                className="p-2 hover:bg-amber-500/10 rounded-lg text-amber-500 hover:text-amber-400 transition-colors"
                                title="Ver / Reenviar invitación por correo"
                                id={`btn-resend-${user.id}`}
                              >
                                <Send className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleCancelInvitation(user.id, user.nombre)}
                                className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
                                title="Cancelar Invitación"
                                id={`btn-cancel-${user.id}`}
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Send Password Recovery (Only for active users) */}
                              <button
                                onClick={() => handleSendPasswordRecovery(user)}
                                className="p-2 hover:bg-emerald-500/10 rounded-lg text-zinc-400 hover:text-emerald-400 transition-colors"
                                title="Enviar recuperación de contraseña"
                                id={`btn-recover-${user.id}`}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                              
                              {/* Toggle Active status */}
                              <button
                                disabled={isMe}
                                onClick={() => toggleUserActive(user)}
                                className={`p-2 rounded-lg transition-colors ${
                                  isMe 
                                    ? "cursor-not-allowed opacity-30 text-zinc-600" 
                                    : user.activo 
                                    ? "hover:bg-red-500/10 text-zinc-400 hover:text-red-400" 
                                    : "hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-400"
                                }`}
                                title={user.activo ? "Desactivar acceso" : "Activar acceso"}
                                id={`btn-toggle-${user.id}`}
                              >
                                {user.activo ? <Lock className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors"
                            title="Editar usuario"
                            id={`btn-edit-${user.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          
                          <button
                            disabled={isMe}
                            onClick={() => handleDelete(user.id, user.nombre)}
                            className={`p-2 rounded-lg text-zinc-500 transition-colors ${
                              isMe 
                                ? "cursor-not-allowed opacity-40" 
                                : "hover:bg-red-500/10 hover:text-red-400"
                            }`}
                            title={isMe ? "No puedes eliminarte a ti mismo" : "Eliminar de la base de datos"}
                            id={`btn-delete-${user.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0f0f0f] border border-white/5 rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-1.5">
              {editingUser ? "Editar Usuario" : "Invitar Nuevo Usuario"}
            </h2>
            <p className="text-xs text-zinc-400 mb-5">
              {editingUser 
                ? "Modifica los datos del colaborador o actualiza sus permisos." 
                : "Se creará el usuario en estado 'Pendiente de activación' y se generará su correo de invitación."
              }
            </p>

            {errorMsg && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs mb-4">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
                <p>{errorMsg}</p>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                />
              </div>

              {/* Rol Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Rol del Colaborador
                </label>
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value as any)}
                  className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                >
                  <option value="Administrador">Administrador (Acceso total + Gestión de usuarios)</option>
                  <option value="Supervisor">Supervisor (Creación, modificación y configuraciones técnicas)</option>
                  <option value="Técnico">Técnico (Ingresar fichas técnicas, mantenimientos y reclamos)</option>
                  <option value="Solo lectura">Solo lectura (Ver reportes, reclamos y estados)</option>
                </select>
              </div>

              {/* Estado Activo (Only for existing users) */}
              {editingUser && (
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="activo-checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    disabled={editingUser.id === profile?.id}
                    className="w-4 h-4 rounded text-emerald-500 bg-zinc-900 border-white/10 focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <label htmlFor="activo-checkbox" className="text-sm font-medium text-zinc-300 select-none cursor-pointer">
                    Usuario Activo (Permitir acceso al sistema)
                  </label>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/5 text-sm font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex items-center justify-center min-w-[100px] px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black font-semibold text-sm rounded-xl transition-all"
                >
                  {actionLoading ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Guardar"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simulated Email Inbox Modal */}
      {invitedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0b0c10] border border-amber-500/30 rounded-3xl shadow-2xl shadow-amber-500/5 overflow-hidden animate-fade-in">
            {/* Header / Top Ribbon */}
            <div className="bg-gradient-to-r from-amber-600/20 via-[#12131a] to-amber-600/20 px-6 py-4 border-b border-amber-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <Mail className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider font-mono">Buzón de Correo Simulado</span>
              </div>
              <button
                onClick={() => setInvitedUser(null)}
                className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulated Email Client Envelope */}
            <div className="p-6 bg-[#12131a]/80 space-y-4 text-xs text-zinc-400 border-b border-white/5">
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <span className="font-semibold text-zinc-500">De:</span>
                <span className="text-zinc-300 font-medium">Soporte del Sistema &lt;soporte@sistema-mantenimiento.com&gt;</span>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <span className="font-semibold text-zinc-500">Para:</span>
                <span className="text-emerald-400 font-mono font-medium">{invitedUser.email}</span>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-2">
                <span className="font-semibold text-zinc-500">Asunto:</span>
                <span className="text-white font-bold">🔑 Invitación para unirte a {empresaNombre} - Crear Contraseña</span>
              </div>
            </div>

            {/* Email Body Mockup */}
            <div className="p-8 bg-black/60 flex flex-col items-center">
              <div className="w-full max-w-md bg-[#0f111a] border border-white/5 rounded-2xl p-8 space-y-6 text-sm text-zinc-300 shadow-inner">
                {/* Email Header */}
                <div className="text-center pb-4 border-b border-white/5">
                  <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">¡Has sido invitado!</h3>
                </div>

                {/* Email Main Text */}
                <div className="space-y-4">
                  <p>Hola <strong>{invitedUser.nombre}</strong>,</p>
                  <p className="leading-relaxed">
                    Te han invitado a unirte a <strong>{empresaNombre}</strong> en el <strong>Sistema de Mantenimiento</strong> con el rol de <span className="px-2 py-0.5 bg-zinc-800 text-zinc-200 rounded text-xs font-mono">{invitedUser.rol}</span>.
                  </p>
                  <p>
                    Para activar tu cuenta de usuario y definir tu contraseña de acceso, haz clic en el siguiente botón:
                  </p>
                </div>

                {/* Email Button */}
                <div className="text-center py-4">
                  <a
                    href={`${window.location.origin}/auth?invite=true&email=${encodeURIComponent(invitedUser.email)}&nombre=${encodeURIComponent(invitedUser.nombre)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl shadow-lg shadow-amber-500/10 transition-all text-xs"
                  >
                    Crear Contraseña
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {/* Email Footer Disclaimer */}
                <div className="pt-4 border-t border-white/5 text-center text-xs text-zinc-500 leading-relaxed">
                  Si el botón no funciona, puedes copiar y pegar el siguiente enlace en tu navegador para realizar la activación:
                  <div className="mt-2 p-2.5 bg-black/50 border border-white/5 rounded-lg text-[11px] font-mono select-all break-all text-left text-zinc-400">
                    {`${window.location.origin}/auth?invite=true&email=${encodeURIComponent(invitedUser.email)}&nombre=${encodeURIComponent(invitedUser.nombre)}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Sandbox Testing Action Footer */}
            <div className="p-6 bg-[#0f111a] border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-zinc-400 text-center sm:text-left max-w-sm">
                <span className="text-amber-500 font-bold">Modo Sandbox:</span> Utiliza estos botones rápidos para copiar el enlace o abrir directamente la activación.
              </p>
              
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-center">
                <button
                  onClick={() => handleCopyLink(`${window.location.origin}/auth?invite=true&email=${encodeURIComponent(invitedUser.email)}&nombre=${encodeURIComponent(invitedUser.nombre)}`)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 border border-white/5 text-zinc-300 font-medium text-xs rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Enlace Copiado" : "Copiar Enlace"}
                </button>
                <a
                  href={`${window.location.origin}/auth?invite=true&email=${encodeURIComponent(invitedUser.email)}&nombre=${encodeURIComponent(invitedUser.nombre)}`}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-xs rounded-xl hover:bg-amber-500 hover:text-black transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Probar Activación
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
