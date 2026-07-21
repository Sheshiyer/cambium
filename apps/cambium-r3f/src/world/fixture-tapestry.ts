import type { TapestrySnapshot } from './constellation-layout';

export const fixtureTapestry: TapestrySnapshot = {
  tenant: {
    id: 'demo-org',
    label: 'Demo Grove',
    vision: 'turn a clear founder promise into a living operating map',
    mission: 'ship useful, on-brand work with synthetic demo evidence only',
  },
  recursion: ['skill', 'cluster', 'organ', 'venture', 'company', 'portfolio'],
  field: { id: 'cambium-field', width: 15.8, depth: 10.6 },
  nodes: [
    { id: 'genesis', organ: 'genesis', title: 'Genesis', scale: 'organ', x: -4.8, z: -1.2, status: 'complete', inputs: ['idea'], outputs: ['brand_system', 'copy_system'] },
    { id: 'taste', organ: 'taste', title: 'Taste', scale: 'organ', x: -2.1, z: 1.2, status: 'active', inputs: ['brand_system'], outputs: ['taste_brief'] },
    { id: 'build', organ: 'hands', title: 'Build', scale: 'organ', x: 1.4, z: -0.8, status: 'pending', inputs: ['taste_brief'], outputs: ['artifact'] },
    { id: 'ops', organ: 'will', title: 'Ops', scale: 'organ', x: 3.6, z: 1.4, status: 'pending', inputs: ['artifact'], outputs: ['live_signal'] },
    { id: 'cortex', organ: 'cortex', title: 'Cortex', scale: 'organ', x: 0, z: 0, status: 'active', inputs: ['live_signal'], outputs: ['recall'] },
    { id: 'brand-dna', organ: 'genesis', title: 'Brand DNA', scale: 'cluster', x: -5.4, z: -1.8, status: 'complete' },
    { id: 'voice-slots', organ: 'genesis', title: 'Voice Slots', scale: 'skill', x: -4.2, z: -0.6, status: 'complete' },
    { id: 'reference-hunt', organ: 'taste', title: 'Reference Hunt', scale: 'cluster', x: -2.6, z: 1.9, status: 'active' },
    { id: 'reroll-orbit', organ: 'taste', title: 'Reroll Orbit', scale: 'skill', x: -1.6, z: 0.8, status: 'pending' },
    { id: 'gate-run', organ: 'hands', title: 'Gate Run', scale: 'cluster', x: 1.9, z: -1.4, status: 'pending' },
    { id: 'wake-loop', organ: 'will', title: 'Wake Loop', scale: 'cluster', x: 4.1, z: 1.9, status: 'active' },
    { id: 'recall-lane', organ: 'cortex', title: 'Recall Lane', scale: 'cluster', x: 0.5, z: 0.6, status: 'active' },
  ],
};
