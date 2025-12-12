-- AoO Strategy Update - Pre-assigned roles for confirmed players
-- Run this in Supabase SQL Editor

UPDATE aoo_strategy SET data = '{
  "players": [
    {"id": 1, "name": "FnDuke", "team": 1, "tags": ["Rally Leader", "Teleport 1st", "Confirmed"], "power": 10496612, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 2, "name": "cloud", "team": 1, "tags": ["Confirmed"], "power": 14168682, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 3, "name": "Funny", "team": 1, "tags": ["Confirmed"], "power": 13953841, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 4, "name": "Hades", "team": 1, "tags": ["Confirmed"], "power": 13211409, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 5, "name": "bear", "team": 1, "tags": ["Confirmed"], "power": 12706131, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 6, "name": "DRAGON", "team": 1, "tags": ["Confirmed"], "power": 11161597, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 7, "name": "VNKaiLey", "team": 1, "tags": ["Confirmed"], "power": 10606053, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 8, "name": "Fluffy Jester", "team": 1, "tags": ["Confirmed"], "power": 9956320, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 9, "name": "Lady Leanna", "team": 1, "tags": ["Confirmed"], "power": 9066944, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 10, "name": "Buby", "team": 1, "tags": ["Confirmed"], "power": 8920472, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 11, "name": "TURAN80g", "team": 1, "tags": ["Confirmed"], "power": 8836607, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 12, "name": "SkyLord", "team": 1, "tags": ["Confirmed"], "power": 8284335, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 13, "name": "sun god", "team": 1, "tags": ["Confirmed"], "power": 8105982, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 14, "name": "Lukes", "team": 1, "tags": ["Confirmed"], "power": 7973454, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 15, "name": "Adegi", "team": 1, "tags": ["Confirmed"], "power": 6632214, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 16, "name": "Fluffy", "team": 2, "tags": ["Rally Leader", "Teleport 1st", "Confirmed"], "power": 58002935, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 17, "name": "Sysstm", "team": 2, "tags": ["Rally Leader", "Teleport 1st", "Confirmed"], "power": 60380989, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 18, "name": "Suntzu", "team": 3, "tags": ["Rally Leader", "Teleport 1st", "Confirmed"], "power": 22531780, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 19, "name": "Vaelstrom", "team": 3, "tags": ["Confirmed"], "power": 12702636, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 20, "name": "Fluffy Queen", "team": 3, "tags": ["Confirmed"], "power": 13314510, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 21, "name": "Black Ruler", "team": 3, "tags": ["Confirmed"], "power": 10970662, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 22, "name": "Obi", "team": 3, "tags": ["Confirmed"], "power": 10146256, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 23, "name": "Raijin", "team": 3, "tags": ["Confirmed"], "power": 11246360, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 24, "name": "Batussai", "team": 3, "tags": ["Confirmed"], "power": 8387327, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 25, "name": "unlimit", "team": 3, "tags": ["Confirmed"], "power": 8322764, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 26, "name": "Bakr", "team": 3, "tags": ["Confirmed"], "power": 8192217, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 27, "name": "Enes1111", "team": 3, "tags": ["Confirmed"], "power": 7266601, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 28, "name": "WOLF", "team": 3, "tags": ["Confirmed"], "power": 6972878, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 29, "name": "Sunman", "team": 3, "tags": ["Confirmed"], "power": 6446296, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}}
  ],
  "teams": [
    {"name": "Zone 1", "description": "Ark"},
    {"name": "Zone 2", "description": "Upper"},
    {"name": "Zone 3", "description": "Lower"}
  ],
  "substitutes": [],
  "notes": "",
  "mapImage": null,
  "mapAssignments": {}
}'::jsonb WHERE event_mode = 'main';

-- Verify the update
SELECT
  event_mode,
  json_array_length(data->'players') as player_count
FROM aoo_strategy
WHERE event_mode = 'main';
