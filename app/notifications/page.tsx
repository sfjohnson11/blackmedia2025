import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Bell, Settings, Trash2 } from "lucide-react"

export default function NotificationsPage() {
  return (
    <div className="pt-24 px-4 md:px-10 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Link href="/" className="mr-4">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Notifications</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button variant="outline" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center">
              <Bell className="h-5 w-5 text-red-500 mr-3" />
              <div>
                <h3 className="font-medium">New Channel Added</h3>
                <p className="text-sm text-gray-400">Check out our newest channel: Truth Seekers</p>
              </div>
            </div>
            <span className="text-xs text-gray-500">2 hours ago</span>
          </div>

          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center">
              <Bell className="h-5 w-5 text-red-500 mr-3" />
              <div>
                <h3 className="font-medium">Donation Received</h3>
                <p className="text-sm text-gray-400">Thank you for your support!</p>
              </div>
            </div>
            <span className="text-xs text-gray-500">1 day ago</span>
          </div>

          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center">
              <Bell className="h-5 w-5 text-red-500 mr-3" />
              <div>
                <h3 className="font-medium">New Content Available</h3>
                <p className="text-sm text-gray-400">Fresh content has been added to Channel 5</p>
              </div>
            </div>
            <span className="text-xs text-gray-500">3 days ago</span>
          </div>

          <div className="p-6 text-center text-gray-400">
            <p>No more notifications</p>
          </div>
        </div>
      </div>
    </div>
  )
}
