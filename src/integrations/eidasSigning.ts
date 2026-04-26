// =============================================================================
// eIDAS QUALIFIED E-SIGNATURE — Signicat (R246)
// =============================================================================
// Replaces the local-capture signatureService for high-value contracts that
// require court-admissible Qualified Electronic Signatures (QES) under
// EU Regulation 910/2014 (eIDAS).
//
// Why Signicat: EU-native, supports DigiD (NL), itsme (BE/NL), BankID (NO/SE),
// IDIN, qualified certs in DE/FR/ES/IT. Single API across all 6 markets.
// Docs: https://developer.signicat.com/
//
// Production needs:
//   SIGNICAT_CLIENT_ID + SIGNICAT_CLIENT_SECRET (Supabase secrets)
//   SIGNICAT_BASE_URL (test: signicat.com sandbox; prod: their EU region)
//
// This file ships the service-side flow. The signing UI is web-redirect:
// contractor's app sends document → Signicat returns a signing URL →
// customer signs in browser → webhook fires when complete.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vasco_signicat_config';

export interface SignicatConfig {
  baseUrl: string;
  accessToken: string;
  expiresAt: number;
  connectedAt: string;
}

export interface SigningRequest {
  documentId: string;             // Vasco quote/contract ID
  title: string;
  documentBase64: string;          // PDF
  signers: Array<{
    name: string;
    email: string;
    role: 'customer' | 'contractor';
  }>;
  redirectUrl?: string;            // contractor app deep-link
  language?: 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';
}

export interface SigningSession {
  signicatId: string;
  signingUrl: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'expired';
  createdAt: string;
}

async function getConfig(): Promise<SignicatConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveSignicatConfig(config: SignicatConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function isEidasConnected(): Promise<boolean> {
  const config = await getConfig();
  return !!config?.accessToken;
}

/**
 * Create a Signicat signing session. Returns a signing URL the customer
 * opens in their browser. The signed document + audit trail are then
 * fetched via getSignedDocument() once the webhook fires.
 */
export async function createSigningSession(request: SigningRequest): Promise<SigningSession | null> {
  const config = await getConfig();
  if (!config) return null;

  try {
    const res = await fetch(`${config.baseUrl}/v1/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: request.title,
        externalId: request.documentId,
        files: [{
          fileName: `${request.title}.pdf`,
          contentBase64: request.documentBase64,
        }],
        signers: request.signers.map((s) => ({
          name: s.name,
          email: s.email,
          authentication: { providers: ['nl-bankid', 'digid', 'itsme', 'bankid'] },
          signature: { type: 'qes' },
        })),
        configuration: {
          locale: request.language ?? 'en',
          redirectAfterSigning: request.redirectUrl,
        },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return {
      signicatId: String(json.id),
      signingUrl: String(json.signingUrl ?? json.signers?.[0]?.signingUrl ?? ''),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getSigningStatus(signicatId: string): Promise<SigningSession['status']> {
  const config = await getConfig();
  if (!config) return 'pending';
  try {
    const res = await fetch(`${config.baseUrl}/v1/documents/${signicatId}`, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    if (!res.ok) return 'pending';
    const json = await res.json();
    const map: Record<string, SigningSession['status']> = {
      created: 'pending', signing: 'in_progress', signed: 'completed',
      rejected: 'rejected', expired: 'expired', cancelled: 'rejected',
    };
    return map[String(json.status ?? '').toLowerCase()] ?? 'pending';
  } catch {
    return 'pending';
  }
}

export async function getSignedDocument(signicatId: string): Promise<{ pdfBase64: string; auditTrailBase64: string } | null> {
  const config = await getConfig();
  if (!config) return null;
  try {
    const res = await fetch(`${config.baseUrl}/v1/documents/${signicatId}/download`, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return {
      pdfBase64: String(json.signedFile ?? ''),
      auditTrailBase64: String(json.auditTrail ?? ''),
    };
  } catch {
    return null;
  }
}
