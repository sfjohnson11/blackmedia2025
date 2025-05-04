"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react"

export default function CreateFreedomSchoolTable() {
  const [isCreating, setIsCreating] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createTable = async () => {
    setIsCreating(true)
    setError(null)

    try {
      // Check if table exists
      const { data: existingTables } = await supabase
        .from("pg_tables")
        .select("tablename")
        .eq("schemaname", "public")
        .eq("tablename", "freedom_school_signups")

      if (existingTables && existingTables.length > 0) {
        setIsSuccess(true)
        return
      }

      // Create the table using SQL
      const { error: createError } = await supabase.rpc("exec_sql", {
        sql_query: `
          CREATE TABLE IF NOT EXISTS freedom_school_signups (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            full_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            age TEXT,
            interests TEXT,
            newsletter BOOLEAN DEFAULT TRUE,
            preferred_course TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `,
      })

      if (createError) throw new Error(createError.message)

      setIsSuccess(true)
    } catch (err) {
      console.error("Error creating table:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Create Freedom School Sign-up Table</CardTitle>
          <CardDescription>
            This will create the necessary database table to store Freedom School sign-ups.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 flex items-center">
              <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
              <p className="text-green-100">
                Freedom School sign-up table has been successfully created or already exists.
              </p>
            </div>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
              <p className="text-red-100">{error}</p>
            </div>
          ) : (
            <p className="text-gray-400">
              Click the button below to create the database table for Freedom School sign-ups.
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={createTable} disabled={isCreating || isSuccess} className="w-full">
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Table...
              </>
            ) : isSuccess ? (
              "Table Created Successfully"
            ) : (
              "Create Table"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
