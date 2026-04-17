// =============================================================================
// UNIFIED ACCOUNTING INTEGRATION — Dutch accounting platforms
// =============================================================================
// Supports: Moneybird, Exact Online, e-Boekhouden, Snelstart, Jortt
// Unified interface so the app doesn't care which platform the contractor uses
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vasco_accounting';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AccountingProvider =
  | 'moneybird'
  | 'exact_online'
  | 'eboekhouden'
  | 'snelstart'
  | 'jortt'
  | 'twinfield'
  // German providers
  | 'datev'
  | 'lexoffice'
  | 'sevdesk'
  // French providers
  | 'pennylane'
  | 'indy'
  // Spanish providers
  | 'holded'
  | 'quipu'
  | 'anfix'
  // Italian providers
  | 'fattureincloud'
  | 'aruba_fe'
  // UK providers
  | 'xero'
  | 'quickbooks'
  | 'freeagent'
  | 'none';

export interface AccountingConfig {
  provider: AccountingProvider;
  connected: boolean;
  connectedAt?: string;
  lastSyncAt?: string;
  settings?: Record<string, string>;
}

export interface UnifiedContact {
  externalId?: string;
  name: string;
  email?: string;
  phone?: string;
  vatNumber?: string;
  kvkNumber?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface UnifiedInvoice {
  externalId?: string;
  contactExternalId?: string;
  reference: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: UnifiedLineItem[];
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  totalExclVat: number;
  totalInclVat: number;
  paidAt?: string;
}

export interface UnifiedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number; // 0, 9, or 21 for NL
  totalExclVat: number;
}

export interface SyncResult {
  provider: AccountingProvider;
  success: boolean;
  invoicesSynced: number;
  contactsSynced: number;
  paymentsSynced: number;
  errors: string[];
  syncedAt: string;
}

// ---------------------------------------------------------------------------
// Provider metadata — for UI display
// ---------------------------------------------------------------------------

