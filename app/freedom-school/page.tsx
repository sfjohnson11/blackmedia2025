export default function FreedomSchoolPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Freedom School</h1>

        <div className="aspect-video bg-gray-900 mb-6 flex items-center justify-center">
          <p className="text-gray-400">Video player will be added here</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">History</h2>
            <p className="text-gray-300">
              Learn about our history and cultural heritage through our comprehensive courses.
            </p>
          </div>

          <div className="bg-gray-900 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Economics</h2>
            <p className="text-gray-300">Understand financial literacy and economic empowerment for our communities.</p>
          </div>

          <div className="bg-gray-900 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Health</h2>
            <p className="text-gray-300">Discover traditional and modern approaches to health and wellness.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
