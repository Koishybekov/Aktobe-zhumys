-- Migration for existing Supabase projects
-- Safe to run multiple times (IF NOT EXISTS / DO blocks)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_since TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS viewed_job_ids TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscribed_until TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS district TEXT;

ALTER TABLE profiles ALTER COLUMN city SET DEFAULT 'Актобе';
ALTER TABLE jobs ALTER COLUMN city SET DEFAULT 'Актобе';

CREATE INDEX IF NOT EXISTS idx_jobs_district ON jobs(district);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- Realtime (ignore errors if already added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE job_applications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
