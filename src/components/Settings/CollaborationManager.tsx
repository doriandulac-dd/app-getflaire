import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, Mail, Trash2, Pencil, AlertTriangle, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

type AgencyUser = {
  id: string;
  email: string;
  nom: string | null;
  Prenom: string | null;
  telephone: string | null;
  Role: 'admin' | 'agent' | 'independant' | null;
  created_at: string;
};

const CollaborationManager: React.FC<{ mode?: 'full' | 'readonly' }> = ({ mode }) => {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<AgencyUser[]>([]);
  const [creating, setCreating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // ---- Rôle & Agence (tolérant) ----
  const rawRole = (appUser?.Role ?? '').toString().toLowerCase();
  const agencyId = appUser?.agency_id ?? appUser?.agency?.id ?? null;
  const agencyName = useMemo(
    () => (appUser?.agency?.name ?? '').trim(),
    [appUser]
  );

  const isAdmin = rawRole === 'admin' || rawRole === 'agence';
  const isAgent = rawRole === 'agent';
  const isIndep = rawRole === 'independant' || rawRole === 'indépendant';
  const hasAgency = Boolean(agencyId);

  // mode passé par le parent (optionnel) > sinon déduit
  const derivedMode: 'full' | 'readonly' | 'none' =
    !hasAgency ? 'none' : isAdmin ? 'full' : isAgent ? 'readonly' : 'none';
  const effectiveMode = mode ?? derivedMode;

  // ---- Formulaire d’ajout (seulement si admin) ----
  const [form, setForm] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    role: 'agent' as 'admin' | 'agent',
    password: '',
  });

  // Liste visible = tous les membres sauf moi
  const visibleMembers = useMemo(
    () => members.filter(u => u.id !== appUser?.id),
    [members, appUser?.id]
  );

  // ---- Fetch collaborateurs ----
  const fetchMembers = async () => {
    setLastError(null);
    if (!agencyId) { setMembers([]); setLoading(false); return; }
    setLoading(true);

    const { data, error } = await supabase
      .from('users')
      .select('id,email,nom,Prenom,telephone,Role,created_at')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[collab] fetch error', error);
      setLastError(error.message);
      toast.error("Impossible de charger l'équipe (RLS ?)");
      setMembers([]);
    } else {
      setMembers((data || []) as AgencyUser[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  const resetForm = () => {
    setForm({ prenom: '', nom: '', email: '', telephone: '', role: 'agent', password: '' });
  };

  const handleCreate = async () => {
    if (effectiveMode !== 'full') return;
    if (!form.email || !form.nom || !form.prenom) {
      toast.error('Renseigne au minimum Prénom, Nom et Email.');
      return;
    }

    try {
      setCreating(true);

      // Hériter des départements de l’admin
      const inheritedDepts = Array.isArray(appUser?.departements_autorises)
        ? appUser?.departements_autorises
        : [];

      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Session non trouvée');
      }

      // Call the Edge Function to create user
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user-admin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: form.email,
          nom: form.nom,
          prenom: form.prenom,
          telephone: form.telephone || null,
          role: form.role,
          agency_id: agencyId,
          departements_autorises: inheritedDepts,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création du collaborateur');
      }

      const result = await response.json();
      
      if (result.resetLink) {
        // Show the reset link to the admin so they can share it
        toast.success(
          `Collaborateur créé !`,
          { duration: 10000 }
        );
      } else {
        toast.success('Collaborateur créé avec succès !');
      }

      resetForm();
      await fetchMembers();
    } catch (e: any) {
      console.error('[collab] create error', e);
      setLastError(e?.message ?? 'Erreur inconnue');
      toast.error(e?.message || 'Création impossible.');
    } finally {
      setCreating(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (userId === appUser?.id) {
      toast.error("Tu ne peux pas te supprimer toi-même.");
      return;
    }
    if (!confirm("Supprimer ce collaborateur ?")) return;

    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) return toast.error(error.message || "Suppression refusée (RLS ?)");
    toast.success("Collaborateur supprimé.");
    await fetchMembers();
  };

  // ---- Édition inline ----
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ telephone?: string; Role?: 'admin' | 'agent' }>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (userId: string, current: { telephone: string | null; Role: any }) => {
    setEditingId(userId);
    setEditForm({
      telephone: current.telephone ?? '',
      Role: (current.Role as 'admin' | 'agent') ?? 'agent',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      setSavingEdit(true);
      const payload: any = {};
      if (typeof editForm.telephone !== 'undefined') payload.telephone = editForm.telephone;
      if (typeof editForm.Role !== 'undefined') payload.Role = editForm.Role;

      const { error } = await supabase.from('users').update(payload).eq('id', editingId);
      if (error) throw error;

      toast.success("Collaborateur mis à jour.");
      setEditingId(null);
      setEditForm({});
      await fetchMembers();
    } catch (e: any) {
      toast.error(e?.message || "Modification refusée (RLS ?)");
    } finally {
      setSavingEdit(false);
    }
  };

  // ====== UI ======
  if (!hasAgency) {
    return (
      <div className="rounded-xl border p-4 bg-white text-sm text-secondary-700">
        Tu n’es rattaché à aucune agence. Renseigne le <b>nom de l’agence</b> dans l’onglet <b>Compte</b> (ou crée une agence).
      </div>
    );
  }
  if (isIndep) {
    return (
      <div className="rounded-xl border p-4 bg-white text-sm text-secondary-700">
        Les <b>indépendants</b> ne disposent pas de collaborateurs.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Ajouter un collaborateur (admin only) */}
      {effectiveMode === 'full' && (
        <div className="rounded-2xl border p-4 md:p-6 bg-white">
          <h3 className="text-lg font-semibold mb-4">Ajouter un collaborateur</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Prénom *</label>
              <input
                value={form.prenom}
                onChange={e => setForm(s => ({ ...s, prenom: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="Alex"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Nom *</label>
              <input
                value={form.nom}
                onChange={e => setForm(s => ({ ...s, nom: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="Martin"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(s => ({ ...s, email: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="alex@agence.fr"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Téléphone</label>
              <input
                value={form.telephone}
                onChange={e => setForm(s => ({ ...s, telephone: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="+33 6 12 34 56 78"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Rôle</label>
              <select
                value={form.role}
                onChange={e => setForm(s => ({ ...s, role: e.target.value as 'admin' | 'agent' }))}
                className="w-full rounded-xl border px-3 py-2"
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <Mail className="h-4 w-4 inline mr-1" />
              Un lien de réinitialisation de mot de passe sera généré pour le nouvel utilisateur.
            </p>
          </div>
          <div className="mt-4">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl bg-black text-white px-4 py-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Ajouter
            </button>
          </div>
        </div>
      )}

      {/* Liste des collaborateurs */}
      <div className="rounded-2xl border p-4 md:p-6 bg-white">
        <h3 className="text-lg font-semibold mb-4">
          Collaborateurs — {visibleMembers.length} {agencyName ? `(${agencyName})` : ''}
        </h3>

        {loading ? (
          <div className="flex items-center gap-2 text-secondary-600">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
          </div>
        ) : lastError ? (
          <div className="text-sm text-red-700 inline-flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {lastError}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-secondary-500">
                  <th className="py-2">Nom</th>
                  <th className="py-2">Prénom</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Téléphone</th>
                  <th className="py-2">Rôle</th>
                  <th className="py-2">Créé le</th>
                  {effectiveMode === 'full' && <th className="py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map(u => {
                  const isEditing = editingId === u.id;
                  return (
                    <tr key={u.id} className="border-t">
                      <td className="py-2">{u.nom || '—'}</td>
                      <td className="py-2">{u.Prenom || '—'}</td>
                      <td className="py-2">{u.email}</td>

                      {/* Téléphone */}
                      <td className="py-2">
                        {isEditing ? (
                          <input
                            className="rounded-lg border px-2 py-1 w-40"
                            value={editForm.telephone ?? ''}
                            onChange={e => setEditForm(s => ({ ...s, telephone: e.target.value }))}
                          />
                        ) : (
                          u.telephone || '—'
                        )}
                      </td>

                      {/* Rôle */}
                      <td className="py-2">
                        {isEditing ? (
                          <select
                            className="rounded-lg border px-2 py-1"
                            value={editForm.Role ?? 'agent'}
                            onChange={e => setEditForm(s => ({ ...s, Role: e.target.value as 'admin' | 'agent' }))}
                          >
                            <option value="agent">agent</option>
                            <option value="admin">admin</option>
                          </select>
                        ) : (
                          u.Role || '—'
                        )}
                      </td>

                      <td className="py-2">{new Date(u.created_at).toLocaleDateString()}</td>

                      {effectiveMode === 'full' && (
                        <td className="py-2">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={saveEdit}
                                disabled={savingEdit}
                                className="inline-flex items-center gap-1 rounded-lg border px-2 py-1"
                                title="Enregistrer"
                              >
                                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Enregistrer
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={savingEdit}
                                className="inline-flex items-center gap-1 rounded-lg border px-2 py-1"
                                title="Annuler"
                              >
                                <X className="w-4 h-4" /> Annuler
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => startEdit(u.id, { telephone: u.telephone, Role: u.Role })}
                                className="inline-flex items-center gap-1 rounded-lg border px-2 py-1"
                                title="Modifier"
                              >
                                <Pencil className="w-4 h-4" /> Éditer
                              </button>
                              <button
                                onClick={() => handleRemove(u.id)}
                                className="inline-flex items-center gap-1 rounded-lg border px-2 py-1"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" /> Retirer
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {visibleMembers.length === 0 && (
                  <tr>
                    <td colSpan={effectiveMode === 'full' ? 7 : 6} className="py-6 text-secondary-500">
                      Aucun collaborateur
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {effectiveMode === 'full' && (
        <div className="rounded-2xl border p-4 md:p-6 bg-gray-50">
          <div className="text-sm text-secondary-700">
            <Mail className="inline-block w-4 h-4 mr-1" />
            <b>Astuce :</b> en production, remplace la création directe par un <b>flux d'invitation</b>.
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaborationManager;
