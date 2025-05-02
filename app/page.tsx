import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DatabaseIcon } from "lucide-react"

export default function Home() {
  return (
    <div className="pt-24 px-4 md:px-10 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
        <div className="flex items-center justify-center mb-6">
          <DatabaseIcon className="h-12 w-12 text-blue-500" />
        </div>
        <h1 className="text-3xl font-bold mb-6 text-center">Welcome to Black Truth TV</h1>
        <div className="bg-gray-900 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Setup Required</h2>
          <p className="mb-4">Please set up your database tables to get started with Black Truth TV.</p>

          <div className="flex justify-center mt-6">
            <Link href="/setup">
              <Button className="bg-red-600 hover:bg-red-700">Go to Setup</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