export interface ProviderInfo {
  id: AccountingProvider;
  name: string;
  description: string;
  icon: string; // Ionicons name
  popular: boolean;
  apiDocs: string;
  features: string[];
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'moneybird',
    name: 'Moneybird',
    description: 'Populairste boekhoudprogramma voor ZZP\'ers',
    icon: 'cloud-outline',
    popular: true,
    apiDocs: 'https://developer.moneybird.com/',
    features: ['Facturen', 'Offertes', 'Contacten', 'BTW-aangifte', 'Bankintegratie', 'Peppol e-factuur'],
  },
  {
    id: 'exact_online',
    name: 'Exact Online',
    description: 'Uitgebreide boekhouding voor groeiende bedrijven',
    icon: 'server-outline',
    popular: true,
    apiDocs: 'https://start.exactonline.nl/docs/HlpRestAPIResources.aspx',
    features: ['Facturen', 'Projecten', 'Voorraadbeheer', 'Bankintegratie', 'CRM'],
  },
  {
    id: 'eboekhouden',
    name: 'e-Boekhouden.nl',
    description: 'Beste prijs-kwaliteit verhouding',
    icon: 'calculator-outline',
    popular: true,
    apiDocs: 'https://www.e-boekhouden.nl/api',
    features: ['Facturen', 'BTW-aangifte', 'Bankimport', 'Kasboek'],
  },
  {
    id: 'snelstart',
    name: 'Snelstart',
    description: 'Eenvoudige boekhouding',
    icon: 'flash-outline',
    popular: false,
    apiDocs: 'https://b2bapi-developer.snelstart.nl/',
    features: ['Facturen', 'Offertes', 'Bankintegratie'],
  },
  {
    id: 'jortt',
    name: 'Jortt',
    description: 'Slimme boekhouding met AI',
    icon: 'sparkles-outline',
    popular: false,
    apiDocs: 'https://app.jortt.nl/api-documentatie',
    features: ['Facturen', 'BTW', 'Bankimport'],
  },
  {
    id: 'twinfield',
    name: 'Twinfield',
    description: 'Onderdeel van Wolters Kluwer',
    icon: 'business-outline',
    popular: false,
    apiDocs: 'https://accounting.twinfield.com/webservices/documentation/',
    features: ['Facturen', 'Projecten', 'Rapportages', 'Multi-administratie'],
  },
  // German providers
  {
    id: 'datev',
    name: 'DATEV',
    description: 'Deutschlands führende Buchhaltungssoftware — über Steuerberater',
    icon: 'server-outline',
    popular: true,
    apiDocs: 'https://developer.datev.de/',
    features: ['Buchführung', 'Lohnabrechnung', 'USt-Voranmeldung', 'DATEV Unternehmen Online'],
  },
  {
    id: 'lexoffice',
    name: 'Lexoffice',
    description: 'Cloud-Buchhaltung für Selbständige und Kleinunternehmer',
    icon: 'calculator-outline',
    popular: true,
    apiDocs: 'https://developers.lexoffice.io/docs/',
    features: ['Rechnungen', 'Angebote', 'Banking', 'USt-Voranmeldung', 'E-Rechnung'],
  },
  {
    id: 'sevdesk',
    name: 'SevDesk',
    description: 'Online-Buchhaltung mit XRechnung und ZUGFeRD',
    icon: 'cloud-outline',
    popular: true,
    apiDocs: 'https://api.sevdesk.de/',
    features: ['Rechnungen', 'Belegerkennung', 'Banking', 'XRechnung', 'ZUGFeRD'],
  },
  // French providers
  {
    id: 'pennylane',
    name: 'Pennylane',
    description: 'Comptabilité en ligne pour artisans et TPE',
    icon: 'cloud-outline',
    popular: true,
    apiDocs: 'https://pennylane.readme.io/',
    features: ['Factures', 'Devis', 'TVA', 'Rapprochement bancaire', 'Factur-X'],
  },
  {
    id: 'indy',
    name: 'Indy',
    description: 'Comptabilité simplifiée pour auto-entrepreneurs',
    icon: 'calculator-outline',
    popular: false,
    apiDocs: 'https://www.indy.fr/',
    features: ['Factures', 'TVA', 'Déclarations'],
  },
  // Spanish providers
  {
    id: 'holded',
    name: 'Holded',
    description: 'Contabilidad y facturación para autónomos y PYMES',
    icon: 'cloud-outline',
    popular: true,
    apiDocs: 'https://developers.holded.com/',
    features: ['Facturas', 'Presupuestos', 'IVA', 'Modelo 303', 'VeriFactu'],
  },
  {
    id: 'quipu',
    name: 'Quipu',
    description: 'Facturación para freelancers y autónomos',
    icon: 'calculator-outline',
    popular: false,
    apiDocs: 'https://quipuapp.github.io/api-v1-docs/',
    features: ['Facturas', 'Tickets', 'IVA', 'IRPF'],
  },
  {
    id: 'anfix',
    name: 'Anfix',
    description: 'Contabilidad con gestoría integrada',
    icon: 'briefcase-outline',
    popular: false,
    apiDocs: 'https://www.anfix.com/',
    features: ['Facturas', 'IVA', 'Nóminas', 'Gestoría'],
  },
  // Italian providers
  {
    id: 'fattureincloud',
    name: 'Fatture in Cloud',
    description: 'Fatturazione elettronica e contabilità per artigiani',
    icon: 'cloud-outline',
    popular: true,
    apiDocs: 'https://developers.fattureincloud.it/',
    features: ['Fatture', 'Preventivi', 'IVA', 'SDI', 'Codice destinatario'],
  },
  {
    id: 'aruba_fe',
    name: 'Aruba Fatturazione',
    description: 'Fatturazione elettronica via SDI',
    icon: 'mail-outline',
    popular: false,
    apiDocs: 'https://fatturazioneelettronica.aruba.it/apidoc/',
    features: ['Fatture SDI', 'FPA12', 'FPR12', 'Conservazione'],
  },
  // UK providers
  {
    id: 'xero',
    name: 'Xero',
    description: 'Cloud accounting for small businesses',
    icon: 'cloud-outline',
    popular: true,
    apiDocs: 'https://developer.xero.com/',
    features: ['Invoices', 'Quotes', 'VAT Returns', 'Bank Feeds', 'Payroll'],
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    description: 'Accounting & bookkeeping for sole traders',
    icon: 'calculator-outline',
    popular: true,
    apiDocs: 'https://developer.intuit.com/',
    features: ['Invoices', 'Expenses', 'VAT', 'Self Assessment', 'MTD'],
  },
  {
    id: 'freeagent',
    name: 'FreeAgent',
    description: 'Accounting built for freelancers & contractors',
    icon: 'person-outline',
    popular: false,
    apiDocs: 'https://dev.freeagent.com/',
    features: ['Invoices', 'Time Tracking', 'VAT', 'Self Assessment'],
  },
];

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

export async function getAccountingConfig(): Promise<AccountingConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { provider: 'none', connected: false };
  } catch {
    return { provider: 'none', connected: false };
  }
}

