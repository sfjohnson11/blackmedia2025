"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Play, Database } from "lucide-react"

export default function SqlQueryPage() {
  const [query, setQuery] = useState("SELECT * FROM programs LIMIT 100;")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const executeQuery = async () => {
    setIsLoading(true)
    setResult(null)
    setError(null)

    try {
      const { data, error: queryError } = await supabase.rpc("exec_sql", { sql: query })

      if (queryError) {
        throw new Error(queryError.message)
      }

      setResult(data)
    } catch (err) {
      console.error("Error executing SQL query:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  // Sample queries for quick access
  const sampleQueries = [
    {
      name: "View All Programs",
      query: "SELECT * FROM programs LIMIT 100;",
    },
    {
      name: "Count Programs by Channel",
      query: "SELECT channel_id, COUNT(*) FROM programs GROUP BY channel_id ORDER BY channel_id;",
    },
    {
      name: "Current Programs",
      query:
        "SELECT channel_id, title, start_time FROM programs WHERE start_time <= NOW() ORDER BY start_time DESC LIMIT 29;",
    },
    {
      name: "Delete All Programs",
      query: "DELETE FROM programs WHERE id > 0;",
    },
  ]

  return (
    <div className="pt-24 px-4 md:px-10 flex flex-col items-center justify-center min-h-[80vh]">
      <div className="bg-gray-800 p-6 rounded-lg max-w-4xl w-full">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">SQL Query Tool</h1>
        </div>

        <div className="mb-6">
          <p className="mb-4">
            Use this tool to execute SQL queries directly against your database. This is useful for advanced
            troubleshooting and data management.
          </p>

          <div className="bg-gray-900 p-4 rounded mb-6">
            <h3 className="font-semibold mb-4 flex items-center">
              <Database className="h-5 w-5 mr-2 text-blue-500" />
              Sample Queries
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
              {sampleQueries.map((sample, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="justify-start text-left bg-gray-800 hover:bg-gray-700 border-gray-700"
                  onClick={() => setQuery(sample.query)}
                >
                  {sample.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="sqlQuery" className="block text-sm font-medium mb-1">
              SQL Query:
            </label>
            <textarea
              id="sqlQuery"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md font-mono text-sm h-32"
              placeholder="Enter your SQL query here..."
            />
          </div>

          <Button
            onClick={executeQuery}
            disabled={isLoading || !query.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              "Executing..."
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Execute Query
              </>
            )}
          </Button>

          {error && (
            <div className="mt-4 p-4 bg-red-900/30 text-red-400 rounded-md">
              <p className="font-semibold">Error:</p>
              <p className="font-mono text-sm">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Query Result:</h3>
              <div className="bg-gray-900 p-4 rounded-md overflow-x-auto">
                {Array.isArray(result) ? (
                  result.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          {Object.keys(result[0]).map((key) => (
                            <th key={key} className="text-left py-2 px-2">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b border-gray-800">
                            {Object.values(row).map((value: any, valueIndex) => (
                              <td key={valueIndex} className="py-2 px-2">
                                {typeof value === "object" ? JSON.stringify(value) : String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-gray-400">Query executed successfully. No results returned.</p>
                  )
                ) : (
                  <pre className="text-gray-300 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
