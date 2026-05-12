import { supabase } from '../lib/supabase';
import type { ActivityScope } from '../hooks/useActivityScope';

export type PropertyStatusValue = 'to_process' | 'to_call' | 'called' | 'hidden' | 'rdv' | null;

export type PropertyStatusRow = {
  id: string;
  annonce_id: string;
  user_id: string;
  agency_id?: string | null;
  statut: PropertyStatusValue;
  note?: string | null;
  date_suivi?: string | null;
};

type StatusScopeParams = {
  annonceId: string;
  userId: string;
  activityScope: ActivityScope;
};

type SaveStatusParams = StatusScopeParams & {
  statut: PropertyStatusValue;
  note?: string;
  dateSuivi?: string;
};

let supportsAgencyStatusColumns: boolean | null = null;

const isAgencyStatusScope = (activityScope: ActivityScope) =>
  activityScope.isAgencyScope && Boolean(activityScope.agencyId);

const isMissingColumnError = (error: { code?: string; message?: string }) =>
  error.code === '42703' || (error.message || '').includes('agency_id does not exist');

const applyStatusScope = (
  query: any,
  { annonceId, userId, activityScope }: StatusScopeParams,
  useAgencyColumn: boolean
) => {
  const scopedQuery = query.eq('annonce_id', annonceId);

  if (useAgencyColumn && isAgencyStatusScope(activityScope)) {
    return scopedQuery.eq('agency_id', activityScope.agencyId);
  }

  if (!useAgencyColumn && isAgencyStatusScope(activityScope) && activityScope.userIds.length > 0) {
    return scopedQuery.in('user_id', activityScope.userIds);
  }

  const userQuery = scopedQuery.eq('user_id', userId);
  return useAgencyColumn ? userQuery.is('agency_id', null) : userQuery;
};

const fetchStatusRow = async (params: StatusScopeParams, useAgencyColumn: boolean) => {
  const query = applyStatusScope(
    supabase
      .from('suivi_annonce')
      .select('*'),
    params,
    useAgencyColumn
  )
    .order('date_suivi', { ascending: false })
    .limit(1);

  const { data, error } = await query;
  if (error) {
    if (useAgencyColumn && isMissingColumnError(error)) {
      supportsAgencyStatusColumns = false;
      return fetchStatusRow(params, false);
    }

    console.error('[status-update] fetch failed', JSON.stringify(error), error);
    throw error;
  }

  return ((data || [])[0] || null) as PropertyStatusRow | null;
};

export const fetchPropertyStatus = async (params: StatusScopeParams) =>
  fetchStatusRow(params, supportsAgencyStatusColumns !== false);

const fetchMutablePropertyStatus = async (params: StatusScopeParams) => {
  if (supportsAgencyStatusColumns !== false) {
    return fetchStatusRow(params, true);
  }

  const { data, error } = await supabase
    .from('suivi_annonce')
    .select('*')
    .eq('annonce_id', params.annonceId)
    .eq('user_id', params.userId)
    .order('date_suivi', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[status-update] mutable fetch failed', JSON.stringify(error), error);
    throw error;
  }

  return ((data || [])[0] || null) as PropertyStatusRow | null;
};

const updatePropertyStatusRow = async (
  id: string,
  payload: Record<string, unknown>
): Promise<PropertyStatusRow> => {
  const { data, error } = await supabase
    .from('suivi_annonce')
    .update(payload)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[status-update] update failed', JSON.stringify(error), error);
    throw error;
  }

  if (!data) {
    const noRowError = new Error('Aucune ligne de statut mise a jour');
    console.error('[status-update] update returned no row', noRowError);
    throw noRowError;
  }

  return data as PropertyStatusRow;
};

export const savePropertyStatus = async ({
  annonceId,
  userId,
  activityScope,
  statut,
  note,
  dateSuivi = new Date().toISOString(),
}: SaveStatusParams): Promise<PropertyStatusRow> => {
  const existing = await fetchMutablePropertyStatus({ annonceId, userId, activityScope });
  const payload: Record<string, unknown> = {
    annonce_id: annonceId,
    user_id: userId,
    statut,
    date_suivi: dateSuivi,
  };

  if (supportsAgencyStatusColumns !== false) {
    payload.agency_id = isAgencyStatusScope(activityScope) ? activityScope.agencyId : null;
  }

  if (note !== undefined) {
    payload.note = note;
  }

  if (existing) {
    return updatePropertyStatusRow(existing.id, payload);
  }

  const { data, error } = await supabase
    .from('suivi_annonce')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      const racedStatus = await fetchPropertyStatus({ annonceId, userId, activityScope });
      if (racedStatus) return updatePropertyStatusRow(racedStatus.id, payload);
    }

    console.error('[status-update] insert failed', JSON.stringify(error), error);
    throw error;
  }

  if (!data) {
    const noRowError = new Error('Aucune ligne de statut creee');
    console.error('[status-update] insert returned no row', noRowError);
    throw noRowError;
  }

  return data as PropertyStatusRow;
};

export const deletePropertyStatus = async (params: StatusScopeParams) => {
  const existing = await fetchMutablePropertyStatus(params);
  if (!existing) return false;

  const { error } = await supabase
    .from('suivi_annonce')
    .delete()
    .eq('id', existing.id);

  if (error) {
    console.error('[status-update] delete failed', JSON.stringify(error), error);
    throw error;
  }

  return true;
};
