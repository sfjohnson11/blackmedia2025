"use client"

import { useState, useEffect } from "react"
import { checkRLSStatus, listBuckets } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Database, RefreshCw, Shield, CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function RLSCheckerPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [buckets, setBuckets] = useState<any[]>([])
  const [rlsStatus, setRlsStatus] = useState<
    Record<
      string,
      {
        enabled: boolean
        hasPublicPolicy: boolean
        canAccess: boolean
      }
    >
  >({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkBuckets()
  }, [])

  const checkBuckets = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Get all buckets
      const bucketsData = await listBuckets()
      setBuckets(bucketsData || [])

      // Check RLS status for each bucket
      const statusResults: Record<string, any> = {}

      for (const bucket of bucketsData) {
        try {
          const status = await checkRLSStatus(bucket.name)
          statusResults[bucket.name] = status
        } catch (e) {
          console.error(`Error checking RLS for bucket ${bucket.name}:`, e)
          statusResults[bucket.name] = {
            enabled: true,
            hasPublicPolicy: false,
            canAccess: false,
            error: e instanceof Error ? e.message : "Unknown error",
          }
        }
      }

      setRlsStatus(statusResults)
    } catch (e) {
      console.error("Error checking buckets:", e)
      setError(e instanceof Error ? e.message : "An unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="pt-24 px-4 md:px-10 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="bg-gray-800 p-6 rounded-lg max-w-4xl w-full">
        <div className="flex items-center mb-6">
          <Link href="/debug" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Debug
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">RLS Status Checker</h1>
        </div>

        <div className="mb-6">
          <p className="mb-4">
            This tool checks the Row Level Security (RLS) status of your Supabase storage buckets. RLS can prevent
            videos from playing if not configured correctly.
          </p>

          <div className="flex justify-end mb-4">
            <Button onClick={checkBuckets} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Check RLS Status
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="bg-red-900/30 text-red-400 p-4 rounded-md mb-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            </div>
          )}

          {buckets.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-gray-900 p-4 rounded-md">
                <h3 className="font-semibold mb-4 flex items-center">
                  <Database className="h-5 w-5 mr-2 text-blue-500" />
                  Storage Buckets
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 px-3">Bucket Name</th>
                        <th className="text-left py-2 px-3">RLS Enabled</th>
                        <th className="text-left py-2 px-3">Public Access</th>
                        <th className="text-left py-2 px-3">Can Access Files</th>
                        <th className="text-left py-2 px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buckets.map((bucket) => {
                        const status = rlsStatus[bucket.name] || {
                          enabled: true,
                          hasPublicPolicy: false,
                          canAccess: false,
                        }

                        return (
                          <tr key={bucket.name} className="border-b border-gray-800">
                            <td className="py-2 px-3">{bucket.name}</td>
                            <td className="py-2 px-3">
                              {status.enabled ? (
                                <span className="flex items-center text-yellow-400">
                                  <Shield className="h-4 w-4 mr-1" />
                                  Enabled
                                </span>
                              ) : (
                                <span className="flex items-center text-green-400">
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Disabled
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {status.hasPublicPolicy ? (
                                <span className="flex items-center text-green-400">
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Yes
                                </span>
                              ) : (
                                <span className="flex items-center text-red-400">
                                  <XCircle className="h-4 w-4 mr-1" />
                                  No
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {status.canAccess ? (
                                <span className="flex items-center text-green-400">
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Yes
                                </span>
                              ) : (
                                <span className="flex items-center text-red-400">
                                  <XCircle className="h-4 w-4 mr-1" />
                                  No
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  window.open(
                                    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/buckets/${bucket.id}`,
                                    "_blank",
                                  )
                                }
                              >
                                View in Supabase
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-gray-900 p-4 rounded-md">
                <h3 className="font-semibold mb-4">How to Fix RLS Issues</h3>

                <div className="space-y-4">
                  <div className="bg-gray-800 p-3 rounded-md">
                    <h4 className="font-medium mb-2">Option 1: Disable RLS (Easiest)</h4>
                    <p className="text-sm text-gray-300 mb-2">
                      If you don't need security for your videos, the simplest solution is to disable RLS for your
                      storage buckets.
                    </p>
                    <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1">
                      <li>Go to Supabase Dashboard → Storage → [Your Bucket]</li>
                      <li>Click on "Policies" tab</li>
                      <li>Toggle off "Enable Row Level Security"</li>
                    </ol>
                  </div>

                  <div className="bg-gray-800 p-3 rounded-md">
                    <h4 className="font-medium mb-2">Option 2: Add Public Access Policy</h4>
                    <p className="text-sm text-gray-300 mb-2">
                      If you want to keep RLS enabled but allow public access to videos:
                    </p>
                    <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1">
                      <li>Go to Supabase Dashboard → Storage → [Your Bucket]</li>
                      <li>Click on "Policies" tab</li>
                      <li>Click "Add Policy"</li>
                      <li>Select "GET" operation (for reading files)</li>
                      <li>
                        Use policy: <code className="bg-gray-700 px-1 rounded">true</code> to allow anyone to read files
                      </li>
                      <li>Click "Save Policy"</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              {isLoading ? (
                <p>Loading buckets...</p>
              ) : (
                <p>No storage buckets found. Create buckets in your Supabase dashboard.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
