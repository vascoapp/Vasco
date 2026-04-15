// =============================================================================
// PLACE-SUPPLIER-ORDER — Supabase Edge Function
// =============================================================================
// Takes a drafted purchase order + supplier id, looks up the contractor's
// stored supplier OAuth token, and POSTs the order to the supplier's B2B API.
// Result is persisted as `purchase_orders.external_ref`.
//
// Body: { userId, supplierId, poId, lines: [{ sku, quantity, unitPrice }], deliveryAddress }
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type SupplierId = 'hornbach' | 'rexel_nl' | 'bouwmaat' | 'technische_unie' | 'solar_nl' | 'bauhaus';

// Each supplier has a slightly different order endpoint. We keep it table-
// driven so adding a new one doesn't require changing handler logic.
const ENDPOINTS: Record<SupplierId, { url: string; payloadShape: 'standard_v1' | 'ubl_2' }> = {
  hornbach:         { url: 'https://api.hornbach.com/b2b/v1/orders', payloadShape: 'standard_v1' },
  rexel_nl:         { url: 'https://api.rexel.nl/v1/orders',          payloadShape: 'standard_v1' },
  bouwmaat:         { url: 'https://api.bouwmaat.nl/v1/orders',       payloadShape: 'standard_v1' },
  technische_unie:  { url: 'https://api.technischeunie.nl/v2/orders', payloadShape: 'ubl_2' },
  solar_nl:         { url: 'https://api.solar.eu/v1/orders',          payloadShape: 'standard_v1' },
  bauhaus:          { url: 'https://api.bauhaus.info/b2b/v1/orders',  payloadShape: 'standard_v1' },
};

interface PlaceOrderRequest {
  userId: string;
  supplierId: SupplierId;
  poId: string;
  lines: Array<{ sku: string; quantity: number; unitPrice?: number }>;
  deliveryAddress?: { street: string; city: string; postcode: string; country: string };
}

function buildPayload(shape: string, req: PlaceOrderRequest): Record<string, any> {
  if (shape === 'ubl_2') {
    // Minimal UBL 2.1 OrderRequest shape
    return {
      'cbc:ID': req.poId,
      'cbc:IssueDate': new Date().toISOString().slice(0, 10),
      'cac:OrderLine': req.lines.map((l, i) => ({
        'cbc:ID': i + 1,
        'cbc:Quantity': l.quantity,
        'cac:Item': { 'cbc:SellersItemIdentification': { 'cbc:ID': l.sku } },
        ...(l.unitPrice != null
          ? { 'cac:Price': { 'cbc:PriceAmount': l.unitPrice } }
          : {}),
      })),
      ...(req.deliveryAddress
        ? { 'cac:DeliveryAddress': { 'cbc:StreetName': req.deliveryAddress.street, 'cbc:CityName': req.deliveryAddress.city, 'cbc:PostalZone': req.deliveryAddress.postcode, 'cac:Country': { 'cbc:IdentificationCode': req.deliveryAddress.country } } }
        : {}),
    };
  }
  // standard_v1 — flat JSON most suppliers accept
  return {
    reference: req.poId,
    lines: req.lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unit_price: l.unitPrice })),
    delivery_address: req.deliveryAddress,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: PlaceOrderRequest = await req.json();
    if (!ENDPOINTS[body.supplierId]) {
      return new Response(JSON.stringify({ ok: false, error: `Unknown supplier ${body.supplierId}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!body.poId || !body.lines || body.lines.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing poId or lines' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (body.userId !== user.id) {
      return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the user's stored supplier access_token
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: tokenRow, error: tokErr } = await admin
      .from('supplier_connections')
      .select('access_token, expires_at')
      .eq('user_id', user.id)
      .eq('supplier_id', body.supplierId)
      .maybeSingle();
    if (tokErr || !tokenRow) {
      return new Response(JSON.stringify({ ok: false, error: `${body.supplierId} not connected` }), {
        status: 412, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if ((tokenRow as any).expires_at && new Date((tokenRow as any).expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ ok: false, error: `${body.supplierId} token expired — please reconnect` }), {
        status: 412, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const endpoint = ENDPOINTS[body.supplierId];
    const payload = buildPayload(endpoint.payloadShape, body);

    const resp = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': endpoint.payloadShape === 'ubl_2' ? 'application/xml' : 'application/json',
        Authorization: `Bearer ${(tokenRow as any).access_token}`,
      },
      body: endpoint.payloadShape === 'ubl_2'
        ? `<?xml version="1.0"?><Order>${JSON.stringify(payload)}</Order>`
        : JSON.stringify(payload),
    });

    const responseText = await resp.text();
    if (!resp.ok) {
      return new Response(JSON.stringify({ ok: false, error: `Supplier ${resp.status}`, detail: responseText.slice(0, 400) }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Best-effort parse of external ref
    let externalRef: string | null = null;
    try {
      const parsed = JSON.parse(responseText);
      externalRef = parsed?.id ?? parsed?.order_id ?? parsed?.reference ?? null;
    } catch {}

    // Persist linkage
    await admin
      .from('purchase_orders')
      .update({ external_ref: externalRef, external_provider: body.supplierId, submitted_at: new Date().toISOString(), status: 'submitted' })
      .eq('id', body.poId)
      .eq('user_id', user.id);

    return new Response(JSON.stringify({ ok: true, externalRef, supplier: body.supplierId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
