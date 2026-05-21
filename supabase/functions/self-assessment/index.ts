import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { analysisId } = await req.json();
    if (!analysisId) throw new Error('analysisId required');

    const { data: analysis } = await supabase
      .from('analyses').select('*').eq('id', analysisId).single();
    if (!analysis) throw new Error('Analysis not found');

    const { data: categories } = await supabase
      .from('categories').select('name').eq('analysis_id', analysisId);
    const catNames = (categories || []).map((c: any) => c.name);
    if (!catNames.length) throw new Error('No categories');

    // Ensure self competitor exists
    const { data: existingComps } = await supabase
      .from('competitors').select('id, type').eq('analysis_id', analysisId);
    let selfId = existingComps?.find((c: any) => c.type === 'self')?.id;
    if (!selfId) {
      const { data: inserted, error: insErr } = await supabase.from('competitors').insert({
        analysis_id: analysisId,
        type: 'self',
        name: `${analysis.user_company} – ${analysis.user_product}`,
        company_name: analysis.user_company,
        product_name: analysis.user_product,
        website: null,
      }).select('id').single();
      if (insErr) throw insErr;
      selfId = inserted!.id;
    }

    // Find which categories still need data
    const { data: existingData } = await supabase
      .from('competitor_data').select('category, ai_summary')
      .eq('analysis_id', analysisId).eq('competitor_id', selfId);
    const have = new Set((existingData || []).filter((d: any) => d.ai_summary).map((d: any) => d.category));
    const missing = catNames.filter((c: string) => !have.has(c));
    if (!missing.length) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a candid product strategist writing an honest self-assessment of ${analysis.user_company}'s product "${analysis.user_product}" for an internal audience (role: ${analysis.user_role}). Be specific: real strengths, real gaps. Never marketing fluff. Always use the self_assessment tool.`,
          },
          {
            role: 'user',
            content: `Produce a self-assessment for ${analysis.user_company} – ${analysis.user_product} covering EXACTLY these categories (one item each): ${missing.map((c: string) => `"${c}"`).join(', ')}.\n\nFor each: 2-3 sentences covering current capability + key strengths + known gaps. Score 1-10 reflecting ${analysis.user_company}'s strength in that category (10 = best-in-class).`,
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'self_assessment',
            description: 'Return self-assessment per category',
            parameters: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      category: { type: 'string' },
                      summary: { type: 'string' },
                      score: { type: 'number' },
                    },
                    required: ['category', 'summary', 'score'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['items'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'self_assessment' } },
      }),
    });

    if (!aiRes.ok) throw new Error(`AI error ${aiRes.status}`);
    const aiData = await aiRes.json();
    const args = JSON.parse(aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || '{}');
    const items: { category: string; summary: string; score: number }[] = args.items || [];

    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const byCat = new Map(items.map(i => [norm(i.category), i]));

    // Delete existing empty rows for missing cats, then insert
    await supabase.from('competitor_data')
      .delete()
      .eq('analysis_id', analysisId)
      .eq('competitor_id', selfId)
      .in('category', missing);

    const rows = missing.map((cat: string) => {
      const m = byCat.get(norm(cat));
      return {
        analysis_id: analysisId,
        competitor_id: selfId,
        category: cat,
        ai_summary: m?.summary || null,
        score: m?.score ?? null,
      };
    });
    await supabase.from('competitor_data').insert(rows);

    return new Response(JSON.stringify({ ok: true, generated: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('self-assessment error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
