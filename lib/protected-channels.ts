// lib/protected-channels.ts
export const PROTECTED_CHANNELS = new Set<number>([23, 24, 25, 26, 27, 28, 29]);

// For demo: hardcode passcodes here (change them!)
// In production, move these to env vars or a secure table.
export const PASSCODES: Record<number, string> = {
  23: "pass23",
  24: "pass24",
  25: "pass25",
  26: "pass26",
  27: "pass27",
  28: "pass28",
  29: "pass29",
};
