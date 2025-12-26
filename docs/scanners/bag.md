# Bag Scanner

Inventory your resources, speedups, and items from bag screenshots.

## Features

- **Category Filtering** - Organize by item type
- **Quantity Detection** - OCR reads item counts
- **100+ Items** - Comprehensive item database
- **Bulk Scanning** - Process multiple screenshots

## Item Categories

### Resources
- Food (1K to 10M packs)
- Wood (1K to 10M packs)
- Stone (1K to 10M packs)
- Gold (1K to 10M packs)
- Gems (various amounts)

### Speedups
- **Universal** - 1min to 7 days
- **Training** - Troop training acceleration
- **Building** - Construction speedups
- **Research** - Technology speedups
- **Healing** - Hospital recovery

### Boosts
- Attack boost (10-50%)
- Defense boost (10-50%)
- Health boost (10-50%)
- Training speed boost
- Gathering speed boost
- March speed boost

### Materials
- Crafting blueprints
- Material chests
- Equipment materials

### Sculptures
- Universal sculptures
- Epic commander sculptures
- Legendary commander sculptures
- Golden sculptures

### Special Items
- Truce agreements (8h, 12h, 24h)
- VIP points
- Action point recovery
- Territorial teleports
- Targeted teleports
- Random teleports

### Keys
- Silver keys
- Gold keys
- Legendary commander chests

## How to Use

### Option 1: Screenshot Scanning (OCR)

1. Screenshot your bag screen in-game
2. Upload to the Bag Scanner
3. Filter by category if needed
4. Review detected items and quantities
5. Adjust any incorrect values
6. Save to your inventory

### Option 2: JSON Import

For faster and more accurate imports, you can create a JSON file with your inventory data and import it directly.

1. Go to the Scanners page (`/scanners`)
2. Click **Import Bag Inventory** card
3. Select your JSON file
4. View your imported inventory in the Bag Scanner

## JSON Format

```json
{
  "bagInventory": {
    "chests": {
      "equipmentMaterialChoice": 51,
      "eliteEquipment": 30,
      "epicEquipment": 120,
      "legendaryEquipment": 1
    },
    "equipment": {
      "epic": [
        { "id": "epic-helmet-1", "slot": "helmet", "type": "infantry", "craftable": false }
      ],
      "uncommon": [
        { "id": "uncommon-boots-1", "slot": "boots", "type": "universal", "craftable": true }
      ]
    },
    "blueprints": {
      "legendary": [{ "name": "Legendary Weapon Blueprint", "quantity": 1 }],
      "epic": [{ "name": "Epic Sword Blueprint", "quantity": 1 }],
      "rare": [{ "name": "Rare Horn Blueprint", "quantity": 8 }],
      "normal": [{ "name": "Normal Leather Blueprint", "quantity": 7 }],
      "fragmentedBlueprints": [{ "name": "Fragmented Helmet Blueprint", "quantity": 15 }]
    },
    "materials": {
      "tier4": { "leather": 447, "stone": 452, "hardwood": 437, "bone": 421 },
      "tier3": { "leather": 60, "stone": 51, "hardwood": 47, "bone": 52 },
      "tier2": { "leather": 29, "stone": 28, "hardwood": 44, "bone": 11 },
      "tier1": { "leather": 19, "stone": 21, "hardwood": 17, "bone": 5 },
      "special": { "fireCrystal": 1, "rockChunks": 1 }
    }
  },
  "metadata": {
    "lastUpdated": "2025-12-23",
    "playerPower": 15750303,
    "vipLevel": 9
  }
}
```

### JSON Structure

| Section | Description |
|---------|-------------|
| `chests` | Equipment chest counts by type (key: chest type, value: count) |
| `equipment` | Equipment items grouped by rarity (legendary/epic/elite/rare/uncommon) |
| `blueprints` | Blueprint items grouped by rarity, each with name and quantity |
| `materials` | Crafting materials grouped by tier (tier1-4 and special) |
| `metadata` | Optional player info: lastUpdated, playerPower, vipLevel |

### Equipment Item Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `slot` | string | helmet, chest, gloves, legs, boots, weapon, offhand, accessory |
| `type` | string | infantry, cavalry, archer, universal |
| `craftable` | boolean | Whether item can be crafted |

### Blueprint Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Blueprint display name |
| `quantity` | number | How many you have |

### Material Tiers

- **tier4** - Highest quality crafting materials
- **tier3** - High quality materials
- **tier2** - Medium quality materials
- **tier1** - Basic materials
- **special** - Special crafting materials (fire crystals, rock chunks, etc.)

## Tips

- Scroll through your entire bag for complete inventory
- Take multiple screenshots for large inventories
- Check quantity detection carefully for stacked items
- **JSON import is recommended** for accurate, complete inventories
