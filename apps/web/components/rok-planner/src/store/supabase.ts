// The Supabase store: plans in the table `map_plans` (sql/schema-map-plans.sql). Owners read and write their own rows through row-level security; a share link goes through two functions
// (get_shared_map_plan / save_shared_map_plan), because a table policy on "shared" rows would let anybody list every shared plan with the public key.
// It takes the client you already have (`createClient()` of lib/supabase/client.ts): the package does not import @supabase/supabase-js.
import { sanitizePlan } from '../core/plan';
import type { PlanDoc } from '../core/plan';
import { AuthRequiredError, ConflictError, NotFoundError, newShareId } from './types';
import type { PlanRole, PlanStore, PlanSummary, PlanUser, ShareMode, StoredPlan } from './types';

interface DbError {
  message: string;
  code?: string;
}
type Result = PromiseLike<{ data: any; error: DbError | null }>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** The few things of a Supabase client the store uses. A real SupabaseClient fits. */
export interface SupabaseLike {
  auth: { getSession(): PromiseLike<{ data: { session: { user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null } } | null } }> };
  from(table: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc(fn: string, args?: Record<string, unknown>): Result;
}

export interface SupabaseStoreOptions {
  /** Table name (default map_plans). */
  table?: string;
}

interface Row {
  id: string;
  owner_id: string;
  owner_name: string | null;
  map: string;
  name: string;
  data: unknown;
  version: number;
  share_mode: ShareMode;
  share_id: string | null;
  updated_at: string;
}

const COLUMNS = 'id,owner_id,owner_name,map,name,version,share_mode,share_id,updated_at';
const FULL = `${COLUMNS},data`;

function fail(e: DbError | null, what: string): never {
  throw new Error(`${what}: ${e?.message ?? 'unknown error'}`);
}

export function userName(u: { email?: string | null; user_metadata?: Record<string, unknown> | null }): string {
  const m = u.user_metadata ?? {};
  for (const k of ['full_name', 'name', 'user_name', 'preferred_username']) {
    const v = m[k];
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 60);
  }
  return (u.email ?? 'Player').split('@')[0].slice(0, 60);
}

export function createSupabaseStore(supabase: SupabaseLike, options: SupabaseStoreOptions = {}): PlanStore {
  const table = options.table ?? 'map_plans';

  // The session is read from the browser (no network round trip) every time, so signing in or out is noticed at once. Row-level security is what really decides who may do what.
  const user = async (): Promise<PlanUser | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session ? { id: data.session.user.id, name: userName(data.session.user) } : null;
  };
  const needUser = async (): Promise<PlanUser> => {
    const u = await user();
    if (!u) throw new AuthRequiredError();
    return u;
  };
  const summary = (r: Row, role: PlanRole): PlanSummary => ({
    id: r.id, name: r.name, map: r.map, ownerId: r.owner_id, ownerName: r.owner_name ?? '', updatedAt: r.updated_at, shareMode: r.share_mode, shareId: r.share_id, role,
  });
  const toStored = (r: Row, role: PlanRole): StoredPlan => {
    const doc = sanitizePlan(r.data);
    return { summary: summary(r, role), doc: { ...doc, name: r.name }, version: r.version };
  };
  const roleOf = (r: Row, u: PlanUser | null): PlanRole => (u && r.owner_id === u.id ? 'owner' : r.share_mode === 'edit' ? 'editor' : 'viewer');

  return {
    user,
    async list(map) {
      const u = await user();
      if (!u) return [];
      const { data, error } = await supabase.from(table).select(COLUMNS).eq('owner_id', u.id).eq('map', map).order('updated_at', { ascending: false });
      if (error) fail(error, 'Could not list the plans');
      return (data as Row[]).map((r) => summary(r, 'owner'));
    },
    async load(id) {
      const u = await needUser();
      const { data, error } = await supabase.from(table).select(FULL).eq('id', id).eq('owner_id', u.id).maybeSingle();
      if (error) fail(error, 'Could not open the plan');
      if (!data) throw new NotFoundError();
      return toStored(data as Row, 'owner');
    },
    async loadShared(shareId) {
      const { data, error } = await supabase.rpc('get_shared_map_plan', { p_share_id: shareId });
      if (error) fail(error, 'Could not open the shared plan');
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new NotFoundError();
      return toStored(row as Row, roleOf(row as Row, await user()));
    },
    async create(doc: PlanDoc) {
      const u = await needUser();
      const { data, error } = await supabase.from(table).insert({ owner_id: u.id, owner_name: u.name, map: doc.map, name: doc.name, data: doc }).select(FULL).single();
      if (error) fail(error, 'Could not save the plan');
      return toStored(data as Row, 'owner');
    },
    async save(id, doc, expectedVersion) {
      const u = await needUser();
      const { data, error } = await supabase
        .from(table)
        .update({ name: doc.name, data: doc, version: expectedVersion + 1, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('owner_id', u.id)
        .eq('version', expectedVersion)
        .select(FULL)
        .maybeSingle();
      if (error) fail(error, 'Could not save the plan');
      if (data) return toStored(data as Row, 'owner');
      const now = await supabase.from(table).select(FULL).eq('id', id).eq('owner_id', u.id).maybeSingle();
      if (now.data) throw new ConflictError(toStored(now.data as Row, 'owner'));
      throw new NotFoundError();
    },
    async saveShared(shareId, doc, expectedVersion) {
      const { data, error } = await supabase.rpc('save_shared_map_plan', { p_share_id: shareId, p_name: doc.name, p_data: doc, p_version: expectedVersion });
      if (error) fail(error, 'Could not save the shared plan');
      const row = (Array.isArray(data) ? data[0] : data) as (Row & { status: string }) | undefined;
      if (!row || row.status === 'not_found' || row.status === 'read_only') throw new NotFoundError();
      const role = roleOf(row, await user());
      if (row.status === 'conflict') throw new ConflictError(toStored(row, role));
      return toStored(row, role);
    },
    async remove(id) {
      const u = await needUser();
      const { error } = await supabase.from(table).delete().eq('id', id).eq('owner_id', u.id);
      if (error) fail(error, 'Could not delete the plan');
    },
    async setSharing(id, mode) {
      const u = await needUser();
      const current = await supabase.from(table).select(COLUMNS).eq('id', id).eq('owner_id', u.id).maybeSingle();
      if (current.error) fail(current.error, 'Could not change the sharing');
      if (!current.data) throw new NotFoundError();
      const shareId = (current.data as Row).share_id ?? (mode === 'private' ? null : newShareId());
      const { data, error } = await supabase.from(table).update({ share_mode: mode, share_id: shareId }).eq('id', id).eq('owner_id', u.id).select(COLUMNS).single();
      if (error) fail(error, 'Could not change the sharing');
      return summary(data as Row, 'owner');
    },
  };
}
