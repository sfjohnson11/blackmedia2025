// Helper functions for channel access and password protection

// Check if a channel requires password protection
export function isPasswordProtected(channelId: string): boolean {
  // Channels 22-29 are password protected
  const id = Number.parseInt(channelId, 10)
  return id >= 22 && id <= 29
}

// Store channel access in localStorage
export function storeChannelAccess(channelId: string): void {
  try {
    const now = Date.now()
    const accessData = {
      channelId,
      hasAccess: true,
      timestamp: now,
    }

    // Store in localStorage
    localStorage.setItem(`channel_access_${channelId}`, JSON.stringify(accessData))
  } catch (error) {
    console.error("Error storing channel access:", error)
  }
}

// Check if user has access to a channel
export function hasChannelAccess(channelId: string): boolean {
  try {
    // If channel is not password protected, always grant access
    if (!isPasswordProtected(channelId)) {
      return true
    }

    // Check localStorage for access data
    const accessDataStr = localStorage.getItem(`channel_access_${channelId}`)
    if (!accessDataStr) {
      return false
    }

    const accessData = JSON.parse(accessDataStr)

    // Check if access is still valid (24 hour expiration)
    const now = Date.now()
    const accessTime = accessData.timestamp
    const accessExpiration = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

    return accessData.hasAccess && now - accessTime < accessExpiration
  } catch (error) {
    console.error("Error checking channel access:", error)
    return false
  }
}

// Verify channel password
export function verifyChannelPassword(channelId: string, password: string): boolean {
  // For this implementation, we'll use a simple password scheme
  // In a production environment, you would want to verify against a database
  // or use a more secure authentication method

  // Simple password scheme: "channel" + channelId
  const correctPassword = `channel${channelId}`

  return password === correctPassword
}

// Clear channel access
export function clearChannelAccess(channelId: string): void {
  try {
    localStorage.removeItem(`channel_access_${channelId}`)
  } catch (error) {
    console.error("Error clearing channel access:", error)
  }
}
