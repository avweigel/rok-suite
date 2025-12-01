# Editor Guide

The AoO Strategy Planner includes an editor mode for alliance leaders to customize strategies.

## Accessing Editor Mode

1. Click the **Edit** button in the top-right corner
2. Enter the password when prompted
3. Editor controls will appear

> **Note:** The default password is set by your alliance leadership.

## Editor Features

### Player Management

#### Adding Players

1. Scroll to the **Roster** tab
2. Click **Add Player** button
3. Enter player name
4. Assign to a zone (1, 2, 3, or Substitute)
5. Add role tags

#### Editing Players

Click any player row to:
- Change their name
- Move to different zone
- Update role tags
- Add/remove assignments

#### Removing Players

1. Click the player row
2. Click the **Remove** button
3. Confirm deletion

### Role Tags

Available tags for players:

| Tag | Symbol | Purpose |
|-----|--------|---------|
| Rally Leader | Crown | Commands rallies |
| Teleport 1st | Lightning | First wave teleport |
| Teleport 2nd | Double lightning | Second wave teleport |
| Hold Obelisks | Shield | Obelisk garrison |
| Garrison | Castle | Building defense |
| Conquer | Sword | Offensive capture |
| Farm | Wheat | Resource gathering |

### Zone Assignment

#### Changing Player Zones

1. Find the player in the roster
2. Click the zone dropdown
3. Select new zone (1, 2, 3, or 0 for substitute)
4. Player moves to new zone list

#### Zone Descriptions

Edit zone names and descriptions:

| Zone | Default Name | Default Description |
|------|--------------|---------------------|
| 1 | Zone 1 | Lower (Left Side) |
| 2 | Zone 2 | Center (Ark Control) |
| 3 | Zone 3 | Upper (Right Side) |

### Map Assignments

#### Assigning Buildings to Zones

On the Strategy Map:

1. Click a building marker
2. Select the zone color (Blue/Orange/Purple)
3. Set the attack order (1-4)
4. Building updates with zone color

#### Attack Order

The order number indicates priority within the phase:

```
Order 1: First target (rush/primary rally)
Order 2: Second target (follow-up)
Order 3: Third target (if resources allow)
Order 4: Fourth target (opportunistic)
```

#### Removing Assignments

1. Click an assigned building
2. Select "Unassign" or clear the zone
3. Building returns to neutral state

### Phase Assignments

Each player can have specific instructions for each phase:

```typescript
Phase 1: Rush phase instructions
Phase 2: Secure phase instructions
Phase 3: Ark/Fortify phase instructions
Phase 4: Hold/Push phase instructions
```

#### Editing Phase Text

1. Click a player in the roster
2. Edit the phase assignment fields
3. Use clear, actionable instructions

**Good Examples:**
- "Rush Obelisk (Left) with cavalry"
- "TP with 1st wave → Garrison Iset-1"
- "Rally Ark → STAY IN BUILDING"
- "Defend our half, rally only on leader call"

### Saving Changes

#### Auto-Save

Changes are saved automatically when you:
- Switch tabs
- Close the editor
- Navigate away

#### Manual Save

Click **Save** to immediately persist changes.

### Data Persistence

Strategy data is stored in Supabase:
- Synced across all alliance members
- Survives browser refreshes
- Backed up automatically

## Best Practices

### Roster Organization

1. **Keep it updated** - Remove inactive players
2. **Balance zones** - Similar player counts per zone
3. **Multiple rally leaders** - Backup in each zone
4. **Clear substitutes** - Ready players for no-shows

### Phase Instructions

1. **Be specific** - Name exact buildings
2. **Be concise** - Players scan quickly during battle
3. **Include contingencies** - "If X, then Y"
4. **Use consistent language** - Same terms across players

### Map Assignments

1. **Prioritize obelisks** - Order 1 for rushes
2. **Chain assignments** - Order matches capture sequence
3. **Balance workload** - Don't overload one zone
4. **Leave flexibility** - Not everything needs assignment

## Troubleshooting

### Changes Not Saving

- Check internet connection
- Try manual save button
- Refresh and re-enter editor mode

### Can't Access Editor

- Verify password is correct
- Check with alliance leadership
- Clear browser cache

### Missing Players

- Check substitute list
- Verify they weren't accidentally deleted
- Re-add from scratch if needed

## Password Management

The editor password should be:
- Shared only with leadership
- Changed periodically
- Not posted in public channels

Contact your alliance R4/R5 for password issues.