export async function saveAccountingConfig(config: AccountingConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function disconnectAccounting(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Unified operations — delegate to provider-specific implementations
// ---------------------------------------------------------------------------

export async function syncInvoices(): Promise<SyncResult> {
  const config = await getAccountingConfig();
  if (!config.connected || config.provider === 'none') {
    return {
      provider: config.provider,
      success: false,
      invoicesSynced: 0,
      contactsSynced: 0,
      paymentsSynced: 0,
      errors: ['Geen boekhouding gekoppeld'],
      syncedAt: new Date().toISOString(),
    };
  }

  // Provider-specific sync will be implemented per provider
  // For now, return mock success
  const result: SyncResult = {
    provider: config.provider,
    success: true,
    invoicesSynced: 0,
    contactsSynced: 0,
    paymentsSynced: 0,
    errors: [],
    syncedAt: new Date().toISOString(),
  };

  await saveAccountingConfig({ ...config, lastSyncAt: result.syncedAt });
  return result;
}

export async function exportInvoice(invoice: UnifiedInvoice): Promise<{ success: boolean; externalId?: string; error?: string }> {
  const config = await getAccountingConfig();
  if (!config.connected || config.provider === 'none') {
    return { success: false, error: 'Geen boekhouding gekoppeld' };
  }

  // Provider-specific export
  const lineItemsPayload = invoice.lineItems.map(li => ({
    description: li.description,
    price: li.unitPrice,
    quantity: li.quantity,
    vatRate: li.vatRate,
  }));

  switch (config.provider) {
    case 'moneybird': {
      const mb = await import('./moneybird');
      const result = await mb.createInvoice({
        contactId: invoice.contactExternalId ?? '',
        reference: invoice.reference,
        lineItems: lineItemsPayload,
        dueDate: invoice.dueDate,
      });
      return { success: result.success, externalId: result.moneybirdId, error: result.error };
    }
    case 'xero': {
      const xero = await import('./xero');
      const result = await xero.createInvoice({
        contactId: invoice.contactExternalId ?? '',
        reference: invoice.reference,
        lineItems: lineItemsPayload,
        dueDate: invoice.dueDate,
      });
      return { success: result.success, externalId: result.xeroId, error: result.error };
    }
    case 'quickbooks': {
      const qb = await import('./quickbooks');
      const result = await qb.createInvoice({
        customerId: invoice.contactExternalId ?? '',
        reference: invoice.reference,
        lineItems: lineItemsPayload,
        dueDate: invoice.dueDate,
        currency: invoice.currency,
      });
      return { success: result.success, externalId: result.quickbooksId, error: result.error };
    }
    case 'lexoffice': {
      const lex = await import('./lexoffice');
      const payload = lex.vascoToLexofficeInvoice({
        customerName: invoice.contactExternalId ?? '',
        lineItems: invoice.lineItems.map((li) => ({
          description: li.description, quantity: li.quantity, unitPrice: li.unitPrice,
          vatRate: li.vatRate, unit: (li as any).unit ?? 'piece',
        })),
        date: invoice.invoiceDate,
        dueDate: invoice.dueDate,
      });
      const id = await lex.createInvoice(payload);
      return id
        ? { success: true, externalId: id }
        : { success: false, error: 'Lexoffice export failed' };
    }
    case 'pennylane': {
      const pl = await import('./pennylane');
      const result = await pl.createInvoice({
        customerId: invoice.contactExternalId ?? '',
        reference: invoice.reference,
        lineItems: invoice.lineItems.map((li) => ({
          description: li.description, price: li.unitPrice, quantity: li.quantity, vatRate: li.vatRate,
        })),
        dueDate: invoice.dueDate,
      });
      return { success: result.success, externalId: result.pennylaneId, error: result.error };
    }
    case 'holded': {
      const hl = await import('./holded');
      const result = await hl.createInvoice({
        contactId: invoice.contactExternalId ?? '',
        reference: invoice.reference,
        lineItems: invoice.lineItems.map((li) => ({
          description: li.description, price: li.unitPrice, quantity: li.quantity, vatRate: li.vatRate,
        })),
        dueDate: invoice.dueDate,
      });
      return { success: result.success, externalId: result.holdedId, error: result.error };
    }
    case 'fattureincloud': {
      const fic = await import('./fattureincloud');
      const clientId = Number(invoice.contactExternalId);
      if (!Number.isFinite(clientId) || clientId <= 0) {
        return { success: false, error: 'Fatture in Cloud client id missing' };
      }
      const result = await fic.createIssuedDocument({
        clientId,
        reference: invoice.reference,
        lineItems: invoice.lineItems.map((li) => ({
          description: li.description, price: li.unitPrice, quantity: li.quantity, vatRate: li.vatRate,
        })),
        dueDate: invoice.dueDate,
      });
      return {
        success: result.success,
        externalId: result.fattureInCloudId != null ? String(result.fattureInCloudId) : undefined,
        error: result.error,
      };
    }
    default:
      return { success: false, error: `${config.provider} export niet beschikbaar` };
  }
}

export async function syncPaymentStatus(): Promise<{ paidInvoiceIds: string[] }> {
  const config = await getAccountingConfig();
  if (!config.connected) return { paidInvoiceIds: [] };

  switch (config.provider) {
    case 'moneybird': {
      const mb = await import('./moneybird');
      return mb.syncPayments();
    }
    case 'xero': {
      const xero = await import('./xero');
      return xero.syncPaymentStatus();
    }
    case 'quickbooks': {
      const qb = await import('./quickbooks');
      return qb.syncPaymentStatus();
    }
    case 'pennylane': {
      const pl = await import('./pennylane');
      return pl.syncPaymentStatus();
    }
    case 'holded': {
      const hl = await import('./holded');
      return hl.syncPaymentStatus();
    }
    case 'fattureincloud': {
      const fic = await import('./fattureincloud');
      const result = await fic.syncPaymentStatus();
      return { paidInvoiceIds: result.paidInvoiceIds.map(String) };
    }
    default:
      return { paidInvoiceIds: [] };
  }
}
