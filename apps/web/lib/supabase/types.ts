// TypeScript types for Supabase database tables

// =============================================================================
// USER & AUTH TYPES
// =============================================================================

export type UserRole = 'member' | 'officer' | 'leader' | 'admin';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  city_hall_level: number;
  role: UserRole;
  alliance_id: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

export interface EventCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface GameEvent {
  id: string;
  slug: string;
  name: string;
  category_id: string | null;
  description: string | null;
  frequency: string | null;
  duration: string | null;
  min_city_hall: number | null;
  overview: string | null;
  mechanics: string | null;
  rewards: string | null;
  icon_url: string | null;
  banner_url: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  category?: EventCategory;
  strategies?: EventStrategy[];
  checklists?: EventChecklist[];
}

export type StrategyType = 'general' | 'alliance' | 'tips';

export interface EventStrategy {
  id: string;
  event_id: string;
  title: string;
  content: string;
  strategy_type: StrategyType;
  author_id: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  author?: Profile;
}

export interface EventChecklist {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  items?: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  content: string;
  details: string | null;
  sort_order: number;
  created_at: string;
}

export interface UserChecklistProgress {
  id: string;
  user_id: string;
  checklist_item_id: string;
  completed_at: string;
}

// =============================================================================
// ALLIANCE TYPES
// =============================================================================

export interface AlliancePage {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: string | null;
  icon: string | null;
  author_id: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  author?: Profile;
}

export interface GuardianSchedule {
  id: string;
  spawn_time_1: string; // Time in HH:MM:SS format
  spawn_time_2: string;
  protocol: string | null;
  timezone: string;
  notification_minutes: number;
  updated_at: string;
  updated_by: string | null;
}

// =============================================================================
// CONTENT HISTORY
// =============================================================================

export interface ContentHistory {
  id: string;
  table_name: string;
  record_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
  // Joined fields
  changed_by_user?: Profile;
}

// =============================================================================
// COMMANDER TYPES (existing, for reference)
// =============================================================================

export type Rarity = 'legendary' | 'epic' | 'elite' | 'advanced';
export type TroopType = 'infantry' | 'cavalry' | 'archer' | 'mixed';

export interface UserCommander {
  id: string;
  user_id: string;
  commander_id: string;
  name: string;
  rarity: Rarity;
  troop_type: TroopType;
  level: number;
  stars: number;
  skill_levels: number[];
  role: string[];
  created_at: string;
  updated_at: string;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface EventWithDetails extends Omit<GameEvent, 'category'> {
  category: EventCategory | null;
  strategies: EventStrategy[];
  checklists: (EventChecklist & { items: ChecklistItem[] })[];
}

export interface GuideNavItem {
  slug: string;
  title: string;
  description?: string;
  icon?: string;
  children?: GuideNavItem[];
}

// =============================================================================
// FORM/INPUT TYPES
// =============================================================================

export interface CreateEventInput {
  slug: string;
  name: string;
  category_id?: string;
  description?: string;
  frequency?: string;
  duration?: string;
  min_city_hall?: number;
  overview?: string;
  mechanics?: string;
  rewards?: string;
}

export interface UpdateEventInput extends Partial<CreateEventInput> {
  is_published?: boolean;
  sort_order?: number;
}

export interface CreateStrategyInput {
  event_id: string;
  title: string;
  content: string;
  strategy_type?: StrategyType;
}

export interface UpdateStrategyInput extends Partial<Omit<CreateStrategyInput, 'event_id'>> {
  is_published?: boolean;
  sort_order?: number;
}

export interface CreateChecklistInput {
  event_id: string;
  title: string;
  description?: string;
  items?: { content: string; details?: string }[];
}

export interface UpdateAlliancePageInput {
  title?: string;
  description?: string;
  content?: string;
  icon?: string;
  is_published?: boolean;
}

export interface UpdateGuardianScheduleInput {
  spawn_time_1?: string;
  spawn_time_2?: string;
  protocol?: string;
  timezone?: string;
  notification_minutes?: number;
}
