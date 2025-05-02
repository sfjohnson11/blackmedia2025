"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CheckCircle, XCircle, ArrowLeft, Code } from "lucide-react"

export default function SqlSetupPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const createExecSqlFunction = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      // SQL to create the exec_sql function
      const createFunctionSql = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      `

      // Execute the SQL directly
      const { error } = await supabase.rpc("exec_sql", { sql: createFunctionSql })

      if (error) {
        // If the function doesn't exist yet, we need to create it differently
        if (error.message.includes("function exec_sql") && error.message.includes("does not exist")) {
          // Try to create it using raw SQL
          const { error: rawError } = await supabase.sql(createFunctionSql)

          if (rawError) {
            throw new Error(`Error creating exec_sql function: ${rawError.message}`)
          }

          setResult({
            success: true,
            message: "SQL execution function created successfully!",
          })
        } else {
          throw new Error(`Error creating exec_sql function: ${error.message}`)
        }
      } else {
        setResult({
          success: true,
          message: "SQL execution function created successfully!",
        })
      }
    } catch (error) {
      console.error("Setup error:", error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred",
      })
    } finally {
      setIsLoading(false)
    }
  }

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
          <h1 className="text-2xl font-bold">SQL Setup Helper</h1>
        </div>

        <div className="mb-6">
          <p className="mb-4">
            This page will help you create a special SQL function in your Supabase database that allows executing SQL
            statements directly from the application. This is needed for the automatic table creation feature.
          </p>

          <div className="bg-gray-900 p-4 rounded mb-6">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Code className="h-4 w-4" />
              SQL Function
            </h3>
            <div className="bg-black p-3 rounded overflow-x-auto">
              <pre className="text-sm text-gray-300">
                {`CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`}
              </pre>
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={createExecSqlFunction}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 w-full max-w-xs"
            >
              {isLoading ? "Creating Function..." : "Create SQL Function"}
            </Button>
          </div>

          {result && (
            <div
              className={`mt-6 p-4 rounded-md ${
                result.success ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
              }`}
            >
              <div className="flex items-center gap-2">
                {result.success ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                <p>{result.message}</p>
              </div>
              {result.success && (
                <div className="mt-4 text-center">
                  <Link href="/">
                    <Button className="bg-green-600 hover:bg-green-700">Return to Home</Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-gray-700 pt-6">
          <h2 className="text-lg font-semibold mb-3">Why is this needed?</h2>
          <p className="text-sm text-gray-300">
            The <code>exec_sql</code> function allows the application to create database tables and other structures
            directly from the UI. This makes setup much easier as you don't need to manually run SQL commands in the
            Supabase dashboard.
          </p>
        </div>
      </div>
    </div>
  )
}
