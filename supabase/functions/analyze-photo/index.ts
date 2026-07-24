// =============================================================================
// ANALYZE PHOTO — Supabase Edge Function
// =============================================================================
// Takes a base64 photo from the contractor's camera, sends to Claude Vision,
// returns structured quote line items with quantities and prices.
// API key stays server-side — never exposed to the app.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// R66r49 #13 audit: this function bills Anthropic per call (~$0.005/photo).
// Without auth, anyone with the URL could loop calls and run up the bill.
// Require a valid user JWT.
async function requireAuth(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized — missing token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) {
    return new Response(JSON.stringify({ error: 'server config missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized — invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return { userId: user.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // R66r49 #13: gate before paying for Anthropic call.
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const { imageBase64, imagesBase64, imageUrls, trade, country, mode } = await req.json();
    const analysisMode = mode || 'quote'; // 'quote' | 'invoice'

    // Input shape priority: imageUrls[] (Claude fetches server-side) > imagesBase64[] > legacy imageBase64.
    // URL path is used by the contractor's "Draft quote from these photos" flow when customer
    // already uploaded to the customer-uploads bucket — avoids a client-side re-download + reencode.
    const urls: string[] = Array.isArray(imageUrls)
      ? imageUrls.filter((u: unknown) => typeof u === 'string' && (u as string).length > 0).slice(0, 5)
      : [];
    const photos: string[] = Array.isArray(imagesBase64) && imagesBase64.length > 0
      ? imagesBase64.filter((b: unknown) => typeof b === 'string' && (b as string).length > 0).slice(0, 5)
      : (typeof imageBase64 === 'string' && imageBase64.length > 0 ? [imageBase64] : []);

    const totalImages = urls.length + photos.length;

    if (totalImages === 0) {
      return new Response(
        JSON.stringify({ error: 'imageBase64, imagesBase64 or imageUrls is required' }),
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

    const multiPhotoHint = totalImages > 1
      ? `\nYou are looking at ${totalImages} photos of the SAME job from different angles (before, detail, damage, overview). Use them together — do not double-count entities that appear in multiple photos. Higher confidence when an entity is visible in 2+ photos.`
      : '';

    // Certificate scanning mode — extract trade-cert fields from a photo of
    // the cert card, PDF screenshot, or badge. Dates in YYYY-MM-DD.
    const certificatePrompt = `You are an expert at reading construction trade certifications and professional licenses for ${countryContext}.

Extract the data from this certificate photo. Return ONLY valid JSON:

{
  "certName": "Full certification name (e.g., VCA Basic, Gaskeur CW, NEN 1010, Meisterbrief, CSCS, Qualibat)",
  "issuingBody": "Organization that issued it (SSVV, Kiwa, VCA, IHK, CITB, Qualibat, etc.)",
  "certificationNumber": "Certificate or license number if visible",
  "holderName": "Person or company the cert is issued to",
  "issueDate": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD",
  "category": "technical" | "safety" | "environmental" | "quality" | "industry_specific",
  "confidence": 0-100,
  "warnings": ["Any concerns — e.g. 'expiry date not readable', 'photo too blurry for number'"]
}

Guidelines:
- Common NL certs: VCA, Gaskeur-CW, NEN 1010, F-gassen, Erkend Gasfitter, BKB, Uneto-VNI
- Common DE certs: Meisterbrief, Elektrofachkraft, SCC, F-Gase Zertifikat, Schornsteinfeger
- Common FR certs: Qualibat, RGE, Qualifélec, CAP, BP
- Common ES certs: Carné de Instalador, Sellos Térmicos
- Common IT certs: Abilitazione 37/08, Patentino F-Gas
- Common UK certs: CSCS, Gas Safe, NICEIC, WaterSafe, 18th Edition
- Expiry date is critical — look for "valid until", "geldig tot", "gültig bis", "valable jusqu'au", phrases
- If expiryDate isn't explicitly printed, leave it undefined (do NOT guess)
- Set confidence low (<60) when fields are unclear or blurry`;

    const prompt = analysisMode === 'certificate' ? certificatePrompt
      : analysisMode === 'invoice' ? invoicePrompt
      : `You are an expert construction trades estimator for ${tradeContext} work in ${countryContext}.${multiPhotoHint}

Analyze this photo of a job site or area that needs work. Return a JSON object with quote line items.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation. Use this exact structure:

{
  "jobType": "Brief description of the work needed",
  "complexity": "simple" | "moderate" | "complex",
  "estimatedHours": number,
  "detectedItems": [
    {
      "id": "ai-1",
      "description": "What needs to be done",
      "category": "Category (e.g., Demolition, Prep, Installation, Finishing, Cleanup)",
      "confidence": 0-100,
      "suggestedQuantity": number,
      "unit": "m²" | "m" | "stuk" | "uur" | "job",
      "materialCostPerUnit": number in ${currency} (materials ONLY, per unit),
      "laborCostPerUnit": number in ${currency} (labor ONLY, per unit),
      "suggestedPrice": number in ${currency} (MUST equal materialCostPerUnit + laborCostPerUnit),
      "brand": "Brand ONLY if a specific product is clearly identifiable, else omit",
      "articleNumber": "Article/SKU ONLY if a product label is legible in the photo, else omit",
      "ean": "EAN/barcode ONLY if legible on packaging in the photo, else omit",
      "selected": true
    }
  ],
  "notes": ["Observation about the space/condition"],
  "warnings": ["Safety concern or thing to verify before starting"]
}

Guidelines for pricing (${countryContext} market rates):
- Labor rates: ${countryContext === 'DE' ? '€45-65/hr' : countryContext === 'NL' ? '€45-60/hr' : '£35-55/hr'}
- Split EVERY line into materialCostPerUnit (materials) and laborCostPerUnit (labor); suggestedPrice MUST be their exact sum
- Be realistic — contractors will judge your estimates
- Detect 4-8 line items typically
- Set confidence based on how clearly you can identify the work
- Only fill brand/articleNumber/ean when the identifier is ACTUALLY VISIBLE on a product label or box in the photo — never guess them
- Mark items as selected:true if they seem definitely needed, selected:false if optional`;

    // Call Claude Vision API — with one retry on transient upstream errors
    // (429 / 5xx) and on a JSON parse miss, so a single hiccup doesn't dead-end
    // the contractor's scan (#4b). Each attempt is an independent Haiku call.
    const callClaude = async (): Promise<
      | { ok: true; result: any }
      | { ok: false; transient: boolean; status?: number; detail?: string; raw?: string; parseFail?: boolean }
    > => {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          // Haiku is 10-20x cheaper than Sonnet/Opus — sufficient for structured photo analysis
          // Haiku: ~$0.001/image vs Sonnet: ~$0.015/image. Multi-photo scales linearly.
          model: 'claude-haiku-4-5-20251001',
          // Slightly more tokens for multi-photo since multi-entity lists can be longer.
          max_tokens: totalImages > 1 ? 1536 : 1024,
          messages: [
            {
              role: 'user',
              content: [
                ...urls.map((u: string) => ({
                  type: 'image' as const,
                  source: { type: 'url' as const, url: u },
                })),
                ...photos.map((b: string) => ({
                  type: 'image' as const,
                  source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: b },
                })),
                { type: 'text' as const, text: prompt },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, transient: response.status === 429 || response.status >= 500, status: response.status, detail: errorText };
      }

      const claudeResponse = await response.json();
      const content = claudeResponse.content?.[0]?.text || '';
      try {
        // Claude might wrap in ```json ... ``` — strip that
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return { ok: true, result: JSON.parse(cleaned) };
      } catch {
        return { ok: false, transient: true, parseFail: true, raw: content };
      }
    };

    let attempt = 0;
    let outcome = await callClaude();
    while (!outcome.ok && outcome.transient && attempt < 1) {
      attempt++;
      await new Promise((r) => setTimeout(r, 700));
      outcome = await callClaude();
    }

    if (!outcome.ok) {
      if (outcome.parseFail) {
        // Both attempts produced unparseable output — return debug + empty fallback.
        return new Response(
          JSON.stringify({
            error: 'Failed to parse Claude response',
            raw: outcome.raw,
            fallback: {
              jobType: 'Analyse niet beschikbaar',
              complexity: 'moderate',
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
        JSON.stringify({ error: `Claude API error: ${outcome.status}`, detail: outcome.detail }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let analysisResult = outcome.result;

    // Alias the AI's raw keys to the shape the app + pricing moat actually read.
    // AIQuoteFromPhoto / persistPhotoAnalysis expect estimatedComplexity /
    // estimatedDurationHours / estimatedTotal / detectedRooms, but the prompt
    // emits complexity / estimatedHours / total / rooms — so the moat captured
    // null complexity/duration/cost from every photo. Non-destructive: keeps the
    // originals, adds aliases only when the source key exists.
    if (analysisResult && typeof analysisResult === 'object') {
      const r = analysisResult as Record<string, unknown>;
      if (r.estimatedComplexity === undefined && r.complexity !== undefined) r.estimatedComplexity = r.complexity;
      if (r.estimatedDurationHours === undefined && r.estimatedHours !== undefined) r.estimatedDurationHours = r.estimatedHours;
      if (r.estimatedTotal === undefined && r.total !== undefined) r.estimatedTotal = r.total;
      if (r.detectedRooms === undefined && r.rooms !== undefined) r.detectedRooms = r.rooms;
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
