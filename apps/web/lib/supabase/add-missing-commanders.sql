-- Add missing commanders to the database
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/mzvxlawobzwiqohmoskm/sql/new

-- Pyrrhus of Epirus
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'pyrrhus',
  'Pyrrhus of Epirus',
  'legendary',
  ARRAY['nuker'],
  'infantry',
  ARRAY['Infantry', 'Conquering', 'Attack'],
  105, 92, 94, 50,
  'Pyrrhic Victory',
  'Deals massive damage to the target',
  1000, 1600, 1,
  ARRAY['guan-yu', 'leonidas-i']
)
ON CONFLICT (id) DO NOTHING;

-- Cyrus the Great
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'cyrus-the-great',
  'Cyrus the Great',
  'legendary',
  ARRAY['support'],
  'mixed',
  ARRAY['Leadership', 'Conquering', 'Support'],
  97, 97, 97, 50,
  'King of Kings',
  'Increases troop capacity and provides buffs',
  1000, 1200, 1,
  ARRAY['alexander-the-great', 'julius-caesar']
)
ON CONFLICT (id) DO NOTHING;

-- Ishida Mitsunari
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'ishida-mitsunari',
  'Ishida Mitsunari',
  'legendary',
  ARRAY['support'],
  'mixed',
  ARRAY['Leadership', 'Conquering', 'Support'],
  94, 94, 103, 50,
  'Righteous Cause',
  'Provides support buffs to allied forces',
  1000, 1000, 3,
  ARRAY['takeda-shingen', 'minamoto-no-yoshitsune']
)
ON CONFLICT (id) DO NOTHING;

-- Mulan
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'mulan',
  'Mulan',
  'legendary',
  ARRAY['support', 'nuker'],
  'mixed',
  ARRAY['Integration', 'Peacekeeping', 'Versatility'],
  100, 97, 94, 50,
  'Legendary Warrior',
  'Deals damage and provides versatile buffs',
  1000, 1400, 1,
  ARRAY['aethelflaed', 'lohar']
)
ON CONFLICT (id) DO NOTHING;

-- Ragnar Lodbrok
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'ragnar-lodbrok',
  'Ragnar Lodbrok',
  'legendary',
  ARRAY['nuker'],
  'infantry',
  ARRAY['Infantry', 'Conquering', 'Skill'],
  106, 88, 97, 50,
  'Sea King',
  'Deals powerful skill damage',
  1000, 1700, 1,
  ARRAY['bjorn-ironside', 'harald-sigurdsson']
)
ON CONFLICT (id) DO NOTHING;

-- Seondeok
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'seondeok',
  'Seondeok',
  'legendary',
  ARRAY['gatherer', 'support'],
  'mixed',
  ARRAY['Leadership', 'Gathering', 'Support'],
  88, 97, 106, 50,
  'Star of Korea',
  'Increases gathering speed and provides support',
  1000, 800, 1,
  ARRAY['cleopatra-vii', 'joan-of-arc']
)
ON CONFLICT (id) DO NOTHING;

-- Verify the insertions
SELECT id, name, rarity FROM public.commanders
WHERE id IN ('pyrrhus', 'cyrus-the-great', 'ishida-mitsunari', 'mulan', 'ragnar-lodbrok', 'seondeok')
ORDER BY name;
