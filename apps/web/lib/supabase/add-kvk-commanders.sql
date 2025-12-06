-- Add KvK and current meta commanders to the database
-- Run this in Supabase SQL Editor

-- ============ NEW META COMMANDERS (2024-2025) ============

-- Arthur Pendragon (NEW - First dual-damage cavalry commander)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'arthur-pendragon',
  'Arthur Pendragon',
  'legendary',
  ARRAY['nuker', 'support'],
  'cavalry',
  ARRAY['Cavalry', 'Versatility', 'Skill'],
  108, 96, 100, 60,
  'Excalibur''s Wrath',
  'Launches combo attacks against up to 3 targets with massive damage',
  1000, 2800, 3,
  ARRAY['subutai', 'huo-qubing', 'alexander-nevsky']
)
ON CONFLICT (id) DO NOTHING;

-- Subutai (NEW - Rally specialist)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'subutai',
  'Subutai',
  'legendary',
  ARRAY['nuker'],
  'cavalry',
  ARRAY['Cavalry', 'Conquering', 'Skill'],
  106, 94, 97, 60,
  'Lightning Assault',
  'Launches 3 combo attacks against target with burn effect',
  1000, 1000, 1,
  ARRAY['arthur-pendragon', 'genghis-khan']
)
ON CONFLICT (id) DO NOTHING;

-- Alexander Nevsky (Top tier cavalry)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'alexander-nevsky',
  'Alexander Nevsky',
  'legendary',
  ARRAY['nuker'],
  'cavalry',
  ARRAY['Cavalry', 'Conquering', 'Skill'],
  110, 92, 94, 60,
  'Novgorod Tactics',
  'Deals massive charge damage to target',
  1000, 1500, 1,
  ARRAY['joan-of-arc', 'arthur-pendragon', 'huo-qubing']
)
ON CONFLICT (id) DO NOTHING;

-- Zhuge Liang (Ranged siege commander)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'zhuge-liang',
  'Zhuge Liang',
  'legendary',
  ARRAY['nuker', 'support'],
  'archer',
  ARRAY['Archer', 'Conquering', 'Skill'],
  104, 94, 97, 50,
  'Eight Gates Array',
  'Deals damage over time to enemies in target area',
  1000, 1200, 3,
  ARRAY['hermann-prime', 'yi-seong-gye', 'ramesses-ii']
)
ON CONFLICT (id) DO NOTHING;

-- Liu Che (Top tier infantry)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'liu-che',
  'Liu Che',
  'legendary',
  ARRAY['nuker', 'tank'],
  'infantry',
  ARRAY['Infantry', 'Conquering', 'Attack'],
  106, 100, 103, 50,
  'Emperor''s Might',
  'Deals massive damage and provides infantry buffs',
  1000, 1700, 1,
  ARRAY['guan-yu', 'leonidas-i', 'scipio-prime']
)
ON CONFLICT (id) DO NOTHING;

-- Xiang Yu (Strong infantry)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'xiang-yu',
  'Xiang Yu',
  'legendary',
  ARRAY['nuker'],
  'infantry',
  ARRAY['Infantry', 'Conquering', 'Attack'],
  112, 88, 97, 50,
  'Conqueror''s Fury',
  'Deals devastating damage with attack buffs',
  1000, 1800, 1,
  ARRAY['liu-che', 'guan-yu']
)
ON CONFLICT (id) DO NOTHING;

-- Nebuchadnezzar II (Strong infantry)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'nebuchadnezzar-ii',
  'Nebuchadnezzar II',
  'legendary',
  ARRAY['nuker', 'tank'],
  'infantry',
  ARRAY['Infantry', 'Conquering', 'Defense'],
  100, 106, 100, 50,
  'Babylon''s Glory',
  'Deals damage and provides defensive buffs',
  1000, 1400, 1,
  ARRAY['guan-yu', 'charles-martel']
)
ON CONFLICT (id) DO NOTHING;

-- Huo Qubing (Cavalry, pairs with Arthur)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'huo-qubing',
  'Huo Qubing',
  'legendary',
  ARRAY['nuker'],
  'cavalry',
  ARRAY['Cavalry', 'Conquering', 'Skill'],
  108, 91, 97, 60,
  'Swift Strike',
  'Deals rapid cavalry damage with mobility buffs',
  1000, 1600, 1,
  ARRAY['arthur-pendragon', 'alexander-nevsky']
)
ON CONFLICT (id) DO NOTHING;

