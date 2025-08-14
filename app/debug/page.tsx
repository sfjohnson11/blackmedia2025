// app/debug/page.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Database, Video, Shield, RefreshCw } from "lucide-react";

export default function DebugPage() {
  return (
    <div className="pt-24 px-4 md:px-10 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="bg-gray-800 p-6 rounded-lg max-w-4xl w-full">
        <div className="flex items-center mb-6">
          <Link href="/" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Debug Tools</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/debug/video-test" className="block">
            <div className="bg-gray-700 hover:bg-gray-600 transition-colors p-4 rounded-lg h-full">
              <div className="flex items-center mb-3">
                <Video className="h-5 w-5 mr-2 text-blue-400" />
                <h2 className="text-lg font-semibold">Video URL Tester</h2>
              </div>
              <p className="text-sm text-gray-300">
                Test video URLs to check if they're accessible and playable in the browser.
              </p>
            </div>
          </Link>

          <Link href="/debug/rls-checker" className="block">
            <div className="bg-gray-700 hover:bg-gray-600 transition-colors p-4 rounded-lg h-full">
              <div className="flex items-center mb-3">
                <Shield className="h-5 w-5 mr-2 text-yellow-400" />
                <h2 className="text-lg font-semibold">RLS Status Checker</h2>
              </div>
              <p className="text-sm text-gray-300">
                Check Row Level Security status for your Supabase storage buckets.
              </p>
            </div>
          </Link>

          <Link href="/admin/database-inspector" className="block">
            <div className="bg-gray-700 hover:bg-gray-600 transition-colors p-4 rounded-lg h-full">
              <div className="flex items-center mb-3">
                <Database className="h-5 w-5 mr-2 text-green-400" />
                <h2 className="text-lg font-semibold">Database Inspector</h2>
              </div>
              <p className="text-sm text-gray-300">Inspect and manage your database tables, programs, and channels.</p>
            </div>
          </Link>

          <Link href="/admin/refresh-programs" className="block">
            <div className="bg-gray-700 hover:bg-gray-600 transition-colors p-4 rounded-lg h-full">
              <div className="flex items-center mb-3">
                <RefreshCw className="h-5 w-5 mr-2 text-purple-400" />
                <h2 className="text-lg font-semibold">Refresh Programs</h2>
              </div>
              <p className="text-sm text-gray-300">
                Refresh program data and clear caches to ensure up-to-date content.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
