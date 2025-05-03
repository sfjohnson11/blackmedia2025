import { createClient } from "@supabase/supabase-js"
import { spawn } from "child_process"
import fs from "fs"
import path from "path"
import os from "os"
import { v4 as uuidv4 } from "uuid"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export interface VideoProcessingResult {
  success: boolean
  message: string
  playlistUrl?: string
  thumbnailUrl?: string
  duration?: number
}

/**
 * Converts a video file to HLS format for streaming
 */
export async function convertVideoToHLS(
  channelId: string,
  fileUrl: string,
  fileName: string,
): Promise<VideoProcessingResult> {
  try {
    // Create a temporary directory for processing
    const tempDir = path.join(os.tmpdir(), uuidv4())
    fs.mkdirSync(tempDir, { recursive: true })

    // Download the file
    const videoPath = path.join(tempDir, fileName)
    const downloadResponse = await fetch(fileUrl)
    const buffer = await downloadResponse.arrayBuffer()
    fs.writeFileSync(videoPath, Buffer.from(buffer))

    // Output directory for HLS files
    const outputDir = path.join(tempDir, "hls")
    fs.mkdirSync(outputDir, { recursive: true })

    // Generate thumbnail
    const thumbnailPath = path.join(tempDir, "thumbnail.jpg")
    await generateThumbnail(videoPath, thumbnailPath)

    // Get video duration
    const duration = await getVideoDuration(videoPath)

    // Convert to HLS
    await convertToHLS(videoPath, outputDir)

    // Upload HLS files to Supabase
    const bucketName = `channel${channelId}-hls`

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.find((b) => b.name === bucketName)) {
      await supabase.storage.createBucket(bucketName, { public: true })
    }

    // Upload the playlist and all segment files
    const files = fs.readdirSync(outputDir)
    const uploadPromises = files.map(async (file) => {
      const filePath = path.join(outputDir, file)
      const fileContent = fs.readFileSync(filePath)

      // Use the original filename as a base for the upload path
      const baseFileName = path.parse(fileName).name
      const uploadPath = `${baseFileName}/${file}`

      return supabase.storage.from(bucketName).upload(uploadPath, fileContent, {
        contentType: file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp4",
        upsert: true,
      })
    })

    // Upload thumbnail
    const thumbnailContent = fs.readFileSync(thumbnailPath)
    const baseFileName = path.parse(fileName).name
    const thumbnailUploadPath = `${baseFileName}/thumbnail.jpg`
    const thumbnailUpload = supabase.storage.from(bucketName).upload(thumbnailUploadPath, thumbnailContent, {
      contentType: "image/jpeg",
      upsert: true,
    })

    // Wait for all uploads to complete
    await Promise.all([...uploadPromises, thumbnailUpload])

    // Get the playlist URL
    const { data: playlistData } = supabase.storage.from(bucketName).getPublicUrl(`${baseFileName}/playlist.m3u8`)

    const { data: thumbnailData } = supabase.storage.from(bucketName).getPublicUrl(`${baseFileName}/thumbnail.jpg`)

    // Clean up temporary files
    fs.rmSync(tempDir, { recursive: true, force: true })

    // Update the video entry in the database if needed
    await supabase
      .from("programs")
      .update({
        hls_url: playlistData.publicUrl,
        thumbnail_url: thumbnailData.publicUrl,
        duration: Math.ceil(duration),
      })
      .eq("channel_id", channelId)
      .eq("mp4_url", fileName)

    return {
      success: true,
      message: "Video converted and uploaded successfully",
      playlistUrl: playlistData.publicUrl,
      thumbnailUrl: thumbnailData.publicUrl,
      duration: Math.ceil(duration),
    }
  } catch (error) {
    console.error("Error converting video:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

/**
 * Generates a thumbnail from a video file
 */
async function generateThumbnail(videoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Take screenshot at 10% of the video
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      videoPath,
      "-ss",
      "00:00:10",
      "-frames:v",
      "1",
      "-vf",
      "scale=640:-1",
      outputPath,
    ])

    ffmpeg.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg exited with code ${code}`))
    })

    ffmpeg.stderr.on("data", (data) => {
      console.log(`ffmpeg: ${data}`)
    })
  })
}

/**
 * Gets the duration of a video in seconds
 */
async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ])

    let output = ""

    ffprobe.stdout.on("data", (data) => {
      output += data.toString()
    })

    ffprobe.on("close", (code) => {
      if (code === 0) {
        resolve(Number.parseFloat(output.trim()))
      } else {
        reject(new Error(`FFprobe exited with code ${code}`))
      }
    })

    ffprobe.stderr.on("data", (data) => {
      console.log(`ffprobe: ${data}`)
    })
  })
}

/**
 * Converts a video to HLS format
 */
async function convertToHLS(inputPath: string, outputDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      inputPath,
      "-profile:v",
      "baseline",
      "-level",
      "3.0",
      "-start_number",
      "0",
      "-hls_time",
      "10", // 10-second segments
      "-hls_list_size",
      "0", // Keep all segments in playlist
      "-f",
      "hls",
      `${outputDir}/playlist.m3u8`,
    ])

    ffmpeg.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg exited with code ${code}`))
    })

    ffmpeg.stderr.on("data", (data) => {
      console.log(`ffmpeg: ${data}`)
    })
  })
}
