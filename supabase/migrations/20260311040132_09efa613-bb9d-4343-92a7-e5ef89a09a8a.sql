
-- 1. Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  website     text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert companies for their analyses"
  ON public.companies FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.analyses
    WHERE analyses.id = companies.analysis_id AND analyses.user_id = auth.uid()
  ));

CREATE POLICY "Users can read companies for their analyses"
  ON public.companies FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.analyses
    WHERE analyses.id = companies.analysis_id AND analyses.user_id = auth.uid()
  ));

-- 2. Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  website     text,
  description text,
  type        text NOT NULL DEFAULT 'direct',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert products for their analyses"
  ON public.products FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.analyses
    WHERE analyses.id = products.analysis_id AND analyses.user_id = auth.uid()
  ));

CREATE POLICY "Users can read products for their analyses"
  ON public.products FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.analyses
    WHERE analyses.id = products.analysis_id AND analyses.user_id = auth.uid()
  ));

-- 3. Add product_id to competitors (keep old columns temporarily for migration safety)
ALTER TABLE public.competitors
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS product_name text;

-- 4. Update competitor_data to also reference product_id for denormalised fast reads
-- (competitor_id still works as the join key, product_id is added for convenience)
