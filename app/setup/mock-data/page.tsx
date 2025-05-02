"use client"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Info } from "lucide-react"

export default function MockDataPage() {
  return (
    <div className="pt-24 px-4 md:px-10 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full">
        <div className="flex items-center mb-6">
          <Link href="/setup" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Setup Information</h1>
        </div>

        <div className="mb-6">
          <div className="bg-blue-900/30 p-4 rounded-md mb-6 flex">
            <Info className="h-5 w-5 text-blue-400 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-400 mb-2">Mock Data Setup Disabled</h3>
              <p className="text-gray-300">
                The automatic mock data setup has been disabled to prevent database conflicts. Please use the import
                functionality instead to add your channels and programs.
              </p>
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-4">Setup Instructions</h2>
          <ol className="list-decimal pl-5 space-y-3 text-gray-300 mb-6">
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
          </ol>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <Link href="/setup/import" className="block">
              <Button className="w-full bg-red-600 hover:bg-red-700">Import Channels</Button>
            </Link>
            <Link href="/setup/import-programs" className="block">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">Import Programs</Button>
            </Link>
          </div>

          <div className="flex justify-center mt-6">
            <Link href="/">
              <Button variant="outline">Return to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
