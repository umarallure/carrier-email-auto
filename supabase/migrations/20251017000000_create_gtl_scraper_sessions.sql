-- Create GTL scraper sessions table
-- This tracks the state of manual login + automated scraping sessions

CREATE TABLE IF NOT EXISTS gtl_scraper_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES scraper_jobs(id) ON DELETE CASCADE,
  
  -- Session status
  status TEXT NOT NULL DEFAULT 'initializing' CHECK (status IN (
    'initializing',
    'waiting_for_login',
    'ready',
    'scraping',
    'completed',
    'failed'
  )),
  
  -- Browser info
  browser_url TEXT,
  gologin_profile_id TEXT,
  
  -- Progress tracking
  current_page INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 19,
  scraped_count INTEGER DEFAULT 0,
  
  -- Error tracking
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on job_id for faster lookups
CREATE INDEX idx_gtl_sessions_job_id ON gtl_scraper_sessions(job_id);

-- Create index on status for filtering
CREATE INDEX idx_gtl_sessions_status ON gtl_scraper_sessions(status);

-- Enable RLS
ALTER TABLE gtl_scraper_sessions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all sessions
CREATE POLICY "Allow authenticated users to read sessions"
  ON gtl_scraper_sessions
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to create sessions
CREATE POLICY "Allow authenticated users to create sessions"
  ON gtl_scraper_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update sessions
CREATE POLICY "Allow authenticated users to update sessions"
  ON gtl_scraper_sessions
  FOR UPDATE
  TO authenticated
  USING (true);

-- Add created_by to scraper_jobs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scraper_jobs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE scraper_jobs ADD COLUMN created_by TEXT;
  END IF;
END $$;

COMMENT ON TABLE gtl_scraper_sessions IS 'Tracks manual login + automated scraping sessions for GTL portal';
COMMENT ON COLUMN gtl_scraper_sessions.status IS 'Current state of the scraping session';
COMMENT ON COLUMN gtl_scraper_sessions.browser_url IS 'URL of the browser page user should navigate to';
COMMENT ON COLUMN gtl_scraper_sessions.current_page IS 'Current pagination page being scraped (1-19)';
COMMENT ON COLUMN gtl_scraper_sessions.scraped_count IS 'Total number of policies scraped so far';
