# Cross-Verification: Game Design Research for Cambium

## Confidence Tier Classification

### High Confidence (Confirmed by 2+ agents from independent sources)

| Finding | Source Agents | Evidence Quality |
|---------|--------------|-----------------|
| HP Magic Awakened uses card-based combat with 8-card decks | dim01 | GameRefinery deconstruction + Android Police guide |
| Hogwarts Legacy has 5 talent trees with 48 talents (36 selectable) | dim01, dim02 | Polygon + MP1st + Fandom Wiki |
| Witcher 3 uses mystery-framework quest design | dim02 | Multiple design analyses + developer quotes |
| Zelda BOTW/TOTK uses ability gating + lock-before-key | dim02 | GDC talks + design postmortems |
| God of War Ragnarok Skill Labors create mastery through usage | dim02 | Direct developer interviews + player studies |
| Cambium quest system is strictly linear (17 arcs) | dim03 | Direct code review of quests.ts |
| Cambium skill forge is flat (no tree) | dim03 | Direct code review of forge.ts |
| Cambium has R3F visual engine with 5 island nodes | dim03 | Direct code review of cambium-r3f/src/ |

### Medium Confidence (1 agent, authoritative source)

| Finding | Source Agent | Evidence Quality |
|---------|-------------|-----------------|
| Magic Awakened developer is NetEase (not Wind Meets Rain directly) | dim01 | Niko Partners + NetEase PR |
| Hogwarts Legacy relationship quests total 24 | dim01 | IGN Wiki |
| Ghost of Tsushima weather responds to playstyle | dim02 | Official developer interviews |
| RDR2 honor system affects 5+ game systems | dim02 | Rockstar design docs + player analysis |
| Cambium NPCs are stateless with no memory | dim03 | Direct code review of npc.ts |

### Conflict Zones

| Conflict | dim01 Finding | dim02 Finding | Resolution |
|----------|-------------|-------------|------------|
| "Wind Meets Rain" as developer | dim01 notes NetEase as primary developer | N/A | "Wind Meets Rain" appears to be a confusion or internal team name; NetEase is the official developer per Niko Partners and PR |
| Skill tree vs flat list benefit | dim01: Talent trees force meaningful choices | dim02: Horizon added free respec in update 1.14 | Both approaches valid — Cambium should start with flat + tiers, add tree later |
| Social-first vs single-player | dim01: Magic Awakened is social-first | dim02: Most AAA story games are single-player | Cambium's use case (founder tool) aligns more with single-player + NPC depth |
