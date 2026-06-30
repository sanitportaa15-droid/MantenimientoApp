import React, { useState, useEffect } from "react";
import { useAuth } from "../services/AuthContext";
import { db } from "../services/db";
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
  AlertTriangle 
} from "lucide-react";

export default function UsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
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

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await db.perfiles.getAll();
      setUsers(data);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  if (profile?.rol !== "Administrador") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold mb-2">Acceso Denegado</h2>
        <p className="text-zinc-400 max-w-md">
          Esta pantalla es exclusiva para administradores del sistema. Comuníquese con el administrador de su empresa para solicitar acceso.
        </p>
      </div>
    );
  }

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
    setRol(user.rol);
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
        // Validation: Do not allow disabling oneself
        if (editingUser.id === profile.id && !activo) {
          throw new Error("No puede desactivar su propio usuario administrador.");
        }
        
        await db.perfiles.update(editingUser.id, {
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          rol,
          activo
        });
      } else {
        // Invite new user (create pre-invite profile record)
        // Check if email already exists
        const emailExists = await db.perfiles.getByEmail(email);
        if (emailExists) {
          throw new Error("Ya existe un usuario o invitación registrada con este correo electrónico.");
        }

        await db.perfiles.create({
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          rol,
          activo,
          empresa_id: profile.empresa_id,
          user_id: null // User has not registered via auth yet
        });
      }
      
      setIsModalOpen(false);
      loadUsers();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Ocurrió un error al guardar la información del usuario.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (id === profile.id) {
      alert("No puede eliminarse a sí mismo.");
      return;
    }

    if (confirm(`¿Está seguro de que desea eliminar al usuario "${name}"? Esta acción no se puede deshacer.`)) {
      try {
        await db.perfiles.delete(id);
        loadUsers();
      } catch (err) {
        console.error("Error al eliminar usuario:", err);
        alert("Ocurrió un error al intentar eliminar el usuario.");
      }
    }
  };

  const toggleUserActive = async (user: Perfil) => {
    if (user.id === profile.id) {
      alert("No puede cambiar el estado de su propio usuario administrador.");
      return;
    }

    try {
      await db.perfiles.update(user.id, { activo: !user.activo });
      loadUsers();
    } catch (err) {
      console.error("Error al cambiar estado de usuario:", err);
    }
  };

  // Filter users based on search query
  const filteredUsers = users.filter(u => 
    u.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.rol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
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
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Estado</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-400 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((user) => {
                  const isPending = !user.user_id;
                  const isMe = user.id === profile.id;
                  
                  return (
                    <tr key={user.id} className="hover:bg-white/[0.01] transition-colors">
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
                        <button
                          disabled={isMe}
                          onClick={() => toggleUserActive(user)}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                            isPending
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20 cursor-pointer"
                              : user.activo
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 cursor-pointer"
                              : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20 cursor-pointer"
                          } ${isMe ? "cursor-not-allowed opacity-80" : ""}`}
                        >
                          {isPending ? (
                            <>
                              <Clock className="w-3.5 h-3.5" />
                              Invitación Pendiente
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
                        </button>
                      </td>
                      
                      {/* Actions Column */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors"
                            title="Editar usuario"
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
                            title={isMe ? "No puedes eliminarte a ti mismo" : "Eliminar usuario"}
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
                : "Al invitar un usuario, se guardará su perfil para que se enlace cuando se registre con su correo."
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
                    disabled={editingUser.id === profile.id}
                    className="w-4 h-4 rounded text-emerald-500 bg-zinc-900 border-white/10 focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <label htmlFor="activo-checkbox" className="text-sm font-medium text-zinc-300 select-none cursor-pointer disabled:opacity-50">
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
    </div>
  );
}
