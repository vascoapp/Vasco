export type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  /** Structured-invoice address. A single free-text `address` line cannot be
   *  split into these reliably — "Marktplatz 3, 10178 Berlin" and "Via Roma 1
   *  — 20100 Milano (MI)" share no grammar — and every e-invoice format needs
   *  them as separate elements. XRechnung BR-DE-8/9 require city and post
   *  code outright. */
  city?: string;
  postcode?: string;
  /** ISO 3166-1 alpha-2. Undefined = the contractor's own country. */
  country?: string;
  /** IT provincia / ES provincia. Two letters. */
  province?: string;
  /** Primary tax id: USt-IdNr / NIF / P.IVA / BTW. */
  vatId?: string;
  /** The second identifier some markets need alongside it — Codice Fiscale in
   *  Italy, where a consumer has a CF and no P.IVA. */
  taxId?: string;
  /** Where the buyer's system receives structured invoices. IT: 7-char Codice
   *  Destinatario ('0000000' when routing by PEC). Without it SDI rejects. */
  einvoiceRouting?: string;
  einvoiceEmail?: string;
};
