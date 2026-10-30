import { createSoundEngine } from '@zemskov-space/harmonia';

// Construct once for the app. Harmonia creates its AudioContext only after a
// user gesture, and remains muted until the user opts in through settings.
export const uiSoundEngine = createSoundEngine({
  enabled: false,
  material: 'felt',
  volume: 0.28,
});
