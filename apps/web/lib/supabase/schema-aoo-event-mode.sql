-- Migration: Add event_mode column to aoo_strategy table
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Add event_mode column with default 'main' for existing records
ALTER TABLE public.aoo_strategy
ADD COLUMN IF NOT EXISTS event_mode text NOT NULL DEFAULT 'main'
CHECK (event_mode IN ('main', 'training'));

-- Update any existing record to be 'main' (should already be by default)
UPDATE public.aoo_strategy SET event_mode = 'main' WHERE event_mode IS NULL;

-- Create unique constraint to ensure only one record per event_mode
-- First drop if exists (in case re-running)
ALTER TABLE public.aoo_strategy DROP CONSTRAINT IF EXISTS aoo_strategy_event_mode_unique;

-- Add unique constraint
ALTER TABLE public.aoo_strategy ADD CONSTRAINT aoo_strategy_event_mode_unique UNIQUE (event_mode);

-- Create index for faster lookups by event_mode
CREATE INDEX IF NOT EXISTS aoo_strategy_event_mode_idx ON public.aoo_strategy(event_mode);
