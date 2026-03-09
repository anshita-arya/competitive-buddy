
-- Fix overly permissive INSERT/UPDATE policies on categories and competitors
-- These should only allow inserts tied to analyses owned by the current user

DROP POLICY IF EXISTS "Public insert categories" ON public.categories;
DROP POLICY IF EXISTS "Public read categories" ON public.categories;

CREATE POLICY "Users can read categories for their analyses"
  ON public.categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.analyses
      WHERE analyses.id = categories.analysis_id
        AND analyses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert categories for their analyses"
  ON public.categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analyses
      WHERE analyses.id = categories.analysis_id
        AND analyses.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public insert competitors" ON public.competitors;
DROP POLICY IF EXISTS "Public read competitors" ON public.competitors;

CREATE POLICY "Users can read competitors for their analyses"
  ON public.competitors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.analyses
      WHERE analyses.id = competitors.analysis_id
        AND analyses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert competitors for their analyses"
  ON public.competitors FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analyses
      WHERE analyses.id = competitors.analysis_id
        AND analyses.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public insert competitor_data" ON public.competitor_data;
DROP POLICY IF EXISTS "Public read competitor_data" ON public.competitor_data;
DROP POLICY IF EXISTS "Public update competitor_data" ON public.competitor_data;

CREATE POLICY "Users can read competitor_data for their analyses"
  ON public.competitor_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.analyses
      WHERE analyses.id = competitor_data.analysis_id
        AND analyses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert competitor_data for their analyses"
  ON public.competitor_data FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analyses
      WHERE analyses.id = competitor_data.analysis_id
        AND analyses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update competitor_data for their analyses"
  ON public.competitor_data FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.analyses
      WHERE analyses.id = competitor_data.analysis_id
        AND analyses.user_id = auth.uid()
    )
  );
