import type { CambiumQaPolicy } from './types.ts';

export const cambiumQaPolicy: CambiumQaPolicy = {
  desktopViewports: [
    { id: 'macbook-air-13', label: 'MacBook Air 13', width: 1440, height: 900, role: 'primary-review' },
    { id: 'macbook-pro-14', label: 'MacBook Pro 14', width: 1512, height: 982, role: 'secondary-review' },
    { id: 'desktop-wide', label: 'Desktop wide', width: 1728, height: 1117, role: 'secondary-review' },
  ],
  visualFeedbackGate: {
    status: 'awaiting-user-flow-feedback',
    reviewer: 'user',
    browserVisualE2E: 'skipped-by-user-request',
    acceptanceMode: 'human-perceptual-flow-review',
    automatedProof: [
      'npm run r3f:test',
      'npm run r3f:build',
      'npm run validate',
      'npm run render-docs:check',
    ],
    explicitNonGoals: [
      'mobile viewport acceptance',
      'browser screenshot approval by automation',
      'Playwright visual e2e as the final flow judge',
    ],
  },
  electronReadiness: {
    targetShell: 'electron-macos-laptop',
    minWindow: { width: 1280, height: 800 },
    routeMode: 'hash-route-scene-states',
    inputs: ['keyboard', 'mouse', 'trackpad'],
    outOfScope: ['mobile layout', 'touch-first navigation', 'phone breakpoint QA'],
  },
};

export function isDesktopReviewViewport(width: number, height: number) {
  return width >= cambiumQaPolicy.electronReadiness.minWindow.width && height >= cambiumQaPolicy.electronReadiness.minWindow.height;
}
