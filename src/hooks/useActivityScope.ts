import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

type ScopeType = 'user' | 'agency';

type ScopeMember = {
  id: string;
  nom: string | null;
  Prenom: string | null;
  email: string | null;
};

export type ActivityScope = {
  scopeType: ScopeType;
  currentUserId: string | null;
  agencyId: string | null;
  userIds: string[];
  members: ScopeMember[];
  loading: boolean;
  isAgencyScope: boolean;
  formatActor: (userId?: string | null) => string;
  isOwnAction: (userId?: string | null) => boolean;
};

const getDisplayName = (member?: ScopeMember) => {
  if (!member) return 'Un collaborateur';
  const name = [member.Prenom, member.nom].filter(Boolean).join(' ').trim();
  return name || member.email || 'Un collaborateur';
};

export const useActivityScope = (): ActivityScope => {
  const { appUser } = useAuth();
  const [members, setMembers] = useState<ScopeMember[]>([]);
  const [loading, setLoading] = useState(false);

  const currentUserId = appUser?.id || null;
  const role = (appUser?.Role || '').toLowerCase();
  const agencyId = appUser?.agency_id || appUser?.agency?.id || null;
  const isAgencyScope = Boolean(agencyId && (role === 'admin' || role === 'agent'));
  const scopeType: ScopeType = isAgencyScope ? 'agency' : 'user';

  const fetchMembers = useCallback(async () => {
    if (!isAgencyScope || !agencyId) {
      setMembers(currentUserId ? [{
        id: currentUserId,
        nom: appUser?.nom || null,
        Prenom: appUser?.Prenom || null,
        email: appUser?.email || null,
      }] : []);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, nom, Prenom, email')
        .eq('agency_id', agencyId);

      if (error) throw error;
      setMembers((data || []) as ScopeMember[]);
    } catch (error) {
      console.error('[activity-scope] members fetch error', error);
      setMembers(currentUserId ? [{
        id: currentUserId,
        nom: appUser?.nom || null,
        Prenom: appUser?.Prenom || null,
        email: appUser?.email || null,
      }] : []);
    } finally {
      setLoading(false);
    }
  }, [agencyId, appUser?.Prenom, appUser?.email, appUser?.nom, currentUserId, isAgencyScope]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  const memberMap = useMemo(() => new Map(members.map(member => [member.id, member])), [members]);
  const userIds = useMemo(() => {
    const ids = members.map(member => member.id);
    if (currentUserId && !ids.includes(currentUserId)) ids.push(currentUserId);
    return ids;
  }, [currentUserId, members]);

  const formatActor = useCallback((userId?: string | null) => {
    if (!userId) return 'Un collaborateur';
    if (userId === currentUserId) return 'Vous';
    return getDisplayName(memberMap.get(userId));
  }, [currentUserId, memberMap]);

  const isOwnAction = useCallback((userId?: string | null) => {
    return Boolean(userId && userId === currentUserId);
  }, [currentUserId]);

  return {
    scopeType,
    currentUserId,
    agencyId,
    userIds,
    members,
    loading,
    isAgencyScope,
    formatActor,
    isOwnAction,
  };
};

