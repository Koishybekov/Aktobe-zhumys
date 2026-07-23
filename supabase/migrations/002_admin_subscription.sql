-- Admin subscription activation RPC (bypasses RLS for admin phone only)
CREATE OR REPLACE FUNCTION public.admin_activate_subscription(target_phone TEXT)
RETURNS void AS $$
DECLARE
  caller_phone TEXT;
  normalized_target TEXT;
BEGIN
  SELECT phone INTO caller_phone FROM public.profiles WHERE id = auth.uid();

  IF caller_phone IS NULL OR regexp_replace(caller_phone, '\D', '', 'g') NOT LIKE '%7762916969%' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  normalized_target := target_phone;
  IF normalized_target NOT LIKE '+%' THEN
    normalized_target := '+' || regexp_replace(normalized_target, '\D', '', 'g');
  END IF;

  UPDATE public.profiles
  SET
    is_subscribed = true,
    subscribed_until = NOW() + INTERVAL '30 days',
    is_pro = true,
    pro_since = COALESCE(pro_since, NOW())
  WHERE regexp_replace(phone, '\D', '', 'g') = regexp_replace(normalized_target, '\D', '', 'g');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_activate_subscription(TEXT) TO authenticated;
