
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_product TEXT NOT NULL,
  user_role TEXT NOT NULL,
  user_company TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  executive_summary TEXT,
  recommendations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read analyses" ON public.analyses FOR SELECT USING (true);
CREATE POLICY "Public insert analyses" ON public.analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update analyses" ON public.analyses FOR UPDATE USING (true);

CREATE TABLE public.competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT,
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'disruptor')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read competitors" ON public.competitors FOR SELECT USING (true);
CREATE POLICY "Public insert competitors" ON public.competitors FOR INSERT WITH CHECK (true);

CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public insert categories" ON public.categories FOR INSERT WITH CHECK (true);

CREATE TABLE public.competitor_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  scraped_content TEXT,
  ai_summary TEXT,
  score INTEGER CHECK (score >= 1 AND score <= 10),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.competitor_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read competitor_data" ON public.competitor_data FOR SELECT USING (true);
CREATE POLICY "Public insert competitor_data" ON public.competitor_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update competitor_data" ON public.competitor_data FOR UPDATE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_analyses_updated_at
  BEFORE UPDATE ON public.analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
