/* eslint-disable @typescript-eslint/no-explicit-any -- the fake below imitates the loosely typed query builder of the Supabase client */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyPlan, renamePlan } from '../src/core/plan';
import { createMemoryStore, MemoryDatabase } from '../src/store/memory';
import { createSupabaseStore, userName } from '../src/store/supabase';
import type { SupabaseLike } from '../src/store/supabase';
import { AuthRequiredError, ConflictError, NotFoundError, newShareId } from '../src/store/types';

// ---- a fake Supabase that behaves like the SQL file: row-level security for the owner, two functions for the share links ---------------------------------------------------
interface FakeRow { [k: string]: any }
class FakeDb {
  rows: FakeRow[] = [];
  n = 0;
}
class Query implements PromiseLike<{ data: any; error: { message: string } | null }> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private filters: [string, unknown][] = [];
  private payload: any;
  private one: 'single' | 'maybe' | null = null;
  private asc = true;
  private orderCol = '';
  constructor(private db: FakeDb, private uid: string | null) {}
  select(): this { return this; }
  insert(v: any): this { this.op = 'insert'; this.payload = v; return this; }
  update(v: any): this { this.op = 'update'; this.payload = v; return this; }
  delete(): this { this.op = 'delete'; return this; }
  eq(c: string, v: unknown): this { this.filters.push([c, v]); return this; }
  order(c: string, o?: { ascending?: boolean }): this { this.orderCol = c; this.asc = o?.ascending !== false; return this; }
  single(): this { this.one = 'single'; return this; }
  maybeSingle(): this { this.one = 'maybe'; return this; }
  then<A, B>(ok?: ((v: { data: any; error: { message: string } | null }) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve(this.run()).then(ok, bad);
  }
  private visible(): FakeRow[] {
    return this.db.rows.filter((r) => r.owner_id === this.uid && this.filters.every(([c, v]) => r[c] === v));
  }
  private run(): { data: any; error: { message: string } | null } {
    let rows: FakeRow[];
    if (this.op === 'insert') {
      if (!this.uid || this.payload.owner_id !== this.uid) return { data: null, error: { message: 'new row violates row-level security policy' } };
      const row = { id: `id${++this.db.n}`, version: 1, share_mode: 'private', share_id: null, updated_at: new Date(2026, 10, 6, 10, this.db.n).toISOString(), ...this.payload };
      this.db.rows.push(row);
      rows = [row];
    } else if (this.op === 'update') {
      rows = this.visible();
      for (const r of rows) Object.assign(r, this.payload);
    } else if (this.op === 'delete') {
      rows = this.visible();
      this.db.rows = this.db.rows.filter((r) => !rows.includes(r));
    } else {
      rows = this.visible();
      if (this.orderCol) rows = [...rows].sort((a, b) => (a[this.orderCol] < b[this.orderCol] ? -1 : 1) * (this.asc ? 1 : -1));
    }
    const out = rows.map((r) => ({ ...r }));
    if (this.one) return { data: out[0] ?? null, error: this.one === 'single' && !out[0] ? { message: 'no rows' } : null };
    return { data: out, error: null };
  }
}
function fakeSupabase(db: FakeDb, uid: string | null, meta: Record<string, unknown> = { full_name: 'Test User' }): SupabaseLike {
  const shared = (id: string): FakeRow | undefined => db.rows.find((r) => r.share_id === id && r.share_mode !== 'private');
  return {
    auth: { getSession: async () => ({ data: { session: uid ? { user: { id: uid, email: 'x@y.z', user_metadata: meta } } : null } }) },
    from: () => new Query(db, uid),
    rpc: (fn: string, args: any) => {
      const r = shared(args.p_share_id);
      if (fn === 'get_shared_map_plan') return Promise.resolve({ data: r ? [{ ...r }] : [], error: null }) as any;
      if (!r) return Promise.resolve({ data: [{ status: 'not_found' }], error: null }) as any;
      if (r.share_mode !== 'edit') return Promise.resolve({ data: [{ ...r, status: 'read_only' }], error: null }) as any;
      if (r.version !== args.p_version) return Promise.resolve({ data: [{ ...r, status: 'conflict' }], error: null }) as any;
      Object.assign(r, { name: args.p_name, data: args.p_data, version: r.version + 1 });
      return Promise.resolve({ data: [{ ...r, status: 'ok' }], error: null }) as any;
    },
  };
}

const plain = () => emptyPlan('k3923', 'Plan one');

test('Supabase store: an owner creates, lists, saves, loads and deletes; a stale save is a conflict', async () => {
  const db = new FakeDb();
  const me = createSupabaseStore(fakeSupabase(db, 'u1'));
  assert.deepEqual(await me.user(), { id: 'u1', name: 'Test User' });
  const a = await me.create(plain());
  assert.equal(a.version, 1);
  assert.equal(a.summary.role, 'owner');
  assert.equal(a.summary.ownerName, 'Test User');
  const b = await me.create(renamePlan(plain(), 'Plan two'));
  assert.deepEqual((await me.list('k3923')).map((p) => p.name), ['Plan two', 'Plan one'], 'newest first');
  assert.deepEqual(await me.list('other-map'), []);
  const saved = await me.save(a.summary.id, renamePlan(a.doc, 'Renamed'), 1);
  assert.equal(saved.version, 2);
  assert.equal((await me.load(a.summary.id)).doc.name, 'Renamed');
  await assert.rejects(me.save(a.summary.id, a.doc, 1), (e: unknown) => e instanceof ConflictError && e.current?.version === 2 && e.current.doc.name === 'Renamed');
  await me.remove(b.summary.id);
  assert.equal((await me.list('k3923')).length, 1);
});

