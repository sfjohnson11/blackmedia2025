import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DatabaseIcon, Upload, Code, Calendar } from "lucide-react"

export default function SetupPage() {
  return (
    <div className="pt-24 px-4 md:px-10 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
        <h1 className="text-3xl font-bold mb-6 text-center">Black Truth TV Setup</h1>

        <div className="grid gap-6 md:grid-cols-2">
          <Link href="/setup/sql-setup" className="block">
            <div className="bg-gray-900 p-6 rounded-lg h-full hover:bg-gray-800 transition-colors border border-gray-700 hover:border-gray-600">
              <div className="flex items-center mb-4">
                <Code className="h-8 w-8 text-blue-500 mr-3" />
                <h2 className="text-xl font-semibold">SQL Setup</h2>
              </div>
              <p className="text-gray-400 mb-4">Create the SQL function needed for automatic table creation.</p>
              <Button variant="outline" className="w-full">
                Setup SQL Function
              </Button>
            </div>
          </Link>

          <Link href="/setup/mock-data" className="block">
            <div className="bg-gray-900 p-6 rounded-lg h-full hover:bg-gray-800 transition-colors border border-gray-700 hover:border-gray-600">
              <div className="flex items-center mb-4">
                <DatabaseIcon className="h-8 w-8 text-green-500 mr-3" />
                <h2 className="text-xl font-semibold">Sample Data</h2>
              </div>
              <p className="text-gray-400 mb-4">Add sample channels and videos to quickly test your setup.</p>
              <Button variant="outline" className="w-full">
                Add Sample Data
              </Button>
            </div>
          </Link>

          <Link href="/setup/import" className="block">
            <div className="bg-gray-900 p-6 rounded-lg h-full hover:bg-gray-800 transition-colors border border-gray-700 hover:border-gray-600">
              <div className="flex items-center mb-4">
                <Upload className="h-8 w-8 text-purple-500 mr-3" />
                <h2 className="text-xl font-semibold">Import Channels</h2>
              </div>
              <p className="text-gray-400 mb-4">Import your Black Truth TV channels from the CSV file.</p>
              <Button variant="outline" className="w-full">
                Import Channels
              </Button>
            </div>
          </Link>

          <Link href="/setup/import-programs" className="block">
            <div className="bg-gray-900 p-6 rounded-lg h-full hover:bg-gray-800 transition-colors border border-gray-700 hover:border-gray-600">
              <div className="flex items-center mb-4">
                <Calendar className="h-8 w-8 text-red-500 mr-3" />
                <h2 className="text-xl font-semibold">Import Programs</h2>
              </div>
              <p className="text-gray-400 mb-4">Import your program schedule from the CSV file.</p>
              <Button variant="outline" className="w-full">
                Import Program Schedule
              </Button>
            </div>
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Setup Instructions</h3>
          <ol className="list-decimal pl-5 space-y-2 text-gray-300">
            <li>
              Start with <strong>SQL Setup</strong> to create the necessary SQL function.
            </li>
            <li>Create database tables from the home page.</li>
            <li>
              Import your channels using <strong>Import Channels</strong>.
            </li>
            <li>
              Import your program schedule using <strong>Import Programs</strong>.
            </li>
            <li>
              Alternatively, use <strong>Sample Data</strong> for quick testing.
            </li>
          </ol>

          <div className="flex justify-center mt-6">
            <Link href="/">
              <Button className="bg-red-600 hover:bg-red-700">Return to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
