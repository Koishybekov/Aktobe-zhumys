-- Phone + password auth (no Supabase email / SMTP)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_phone_auth ON public.profiles(phone);

-- Check if phone is already registered (callable before sign-up)
CREATE OR REPLACE FUNCTION public.phone_exists(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE phone = p_phone AND password_hash IS NOT NULL
  );
$$;

-- Verify phone + password hash; returns user id or NULL
CREATE OR REPLACE FUNCTION public.verify_phone_password(p_phone TEXT, p_password_hash TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles
  WHERE phone = p_phone AND password_hash = p_password_hash
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.phone_exists(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_phone_password(TEXT, TEXT) TO anon, authenticated;
