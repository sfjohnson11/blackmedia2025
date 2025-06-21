-- Ensure you have addressed any orphaned channel_id values in the 'programs' table first.
-- (See query in the previous diagnostic step)

DO $$
BEGIN
   IF NOT EXISTS (
       SELECT 1
       FROM   pg_constraint
       WHERE  conname = 'fk_programs_channel_id'  -- The name we want to give our constraint
       AND    conrelid = 'public.programs'::regclass -- The table the constraint is on
   ) THEN
       -- Add the foreign key constraint to the 'programs' table
       ALTER TABLE public.programs
       ADD CONSTRAINT fk_programs_channel_id
       FOREIGN KEY (channel_id)         -- Column in 'programs' table
       REFERENCES public.channels(id)   -- Referenced 'id' column in 'channels' table
       ON UPDATE CASCADE                -- Optional: If a channel's ID changes, update it in programs
       ON DELETE SET NULL;              -- Optional: If a channel is deleted, set channel_id in programs to NULL
                                        -- Consider ON DELETE CASCADE if programs should be deleted with their channel
                                        -- Or ON DELETE RESTRICT to prevent deleting a channel if programs reference it
       RAISE NOTICE 'Constraint fk_programs_channel_id created on public.programs.';
   ELSE
       RAISE NOTICE 'Constraint fk_programs_channel_id already exists on public.programs.';
   END IF;
END;
$$;
