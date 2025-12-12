-- AoO Strategy Update - From AoO_assignments.csv
-- Run this in Supabase SQL Editor

UPDATE aoo_strategy SET data = '{
  "players": [
    {"id": 1, "name": "Suntzu", "team": 3, "tags": ["Rally Leader", "Teleport 1st", "Confirmed"], "power": 22560084, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 2, "name": "Bun", "team": 3, "tags": ["Confirmed"], "power": 17420438, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 3, "name": "Funny", "team": 3, "tags": ["Confirmed"], "power": 14043140, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 4, "name": "Fluffy Queen", "team": 3, "tags": ["Teleport 1st"], "power": 13314970, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 5, "name": "Vaelstrom", "team": 3, "tags": ["Teleport 1st", "Confirmed"], "power": 12702636, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 6, "name": "Black Ruler", "team": 3, "tags": ["Confirmed"], "power": 10973909, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 7, "name": "Fluffy Jester", "team": 3, "tags": ["Confirmed"], "power": 10044542, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 8, "name": "Buby", "team": 3, "tags": ["Confirmed"], "power": 8920472, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 9, "name": "Batussai", "team": 3, "tags": ["Confirmed"], "power": 8395564, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 10, "name": "Bakr", "team": 3, "tags": ["Confirmed"], "power": 8193717, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 11, "name": "sun god", "team": 3, "tags": ["Confirmed"], "power": 8105982, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 12, "name": "MrOren", "team": 3, "tags": ["Confirmed"], "power": 8012818, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 13, "name": "Cain", "team": 3, "tags": [], "power": 7263767, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 14, "name": "Sunman", "team": 3, "tags": ["Confirmed"], "power": 6450186, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 15, "name": "Sysstm", "team": 2, "tags": ["Rally Leader", "Teleport 1st", "Confirmed"], "power": 60380989, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 16, "name": "Fluffy", "team": 2, "tags": ["Rally Leader", "Teleport 1st", "Confirmed"], "power": 58678555, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 17, "name": "GiaHuy", "team": 1, "tags": [], "power": 17753402, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 18, "name": "cloud", "team": 1, "tags": ["Teleport 1st", "Confirmed"], "power": 14177673, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 19, "name": "Hades", "team": 1, "tags": ["Confirmed"], "power": 13215367, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 20, "name": "MadMonkey", "team": 1, "tags": [], "power": 13079094, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 21, "name": "Divid3", "team": 1, "tags": ["Confirmed"], "power": 12757179, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 22, "name": "bear", "team": 1, "tags": [], "power": 12713981, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 23, "name": "BBQSGE", "team": 1, "tags": ["Confirmed"], "power": 12353171, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 24, "name": "MayorEric", "team": 1, "tags": [], "power": 11921993, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 25, "name": "DRAGON", "team": 1, "tags": ["Confirmed"], "power": 11161597, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 26, "name": "VNKaiLey", "team": 1, "tags": ["Confirmed"], "power": 10606053, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 27, "name": "FnDuke", "team": 1, "tags": ["Rally Leader", "Teleport 1st", "Confirmed"], "power": 10494272, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 28, "name": "Obi", "team": 1, "tags": ["Teleport 1st", "Confirmed"], "power": 10162482, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 29, "name": "Lady Leanna", "team": 1, "tags": ["Confirmed"], "power": 9070720, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 30, "name": "Adegi", "team": 1, "tags": ["Confirmed"], "power": 6632214, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}}
  ],
  "teams": [
    {"name": "Zone 1", "description": "Lower"},
    {"name": "Zone 2", "description": "Ark"},
    {"name": "Zone 3", "description": "Upper"}
  ],
  "substitutes": [
    {"id": 101, "name": "Angry Short Guy", "team": 0, "tags": [], "power": 30897651, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 102, "name": "Sadgame", "team": 0, "tags": [], "power": 30788878, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 103, "name": "Xtelli", "team": 0, "tags": [], "power": 26508084, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 104, "name": "Zdrawee", "team": 0, "tags": [], "power": 25079351, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 105, "name": "leander112", "team": 0, "tags": [], "power": 21011797, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 106, "name": "ZETMA", "team": 0, "tags": [], "power": 18521715, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 107, "name": "NECO", "team": 0, "tags": [], "power": 18092407, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 108, "name": "Crus8r", "team": 0, "tags": [], "power": 17005737, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 109, "name": "Conejo", "team": 0, "tags": [], "power": 16986586, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}},
    {"id": 110, "name": "Shroud", "team": 0, "tags": [], "power": 13221420, "assignments": {"phase1": "", "phase2": "", "phase3": "", "phase4": ""}}
  ],
  "notes": "",
  "mapImage": null,
  "mapAssignments": {}
}'::jsonb WHERE id = 1;