-- ============ PRIME COMMANDERS ============

-- Joan of Arc Prime
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'joan-of-arc-prime',
  'Joan of Arc Prime',
  'legendary',
  ARRAY['support'],
  'mixed',
  ARRAY['Integration', 'Support', 'Skill'],
  94, 100, 106, 50,
  'Divine Blessing',
  'Provides powerful healing and buffs to allied troops',
  1000, 800, 5,
  ARRAY['alexander-nevsky', 'arthur-pendragon']
)
ON CONFLICT (id) DO NOTHING;

-- Scipio Africanus Prime
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'scipio-prime',
  'Scipio Africanus Prime',
  'legendary',
  ARRAY['nuker', 'support'],
  'mixed',
  ARRAY['Leadership', 'Conquering', 'Attack'],
  103, 97, 100, 50,
  'Roman Tactics',
  'Deals damage and provides leadership buffs',
  1000, 1500, 3,
  ARRAY['liu-che', 'guan-yu']
)
ON CONFLICT (id) DO NOTHING;

-- Boudica Prime
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'boudica-prime',
  'Boudica Prime',
  'legendary',
  ARRAY['nuker', 'support'],
  'mixed',
  ARRAY['Integration', 'Peacekeeping', 'Skill'],
  100, 94, 100, 50,
  'Celtic Fury',
  'Deals AOE damage with rage generation',
  1000, 1400, 3,
  ARRAY['aethelflaed', 'lohar']
)
ON CONFLICT (id) DO NOTHING;

-- Hermann Prime
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'hermann-prime',
  'Hermann Prime',
  'legendary',
  ARRAY['nuker', 'support'],
  'archer',
  ARRAY['Archer', 'Garrison', 'Skill'],
  100, 97, 97, 50,
  'Germanic Assault',
  'Deals damage and silences enemy commanders',
  1000, 1300, 1,
  ARRAY['zhuge-liang', 'yi-seong-gye']
)
ON CONFLICT (id) DO NOTHING;

-- ============ OTHER META COMMANDERS ============

-- Dido (Archer)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'dido',
  'Dido',
  'legendary',
  ARRAY['nuker'],
  'archer',
  ARRAY['Archer', 'Conquering', 'Skill'],
  103, 94, 97, 50,
  'Carthage''s Flame',
  'Deals ranged damage with debuffs',
  1000, 1400, 1,
  ARRAY['zhuge-liang', 'ramesses-ii']
)
ON CONFLICT (id) DO NOTHING;

-- Chandragupta (Cavalry)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'chandragupta',
  'Chandragupta Maurya',
  'legendary',
  ARRAY['nuker'],
  'cavalry',
  ARRAY['Cavalry', 'Conquering', 'Attack'],
  106, 91, 97, 60,
  'Maurya''s Charge',
  'Deals cavalry damage with attack buffs',
  1000, 1500, 1,
  ARRAY['cao-cao', 'saladin']
)
ON CONFLICT (id) DO NOTHING;

-- Trajan (Infantry)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'trajan',
  'Trajan',
  'legendary',
  ARRAY['nuker', 'support'],
  'infantry',
  ARRAY['Infantry', 'Conquering', 'Attack'],
  103, 97, 100, 50,
  'Optimus Princeps',
  'Deals damage and provides infantry buffs',
  1000, 1400, 1,
  ARRAY['guan-yu', 'scipio-prime']
)
ON CONFLICT (id) DO NOTHING;

-- Cheok Jun-Gyeong (Infantry)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'cheok-jun-gyeong',
  'Cheok Jun-Gyeong',
  'legendary',
  ARRAY['nuker'],
  'infantry',
  ARRAY['Infantry', 'Conquering', 'Skill'],
  106, 94, 100, 50,
  'Gwanggaeto''s Heir',
  'Deals massive infantry damage',
  1000, 1600, 1,
  ARRAY['guan-yu', 'liu-che']
)
ON CONFLICT (id) DO NOTHING;

