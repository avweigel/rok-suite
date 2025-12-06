// Static alliance page data - will be replaced by database content

export interface AlliancePageData {
  slug: string;
  title: string;
  description: string;
  icon: string;
  content: string;
}

export const alliancePagesData: Record<string, AlliancePageData> = {
  guardians: {
    slug: 'guardians',
    title: 'Guardian Runs',
    description: 'Schedule, timers, and protocol for Holy Site guardian kills',
    icon: 'Clock',
    content: `## Guardian Schedule

Guardians spawn **twice daily** at fixed times. Our alliance coordinates kills at these times:

**Spawn Times (Server Time):**
- **Spawn 1:** 12:00 UTC
- **Spawn 2:** 00:00 UTC

---

## Protocol

### Before Guardian Spawn

1. **Be online 5 minutes early** - Get positioned near the guardian location
2. **Join voice chat** - Coordination is key
3. **Have marches ready** - Don't be training troops when spawn happens
4. **Check which guardians are targets** - R4/R5 will announce

### During the Kill

1. **Wait for the call** - Don't attack until leadership says go
2. **Hit simultaneously** - The goal is to overwhelm the guardian quickly
3. **Don't solo attack** - You'll just die and waste troops
4. **Follow rally if called** - Some guardians require rallies

### After the Kill

1. **Move to next target** - If there are multiple guardians
2. **Report any issues** - Let leadership know if something went wrong
3. **Don't loot solo** - Wait for fair distribution if applicable

---

## Guardian Types

### Zone 1 Altars (15K T2 Guardians)
- Easiest guardians
- Can often be soloed by strong players
- Good practice for new members

### Sanctums (Stronger Guardians)
- Require coordinated attacks
- Usually need 3-5 players hitting simultaneously
- Rally may be needed

### Shrines (Strongest)
- Always require rally
- Top commanders only
- Follow R5 commands exactly

---

## Tips for Success

- **Use peacekeeping commanders** - Bonus damage to guardians
- **Cavalry for mobility** - Get to targets quickly
- **Don't waste AP teleporting** - Walk if you have time
- **Heal troops immediately** - Don't let hospital overflow

---

## Who Leads Guardian Runs?

Guardian runs are led by R4 and R5 members. Current leaders:
- *(To be filled in by alliance leadership)*

---

## Questions?

Ask in alliance chat or Discord if you're unsure about anything. It's better to ask than to mess up a run!`,
  },

  territory: {
    slug: 'territory',
    title: 'Territory Policy',
    description: 'Rules for farmers in our territory and zone control',
    icon: 'Map',
    content: `## Our Territory

Our alliance controls the following zones:
- *(To be filled in by leadership)*

---

## Farmer Policy

### Out-of-Alliance Farmers in Our Territory

When you encounter farmers from other alliances in our territory:

#### Step 1: Check Alliance Relations
- **Allied alliances** - Let them farm, we have agreements
- **Neutral alliances** - Warn first, then act
- **Enemy/Unknown** - Follow protocol below

#### Step 2: Warning Protocol
1. Send a mail: *"You are farming in [Alliance Name] territory. Please relocate within 30 minutes."*
2. Wait 30 minutes
3. If they don't move, report to R4/R5

#### Step 3: Escalation
- R4/R5 will decide on action
- May result in attack on their gatherers
- Document everything (screenshots)

---

## Zone Control Rules

### Resource Nodes
- High-level nodes (6+) are first-come-first-served within alliance
- Don't kick alliance members off nodes
- Gem deposits have priority rules (ask leadership)

### Passes
- Strategic passes are alliance-controlled
- Don't abandon pass garrisons without approval
- Report enemy movement through passes immediately

### Holy Sites
- Altars, Sanctums, Shrines controlled per schedule
- Don't randomly attack holy site guardians
- Follow guardian run protocol

---

## What NOT to Do

- Don't attack without warning first
- Don't start diplomatic incidents without R4/R5 approval
- Don't grief allied alliances' farmers
- Don't ignore enemy scouts in our territory

---

## Reporting Issues

If you encounter problems:
1. Take screenshots
2. Note time, location, player name, alliance
3. Report to R4/R5 in Discord
4. Don't escalate without leadership approval`,
  },

  rallies: {
    slug: 'rallies',
    title: 'Rally Protocol',
    description: 'When and how to join rallies, troop requirements',
    icon: 'Swords',
    content: `## Rally Types

### Barbarian Fort Rallies
- **When:** Called in alliance chat
- **Who:** Anyone can join
- **Troops:** Send your best, but T4 minimum for high-level forts

### Holy Site Guardian Rallies
- **When:** During guardian runs
- **Who:** Called by R4/R5
- **Troops:** T4+ only, follow commander instructions

### PvP Rallies (KvK/War)
- **When:** During alliance wars
- **Who:** Designated rally fillers
- **Troops:** T5 only, specific troop types as called

---

## How to Join Rallies

1. **Watch alliance chat** - Rally announcements appear here
2. **Click the rally** - Don't just send random troops
3. **Select correct troops** - Match what's being requested
4. **Send immediately** - Rallies have limited time

### Troop Type Requests
- **"Infantry rally"** - Send infantry only
- **"Cav rally"** - Send cavalry only
- **"Archer rally"** - Send archers only
- **"Mixed"** - Send your best composition

---

## Rally Filler Expectations

If you're designated as a rally filler:
- Be online during war times
- Have troops ready (not training, not gathering)
- Join Discord voice for coordination
- Fill rallies within 30 seconds of call

---

## Rally Leaders

Current designated rally leaders:
- *(To be filled in by leadership)*

### If You Want to Lead Rallies
1. Talk to R5 about interest
2. Must have appropriate commanders
3. Must be active during key times
4. Training may be required

---

## Common Mistakes to Avoid

- Sending T1/T2/T3 troops to high-level rallies
- Sending wrong troop type
- Being AFK when rallies are called
- Starting unauthorized rallies
- Joining enemy rallies (yes, this happens)`,
  },

  rules: {
    slug: 'rules',
    title: 'Alliance Rules',
    description: 'General policies, activity requirements, and expectations',
    icon: 'ScrollText',
    content: `## Membership Requirements

### Activity
- **Minimum:** Log in daily
- **Expected:** Participate in alliance events
- **Ideal:** Active in chat, helps others

### Power Requirements
- **Minimum power:** *(Set by leadership)*
- **Growth expected:** Show consistent improvement
- **Exceptions:** Talk to R4/R5 if you have circumstances

---

## Rank Structure

### R5 - Leader
- Final decision maker
- Sets alliance direction
- Handles diplomacy

### R4 - Officers
- Day-to-day management
- Lead events and rallies
- Can accept/kick members

### R3 - Elites
- Trusted members
- May have specific responsibilities
- Path to R4

### R2 - Members
- Full alliance members
- Expected to participate

### R1 - New
- Probationary period
- Limited permissions
- Prove yourself to rank up

---

## Code of Conduct

### DO:
- Help alliance members
- Participate in events
- Communicate absences
- Report issues to leadership
- Be respectful in chat

### DON'T:
- Attack allied alliances
- Start drama
- Be inactive without notice
- Ignore rally calls during war
- Share alliance strategies externally

---

## Event Participation

### Required Events:
- Ark of Osiris (if selected)
- KvK battles (when active)
- Alliance rallies

### Expected Events:
- Guardian runs
- Alliance helps
- MGE (at least hit thresholds)

### Optional:
- Sunset Canyon
- Solo events

---

## Consequences

### Warnings:
- First offense: Verbal warning
- Second offense: Written warning
- Third offense: Demotion or kick

### Immediate Kick:
- Attacking allies
- Sharing intel with enemies
- Extended inactivity without notice (14+ days)
- Toxic behavior

---

## Leave of Absence

If you need to be away:
1. Tell R4/R5 in advance
2. State expected return date
3. You won't be kicked during approved absence
4. Extended absence may result in temporary kick (can rejoin)

---

## Questions or Concerns

- Talk to any R4 or R5
- Use Discord for private matters
- Alliance chat for general questions

We want everyone to succeed and have fun. Rules exist to keep things fair and organized, not to be punitive.`,
  },
};

export function getAlliancePageData(slug: string): AlliancePageData | null {
  return alliancePagesData[slug] || null;
}
