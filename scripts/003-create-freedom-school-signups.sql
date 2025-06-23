-- This SQL script creates the freedom_school_signups table

-- Create the function to set up the freedom_school_signups table
CREATE OR REPLACE FUNCTION create_freedom_school_signups_table()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create the table if it doesn't exist
  CREATE TABLE IF NOT EXISTS freedom_school_signups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE, -- Ensures email addresses are unique
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Create an index on email for faster lookups
  CREATE INDEX IF NOT EXISTS idx_freedom_school_signups_email ON freedom_school_signups(email);
END;
$$;

-- (Optional) You might want to call this function once manually or via a setup page
-- SELECT create_freedom_school_signups_table();
