ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS recent_announcements jsonb,
  ADD COLUMN IF NOT EXISTS market_trends jsonb,
  ADD COLUMN IF NOT EXISTS intel_updated_at timestamptz;