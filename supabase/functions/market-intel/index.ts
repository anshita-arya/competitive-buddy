// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FIRECRAWL = 'https://api.firecrawl.dev/v2';
const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

async function firecrawlSearch(query: string, apiKey: string, limit = 5) {
  try {
    const res = await fetch(`${FIRECRAWL}/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit, tbs: 'qdr:m' }),
    });
    if (!res.ok) {
      console.error('firecrawl search failed', query, res.status, await res.text());
      return [];
    }
    const data = await res.json();
    // v2: { data: { web: [...] } } OR { data: [...] } depending on shape
    const web = data?.data?.web || data?.data || [];
    return Array.isArray(web) ? web : [];
  } catch (e) {
    console.error('firecrawl error', e);
    return [];
  }
}

async function callAI(prompt: string, schema: any, lovableKey: string) {
  const res = await fetch(AI_GATEWAY, {
    method: 'POST',
    headers: { Authorization: `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You synthesize web search results into concise, factual market intelligence. Always return structured JSON via the provided tool.' },
        { role: 'user', content: prompt },
      ],
      tools: [{ type: 'function', function: { name: 'emit', description: 'Emit structured intel', parameters: schema } }],
      tool_choice: { type: 'function', function: { name: 'emit' } },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t}`);
  }
  const data = await res.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error('No tool call returned');
  return JSON.parse(args);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { analysisId, force } = await req.json();
    if (!analysisId) {
      return new Response(JSON.stringify({ error: 'analysisId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!FIRECRAWL_API_KEY) throw new Error('FIRECRAWL_API_KEY not configured');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: analysis, error: aErr } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', analysisId)
      .maybeSingle();
    if (aErr || !analysis) throw new Error('Analysis not found');

    // Cache: 24h unless forced
    if (!force && analysis.intel_updated_at) {
      const age = Date.now() - new Date(analysis.intel_updated_at).getTime();
      if (age < 24 * 60 * 60 * 1000 && analysis.recent_announcements && analysis.market_trends) {
        return new Response(JSON.stringify({
          recent_announcements: analysis.recent_announcements,
          market_trends: analysis.market_trends,
          intel_updated_at: analysis.intel_updated_at,
          cached: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const { data: competitors = [] } = await supabase
      .from('competitors')
      .select('id, company_name, product_name, name, type')
      .eq('analysis_id', analysisId);
    const { data: categories = [] } = await supabase
      .from('categories')
      .select('name')
      .eq('analysis_id', analysisId);

    const others = (competitors || []).filter((c: any) => c.type !== 'self');

    // === 1. ANNOUNCEMENTS (per competitor) ===
    const announcementsPromise = (async () => {
      const results: any[] = [];
      await Promise.all(others.map(async (c: any) => {
        const company = c.company_name || c.name?.split(' – ')[0] || c.name;
        const product = c.product_name || c.name?.split(' – ')[1] || '';
        const query = `${company} ${product} launch OR announcement OR release OR funding OR partnership`.trim();
        const hits = await firecrawlSearch(query, FIRECRAWL_API_KEY, 5);
        const summarized = hits.slice(0, 5).map((h: any) => ({
          title: h.title || h.url,
          url: h.url,
          description: h.description || h.snippet || '',
          date: h.date || h.publishedDate || null,
        }));
        if (summarized.length) {
          results.push({ company, product, items: summarized });
        }
      }));

      if (!results.length) return [];

      // Have AI distill highlights
      const distilled = await callAI(
        `Below are raw recent web results for competitors. For EACH item produce a 1-sentence "why it matters" highlight. Group by company. Drop noise/irrelevant items. Keep at most 4 items per company.\n\n${JSON.stringify(results)}`,
        {
          type: 'object',
          properties: {
            companies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  company: { type: 'string' },
                  product: { type: 'string' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        url: { type: 'string' },
                        date: { type: 'string' },
                        highlight: { type: 'string' },
                      },
                      required: ['title', 'url', 'highlight'],
                    },
                  },
                },
                required: ['company', 'items'],
              },
            },
          },
          required: ['companies'],
        },
        LOVABLE_API_KEY,
      );
      return distilled.companies || [];
    })();

    // === 2. MARKET TRENDS (industry-level) ===
    const trendsPromise = (async () => {
      const industryHint = `${analysis.user_company} ${analysis.user_product}`;
      const catNames = (categories || []).map((c: any) => c.name).slice(0, 4);
      const queries = [
        `${industryHint} industry trends 2026`,
        `${industryHint} market analysis signals`,
        ...catNames.map((c) => `${industryHint} ${c} trend`),
      ].slice(0, 5);

      const allHits: any[] = [];
      await Promise.all(queries.map(async (q) => {
        const hits = await firecrawlSearch(q, FIRECRAWL_API_KEY, 4);
        allHits.push(...hits.slice(0, 4).map((h: any) => ({
          title: h.title || h.url, url: h.url, description: h.description || h.snippet || '', query: q,
        })));
      }));

      if (!allHits.length) return [];

      const distilled = await callAI(
        `You are a market analyst. Based on these recent web results about the "${industryHint}" space, synthesize 4-6 distinct, non-obvious market trends. For each, write a tight 2-sentence summary, list 2-3 supporting signals (concrete observations), and cite source URLs from the input. Avoid generic platitudes.\n\nResults:\n${JSON.stringify(allHits)}`,
        {
          type: 'object',
          properties: {
            trends: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  summary: { type: 'string' },
                  signals: { type: 'array', items: { type: 'string' } },
                  sources: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, url: { type: 'string' } }, required: ['url'] } },
                },
                required: ['title', 'summary', 'signals'],
              },
            },
          },
          required: ['trends'],
        },
        LOVABLE_API_KEY,
      );
      return distilled.trends || [];
    })();

    const [recent_announcements, market_trends] = await Promise.all([
      announcementsPromise.catch((e) => { console.error('announcements failed', e); return []; }),
      trendsPromise.catch((e) => { console.error('trends failed', e); return []; }),
    ]);

    const intel_updated_at = new Date().toISOString();
    await supabase.from('analyses').update({
      recent_announcements,
      market_trends,
      intel_updated_at,
    }).eq('id', analysisId);

    return new Response(JSON.stringify({ recent_announcements, market_trends, intel_updated_at, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('market-intel error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
