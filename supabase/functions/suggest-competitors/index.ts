const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { product, company, role } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

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
            content: `You are a competitive intelligence expert. Given a product, company and user role, suggest relevant competitors. For each competitor company, identify the specific competing product. Always respond using the suggest_competitors tool.`,
          },
          {
            role: 'user',
            content: `Product: ${product}\nCompany: ${company}\nUser role: ${role}\n\nSuggest 4-5 direct competitors and 3-4 disruptive/emerging players. For each, provide both the company name AND the specific competing product name.`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_competitors',
              description: 'Return a list of suggested competitors with type classification and their competing products',
              parameters: {
                type: 'object',
                properties: {
                  competitors: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'The company name' },
                        product: { type: 'string', description: 'The specific competing product or service offered by this company' },
                        website: { type: 'string', description: 'The company or product website' },
                        type: { type: 'string', enum: ['direct', 'disruptor'] },
                        description: { type: 'string', description: 'Brief description of why this is a competitor' },
                      },
                      required: ['name', 'product', 'website', 'type', 'description'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['competitors'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_competitors' } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error(`AI error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No tool call in response');

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('suggest-competitors error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
