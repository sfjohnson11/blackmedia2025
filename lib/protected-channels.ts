// lib/protected-channels.ts
// Tier-based channel access system

// FREE channels — available to all visitors (no login required)
export const FREE_CHANNELS = new Set<number>([
  1,  // Resistance TV
  2,  // Black History Uncut
  3,  // Black PBS
  6,  // Culture & Revolution
  11, // Black StoryTime
  13, // Sankofa Kids
  16, // Nature & Discovery
  17, // The Black Music Vault
  21, // Black Truth LIVE
  22, // The Family Channel
])

// MEMBER channels — require $9.99/mo membership
// (everything not in FREE_CHANNELS)
export const MEMBER_ONLY_CHANNELS = new Set<number>([
  4,  // Voices of the Movement
  5,  // The People's Archive
  7,  // Teaching Truth TV
  8,  // 1619 & Beyond
  9,  // Freedom Fighters Network
  10, // Being Black in 50 States
  12, // HerStory & HisStory
  14, // Family History Night
  15, // Construction Queen TV
  18, // Politics Then & Now
  19, // Apprentice Academy
  20, // Trades of Our Ancestors
  23, // Electrical Mastery
  24, // Plumbing Mastery
  25, // HVAC Mastery
  26, // Concrete & Earthworks
  27, // Framing & Drywall Mastery
  28, // Roofing Mastery
  29, // Painting & Coatings
  30, // Freedom School Channel
  31, // Black Truth Music Experience
])

// CONSTRUCTIQ channels — free for Constructiq family accounts
// (construction education channels)
export const CONSTRUCTIQ_FREE_CHANNELS = new Set<number>([
  15, // Construction Queen TV
  19, // Apprentice Academy
  20, // Trades of Our Ancestors
  23, // Electrical Mastery
  24, // Plumbing Mastery
  25, // HVAC Mastery
  26, // Concrete & Earthworks
  27, // Framing & Drywall Mastery
  28, // Roofing Mastery
  29, // Painting & Coatings
])

// Keep for backward compatibility
export const PROTECTED_CHANNELS = MEMBER_ONLY_CHANNELS

// Helper functions
export function isFreeChannel(channelId: number): boolean {
  return FREE_CHANNELS.has(channelId)
}

export function isMemberChannel(channelId: number): boolean {
  return MEMBER_ONLY_CHANNELS.has(channelId)
}

export function isConstructiqFreeChannel(channelId: number): boolean {
  return CONSTRUCTIQ_FREE_CHANNELS.has(channelId)
}

export function canAccessChannel(
  channelId: number,
  tier: 'free' | 'member' | 'constructiq' | 'admin' | null
): boolean {
  // Admins get everything
  if (tier === 'admin') return true

  // Free channels — everyone gets them
  if (FREE_CHANNELS.has(channelId)) return true

  // Member channels — need active membership
  if (MEMBER_ONLY_CHANNELS.has(channelId)) {
    if (tier === 'member') return true

    // Constructiq users get construction channels free
    if (tier === 'constructiq' && CONSTRUCTIQ_FREE_CHANNELS.has(channelId)) return true

    return false
  }

  return false
}
