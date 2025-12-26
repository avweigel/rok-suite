# Scanners

Screenshot analysis tools to build your in-game inventory using OCR technology. You can also import data directly via JSON files.

## Quick Import (Recommended)

For faster and more accurate data entry, use **JSON import**:

1. Go to `/scanners`
2. Use the **Import Commanders** or **Import Bag Inventory** cards
3. Select your JSON file
4. Data is loaded instantly

See [Commander Scanner](scanners/commander.md) and [Bag Scanner](scanners/bag.md) for JSON format details.

## Available Scanners

### Commander Scanner

Extract commander information from screenshots including:
- Commander name and title
- Level and stars
- Skill levels (1-4 and expertise)
- Power and troop capacity

### Equipment Scanner

Build your gear inventory by scanning equipment screenshots:
- Automatic equipment identification
- Quality/rarity detection
- Stats extraction
- Set bonus tracking

### Bag Scanner

Inventory your resources and items:
- Resources (food, wood, stone, gold, gems)
- Speedups (all types and durations)
- Boosts and buffs
- Materials and sculptures
- Keys, teleports, and special items

## How It Works

1. **Upload** - Take a screenshot in-game and upload it to the scanner
2. **Scan** - OCR technology extracts text and identifies items
3. **Verify** - Review detected items and adjust if needed
4. **Save** - Add to your inventory (stored locally, synced when logged in)

## Scanning Tips

1. Take clear screenshots with the item/commander info fully visible
2. Use screenshots at full resolution (no cropping) for best results
3. The scanner uses OCR - verify detected values before accepting
4. You can manually adjust any incorrectly detected values

## Data Sources

Equipment and item databases compiled from:
- [Rise of Kingdoms Fandom Wiki](https://riseofkingdoms.fandom.com/)
- [ROK.guide](https://www.rok.guide/)
- [RiseOfKingdomsGuides.com](https://riseofkingdomsguides.com/)

---

*45 equipment items and 100+ bag items in the database*
