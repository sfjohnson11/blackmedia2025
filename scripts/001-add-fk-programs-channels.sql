-- Ensure the 'programs' table exists and has a 'channel_id' column
-- Ensure the 'channels' table exists and has an 'id' column (primary key)

-- Add the foreign key constraint to the 'programs' table
ALTER TABLE public.programs
ADD CONSTRAINT fk_programs_channel_id
FOREIGN KEY (channel_id)
REFERENCES public.channels(id)
ON UPDATE CASCADE -- Optional: What to do if a channel's ID changes
ON DELETE SET NULL; -- Optional: Set channel_id to NULL if a channel is deleted.
                    -- Other options: ON DELETE CASCADE (delete programs if channel is deleted)
                    -- or ON DELETE RESTRICT (prevent deleting channel if programs reference it)

-- After running this SQL, Supabase should recognize the relationship.
-- You may also want to regenerate your Supabase TypeScript types for your project
-- using the Supabase CLI: `supabase gen types typescript --project-id your-project-ref --schema public > types/supabase.ts`
-- This will update the `Relationships` array in your `types/supabase.ts` file.
