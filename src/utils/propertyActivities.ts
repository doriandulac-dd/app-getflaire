import { supabase } from '../lib/supabase';
import type { ActivityScope } from '../hooks/useActivityScope';
import {
  deletePropertyStatus,
  fetchPropertyStatus,
  savePropertyStatus,
  type PropertyStatusRow,
  type PropertyStatusValue,
} from './propertyStatus';

export type PropertyActionType = 'to_call' | 'called' | 'reminder' | 'rdv' | 'hidden' | 'viewed';

export type PropertyActionRow = {
  id: string;
  annonce_id: string;
  user_id: string;
  agency_id?: string | null;
  action_type: PropertyActionType;
  active: boolean;
  scheduled_at?: string | null;
  note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PropertyNoteRow = {
  id: string;
  annonce_id: string;
  user_id: string;
  agency_id?: string | null;
  content: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PropertyActivityState = {
  actions: PropertyActionRow[];
  notes: PropertyNoteRow[];
  favorite: boolean;
  to_call: boolean;
  called: boolean;
  reminder: boolean;
  rdv: boolean;
  hidden: boolean;
  viewed: boolean;
  calledAt?: string | null;
  reminderAt?: string | null;
  rdvAt?: string | null;
  statusActor?: string | null;
  latestNote?: string;
};

type ActivityScopeParams = {
  annonceId: string;
  userId: string;
  activityScope: ActivityScope;
};

type SaveActionParams = ActivityScopeParams & {
  actionType: PropertyActionType;
  active?: boolean;
  scheduledAt?: string | null;
  note?: string;
};

let supportsPigeActions: boolean | null = null;

const isAgencyScope = (activityScope: ActivityScope) =>
  activityScope.isAgencyScope && Boolean(activityScope.agencyId);

const isMissingActivityTableError = (error: { code?: string; message?: string }) => {
  const message = error.message || '';
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    message.includes('pige_actions') ||
    message.includes('pige_notes') ||
    message.includes('Could not find the table')
  );
};

const applyActivityScope = (
  query: any,
  { annonceId, userId, activityScope }: ActivityScopeParams,
  ownOnly = false
) => {
  const scopedQuery = query.eq('annonce_id', annonceId);

  if (!ownOnly && isAgencyScope(activityScope)) {
    return scopedQuery.eq('agency_id', activityScope.agencyId);
  }

  if (!ownOnly && activityScope.userIds.length > 0) {
    return scopedQuery.in('user_id', activityScope.userIds);
  }

  const userQuery = scopedQuery.eq('user_id', userId);
  return isAgencyScope(activityScope)
    ? userQuery.eq('agency_id', activityScope.agencyId)
    : userQuery.is('agency_id', null);
};

const legacyToActivity = (status: PropertyStatusRow | null): PropertyActivityState => {
  const state: PropertyActivityState = {
    actions: [],
    notes: [],
    favorite: false,
    to_call: false,
    called: false,
    reminder: false,
    rdv: false,
    hidden: false,
    viewed: false,
    statusActor: status?.user_id || null,
    latestNote: status?.note || undefined,
  };

  if (!status?.statut) return state;

  const actionType = status.statut === 'to_process'
    ? 'to_call'
    : status.statut === 'to_call'
      ? 'reminder'
      : status.statut;

  if (actionType === 'to_call') state.to_call = true;
  if (actionType === 'called') {
    state.called = true;
    state.calledAt = status.date_suivi;
  }
  if (actionType === 'reminder') {
    state.reminder = true;
    state.reminderAt = status.date_suivi;
  }
  if (actionType === 'rdv') {
    state.rdv = true;
    state.rdvAt = status.date_suivi;
  }
  if (actionType === 'hidden') state.hidden = true;

  state.actions = [{
    id: status.id,
    annonce_id: status.annonce_id,
    user_id: status.user_id,
    agency_id: status.agency_id,
    action_type: actionType as PropertyActionType,
    active: true,
    scheduled_at: status.date_suivi,
    note: status.note,
  }];

  if (status.note) {
    state.notes = [{
      id: status.id,
      annonce_id: status.annonce_id,
      user_id: status.user_id,
      agency_id: status.agency_id,
      content: status.note,
      created_at: status.date_suivi,
      updated_at: status.date_suivi,
    }];
  }

  return state;
};

const deriveActivityState = (actions: PropertyActionRow[], notes: PropertyNoteRow[]): PropertyActivityState => {
  const activeActions = actions.filter(action => action.active);
  const findLatest = (type: PropertyActionType) =>
    activeActions
      .filter(action => action.action_type === type)
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())[0];

  const called = findLatest('called');
  const reminder = findLatest('reminder');
  const rdv = findLatest('rdv');
  const latestAction = [...activeActions]
    .filter(action => action.action_type !== 'viewed')
    .sort(
    (a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime()
  )[0];
  const latestNote = [...notes].sort(
    (a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime()
  )[0];

  return {
    actions,
    notes,
    favorite: false,
    to_call: Boolean(findLatest('to_call')),
    called: Boolean(called),
    reminder: Boolean(reminder),
    rdv: Boolean(rdv),
    hidden: Boolean(findLatest('hidden')),
    viewed: Boolean(findLatest('viewed')),
    calledAt: called?.scheduled_at || called?.created_at,
    reminderAt: reminder?.scheduled_at,
    rdvAt: rdv?.scheduled_at,
    statusActor: latestAction?.user_id || null,
    latestNote: latestNote?.content,
  };
};

export const fetchPropertyActivity = async (params: ActivityScopeParams): Promise<PropertyActivityState> => {
  if (supportsPigeActions === false) {
    return legacyToActivity(await fetchPropertyStatus(params));
  }

  const actionsQuery = applyActivityScope(
    supabase
      .from('pige_actions')
      .select('*'),
    params
  ).order('updated_at', { ascending: false });

  const notesQuery = applyActivityScope(
    supabase
      .from('pige_notes')
      .select('*'),
    params
  ).order('created_at', { ascending: false });

  const [actionsResult, notesResult] = await Promise.all([actionsQuery, notesQuery]);

  if (actionsResult.error || notesResult.error) {
    const error = actionsResult.error || notesResult.error;
    if (error && isMissingActivityTableError(error)) {
      supportsPigeActions = false;
      return legacyToActivity(await fetchPropertyStatus(params));
    }
    console.error('[pige-activity] fetch failed', JSON.stringify(error), error);
    throw error;
  }

  return deriveActivityState(
    (actionsResult.data || []) as PropertyActionRow[],
    (notesResult.data || []) as PropertyNoteRow[]
  );
};

const findActiveAction = async (params: ActivityScopeParams & { actionType: PropertyActionType }) => {
  const query = applyActivityScope(
    supabase
      .from('pige_actions')
      .select('*'),
    params
  )
    .eq('action_type', params.actionType)
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(1);

  const { data, error } = await query;
  if (error) throw error;
  return ((data || [])[0] || null) as PropertyActionRow | null;
};

const legacyStatusForAction = (actionType: PropertyActionType): PropertyStatusValue => {
  if (actionType === 'to_call') return 'to_process';
  if (actionType === 'reminder') return 'to_call';
  return actionType === 'viewed' ? null : actionType;
};

export const savePropertyAction = async ({
  annonceId,
  userId,
  activityScope,
  actionType,
  active = true,
  scheduledAt,
  note,
}: SaveActionParams) => {
  if (supportsPigeActions === false) {
    return savePropertyStatus({
      annonceId,
      userId,
      activityScope,
      statut: legacyStatusForAction(actionType),
      note,
      dateSuivi: scheduledAt || new Date().toISOString(),
    });
  }

  const payload: Record<string, unknown> = {
    annonce_id: annonceId,
    user_id: userId,
    agency_id: isAgencyScope(activityScope) ? activityScope.agencyId : null,
    action_type: actionType,
    active,
    scheduled_at: scheduledAt || (actionType === 'called' ? new Date().toISOString() : null),
    updated_at: new Date().toISOString(),
  };

  if (note !== undefined) payload.note = note;

  try {
    const existing = actionType === 'called' ? null : await findActiveAction({ annonceId, userId, activityScope, actionType });
    const result = existing
      ? await supabase.from('pige_actions').update(payload).eq('id', existing.id).select('*').maybeSingle()
      : await supabase.from('pige_actions').insert(payload).select('*').maybeSingle();

    if (result.error) throw result.error;
    return result.data as PropertyActionRow;
  } catch (error: any) {
    if (isMissingActivityTableError(error)) {
      supportsPigeActions = false;
      return savePropertyAction({ annonceId, userId, activityScope, actionType, active, scheduledAt, note });
    }
    console.error('[pige-activity] save action failed', JSON.stringify(error), error);
    throw error;
  }
};

export const deletePropertyAction = async (params: ActivityScopeParams & { actionType: PropertyActionType }) => {
  if (supportsPigeActions === false) {
    return deletePropertyStatus(params);
  }

  try {
    const existing = await findActiveAction(params);
    if (!existing) return false;

    const { error } = await supabase
      .from('pige_actions')
      .update({ active: false, user_id: params.userId, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (error) throw error;
    return true;
  } catch (error: any) {
    if (isMissingActivityTableError(error)) {
      supportsPigeActions = false;
      return deletePropertyAction(params);
    }
    console.error('[pige-activity] delete action failed', JSON.stringify(error), error);
    throw error;
  }
};

export const savePropertyNote = async ({
  annonceId,
  userId,
  activityScope,
  content,
}: ActivityScopeParams & { content: string }) => {
  const trimmed = content.trim();
  if (!trimmed) return null;

  if (supportsPigeActions === false) {
    return savePropertyStatus({
      annonceId,
      userId,
      activityScope,
      statut: null,
      note: trimmed,
    });
  }

  const payload = {
    annonce_id: annonceId,
    user_id: userId,
    agency_id: isAgencyScope(activityScope) ? activityScope.agencyId : null,
    content: trimmed,
  };

  try {
    const { data, error } = await supabase
      .from('pige_notes')
      .insert(payload)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data as PropertyNoteRow;
  } catch (error: any) {
    if (isMissingActivityTableError(error)) {
      supportsPigeActions = false;
      return savePropertyNote({ annonceId, userId, activityScope, content });
    }
    console.error('[pige-activity] save note failed', JSON.stringify(error), error);
    throw error;
  }
};

export const updatePropertyNote = async ({
  noteId,
  annonceId,
  userId,
  activityScope,
  content,
}: ActivityScopeParams & { noteId: string; content: string }) => {
  const trimmed = content.trim();
  if (!trimmed) return null;

  if (supportsPigeActions === false) {
    return savePropertyStatus({
      annonceId,
      userId,
      activityScope,
      statut: null,
      note: trimmed,
    });
  }

  try {
    const { data, error } = await supabase
      .from('pige_notes')
      .update({
        content: trimmed,
        user_id: userId,
        agency_id: isAgencyScope(activityScope) ? activityScope.agencyId : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data as PropertyNoteRow;
  } catch (error: any) {
    if (isMissingActivityTableError(error)) {
      supportsPigeActions = false;
      return updatePropertyNote({ noteId, annonceId, userId, activityScope, content });
    }
    console.error('[pige-activity] update note failed', JSON.stringify(error), error);
    throw error;
  }
};

export const deletePropertyNote = async ({
  noteId,
  annonceId,
  userId,
  activityScope,
}: ActivityScopeParams & { noteId: string }) => {
  if (supportsPigeActions === false) {
    return savePropertyStatus({
      annonceId,
      userId,
      activityScope,
      statut: null,
      note: '',
    });
  }

  try {
    const { error } = await supabase
      .from('pige_notes')
      .delete()
      .eq('id', noteId);

    if (error) throw error;
    return true;
  } catch (error: any) {
    if (isMissingActivityTableError(error)) {
      supportsPigeActions = false;
      return deletePropertyNote({ noteId, annonceId, userId, activityScope });
    }
    console.error('[pige-activity] delete note failed', JSON.stringify(error), error);
    throw error;
  }
};
