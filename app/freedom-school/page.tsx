import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { FreedomSchoolPlayer } from "@/components/freedom-school-player"

export const revalidate = 3600 // Revalidate every hour

async function getFeaturedVideo() {
  const { data, error } = await supabase
    .from("freedom_school_videos")
    .select("*")
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error("Error fetching featured video:", error)
    return null
  }

  return data
}

async function getRecentVideos() {
  const { data, error } = await supabase
    .from("freedom_school_videos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(6)

  if (error) {
    console.error("Error fetching recent videos:", error)
    return []
  }

  return data || []
}

export default async function FreedomSchoolPage() {
  const featuredVideo = await getFeaturedVideo()
  const recentVideos = await getRecentVideos()

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Freedom School</h1>

        {/* Featured Video */}
        {featuredVideo ? (
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-4">Featured Video</h2>
            <div className="bg-black rounded-lg overflow-hidden">
              <FreedomSchoolPlayer
                videoId={featuredVideo.id}
                videoUrl={featuredVideo.video_url}
                title={featuredVideo.title}
              />
              <div className="p-4">
                <h3 className="text-xl font-bold text-white">{featuredVideo.title}</h3>
                {featuredVideo.description && (
                  <p className="text-gray-300 mt-2">{featuredVideo.description.substring(0, 150)}...</p>
                )}
                <Link
                  href={`/watch/freedom-school?id=${featuredVideo.id}`}
                  className="inline-block mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                >
                  Watch Full Video
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-12 p-8 bg-gray-800 rounded-lg text-center">
            <h2 className="text-xl font-semibold text-white mb-4">Welcome to Freedom School</h2>
            <p className="text-gray-300 mb-4">
              Explore our educational videos and expand your knowledge with our curated content.
            </p>
          </div>
        )}

        {/* Recent Videos */}
        <h2 className="text-xl font-semibold text-white mb-4">Recent Videos</h2>
        {recentVideos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentVideos.map((video) => (
              <Link key={video.id} href={`/watch/freedom-school?id=${video.id}`} className="block">
                <div className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors">
                  <div className="aspect-video bg-black relative">
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url || "/placeholder.svg"}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-800">
                        <span className="text-gray-500">No thumbnail</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <div className="bg-red-600 rounded-full p-3">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-8 w-8 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-white">{video.title}</h3>
                    {video.instructor && <p className="text-gray-400 text-sm mt-1">By {video.instructor}</p>}
                    {video.duration && (
                      <p className="text-gray-400 text-sm mt-1">{Math.floor(video.duration / 60)} minutes</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 bg-gray-800 rounded-lg text-center">
            <p className="text-gray-300">No videos available at the moment. Please check back later.</p>
          </div>
        )}
      </div>
    </div>
  )
}