-- Honda Tadakatsu (Infantry garrison)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'honda-tadakatsu',
  'Honda Tadakatsu',
  'legendary',
  ARRAY['tank'],
  'infantry',
  ARRAY['Infantry', 'Garrison', 'Defense'],
  97, 106, 103, 50,
  'Tokugawa''s Shield',
  'Provides powerful garrison defense',
  1000, 1200, 1,
  ARRAY['charles-martel', 'richard-i']
)
ON CONFLICT (id) DO NOTHING;

-- Gilgamesh (Infantry)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'gilgamesh',
  'Gilgamesh',
  'legendary',
  ARRAY['nuker', 'tank'],
  'infantry',
  ARRAY['Infantry', 'Conquering', 'Attack'],
  106, 100, 100, 50,
  'King of Uruk',
  'Deals massive damage with defensive buffs',
  1000, 1600, 1,
  ARRAY['guan-yu', 'leonidas-i']
)
ON CONFLICT (id) DO NOTHING;

-- Gorgo (Infantry)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'gorgo',
  'Gorgo',
  'legendary',
  ARRAY['nuker', 'tank'],
  'infantry',
  ARRAY['Infantry', 'Conquering', 'Defense'],
  100, 103, 103, 50,
  'Spartan Queen',
  'Deals damage with defensive capabilities',
  1000, 1400, 1,
  ARRAY['leonidas-i', 'guan-yu']
)
ON CONFLICT (id) DO NOTHING;

-- Imhotep (Support)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'imhotep',
  'Imhotep',
  'legendary',
  ARRAY['support'],
  'mixed',
  ARRAY['Leadership', 'Support', 'Skill'],
  91, 100, 106, 50,
  'Architect''s Wisdom',
  'Provides healing and support buffs',
  1000, 800, 5,
  ARRAY['wu-zetian', 'cleopatra-vii']
)
ON CONFLICT (id) DO NOTHING;

-- Pakal II (Leadership)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'pakal-ii',
  'Pakal the Great',
  'legendary',
  ARRAY['support', 'nuker'],
  'mixed',
  ARRAY['Leadership', 'Conquering', 'Support'],
  100, 97, 100, 50,
  'Mayan Glory',
  'Deals damage and provides leadership buffs',
  1000, 1300, 3,
  ARRAY['julius-caesar', 'hannibal-barca']
)
ON CONFLICT (id) DO NOTHING;

-- Tariq Ibn Ziyad (Cavalry)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'tariq-ibn-ziyad',
  'Tariq Ibn Ziyad',
  'legendary',
  ARRAY['nuker'],
  'cavalry',
  ARRAY['Cavalry', 'Conquering', 'Attack'],
  106, 91, 97, 60,
  'Conquest of Iberia',
  'Deals cavalry damage with attack buffs',
  1000, 1500, 1,
  ARRAY['saladin', 'cao-cao']
)
ON CONFLICT (id) DO NOTHING;

-- Matthias I Corvinus (NEW anniversary)
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'matthias-corvinus',
  'Matthias Corvinus',
  'legendary',
  ARRAY['tank'],
  'infantry',
  ARRAY['Leadership', 'Garrison', 'Defense'],
  94, 106, 106, 50,
  'Black Army',
  'Provides AOE shields and counter-damage on city defense',
  1000, 1100, 3,
  ARRAY['charles-martel', 'richard-i']
)
ON CONFLICT (id) DO NOTHING;

-- Ashurbanipal
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'ashurbanipal',
  'Ashurbanipal',
  'legendary',
  ARRAY['nuker', 'support'],
  'archer',
  ARRAY['Archer', 'Conquering', 'Skill'],
  106, 94, 97, 50,
  'Library of Nineveh',
  'Deals ranged damage with skill buffs',
  1000, 1500, 1,
  ARRAY['zhuge-liang', 'ramesses-ii']
)
ON CONFLICT (id) DO NOTHING;

-- Yi Sun-sin
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'yi-sun-sin',
  'Yi Sun-sin',
  'legendary',
  ARRAY['nuker'],
  'archer',
  ARRAY['Archer', 'Garrison', 'Skill'],
  103, 97, 97, 50,
  'Turtle Ship',
  'Deals ranged damage with garrison bonuses',
  1000, 1400, 1,
  ARRAY['yi-seong-gye', 'ramesses-ii']
)
ON CONFLICT (id) DO NOTHING;

