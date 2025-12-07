# Training Polls

Schedule Ark of Osiris training sessions with interactive availability polls.

## Overview

Training polls help coordinate practice sessions by collecting availability from all alliance members. The system supports multi-day schedules with multiple time slots per day.

## Creating a Poll

1. Navigate to the **AoO Strategy** page
2. Click **Create Training Poll**
3. Configure your poll:
   - **Title** - Name your training session (e.g., "Weekend AoO Practice")
   - **Description** - Optional details about the training
   - **Dates** - Select one or more days
   - **Time Slots** - Add available time windows

## Voting on Polls

### Drag-to-Select Interface

- Click and drag across time slots to mark your availability
- Green cells = Available
- Red cells = Unavailable
- Gray cells = No response

### Timezone Support

- All times displayed in your local timezone
- Toggle between **UTC** and **Local** time display
- Timezone is automatically detected from your browser

## Poll Management

### For Leaders/Coordinators

- **Open/Close Poll** - Control when members can submit responses
- **Delete Poll** - Remove a poll entirely
- **View Responses** - See individual member availability

### Response Summary

The poll displays:
- Total voters
- Best time slots (highest availability)
- Per-slot availability count

## Exporting Results

Click **Export as Image** to generate a shareable PNG of the poll results. This is useful for:
- Posting in Discord
- Sharing in alliance chat
- Archiving training schedules

## Best Practices

1. **Create polls early** - Give members time to respond (2-3 days minimum)
2. **Include multiple options** - Offer various time slots across different days
3. **Close polls before scheduling** - Finalize availability before announcing the training time
4. **Export and share** - Post the final schedule where everyone can see it

## Technical Details

- Polls are stored in Supabase with real-time updates
- Responses are tracked per-voter (one response per poll per person)
- Poll data persists until manually deleted
