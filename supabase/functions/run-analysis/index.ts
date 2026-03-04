import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function scrapeCompetitor(name: string, website: string, category: string): Promise<string> {
  const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
  if (!FIRECRAWL_API_KEY) return '';

  try {
    // Use Firecrawl search to find relevant info
    const query = category.toLowerCase().includes('blog') || category.toLowerCase().includes('announcement')
      ? `${name} blog announcements news 2024 2025`
      : category.toLowerCase().includes('changelog') || category.toLowerCase().includes('launch')
      ? `${name} product launch changelog updates 2024 2025`
      : `${name} ${category.toLowerCase()}`;

    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: 3,
        scrapeOptions: { formats: ['markdown'] },
      }),
    });

    if (!response.ok) return '';
    const data = await response.json();
    if (!data.success || !data.data?.length) return '';

    return data.data
      .slice(0, 3)
      .map((r: { title?: string; url?: string; markdown?: string }) => `[${r.title || ''}](${r.url || ''})\n${r.markdown?.slice(0, 800) || r.title || ''}`)
      .join('\n\n---\n\n');
  } catch {
    return '';
  }
}

async function analyzeWithAI(
  userProduct: string,
  userCompany: string,
  competitors: Array<{ name: string; website: string; type: string }>,
  categories: string[],
  scrapedData: Record<string, Record<string, string>>
): Promise<{ executive_summary: string; competitor_analysis: Record<string, Record<string, { summary: string; score: number }>>; recommendations: string }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  const context = competitors.map(c => {
    const catData = categories.map(cat => {
      const scraped = scrapedData[c.name]?.[cat] || 'No scraped data available';
      return `  ${cat}: ${scraped.slice(0, 500)}`;
    }).join('\n');
    return `### ${c.name} (${c.type})\nWebsite: ${c.website}\n${catData}`;
  }).join('\n\n');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: `You are a senior competitive intelligence analyst. Provide deep, actionable analysis for product teams. Be specific, insightful, and data-driven. Always use the analyze_competitors tool.`,
        },
        {
          role: 'user',
          content: `Analyze competitive landscape for:\nProduct: ${userProduct}\nCompany: ${userCompany}\n\nCompetitor data:\n${context}\n\nCategories to analyze: ${categories.join(', ')}\n\nProvide comprehensive competitive analysis including executive summary, per-competitor per-category analysis with scores (1-10), and strategic recommendations.`,
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'analyze_competitors',
            description: 'Return structured competitive analysis',
            parameters: {
              type: 'object',
              properties: {
                executive_summary: { type: 'string', description: '3-5 paragraph executive summary covering market dynamics, key threats and opportunities' },
                competitor_analysis: {
                  type: 'object',
                  description: 'Nested object: competitor_name -> category -> { summary, score }',
                  additionalProperties: {
                    type: 'object',
                    additionalProperties: {
                      type: 'object',
                      properties: {
                        summary: { type: 'string' },
                        score: { type: 'number' },
                      },
                      required: ['summary', 'score'],
                      additionalProperties: false,
                    },
                  },
                },
                recommendations: { type: 'string', description: '5-7 specific, actionable strategic recommendations for the user company' },
              },
              required: ['executive_summary', 'competitor_analysis', 'recommendations'],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'analyze_competitors' } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error('Rate limit exceeded. Please try again.');
    if (response.status === 402) throw new Error('AI credits exhausted. Please add funds.');
    throw new Error(`AI error ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error('No tool call response from AI');

  return JSON.parse(toolCall.function.arguments);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { analysis_id } = await req.json();
    if (!analysis_id) throw new Error('analysis_id required');

    // Fetch analysis
    const { data: analysis, error: aErr } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', analysis_id)
      .single();
    if (aErr || !analysis) throw new Error('Analysis not found');

    // Fetch competitors & categories
    const [{ data: competitors }, { data: categories }] = await Promise.all([
      supabase.from('competitors').select('*').eq('analysis_id', analysis_id),
      supabase.from('categories').select('*').eq('analysis_id', analysis_id),
    ]);

    if (!competitors?.length) throw new Error('No competitors found');
    if (!categories?.length) throw new Error('No categories found');

    // Update status to running
    await supabase.from('analyses').update({ status: 'running' }).eq('id', analysis_id);

    const categoryNames = categories.map(c => c.name);

    // Scrape data for all competitors × categories
    const scrapedData: Record<string, Record<string, string>> = {};
    for (const comp of competitors) {
      scrapedData[comp.name] = {};
      for (const cat of categoryNames) {
        const scraped = await scrapeCompetitor(comp.name, comp.website || comp.name, cat);
        scrapedData[comp.name][cat] = scraped;
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Run AI analysis
    const aiResult = await analyzeWithAI(
      analysis.user_product,
      analysis.user_company,
      competitors,
      categoryNames,
      scrapedData
    );

    // Store competitor_data rows
    const dataRows = [];
    for (const comp of competitors) {
      for (const cat of categoryNames) {
        const catAnalysis = aiResult.competitor_analysis?.[comp.name]?.[cat];
        dataRows.push({
          analysis_id,
          competitor_id: comp.id,
          category: cat,
          scraped_content: scrapedData[comp.name]?.[cat] || null,
          ai_summary: catAnalysis?.summary || null,
          score: catAnalysis?.score || null,
        });
      }
    }

    await supabase.from('competitor_data').insert(dataRows);

    // Update analysis with results
    await supabase.from('analyses').update({
      status: 'completed',
      executive_summary: aiResult.executive_summary,
      recommendations: aiResult.recommendations,
    }).eq('id', analysis_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('run-analysis error:', e);
    // Mark as failed
    try {
      const { analysis_id } = await req.clone().json().catch(() => ({}));
      if (analysis_id) {
        await supabase.from('analyses').update({ status: 'failed' }).eq('id', analysis_id);
      }
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