-- Henry V
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'henry-v',
  'Henry V',
  'legendary',
  ARRAY['nuker'],
  'archer',
  ARRAY['Archer', 'Conquering', 'Attack'],
  106, 91, 97, 50,
  'Agincourt',
  'Deals massive archer damage',
  1000, 1600, 1,
  ARRAY['edward-of-woodstock', 'yi-seong-gye']
)
ON CONFLICT (id) DO NOTHING;

-- Amanitore
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'amanitore',
  'Amanitore',
  'legendary',
  ARRAY['nuker'],
  'archer',
  ARRAY['Archer', 'Conquering', 'Skill'],
  103, 94, 97, 50,
  'Nubian Queen',
  'Deals archer damage with skill buffs',
  1000, 1400, 1,
  ARRAY['ramesses-ii', 'yi-seong-gye']
)
ON CONFLICT (id) DO NOTHING;

-- Eleanor of Aquitaine
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'eleanor-of-aquitaine',
  'Eleanor of Aquitaine',
  'legendary',
  ARRAY['support'],
  'mixed',
  ARRAY['Leadership', 'Garrison', 'Support'],
  91, 100, 106, 50,
  'Queen''s Grace',
  'Provides support and garrison buffs',
  1000, 900, 5,
  ARRAY['richard-i', 'joan-of-arc']
)
ON CONFLICT (id) DO NOTHING;

-- Lapu-Lapu
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'lapu-lapu',
  'Lapu-Lapu',
  'legendary',
  ARRAY['nuker'],
  'infantry',
  ARRAY['Infantry', 'Conquering', 'Attack'],
  106, 94, 97, 50,
  'Mactan''s Defender',
  'Deals infantry damage with attack buffs',
  1000, 1500, 1,
  ARRAY['guan-yu', 'leonidas-i']
)
ON CONFLICT (id) DO NOTHING;

-- Justinian I
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'justinian-i',
  'Justinian I',
  'legendary',
  ARRAY['support', 'tank'],
  'cavalry',
  ARRAY['Cavalry', 'Versatility', 'Defense'],
  97, 103, 100, 60,
  'Byzantine Glory',
  'Provides defensive buffs and cavalry support',
  1000, 1200, 1,
  ARRAY['belisarius', 'cao-cao']
)
ON CONFLICT (id) DO NOTHING;

-- Sargon of Akkad
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'sargon-of-akkad',
  'Sargon of Akkad',
  'legendary',
  ARRAY['nuker'],
  'infantry',
  ARRAY['Infantry', 'Conquering', 'Attack'],
  106, 94, 97, 50,
  'First Emperor',
  'Deals massive infantry damage',
  1000, 1600, 1,
  ARRAY['guan-yu', 'gilgamesh']
)
ON CONFLICT (id) DO NOTHING;

-- Babur
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'babur',
  'Babur',
  'legendary',
  ARRAY['nuker'],
  'cavalry',
  ARRAY['Cavalry', 'Conquering', 'Attack'],
  106, 91, 97, 60,
  'Mughal Founder',
  'Deals cavalry damage with attack buffs',
  1000, 1500, 1,
  ARRAY['cao-cao', 'saladin']
)
ON CONFLICT (id) DO NOTHING;

-- Pericles
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'pericles',
  'Pericles',
  'legendary',
  ARRAY['support', 'nuker'],
  'infantry',
  ARRAY['Infantry', 'Versatility', 'Support'],
  97, 100, 100, 50,
  'Golden Age',
  'Provides buffs and deals moderate damage',
  1000, 1200, 3,
  ARRAY['leonidas-i', 'gorgo']
)
ON CONFLICT (id) DO NOTHING;

-- Philip II
INSERT INTO public.commanders (id, name, rarity, roles, troop_type, specialties, attack, defense, health, march_speed, skill_1_name, skill_1_description, skill_1_rage, skill_1_damage_coefficient, skill_1_targets, synergies)
VALUES (
  'philip-ii',
  'Philip II',
  'legendary',
  ARRAY['nuker'],
  'cavalry',
  ARRAY['Cavalry', 'Conquering', 'Skill'],
  106, 94, 97, 60,
  'Macedonian Tactics',
  'Active skill has 40% chance to trigger twice',
  1000, 1400, 1,
  ARRAY['arthur-pendragon', 'alexander-the-great']
)
ON CONFLICT (id) DO NOTHING;

-- Verify insertions
SELECT name, rarity, troop_type FROM public.commanders
ORDER BY name;
