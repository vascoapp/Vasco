import { PropsWithChildren, createContext, useContext, useMemo, useState } from 'react';
import { businessProfile as initialBusinessProfile } from '../data/mockBusiness';
import { invoices as initialInvoices, quotes as initialQuotes } from '../data/mockDocuments';
import { quoteLineItems as initialLineItems } from '../data/mockLineItems';
import { ExtractedDocument } from '../ingestion/pdfSchema';
import { ingestPdfStub } from '../ingestion/ingestionStub';
import { buildPriceRiskSignals } from '../logic/priceRisk';
import { exportInvoiceToMoneybird } from '../integrations/moneybird';
import { createMolliePayment } from '../integrations/mollie';
import { BusinessProfile } from '../domain/business';
import { Invoice, Quote } from '../domain/documents';
import { PriceRiskSignal } from '../domain/insights';
import { QuoteLineItem } from '../domain/lineItems';

type AppState = {
  businessProfile: BusinessProfile;
  quotes: Quote[];
  invoices: Invoice[];
  priceRisks: PriceRiskSignal[];
  extractedDocs: ExtractedDocument[];
  lineItems: Record<string, QuoteLineItem[]>;
  moneybirdConnected: boolean;
  lastMoneybirdExport: Record<string, string>;
  mollieConnected: boolean;
  lastMolliePayment: Record<string, string>;
  ingestPdfHistory: () => void;
  addExtractedDoc: (doc: ExtractedDocument) => void;
  applySuggestedPrice: (quoteId: string, description: string, unitPrice: number) => void;
  markQuoteSent: (id: string) => void;
  markInvoiceSent: (id: string) => void;
  markInvoicePaid: (id: string) => void;
  connectMoneybird: () => void;
  exportInvoice: (invoiceId: string) => Promise<void>;
  connectMollie: () => void;
  createPaymentLink: (invoiceId: string, amount: number) => Promise<void>;
};

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const [businessProfile] = useState<BusinessProfile>(initialBusinessProfile);
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [extractedDocs, setExtractedDocs] = useState<ExtractedDocument[]>([]);
  const [lineItems, setLineItems] = useState<Record<string, QuoteLineItem[]>>(initialLineItems);
  const [moneybirdConnected, setMoneybirdConnected] = useState(false);
  const [lastMoneybirdExport, setLastMoneybirdExport] = useState<Record<string, string>>({});
  const [mollieConnected, setMollieConnected] = useState(false);
  const [lastMolliePayment, setLastMolliePayment] = useState<Record<string, string>>({});

  const recalcQuoteTotal = (quoteId: string, items: QuoteLineItem[]) => {
    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    setQuotes((prev) =>
      prev.map((quote) => (quote.id === quoteId ? { ...quote, amount: total } : quote))
    );
  };

  const value = useMemo<AppState>(
    () => ({
      businessProfile,
      quotes,
      invoices,
      extractedDocs,
      lineItems,
      moneybirdConnected,
      lastMoneybirdExport,
      mollieConnected,
      lastMolliePayment,
      priceRisks: buildPriceRiskSignals(quotes, lineItems, extractedDocs),
      ingestPdfHistory: () => {
        setExtractedDocs((prev) => [...prev, ...ingestPdfStub()]);
      },
      addExtractedDoc: (doc) => setExtractedDocs((prev) => [...prev, doc]),
      applySuggestedPrice: (quoteId, description, unitPrice) => {
        setLineItems((prev) => {
          const items = prev[quoteId] ?? [];
          const updated = items.map((item) =>
            item.description === description ? { ...item, unitPrice } : item
          );
          recalcQuoteTotal(quoteId, updated);
          return { ...prev, [quoteId]: updated };
        });
      },
      markQuoteSent: (id) =>
        setQuotes((prev) =>
          prev.map((quote) =>
            quote.id === id ? { ...quote, status: 'sent', lastUpdated: 'Just now' } : quote
          )
        ),
      markInvoiceSent: (id) =>
        setInvoices((prev) =>
          prev.map((invoice) =>
            invoice.id === id ? { ...invoice, status: 'sent', dueInDays: 14 } : invoice
          )
        ),
      markInvoicePaid: (id) =>
        setInvoices((prev) =>
          prev.map((invoice) =>
            invoice.id === id ? { ...invoice, status: 'paid', dueInDays: 0 } : invoice
          )
        ),
      connectMoneybird: () => setMoneybirdConnected(true),
      exportInvoice: async (invoiceId) => {
        const result = await exportInvoiceToMoneybird(invoiceId);
        if (result.success) {
          setLastMoneybirdExport((prev) => ({
            ...prev,
            [invoiceId]: result.exportedAt,
          }));
        }
      },
      connectMollie: () => setMollieConnected(true),
      createPaymentLink: async (invoiceId, amount) => {
        const result = await createMolliePayment(invoiceId, amount);
        if (result.success) {
          setLastMolliePayment((prev) => ({
            ...prev,
            [invoiceId]: result.paymentId,
          }));
        }
      },
    }),
    [
      businessProfile,
      extractedDocs,
      invoices,
      lineItems,
      moneybirdConnected,
      mollieConnected,
      quotes,
      lastMoneybirdExport,
      lastMolliePayment,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