test('Supabase store: nobody else sees or touches a private plan; signed out nothing can be saved', async () => {
  const db = new FakeDb();
  const me = createSupabaseStore(fakeSupabase(db, 'u1'));
  const other = createSupabaseStore(fakeSupabase(db, 'u2'));
  const out = createSupabaseStore(fakeSupabase(db, null));
  const p = await me.create(plain());
  assert.deepEqual(await other.list('k3923'), []);
  await assert.rejects(other.load(p.summary.id), NotFoundError);
  await assert.rejects(other.save(p.summary.id, p.doc, 1), NotFoundError);
  await assert.rejects(other.setSharing(p.summary.id, 'edit'), NotFoundError);
  await assert.rejects(out.create(plain()), AuthRequiredError);
  assert.equal(await out.user(), null);
  assert.deepEqual(await out.list('k3923'), []);
  await assert.rejects(out.loadShared('nope'), NotFoundError);
});

test('Supabase store: a share link opens the plan for others, and only an "edit" link lets them save', async () => {
  const db = new FakeDb();
  const me = createSupabaseStore(fakeSupabase(db, 'u1'));
  const other = createSupabaseStore(fakeSupabase(db, 'u2'));
  const out = createSupabaseStore(fakeSupabase(db, null));
  const p = await me.create(plain());
  await assert.rejects(other.loadShared('whatever'), NotFoundError);
  const viewS = await me.setSharing(p.summary.id, 'view');
  assert.match(viewS.shareId!, /^[a-z0-9]{12}$/);
  const seen = await other.loadShared(viewS.shareId!);
  assert.equal(seen.summary.role, 'viewer');
  assert.equal((await out.loadShared(viewS.shareId!)).summary.role, 'viewer', 'works signed out');
  assert.equal((await me.loadShared(viewS.shareId!)).summary.role, 'owner');
  await assert.rejects(other.saveShared(viewS.shareId!, seen.doc, seen.version), NotFoundError);
  const editS = await me.setSharing(p.summary.id, 'edit');
  assert.equal(editS.shareId, viewS.shareId, 'the link stays the same');
  const e1 = await out.loadShared(editS.shareId!);
  assert.equal(e1.summary.role, 'editor');
  const e2 = await out.saveShared(editS.shareId!, renamePlan(e1.doc, 'By link'), e1.version);
  assert.equal(e2.version, 2);
  assert.equal((await me.load(p.summary.id)).doc.name, 'By link');
  await assert.rejects(out.saveShared(editS.shareId!, e1.doc, e1.version), ConflictError);
  await me.setSharing(p.summary.id, 'private');
  await assert.rejects(other.loadShared(editS.shareId!), NotFoundError, 'a private plan is closed again');
  const again = await me.setSharing(p.summary.id, 'view');
  assert.equal(again.shareId, editS.shareId, 'and reopening it gives the same link');
});

test('Supabase store: a stored plan that is not valid is refused when it is read, not trusted', async () => {
  const db = new FakeDb();
  const me = createSupabaseStore(fakeSupabase(db, 'u1'));
  const p = await me.create(plain());
  db.rows[0].data = { v: 1, map: 'k3923', alliances: [], items: [] };
  await assert.rejects(me.load(p.summary.id), /Not a valid plan/);
});

test('user names come from the sign-in profile, else from the e-mail', () => {
  assert.equal(userName({ user_metadata: { full_name: '  Davide  ' } }), 'Davide');
  assert.equal(userName({ user_metadata: { user_name: 'fluffy' } }), 'fluffy');
  assert.equal(userName({ email: 'someone@example.com' }), 'someone');
  assert.equal(userName({}), 'Player');
});

test('share ids are long, from a safe alphabet, and not repeated', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const id = newShareId();
    assert.match(id, /^[a-z2-9]{12}$/);
    seen.add(id);
  }
  assert.equal(seen.size, 200);
});

// ---- the memory store ----------------------------------------------------------------------------------------------------------------------------------------------------------
test('memory store: the same rules as the database one, for two people on one database', async () => {
  const db = new MemoryDatabase();
  const clock = (() => { let n = 0; return () => new Date(2026, 10, 6, 10, ++n).toISOString(); })();
  const me = createMemoryStore({ id: 'u1', name: 'Me' }, db, clock);
  const other = createMemoryStore({ id: 'u2', name: 'Other' }, db, clock);
  const out = createMemoryStore(null, db, clock);
  const a = await me.create(plain());
  const b = await me.create(renamePlan(plain(), 'Second'));
  assert.deepEqual((await me.list('k3923')).map((p) => p.name), ['Second', 'Plan one']);
  assert.deepEqual(await other.list('k3923'), []);
  await assert.rejects(other.load(a.summary.id), NotFoundError);
  await assert.rejects(out.create(plain()), AuthRequiredError);
  const s = await me.setSharing(a.summary.id, 'edit');
  const viaLink = await other.loadShared(s.shareId!);
  assert.equal(viaLink.summary.role, 'editor');
  const saved = await other.saveShared(s.shareId!, renamePlan(viaLink.doc, 'Edited'), viaLink.version);
  assert.equal(saved.version, 2);
  await assert.rejects(me.save(a.summary.id, a.doc, 1), ConflictError);
  assert.equal((await me.load(a.summary.id)).doc.name, 'Edited');
  await me.remove(b.summary.id);
  assert.equal((await me.list('k3923')).length, 1);
});
