// A store that keeps everything in memory: for a demo, for tests, and for a host that wants to try the planner before it has a database. Several "users" can share one store.
import { sanitizePlan } from '../core/plan';
import type { PlanDoc } from '../core/plan';
import { AuthRequiredError, ConflictError, NotFoundError, newShareId } from './types';
import type { PlanRole, PlanStore, PlanSummary, PlanUser, ShareMode, StoredPlan } from './types';

interface Row {
  id: string;
  ownerId: string;
  ownerName: string;
  doc: PlanDoc;
  version: number;
  shareMode: ShareMode;
  shareId: string | null;
  updatedAt: string;
}

/** The rows shared by every handle made with `forUser`. */
export class MemoryDatabase {
  readonly rows = new Map<string, Row>();
  private n = 0;
  nextId(): string {
    this.n++;
    return `plan-${this.n}`;
  }
}

const clone = (doc: PlanDoc): PlanDoc => sanitizePlan(JSON.parse(JSON.stringify(doc)));

export function createMemoryStore(user: PlanUser | null = { id: 'me', name: 'Me' }, db: MemoryDatabase = new MemoryDatabase(), now: () => string = () => new Date().toISOString()): PlanStore & { db: MemoryDatabase } {
  const summary = (r: Row, role: PlanRole): PlanSummary => ({
    id: r.id, name: r.doc.name, map: r.doc.map, ownerId: r.ownerId, ownerName: r.ownerName, updatedAt: r.updatedAt, shareMode: r.shareMode, shareId: r.shareId, role,
  });
  const stored = (r: Row, role: PlanRole): StoredPlan => ({ summary: summary(r, role), doc: clone(r.doc), version: r.version });
  const byShare = (shareId: string): Row => {
    for (const r of db.rows.values()) if (r.shareId === shareId && r.shareMode !== 'private') return r;
    throw new NotFoundError();
  };
  const mine = (id: string): Row => {
    if (!user) throw new AuthRequiredError();
    const r = db.rows.get(id);
    if (!r || r.ownerId !== user.id) throw new NotFoundError();
    return r;
  };
  return {
    db,
    user: async () => user,
    list: async (map) => {
      if (!user) return [];
      return [...db.rows.values()].filter((r) => r.ownerId === user.id && r.doc.map === map).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((r) => summary(r, 'owner'));
    },
    load: async (id) => stored(mine(id), 'owner'),
    loadShared: async (shareId) => {
      const r = byShare(shareId);
      return stored(r, user && r.ownerId === user.id ? 'owner' : r.shareMode === 'edit' ? 'editor' : 'viewer');
    },
    create: async (doc) => {
      if (!user) throw new AuthRequiredError();
      const row: Row = { id: db.nextId(), ownerId: user.id, ownerName: user.name, doc: clone(doc), version: 1, shareMode: 'private', shareId: null, updatedAt: now() };
      db.rows.set(row.id, row);
      return stored(row, 'owner');
    },
    save: async (id, doc, expectedVersion) => {
      const r = mine(id);
      if (r.version !== expectedVersion) throw new ConflictError(stored(r, 'owner'));
      r.doc = clone(doc);
      r.version++;
      r.updatedAt = now();
      return stored(r, 'owner');
    },
    saveShared: async (shareId, doc, expectedVersion) => {
      const r = byShare(shareId);
      if (r.shareMode !== 'edit') throw new NotFoundError();
      if (r.version !== expectedVersion) throw new ConflictError(stored(r, 'editor'));
      r.doc = clone(doc);
      r.version++;
      r.updatedAt = now();
      return stored(r, user && r.ownerId === user.id ? 'owner' : 'editor');
    },
    remove: async (id) => {
      mine(id);
      db.rows.delete(id);
    },
    setSharing: async (id, mode) => {
      const r = mine(id);
      r.shareMode = mode;
      if (mode !== 'private' && !r.shareId) r.shareId = newShareId();
      return summary(r, 'owner');
    },
  };
}
