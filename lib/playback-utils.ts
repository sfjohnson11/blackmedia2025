import type { Video } from "@/types"

// Calculate which video should be playing based on the current time
export function getCurrentVideo(videos: Video[], startTime: Date = new Date()): { video: Video; progress: number } {
  if (videos.length === 0) {
    throw new Error("No videos available")
  }

  // Calculate total duration of all videos in seconds
  const totalDuration = videos.reduce((sum, video) => sum + video.duration, 0)

  // Calculate seconds elapsed since startTime
  const now = new Date()
  const secondsElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000)

  // Calculate position in the loop
  const positionInLoop = secondsElapsed % totalDuration

  // Find which video should be playing
  let durationSoFar = 0
  for (const video of videos) {
    if (positionInLoop < durationSoFar + video.duration) {
      // This is the current video
      const progress = positionInLoop - durationSoFar
      return { video, progress }
    }
    durationSoFar += video.duration
  }

  // Fallback to first video
  return { video: videos[0], progress: 0 }
}
