import SimpleTestPlayer from "@/components/simple-test-player"

export default function TestVideoPage() {
  const videoUrl = "https://msllqpnxwbugvkpnquwx.supabase.co/storage/v1/object/public/12/standby_blacktruthtv.mp4"

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <h1 className="text-white text-2xl mb-4">Video Test Page</h1>
      <SimpleTestPlayer videoUrl={videoUrl} shouldLoop={true} />
    </div>
  )
}
