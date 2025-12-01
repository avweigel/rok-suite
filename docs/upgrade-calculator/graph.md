# Graph Navigation

Guide to using the interactive dependency graph visualization.

## Graph Overview

The dependency graph displays:

- **City Hall** at the center (larger node)
- **Buildings** arranged in circular layers by dependency distance
- **Arrows** showing prerequisite relationships
- **Colors** indicating building categories

## Layout

### Hierarchical Structure

```
        Layer 3 (furthest from CH)
           ○  ○  ○  ○

      Layer 2
         ○  ○  ○  ○  ○

    Layer 1 (direct CH prerequisites)
       ○   ○   ○   ○

          City Hall
             ★
```

### Node Colors

| Color | Category | Examples |
|-------|----------|----------|
| Red | Military | Wall, Barracks, Hospital |
| Green | Economy | Farm, Trading Post |
| Blue | Development | Academy, Castle, Alliance Center |
| Gray | Other | Watchtower, Scout Camp |

### Connection Lines

- **Arrows** point from prerequisite → dependent building
- **Curved paths** for visual clarity
- **Animation** subtle flow direction

## Interactions

### Pan (Move View)

| Input | Action |
|-------|--------|
| Mouse drag | Click and drag to pan |
| Touch drag | One finger drag on mobile |

### Zoom

| Input | Action |
|-------|--------|
| Mouse wheel | Scroll to zoom in/out |
| Pinch | Two finger pinch on mobile |

**Zoom limits:** 0.3x (far) to 2.0x (close)

### Select Node

Click any building node to:
1. Highlight the node
2. Open the editor panel
3. See current vs required level
4. Adjust level with +/- buttons

### Visual Feedback

| State | Appearance |
|-------|------------|
| Default | Category color |
| Selected | Bright highlight |
| Requirement met | Green checkmark |
| Requirement not met | Shows levels needed |

## Editor Panel

When a node is selected:

```
┌─────────────────────────────────┐
│  [Building Name]                │
│                                 │
│  Current: 15    Required: 18    │
│                                 │
│    [ - ]    15    [ + ]         │
│                                 │
│  [ Set to Required ]            │
│                                 │
│  Status: Need 3 more levels     │
└─────────────────────────────────┘
```

### Controls

| Button | Action |
|--------|--------|
| **-** | Decrease level by 1 |
| **+** | Increase level by 1 |
| **Set to Required** | Jump to exact required level |

### Status Messages

| Status | Meaning |
|--------|---------|
| "Requirement met" | Current ≥ Required |
| "Need X more levels" | Current < Required |
| "Above requirement" | Current > Required |

## View Modes

### Graph View (Default)

Interactive SVG visualization:
- Best for understanding relationships
- Visual dependency paths
- Pan/zoom exploration

### List View (Alternative)

Expandable tree list:
- Better for mobile devices
- Faster level adjustments
- Compact display

**Toggle:** Click the view mode button in the toolbar

## Graph Navigation Tips

### Finding Buildings

1. **By Color:** Military red, Economy green, Development blue
2. **By Layer:** Direct CH prereqs in inner layer
3. **By Search:** Use list view and scroll

### Understanding Dependencies

1. Follow arrows **backward** to see what's needed
2. Follow arrows **forward** to see what it unlocks
3. Long chains = many prerequisites

### Efficient Editing

1. Start with outer layer buildings
2. Work inward toward City Hall
3. Use "Set to Required" for quick setup
4. Check totals after each change

## Troubleshooting

### Graph Not Loading

- Wait for SVG to render
- Try refreshing the page
- Check browser console for errors

### Can't Pan or Zoom

- Make sure you're dragging on the canvas, not a node
- Try different input method (mouse vs touch)
- Reset zoom with double-click

### Nodes Overlapping

- Zoom in for clearer view
- Switch to list view for editing
- Many buildings = denser graph

### Performance Issues

- Large dependency chains are compute-intensive
- Try list view if graph is slow
- Modern browser recommended

## Mobile Usage

### Touch Controls

| Gesture | Action |
|---------|--------|
| Tap | Select node |
| Drag | Pan view |
| Pinch | Zoom in/out |
| Double tap | Reset zoom |

### Recommended

- Use list view on small screens
- Rotate to landscape for graph
- Editor panel scrolls on mobile

## Accessibility

### Keyboard Navigation

Not yet supported - use list view for keyboard navigation.

### Screen Readers

List view provides better screen reader support with proper labels.

### Color Blindness

Building categories use distinct colors and shapes are planned for future updates.
