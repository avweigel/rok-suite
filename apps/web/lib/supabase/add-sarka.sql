-- Add Sarka to the commanders database
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/mzvxlawobzwiqohmoskm/sql/new

INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'sarka',
  'Sarka',
  'epic',
  ARRAY['garrison', 'nuker'],
  'infantry',
  ARRAY['Infantry', 'Garrison', 'Skill'],
  84, 84, 84, 45,
  'Bohemian Resistance',
  'Deals skill damage and provides garrison buffs',
  1000, 1000, 1,
  ARRAY['sun-tzu', 'charles-martel']
)
ON CONFLICT (id) DO NOTHING;

-- Verify the insertion
SELECT id, name, rarity FROM public.commanders WHERE id = 'sarka';
