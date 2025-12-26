# Commander Scanner

Scan commander screenshots to extract level, skills, and stats.

## Features

- **OCR Detection** - Uses Tesseract.js for text recognition
- **AI Detection** - Optional Roboflow integration for enhanced accuracy
- **Skill Extraction** - Detects all 4 skills plus expertise
- **Stat Parsing** - Power, troop capacity, level, and stars

## How to Use

### Option 1: Screenshot Scanning (OCR)

1. Open the Scanners page and select **Commander Scanner**
2. Upload a screenshot of your commander info screen
3. The scanner will detect:
   - Commander name
   - Level (1-60)
   - Stars (1-6)
   - Skill levels (5/5/5/5/1 format)
   - Power rating
   - Troop capacity
4. Review the detected values and adjust if needed
5. Click **Accept** to save to your inventory

### Option 2: JSON Import

For faster and more accurate imports, you can create a JSON file with your commander roster and import it directly.

1. Go to the Scanners page (`/scanners`)
2. Click **Import Commanders** card
3. Select your JSON file
4. Open the Commander Scanner to view imported commanders

## JSON Format

```json
{
  "commanders": [
    {
      "id": "richard-i",
      "name": "Richard I",
      "rarity": "legendary",
      "types": ["infantry", "defender"],
      "level": 60,
      "skills": [5, 5, 5, 5, 4],
      "stars": 5,
      "power": 1234567
    },
    {
      "id": "sun-tzu",
      "name": "Sun Tzu",
      "rarity": "epic",
      "types": ["infantry", "support"],
      "level": 50,
      "skills": [5, 5, 5, 5],
      "stars": 4,
      "power": 456789
    }
  ]
}
```

### Commander Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (e.g., `richard-i`, `sun-tzu`) |
| `name` | string | Yes | Commander display name |
| `rarity` | string | Yes | One of: `legendary`, `epic`, `elite`, `advanced`, `normal` |
| `types` | string[] | Yes | Array of commander types |
| `level` | number | Yes | Commander level (1-60) |
| `skills` | number[] | Yes | Array of skill levels (4-5 values, each 1-5) |
| `stars` | number | No | Star level (1-5), defaults to 1 |
| `power` | number | No | Commander power rating |
| `unitCapacity` | number | No | Troop capacity bonus |

### Commander Types

- `infantry` - Infantry tree unlocked
- `cavalry` - Cavalry tree unlocked
- `archer` - Archer tree unlocked
- `leadership` - Leadership tree unlocked
- `defender` - Garrison/defense specialist
- `attacker` - Rally/offense specialist
- `support` - Buffing/debuffing abilities
- `gatherer` - Resource gathering bonuses
- `peacekeeping` - Barbarian/event bonuses

## Best Practices

- Screenshot the commander details screen (not the portrait)
- Ensure all skill levels are visible
- Use high resolution for better OCR accuracy
- Dark mode screenshots work better for contrast

## Supported Commanders

The scanner works with all commanders in Rise of Kingdoms, including:
- Legendary commanders
- Epic commanders
- Elite commanders
- Advanced commanders

## Troubleshooting

**OCR not detecting correctly?**
- Ensure the screenshot is clear and not compressed
- Try cropping to just the commander info area
- Use the manual edit option to correct values

**Skills showing wrong values?**
- Double-check the skill order matches in-game
- Use the dropdown selectors to manually set levels
