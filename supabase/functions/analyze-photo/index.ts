// =============================================================================
// ANALYZE PHOTO — Supabase Edge Function
// =============================================================================
// Takes a base64 photo from the contractor's camera, sends to Claude Vision,
// returns structured quote line items with quantities and prices.
// API key stays server-side — never exposed to the app.
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64, trade, country, mode } = await req.json();
    const analysisMode = mode || 'quote'; // 'quote' | 'invoice'

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'imageBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tradeContext = trade || 'general';
    const countryContext = country || 'NL';
    const currency = countryContext === 'UK' ? 'GBP' : 'EUR';

    // Invoice scanning mode — extract supplier invoice data
    const invoicePrompt = `You are an expert at reading construction supplier invoices and receipts.

Extract ALL data from this invoice/receipt photo. Return ONLY valid JSON:

{
  "documentType": "invoice" | "receipt" | "delivery_note" | "quote",
  "supplierName": "Supplier company name",
  "supplierAddress": "Full address if visible",
  "supplierVat": "VAT/BTW number if visible",
  "documentNumber": "Invoice/receipt number",
  "documentDate": "YYYY-MM-DD",
  "lineItems": [
    {
      "description": "Material/product name",
      "articleNumber": "SKU/article number if visible",
      "ean": "EAN/barcode if visible",
      "brand": "Brand name if identifiable",
      "category": "plumbing" | "electrical" | "painting" | "carpentry" | "gas" | "general",
      "quantity": number,
      "unit": "stuk" | "m" | "m²" | "rol" | "doos" | "kg" | "l",
      "unitPrice": number (excl VAT in ${currency}),
      "vatRate": number (percentage),
      "totalPrice": number (excl VAT),
      "confidence": 0-100
    }
  ],
  "subtotal": number,
  "vatAmount": number,
  "total": number,
  "paymentTerms": "Payment terms if visible",
  "confidence": 0-100
}

Guidelines:
- Extract EVERY line item, even partial
- Article numbers and EAN codes are very valuable — extract if visible
- Identify the brand from context (Grohe, Viega, Hager, etc.)
- Set confidence based on how clearly you can read each field
- Prices should be in ${currency}, excl VAT unless clearly stated incl VAT
- Common Dutch suppliers: Technische Unie, Rexel, Solar, Hornbach, Brouwer, Sonepar`;

    const prompt = analysisMode === 'invoice' ? invoicePrompt : `You are an expert construction trades estimator for ${tradeContext} work in ${countryContext}.

Analyze this photo of a job site or area that needs work. Return a JSON object with quote line items.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation. Use this exact structure:

{
  "jobType": "Brief description of the work needed",
  "complexity": "simple" | "medium" | "complex",
  "estimatedHours": number,
  "detectedItems": [
    {
      "id": "ai-1",
      "description": "What needs to be done",
      "category": "Category (e.g., Demolition, Prep, Installation, Finishing, Cleanup)",
      "confidence": 0-100,
      "suggestedQuantity": number,
      "unit": "m²" | "m" | "stuk" | "uur" | "job",
      "suggestedPrice": number in ${currency} (labor + materials per unit),
      "selected": true
    }
  ],
  "notes": ["Observation about the space/condition"],
  "warnings": ["Safety concern or thing to verify before starting"]
}

Guidelines for pricing (${countryContext} market rates):
- Labor rates: ${countryContext === 'DE' ? '€45-65/hr' : countryContext === 'NL' ? '€45-60/hr' : '£35-55/hr'}
- Include both labor and materials in suggestedPrice per unit
- Be realistic — contractors will judge your estimates
- Detect 4-8 line items typically
- Set confidence based on how clearly you can identify the work
- Mark items as selected:true if they seem definitely needed, selected:false if optional`;

    // Call Claude Vision API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        // Haiku is 10-20x cheaper than Sonnet/Opus — sufficient for structured photo analysis
        // Haiku: ~$0.001/image vs Sonnet: ~$0.015/image
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024, // Keep response tight — structured JSON doesn't need more
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `Claude API error: ${response.status}`, detail: errorText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeResponse = await response.json();
    const content = claudeResponse.content?.[0]?.text || '';

    // Parse the JSON from Claude's response
    let analysisResult;
    try {
      // Claude might wrap in ```json ... ``` — strip that
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisResult = JSON.parse(cleaned);
    } catch {
      // If JSON parsing fails, return the raw text for debugging
      return new Response(
        JSON.stringify({
          error: 'Failed to parse Claude response',
          raw: content,
          fallback: {
            jobType: 'Analyse niet beschikbaar',
            complexity: 'medium',
            estimatedHours: 8,
            detectedItems: [],
            notes: ['AI kon de foto niet volledig analyseren. Probeer een duidelijkere foto.'],
            warnings: [],
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
