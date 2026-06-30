# Prompt: Motion Storyboard Mobile

Create a portrait mobile-native animation storyboard reference, 1024x1536, for Cambium TG mini app Mission Control.

Use the attached references:
- Cambium design system sheet for state rows, orbit rings, progress circles, warning states, and component board style.
- Cambium atlas for rails, packet dots, contour-field background, orbit paths, and highlighted nodes.
- Existing Mission Control mobile reference for phone layout and typography.

Goal:
Show how the circle highlights, selected states, rails, packet dots, and Gate attention animations should behave as modular UI primitives. This is a still image arranged as animation strips.

Storyboard sections:
1. "Selected Branch"
   - Three frames: idle chip, selected halo begins, selected halo resting.
2. "Questline Progress"
   - Three frames: packet active, proof blocked, launch locked.
3. "Proof Orbit"
   - Three frames: dotted pending ring, partial active ring, completed ring.
4. "Packet Rail"
   - Three frames: static rail, packet dots moving, reduced-motion static dots.
5. "Gate Attention"
   - Three frames: quiet row, peach warning stroke, resting review state.

Visual rules:
- Use the same mobile-native deep teal shell and chartreuse/mint palette.
- Keep frames compact and readable, like an implementation storyboard.
- Use labels for motion names: orbitSweep, packetDrift, glyphBreathe, warningAttention, reducedMotion.
- Make animation implied through ghosted positions, arrows, and frame numbers, not through excessive blur.
- Keep visual density high but not cluttered.

Do not show:
- Raw architecture terms: scene provenance, ecosystem target, R3F, operator map, schema, envelope, quest-ledger.
- Marketing hero copy or generic dashboard charts.
- Flashing or aggressive warning visuals.

Output should make it obvious which CSS or canvas animation primitives will be implemented and how they map to states.
