-- This SQL file creates the freedom_school_videos table and related functions

-- Create the function to set up the freedom_school_videos table
CREATE OR REPLACE FUNCTION create_freedom_school_table()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create the table if it doesn't exist
  CREATE TABLE IF NOT EXISTS freedom_school_videos (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL, -- Should be relative path like 'freedom-school/video.mp4'
    thumbnail_url TEXT, -- Should be relative path like 'freedom-school/thumbnails/thumb.jpg'
    duration INTEGER, -- in seconds
    category TEXT,
    is_featured BOOLEAN DEFAULT false,
    published BOOLEAN DEFAULT FALSE, -- Added published column
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Create an index on category for faster filtering
  CREATE INDEX IF NOT EXISTS idx_freedom_school_videos_category ON freedom_school_videos(category);
  
  -- Create an index on is_featured for faster filtering
  CREATE INDEX IF NOT EXISTS idx_freedom_school_videos_featured ON freedom_school_videos(is_featured);

  -- Create an index on published for faster filtering
  CREATE INDEX IF NOT EXISTS idx_freedom_school_videos_published ON freedom_school_videos(published);
END;
$$;

-- Sample data insertion function
CREATE OR REPLACE FUNCTION insert_sample_freedom_school_videos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clear existing data
  DELETE FROM freedom_school_videos;
  
  -- Reset the sequence
  ALTER SEQUENCE freedom_school_videos_id_seq RESTART WITH 1;
  
  -- Insert a single placeholder video
  INSERT INTO freedom_school_videos (title, description, video_url, thumbnail_url, duration, category, is_featured, published, sort_order)
  VALUES 
    ('Placeholder Video', 'This is a placeholder. Please upload your own content.', 'freedom-school/placeholder.mp4', 'freedom-school/thumbnails/placeholder.jpg', 10, 'General', true, true, 1); -- Added published: true
END;
$$;
