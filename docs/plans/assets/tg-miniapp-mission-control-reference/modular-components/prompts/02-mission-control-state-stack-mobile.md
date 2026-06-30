# Prompt: Mission Control State Stack Mobile

Create a portrait mobile-native UI reference, 1024x1536, for Cambium TG mini app Mission Control.

Use the attached references as strict style anchors:
- Current Mission Control mobile reference for layout and hierarchy.
- Cambium design system sheet for glyphs, state rings, chips, buttons, and progress states.
- Cambium atlas for subtle contour fields, rail paths, and packet dots.

Screen concept:
- Header: "Mission Control"
- Subtitle: "cambium · branch arcs"
- Freshness chip: "fresh 2m"
- Nav: Mission selected, Gate, Tools, Story, Inspect.
- Branch chip rail with four branches:
  - Fitcheck selected active
  - Vantyx stale
  - Snow Gloves blocked
  - IVerif locked
- Main mission card:
  - Eyebrow: "Next Mission"
  - Title: "Launch proof packet"
  - Owner: Build
  - Gate: Founder review
  - Dispatch: Plexus
  - Promotion: Supervised branch
- Questline timeline:
  - Seed complete
  - Packet active
  - Proof blocked
  - Launch locked
- State stack below:
  - "Selected" row with chartreuse orbit halo
  - "Blocked" row with peach warning token
  - "Proof needed" row with dotted receipt ring
  - "Locked" row with muted lock token
- Bottom actions:
  - Review Gate
  - Open Proof

Visual rules:
- Must feel like a native Telegram mini app: safe-area spacing, thumb-friendly buttons, dense but readable cards.
- Preserve deep teal, chartreuse, soft mint, peach warning accent.
- Use circles and highlighted states from the Cambium design system.
- Use very subtle animated-state cues as still frames: selected orbit, active packet dots, blocked warning marker.
- Keep text sparse and product-facing.

Do not show:
- scene provenance, ecosystem target, R3F, operator map, tapestry audit, contract, schema, envelope, quest-ledger, paperclipCommandsData, no local operator writes.
- Fake URLs, tokens, auth data, or extra logos.

Output should be a concrete state-stack reference so implementation can map every visual state to a component.
