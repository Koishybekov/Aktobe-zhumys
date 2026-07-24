-- Support user_id column (alias for job owner) + relaxed insert RLS

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

UPDATE public.jobs SET user_id = client_id WHERE user_id IS NULL AND client_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_jobs_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.client_id IS NOT NULL THEN
    NEW.user_id := NEW.client_id;
  ELSIF NEW.client_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.client_id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_sync_user_id ON public.jobs;
CREATE TRIGGER trg_jobs_sync_user_id
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.sync_jobs_user_id();

DROP POLICY IF EXISTS "Clients can create jobs" ON public.jobs;
CREATE POLICY "Authenticated users can create jobs" ON public.jobs
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      auth.uid() = client_id OR auth.uid() = user_id
    )
  );

DROP POLICY IF EXISTS "Clients can update own jobs" ON public.jobs;
CREATE POLICY "Owners can update own jobs" ON public.jobs
  FOR UPDATE
  USING (auth.uid() = client_id OR auth.uid() = user_id);
