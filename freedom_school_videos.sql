-- Create the freedom_school_videos table
CREATE TABLE IF NOT EXISTS freedom_school_videos (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  instructor TEXT,
  duration INTEGER, -- in seconds
  featured BOOLEAN DEFAULT false,
  category TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add some sample videos
INSERT INTO freedom_school_videos (
  title, 
  description, 
  video_url, 
  thumbnail_url, 
  instructor, 
  duration, 
  featured, 
  category
) VALUES 
(
  'Introduction to Freedom School',
  'Learn about the purpose and mission of our Freedom School program.',
  'https://bttv-videos.s3.amazonaws.com/freedom-school/intro.mp4',
  'https://images.unsplash.com/photo-1577896851231-70ef18881754',
  'Dr. James Wilson',
  1200, -- 20 minutes
  true,
  'Introduction'
),
(
  'History of Civil Rights',
  'A comprehensive overview of the civil rights movement and its impact on society.',
  'https://bttv-videos.s3.amazonaws.com/freedom-school/civil-rights.mp4',
  'https://images.unsplash.com/photo-1529243856184-fd5465488984',
  'Prof. Angela Davis',
  2700, -- 45 minutes
  false,
  'History'
),
(
  'Economic Empowerment',
  'Strategies for building wealth and economic independence in our communities.',
  'https://bttv-videos.s3.amazonaws.com/freedom-school/economics.mp4',
  'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e',
  'Dr. Michael Johnson',
  1800, -- 30 minutes
  false,
  'Economics'
);

-- Add an index for faster searches
CREATE INDEX IF NOT EXISTS idx_freedom_school_videos_featured ON freedom_school_videos(featured);
CREATE INDEX IF NOT EXISTS idx_freedom_school_videos_category ON freedom_school_videos(category);
