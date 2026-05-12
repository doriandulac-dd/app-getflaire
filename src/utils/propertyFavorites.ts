import { supabase } from '../lib/supabase';
import type { ActivityScope } from '../hooks/useActivityScope';

export type PropertyFavoriteRow = {
  id: string;
  annonce_id: string;
  user_id: string;
  agency_id?: string | null;
  date_favoris?: string | null;
};

type FavoriteScopeParams = {
  annonceId: string;
  userId: string;
  activityScope: ActivityScope;
};

let supportsAgencyFavoriteColumns: boolean | null = null;

const isAgencyFavoriteScope = (activityScope: ActivityScope) =>
  activityScope.isAgencyScope && Boolean(activityScope.agencyId);

const isMissingColumnError = (error: { code?: string; message?: string }) =>
  error.code === '42703' || (error.message || '').includes('agency_id does not exist');

const applyFavoriteScope = (
  query: any,
  { annonceId, userId, activityScope }: FavoriteScopeParams,
  useAgencyColumn: boolean,
  ownOnly = false
) => {
  const scopedQuery = query.eq('annonce_id', annonceId);

  if (!ownOnly && useAgencyColumn && isAgencyFavoriteScope(activityScope)) {
    return scopedQuery.eq('agency_id', activityScope.agencyId);
  }

  if (!ownOnly && !useAgencyColumn && isAgencyFavoriteScope(activityScope) && activityScope.userIds.length > 0) {
    return scopedQuery.in('user_id', activityScope.userIds);
  }

  const userQuery = scopedQuery.eq('user_id', userId);
  if (!useAgencyColumn) return userQuery;

  return isAgencyFavoriteScope(activityScope)
    ? userQuery.eq('agency_id', activityScope.agencyId)
    : userQuery.is('agency_id', null);
};

const fetchFavoriteRows = async (params: FavoriteScopeParams, useAgencyColumn: boolean) => {
  const query = applyFavoriteScope(
    supabase
      .from('favoris')
      .select('*'),
    params,
    useAgencyColumn
  );

  const { data, error } = await query;
  if (error) {
    if (useAgencyColumn && isMissingColumnError(error)) {
      supportsAgencyFavoriteColumns = false;
      return fetchFavoriteRows(params, false);
    }

    console.error('[favorite-update] fetch failed', JSON.stringify(error), error);
    throw error;
  }

  return (data || []) as PropertyFavoriteRow[];
};

export const fetchPropertyFavorites = async (params: FavoriteScopeParams) =>
  fetchFavoriteRows(params, supportsAgencyFavoriteColumns !== false);

const fetchOwnFavorite = async (params: FavoriteScopeParams) => {
  const query = applyFavoriteScope(
    supabase
      .from('favoris')
      .select('*'),
    params,
    supportsAgencyFavoriteColumns !== false,
    true
  )
    .order('date_favoris', { ascending: false })
    .limit(1);

  const { data, error } = await query;
  if (error) {
    if (supportsAgencyFavoriteColumns !== false && isMissingColumnError(error)) {
      supportsAgencyFavoriteColumns = false;
      return fetchOwnFavorite(params);
    }

    console.error('[favorite-update] own fetch failed', JSON.stringify(error), error);
    throw error;
  }

  return ((data || [])[0] || null) as PropertyFavoriteRow | null;
};

export const savePropertyFavorite = async ({
  annonceId,
  userId,
  activityScope,
}: FavoriteScopeParams): Promise<PropertyFavoriteRow> => {
  const existing = await fetchOwnFavorite({ annonceId, userId, activityScope });
  if (existing) return existing;

  const payload: Record<string, unknown> = {
    annonce_id: annonceId,
    user_id: userId,
    date_favoris: new Date().toISOString(),
  };

  if (supportsAgencyFavoriteColumns !== false) {
    payload.agency_id = isAgencyFavoriteScope(activityScope) ? activityScope.agencyId : null;
  }

  const { data, error } = await supabase
    .from('favoris')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) {
      supportsAgencyFavoriteColumns = false;
      return savePropertyFavorite({ annonceId, userId, activityScope });
    }

    if (error.code === '23505') {
      const racedFavorite = await fetchOwnFavorite({ annonceId, userId, activityScope });
      if (racedFavorite) return racedFavorite;
    }

    console.error('[favorite-update] insert failed', JSON.stringify(error), error);
    throw error;
  }

  if (!data) {
    const noRowError = new Error('Aucune ligne favori creee');
    console.error('[favorite-update] insert returned no row', noRowError);
    throw noRowError;
  }

  return data as PropertyFavoriteRow;
};

export const deletePropertyFavorite = async (params: FavoriteScopeParams) => {
  const existing = await fetchOwnFavorite(params);
  if (!existing) return false;

  const { error } = await supabase
    .from('favoris')
    .delete()
    .eq('id', existing.id);

  if (error) {
    console.error('[favorite-update] delete failed', JSON.stringify(error), error);
    throw error;
  }

  return true;
};
