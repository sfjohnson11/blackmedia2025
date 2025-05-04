import { supabase } from "@/lib/supabase"
import { VideoPlayer } from "@/components/video-player"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Freedom School Channel - Black Truth TV",
  description: "Educational content about the history and tradition of Freedom Schools in African American history",
}

export default async function FreedomSchoolChannelPage() {
  // Get the Freedom School channel
  const { data: channel, error: channelError } = await supabase
    .from("channels")
    .select("*")
    .eq("id", "freedom-school")
    .single()

  if (channelError || !channel) {
    console.error("Error fetching Freedom School channel:", channelError)
    redirect("/freedom-school") // Redirect to the sign-up page if channel not found
  }

  // Get current program
  const now = new Date().toISOString()
  const { data: currentProgram, error: programError } = await supabase
    .from("programs")
    .select("*")
    .eq("channel_id", "freedom-school")
    .lte("start_time", now)
    .order("start_time", { ascending: false })
    .limit(1)
    .single()

  if (programError && programError.code !== "PGRST116") {
    console.error("Error fetching current program:", programError)
  }

  // Get upcoming programs
  const { data: upcomingPrograms = [], error: upcomingError } = await supabase
    .from("programs")
    .select("*")
    .eq("channel_id", "freedom-school")
    .gt("start_time", now)
    .order("start_time", { ascending: true })
    .limit(5)

  if (upcomingError) {
    console.error("Error fetching upcoming programs:", upcomingError)
  }

  return (
    <div className="min-h-screen bg-black pt-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Freedom School Channel</h1>

        <div className="mb-8">
          <VideoPlayer
            channel={channel}
            initialProgram={currentProgram || null}
            upcomingPrograms={upcomingPrograms || []}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <div className="bg-gray-900 rounded-xl p-6">
              <h2 className="text-2xl font-bold mb-4">About Freedom Schools</h2>
              <p className="text-gray-300 mb-4">
                Freedom Schools were established during the Civil Rights Movement as alternative free schools for
                African Americans. They were part of a nationwide effort to counter the inadequate education available
                to Black Americans, particularly in the South.
              </p>
              <p className="text-gray-300 mb-4">
                The curriculum was designed to encourage political and social awareness, emphasizing voter registration,
                political organization, and the history of the civil rights movement. Freedom Schools provided a space
                where students could openly discuss current events and the social conditions they faced.
              </p>
              <p className="text-gray-300">
                Today, the tradition continues through programs that focus on social justice, cultural heritage, and
                community empowerment. Our Freedom School Channel celebrates this legacy by providing educational
                content that inspires and informs.
              </p>
            </div>
          </div>

          <div className="md:col-span-1">
            <div className="bg-gray-900 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">Join Our Freedom School</h2>
              <p className="text-gray-300 mb-4">Sign up for our Freedom School program to access:</p>
              <ul className="list-disc list-inside text-gray-300 mb-6 space-y-2">
                <li>Live interactive classes</li>
                <li>Exclusive educational content</li>
                <li>Community discussions</li>
                <li>Reading materials and resources</li>
                <li>Certificate of completion</li>
              </ul>
              <a
                href="/freedom-school"
                className="block w-full bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded text-center font-medium"
              >
                Sign Up Now
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
