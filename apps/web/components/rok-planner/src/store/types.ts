// Where plans live. The planner never talks to a database itself: it gets a PlanStore. Two ship with the package (memory, Supabase); a host can write its own.
import type { PlanDoc } from '../core/plan';

/** private = only the owner; view = anyone with the link can look; edit = anyone with the link can change it. */
export type ShareMode = 'private' | 'view' | 'edit';
export type PlanRole = 'owner' | 'editor' | 'viewer';

export interface PlanUser {
  id: string;
  name: string;
}

export interface PlanSummary {
  id: string;
  name: string;
  map: string;
  ownerId: string | null;
  ownerName: string;
  /** ISO time of the last save. */
  updatedAt: string;
  shareMode: ShareMode;
  shareId: string | null;
  /** What the person who loaded it may do with it. */
  role: PlanRole;
}

export interface StoredPlan {
  summary: PlanSummary;
  doc: PlanDoc;
  /** Grows with every save; a save must name the version it started from, so two people never overwrite each other unseen. */
  version: number;
}

export class ConflictError extends Error {
  constructor(readonly current: StoredPlan | null) {
    super('Somebody saved this plan after you opened it.');
    this.name = 'ConflictError';
  }
}
export class AuthRequiredError extends Error {
  constructor() {
    super('Sign in to save plans.');
    this.name = 'AuthRequiredError';
  }
}
export class NotFoundError extends Error {
  constructor() {
    super('That plan does not exist, or it is not shared with you.');
    this.name = 'NotFoundError';
  }
}

export interface PlanStore {
  /** Who is using the planner; null when nobody is signed in (then plans can be shared-opened and exported, not saved to an account). */
  user(): Promise<PlanUser | null>;
  /** The plans of the signed-in user for this map, newest first. */
  list(map: string): Promise<PlanSummary[]>;
  load(id: string): Promise<StoredPlan>;
  /** A plan opened through its share link (works signed out). */
  loadShared(shareId: string): Promise<StoredPlan>;
  create(doc: PlanDoc): Promise<StoredPlan>;
  /** Saves `doc` over plan `id`, which the caller read at `expectedVersion`. Throws ConflictError when the stored version moved. */
  save(id: string, doc: PlanDoc, expectedVersion: number): Promise<StoredPlan>;
  /** The same through a share link that allows editing. */
  saveShared(shareId: string, doc: PlanDoc, expectedVersion: number): Promise<StoredPlan>;
  remove(id: string): Promise<void>;
  setSharing(id: string, mode: ShareMode): Promise<PlanSummary>;
}

/** A hard-to-guess id for a share link: 12 characters from the browser's (or Node's) random source. */
export function newShareId(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}
