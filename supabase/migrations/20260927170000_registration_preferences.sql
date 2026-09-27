ALTER TABLE public.tamusni_users
  ADD COLUMN IF NOT EXISTS preferred_topic text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sponsored_in_app boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sponsored_email boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tamusni_users.sponsored_in_app IS 'Explicit consent for sponsored content displayed inside the TAMUSNI account.';
COMMENT ON COLUMN public.tamusni_users.sponsored_email IS 'Explicit consent for sponsored emails.';
