-- Migration: Add aoo_team column to aoo_strategy table
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Add aoo_team column with default 'team1' for existing records
ALTER TABLE public.aoo_strategy
ADD COLUMN IF NOT EXISTS aoo_team text NOT NULL DEFAULT 'team1'
CHECK (aoo_team IN ('team1', 'team2'));

-- Update any existing record to be 'team1' (should already be by default)
UPDATE public.aoo_strategy SET aoo_team = 'team1' WHERE aoo_team IS NULL;

-- Drop old unique constraint on event_mode (if exists)
ALTER TABLE public.aoo_strategy DROP CONSTRAINT IF EXISTS aoo_strategy_event_mode_unique;

-- Create composite unique constraint for event_mode + aoo_team
-- This allows one record per (event_mode, aoo_team) combination
ALTER TABLE public.aoo_strategy DROP CONSTRAINT IF EXISTS aoo_strategy_mode_team_unique;
ALTER TABLE public.aoo_strategy ADD CONSTRAINT aoo_strategy_mode_team_unique UNIQUE (event_mode, aoo_team);

-- Create composite index for faster lookups
DROP INDEX IF EXISTS aoo_strategy_mode_team_idx;
CREATE INDEX aoo_strategy_mode_team_idx ON public.aoo_strategy(event_mode, aoo_team);
