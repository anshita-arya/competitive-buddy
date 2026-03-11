import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function scrapeCompetitor(companyName: string, productName: string, website: string, category: string): Promise<string> {
  const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
  if (!FIRECRAWL_API_KEY) return '';

  try {
    const query = category.toLowerCase().includes('blog') || category.toLowerCase().includes('announcement')
      ? `${companyName} ${productName} blog announcements news 2024 2025`
      : category.toLowerCase().includes('changelog') || category.toLowerCase().includes('launch')
      ? `${companyName} ${productName} product launch changelog updates 2024 2025`
      : `${companyName} ${productName} ${category.toLowerCase()}`;

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
      .map((r: { title?: string; url?: string; markdown?: string }) =>
        `[${r.title || ''}](${r.url || ''})\n${r.markdown?.slice(0, 800) || r.title || ''}`)
      .join('\n\n---\n\n');
  } catch {
    return '';
  }
}

function classifyRole(userRole: string): 'internal' | 'outbound' {
  const role = userRole.toLowerCase();
  const outboundKeywords = [
    'sales', 'account executive', 'account manager', 'field', 'ae', 'sdr', 'bdr',
    'solutions engineer', 'se ', ' se', 'marketing', 'cmo', 'growth', 'revenue',
    'business development', 'partnerships', 'customer success', 'cs ', ' cs',
  ];
  return outboundKeywords.some(k => role.includes(k)) ? 'outbound' : 'internal';
}

interface AnalysisItem {
  competitor: string; // "CompanyName – ProductName"
  category: string;
  summary: string;
  score: number;
}

interface AIAnalysisResult {
  executive_summary: string;
  analysis_items: AnalysisItem[];
  recommendations: string;
}

// Enriched competitor row joining competitors → products → companies
interface EnrichedCompetitor {
  id: string;          // competitors.id
  product_id: string;
  company_name: string;
  product_name: string;
  website: string | null;
  type: string;
  // composite key used in AI prompts
  display_name: string; // "CompanyName – ProductName"
}

