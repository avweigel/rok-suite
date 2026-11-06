// The public API of the planner package.
export { MapPlanner } from './ui/MapPlanner';
export type { MapPlannerProps } from './ui/MapPlanner';
export type { ExtraLayer } from './ui/model';
export type { View } from './ui/view';
export { toScreen, toTile } from './ui/view';

export { createMemoryStore, MemoryDatabase } from './store/memory';
export { createSupabaseStore } from './store/supabase';
export type { SupabaseLike, SupabaseStoreOptions } from './store/supabase';
export { AuthRequiredError, ConflictError, NotFoundError } from './store/types';
export type { PlanRole, PlanStore, PlanSummary, PlanUser, ShareMode, StoredPlan } from './store/types';

// the engine, for a host that wants to use the rules without the interface
export { emptyPlan, sanitizePlan } from './core/plan';
export type { PlanAlliance, PlanDoc, PlanItem } from './core/plan';
export { loadWorld } from './core/world';
export type { World } from './core/world';
export { computeState } from './core/state';
export { checkPlacement, describeReason } from './core/rules';
export { MAX_EXTRA_FLAGS, PRESETS, planRoute } from './core/route';
export type { RouteOptions, RouteRequest, RouteResult } from './core/route';
export { findCfDrops } from './core/drop';
export type { DropOptions, DropSpot } from './core/drop';
export { findWallJumps, openJumps } from './core/walljump';
export type { JumpView, WallJump, ZoneOf } from './core/walljump';
export { applyRemoved, describeRemovals } from './core/removal';
export type { RemovalGroup, Spot } from './core/removal';
export type { MapDataFile } from './core/types';