async function analyzeWithAI(
  userProduct: string,
  userCompany: string,
  userRole: string,
  competitors: EnrichedCompetitor[],
  categories: string[],
  scrapedData: Record<string, Record<string, string>>
): Promise<AIAnalysisResult> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  const roleType = classifyRole(userRole);

  const systemPrompt = roleType === 'outbound'
    ? `You are a competitive intelligence specialist supporting sales teams at ${userCompany}. Your goal is to help salespeople win deals. ALWAYS lead with ${userCompany}'s strengths and advantages. Frame competitor features as trade-offs, limitations, or signs of market validation. Highlight where ${userCompany} wins clearly. Minimize competitor strengths by contextualizing them as niche or narrow. Help the salesperson craft a compelling story about why ${userCompany} is the better choice. Always use the analyze_competitors tool.`
    : `You are a senior competitive intelligence analyst providing deep technical analysis for internal product teams at ${userCompany}. Be specific, data-driven, and unbiased. Identify feature gaps, technical moats, architectural signals, API quality, performance benchmarks, and roadmap indicators. Surface real threats and opportunities with actionable depth. Always use the analyze_competitors tool.`;

  const userPromptSuffix = roleType === 'outbound'
    ? `\n\nIMPORTANT: This analysis is for a sales/outbound role (${userRole}). Frame every category to highlight ${userCompany}'s strengths first. Show how competitors validate the market but fall short where ${userCompany} excels. Scores should reflect how well competitors serve as a foil — higher scores mean they are a stronger comparison point to highlight ${userCompany}'s advantages.`
    : `\n\nIMPORTANT: This analysis is for an internal/technical role (${userRole}). Provide deep technical insights: feature parity gaps, architectural approaches, technical debt signals, API depth, scalability indicators, and developer experience. Be candid about where competitors excel and where ${userCompany} must improve.`;

  // Build context using display_name (Company – Product) for AI consistency
  const context = competitors.map(c => {
    const catData = categories.map(cat => {
      const scraped = scrapedData[c.display_name]?.[cat] || 'No scraped data available';
      return `  ${cat}: ${scraped.slice(0, 500)}`;
    }).join('\n');
    return `### ${c.display_name}\nCompany: ${c.company_name}\nProduct: ${c.product_name}\nType: ${c.type}\nWebsite: ${c.website || 'N/A'}\n${catData}`;
  }).join('\n\n');

  const pairsDescription = competitors.flatMap(c =>
    categories.map(cat => `{ "competitor": "${c.display_name}", "category": "${cat}", "summary": "...", "score": N }`)
  ).join(',\n');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-5-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Analyze competitive landscape for:\nProduct: ${userProduct}\nCompany: ${userCompany}\nRole: ${userRole}\n\nCompetitor data:\n${context}\n\nYou MUST produce exactly one analysis_item for EVERY competitor×category combination listed below (${competitors.length * categories.length} items total):\n${pairsDescription}\n\nUse exactly the competitor and category strings as given. Score 1-10 where 10 = highest threat/strength. Provide comprehensive executive summary and strategic recommendations.${userPromptSuffix}`,
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'analyze_competitors',
            description: 'Return structured competitive analysis with a flat array of per-competitor per-category items',
            parameters: {
              type: 'object',
              properties: {
                executive_summary: {
                  type: 'string',
                  description: 'A structured executive summary using markdown formatting. Use ## for section headers (e.g. ## Market Overview, ## Key Threats, ## Opportunities, ## Our Position). Under each section use bullet points starting with "- " to list 3-5 concise points. Use **bold** for company names, product names, and key metrics. Do NOT write plain paragraphs — every section must have bullet points.',
                },
                analysis_items: {
                  type: 'array',
                  description: 'Flat array — one entry per competitor per category. The competitor field must be "CompanyName – ProductName" format.',
                  items: {
                    type: 'object',
                    properties: {
                      competitor: { type: 'string', description: 'Exact "CompanyName – ProductName" string as provided' },
                      category: { type: 'string', description: 'Exact category name as provided' },
                      summary: { type: 'string', description: '2-4 sentence analysis for this competitor in this category' },
                      score: { type: 'number', description: 'Threat/strength score 1-10' },
                    },
                    required: ['competitor', 'category', 'summary', 'score'],
                    additionalProperties: false,
                  },
                },
                recommendations: {
                  type: 'string',
                  description: 'Strategic recommendations using markdown. Use ## for section headers (e.g. ## Immediate Actions, ## Product Gaps to Close, ## Messaging & Positioning, ## Watch List). Under each section use numbered lists "1. " with **bold** action verbs. Be specific and actionable.',
                },
              },
              required: ['executive_summary', 'analysis_items', 'recommendations'],
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
  if (!toolCall) {
    console.error('No tool call. Full response:', JSON.stringify(data));
    throw new Error('No tool call response from AI');
  }

  return JSON.parse(toolCall.function.arguments) as AIAnalysisResult;
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

    // Fetch competitors with joined product+company data
    // competitors has company_name and product_name columns (denormalized for speed)
    const [{ data: rawCompetitors }, { data: categories }] = await Promise.all([
      supabase.from('competitors').select('id, product_id, company_name, product_name, website, type, name').eq('analysis_id', analysis_id),
      supabase.from('categories').select('*').eq('analysis_id', analysis_id),
    ]);

    if (!rawCompetitors?.length) throw new Error('No competitors found');
    if (!categories?.length) throw new Error('No categories found');

    // Build enriched competitors, falling back to legacy `name` field for old data
    const competitors: EnrichedCompetitor[] = rawCompetitors.map(c => {
      const companyName = c.company_name || c.name?.split(' – ')[0] || c.name || 'Unknown';
      const productName = c.product_name || c.name?.split(' – ')[1] || c.name || 'Unknown';
      return {
        id: c.id,
        product_id: c.product_id,
        company_name: companyName,
        product_name: productName,
        website: c.website,
        type: c.type,
        display_name: `${companyName} – ${productName}`,
      };
    });

    // Update status to running
    await supabase.from('analyses').update({ status: 'running' }).eq('id', analysis_id);

    const categoryNames = categories.map(c => c.name);

    // Scrape data keyed by display_name
    const scrapedData: Record<string, Record<string, string>> = {};
    for (const comp of competitors) {
      scrapedData[comp.display_name] = {};
      for (const cat of categoryNames) {
        const scraped = await scrapeCompetitor(comp.company_name, comp.product_name, comp.website || comp.display_name, cat);
        scrapedData[comp.display_name][cat] = scraped;
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Run AI analysis
    const aiResult = await analyzeWithAI(
      analysis.user_product,
      analysis.user_company,
      analysis.user_role,
      competitors,
      categoryNames,
      scrapedData
    );

    console.log(`AI returned ${aiResult.analysis_items?.length ?? 0} analysis items`);

    // Build lookup map — key: "normalised_display_name::normalised_category"
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const itemMap = new Map<string, { summary: string; score: number }>();
    for (const item of (aiResult.analysis_items || [])) {
      const key = `${norm(item.competitor)}::${norm(item.category)}`;
      itemMap.set(key, { summary: item.summary, score: item.score });
    }

    // Store competitor_data rows
    const dataRows = [];
    for (const comp of competitors) {
      for (const cat of categoryNames) {
        const key = `${norm(comp.display_name)}::${norm(cat)}`;
        const item = itemMap.get(key);
        console.log(`  "${comp.display_name}" × "${cat}" -> key="${key}" -> found=${!!item} score=${item?.score ?? 'NULL'}`);
        dataRows.push({
          analysis_id,
          competitor_id: comp.id,
          category: cat,
          scraped_content: scrapedData[comp.display_name]?.[cat] || null,
          ai_summary: item?.summary || null,
          score: item?.score ?? null,
        });
      }
    }

    await supabase.from('competitor_data').insert(dataRows);

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
