// =============================================================================
// ITALIAN COMPLIANCE - Types
// =============================================================================
// Italy-specific compliance automation: IVA, Partita IVA, DURC, certifications
// a16z Sphere pattern: "Compliance as executable workflow logic"
// =============================================================================

// ============================================
// PARTITA IVA / CAMERA DI COMMERCIO
// ============================================

export interface PartitaIvaRegistration {
  partitaIva: string;            // 11 digits (e.g. 01234567890)
  codiceFiscale: string;         // 16-char alphanumeric (individuals) or 11-digit (companies)
  businessName: string;
  tradeName?: string;
  legalForm: ItalianLegalForm;

  // Address
  address: ItalianAddress;

  // Status
  status: 'active' | 'inactive' | 'dissolved' | 'unknown';
  registrationDate: string;
  lastVerified: string;

  // Activity
  codiceAteco: string;           // Codice ATECO (e.g. "43.22.01" for plumbing)
  codiceAtecoLabel: string;
  secondaryActivities?: AtecoActivity[];

  // Registrations
  cameraCommercioNumber?: string; // REA number — Camera di Commercio
  cameraCommercioProvince?: string;
  alboArtigianiNumber?: string;  // Albo delle Imprese Artigiane

  // DURC
  durcValid: boolean;
  durcExpiryDate?: string;       // Valid for 120 days
  durcProtocolNumber?: string;

  // Regime
  regimeForfettario: boolean;    // Flat-rate tax regime (< €85k revenue)

  // Flags
  verificationStatus: 'verified' | 'pending' | 'failed' | 'stale';
  alerts?: PartitaIvaAlert[];
}

export type ItalianLegalForm =
  | 'ditta_individuale'      // Sole proprietorship
  | 'libero_professionista'  // Freelance professional
  | 'srl'                    // Società a Responsabilità Limitata
  | 'srls'                   // SRL Semplificata (simplified SRL)
  | 'srl_unipersonale'       // Single-member SRL
  | 'spa'                    // Società per Azioni
  | 'sas'                    // Società in Accomandita Semplice
  | 'snc'                    // Società in Nome Collettivo
  | 'ss'                     // Società Semplice
  | 'cooperativa'            // Cooperativa
  | 'other';

export interface AtecoActivity {
  code: string;
  label: string;
  isMain: boolean;
}

export interface PartitaIvaAlert {
  type: 'registration-changed' | 'address-changed' | 'status-changed' | 'durc-expiring' | 'activity-changed';
  message: string;
  detectedAt: string;
  previousValue?: string;
  newValue?: string;
}

export interface ItalianAddress {
  street: string;
  civicNumber: string;
  interno?: string;
  cap: string;               // Codice di Avviamento Postale (postal code)
  city: string;
  province: string;          // 2-letter code (e.g. MI, RM, NA)
  country: 'IT';
}

// ============================================
// IVA (VAT)
// ============================================

export interface IvaRegistration {
  partitaIva: string;
  isActive: boolean;
  registrationDate: string;
  lastVerified: string;

  // VIES Verification
  viesVerified: boolean;
  viesVerificationDate?: string;

  // Filing Requirements
  filingFrequency: 'monthly' | 'quarterly';
  regime: ItalianIvaRegime;
  nextFilingDeadline: string;

  // Schemes
  regimeForfettario: boolean;       // Flat-rate (no IVA charged, no deduction)
  regimeMinimiContribuenti: boolean; // Regime dei minimi (legacy)
  splitPayment: boolean;            // Split payment (PA invoices)
}

export type ItalianIvaRegime =
  | 'ordinario'           // Regime ordinario
  | 'forfettario'         // Regime forfettario (flat-rate, no IVA)
  | 'semplificato'        // Regime semplificato (simplified accounting)
  | 'agricoltura';        // Regime speciale agricoltura

export type ItalianIvaRate = 0 | 4 | 5 | 10 | 22;

export interface IvaRateRule {
  rate: ItalianIvaRate;
  description: string;
  applicableTo: string[];
  exceptions?: string[];
}

// Standard Italian IVA rates
export const IVA_RATES: IvaRateRule[] = [
  {
    rate: 22,
    description: 'Aliquota ordinaria',
    applicableTo: ['Most goods and services', 'Construction materials', 'Professional services'],
  },
  {
    rate: 10,
    description: 'Aliquota ridotta',
    applicableTo: ['Ristrutturazione edilizia (manutenzione ordinaria/straordinaria)', 'Fornitura con posa in opera (beni significativi fino a valore prestazione)'],
    exceptions: ['Beni significativi (caldaie, infissi, sanitari) al 22% per la quota eccedente'],
  },
  {
    rate: 5,
    description: 'Aliquota ridotta speciale',
    applicableTo: ['Erbe aromatiche', 'Basilico, rosmarino, salvia freschi'],
  },
  {
    rate: 4,
    description: 'Aliquota minima',
    applicableTo: ['Prima casa (costruzione/ristrutturazione)', 'Eliminazione barriere architettoniche'],
  },
  {
    rate: 0,
    description: 'Esente / Non imponibile',
    applicableTo: ['Cessioni intracomunitarie', 'Esportazioni extra UE', 'Regime forfettario (no IVA applicata)'],
  },
];

export interface IvaPeriod {
  periodType: 'month' | 'quarter' | 'year';
  periodStart: string;
  periodEnd: string;
  filingDeadline: string;
  paymentDeadline: string;
  status: 'upcoming' | 'due' | 'filed' | 'paid' | 'overdue';
}

export interface IvaCalculation {
  // Outputs (Sales)
  salesExclIva22: number;
  salesExclIva10: number;
  salesExclIva4: number;
  ivaOwed22: number;
  ivaOwed10: number;
  ivaOwed4: number;
  totalIvaOwed: number;

  // Inputs (Purchases)
  purchasesExclIva: number;
  ivaPaid: number;

  // Balance
  ivaBalance: number;  // Positive = owe, Negative = credit

  // Intra-community
  icSales?: number;
  icPurchases?: number;

  // Split payment (PA)
  splitPaymentAmount?: number;

  // Reverse charge
  reverseChargeAmount?: number;
}

export interface IvaFiling {
  id: string;
  period: IvaPeriod;
  calculation: IvaCalculation;

  // E-invoicing: Italy mandates electronic invoicing (Fatturazione Elettronica) via SDI
  fatturazioneTipo: 'liquidazione_periodica' | 'dichiarazione_annuale' | 'esterometro';
  status: 'draft' | 'generated' | 'submitted' | 'confirmed';
  generatedAt?: string;
  submittedAt?: string;
  referenceNumber?: string;

  // Payment — F24 form
  paymentStatus: 'pending' | 'paid' | 'credit-carried' | 'refund-requested' | 'refund-received';
  f24Reference?: string;
  paidAt?: string;

  // Audit Trail
  invoicesIncluded: string[];
  expensesIncluded: string[];
  manualAdjustments?: IvaAdjustment[];
}

export interface IvaAdjustment {
  description: string;
  amount: number;
  ivaRate: ItalianIvaRate;
  reason: 'correction' | 'private-use' | 'non-deductible' | 'pro-rata' | 'other';
}

// ============================================
// DURC (Documento Unico di Regolarità Contributiva)
// ============================================

export interface DurcDocument {
  id: string;
  protocolNumber: string;
  partitaIva: string;
  businessName: string;

  issueDate: string;
  expiryDate: string;           // Valid for 120 days from issue
  status: 'valid' | 'expiring-soon' | 'expired' | 'irregular';
  daysUntilExpiry: number;

  // Regularity with social security bodies
  inpsRegular: boolean;         // INPS (pension/social security)
  inailRegular: boolean;        // INAIL (workplace accident insurance)
  cassaEdileRegular: boolean;   // Cassa Edile (construction workers' fund)

  documentUri?: string;
}

// ============================================
// CERTIFICATIONS & QUALIFICATIONS
// ============================================

export interface ItalianCertification {
  id: string;

  // Certification Details
  type: ItalianCertificationType;
  name: string;
  issuingBody: string;
  certificateNumber: string;

  // Holder
  holderType: 'individual' | 'company';
  holderName: string;

  // Validity
  issueDate: string;
  expiryDate: string;
  status: 'valid' | 'expiring-soon' | 'expired' | 'suspended' | 'revoked';
  daysUntilExpiry: number;

  // Renewal
  renewalRequired: boolean;
  renewalLeadTimeDays: number;
  renewalProcess?: RenewalProcess;

  // Document
  documentUri?: string;
  documentVerified: boolean;

  // Compliance
  requiredForTrades: string[];
  legalBasis?: string;
}

export type ItalianCertificationType =
  // SOA — required for public works > €150k
  | 'soa'                       // Attestazione SOA (categories OG/OS)

  // Trade authorizations
  | 'abilitazione_elettrica'    // Abilitazione impianti elettrici (DM 37/08 lettera A)
  | 'abilitazione_idraulica'    // Abilitazione impianti idraulici (DM 37/08 lettera D)
  | 'abilitazione_gas'          // Abilitazione impianti gas (DM 37/08 lettera E)
  | 'abilitazione_climatizzazione' // Abilitazione climatizzazione (DM 37/08 lettera C)
  | 'abilitazione_ascensori'    // Abilitazione impianti di sollevamento (DM 37/08 lettera F)

  // Energy
  | 'certificazione_energetica' // Certificazione Energetica APE (Attestato di Prestazione Energetica)
  | 'fonti_rinnovabili'         // Qualificazione fonti rinnovabili (FER)

  // Safety
  | 'rspp'                      // RSPP — Responsabile Servizio Prevenzione e Protezione
  | 'rls'                       // RLS — Rappresentante dei Lavoratori per la Sicurezza
  | 'primo_soccorso'            // Primo Soccorso (first aid)
  | 'antincendio'               // Prevenzione Incendi (fire safety)
  | 'ponteggi'                  // Montaggio/smontaggio ponteggi (scaffolding)
  | 'lavori_quota'              // Lavori in quota (working at height)
  | 'spazi_confinati'           // Spazi confinati (confined spaces)
  | 'amianto'                   // Bonifica amianto (asbestos removal)

  // Refrigeration
  | 'fgas'                      // Certificato F-Gas (Reg. EU 517/2014)

  // Business / Quality
  | 'iso_9001'                  // Quality management
  | 'iso_14001'                 // Environmental management
  | 'iso_45001'                 // Occupational health and safety

  | 'other';

export interface RenewalProcess {
  steps: RenewalStep[];
  estimatedCost?: number;
  estimatedDuration?: string;
  submissionUrl?: string;
}

export interface RenewalStep {
  order: number;
  description: string;
  deadline?: string;
  documentRequired?: string;
  status: 'pending' | 'completed' | 'skipped';
}

// ============================================
// INSURANCE
// ============================================

export interface ItalianInsurance {
  id: string;

  type: ItalianInsuranceType;
  provider: string;
  policyNumber: string;

  // Coverage
  coverageDescription: string;
  coverageAmount: number;
  deductible: number;

  // Term
  startDate: string;
  endDate: string;
  status: 'active' | 'expiring-soon' | 'expired' | 'cancelled';
  daysUntilExpiry: number;

  // Premium
  premiumAmount: number;
  premiumFrequency: 'monthly' | 'quarterly' | 'yearly';
  nextPaymentDate: string;

  // Contact
  claimPhone?: string;
  claimEmail?: string;

  // Document
  documentUri?: string;
}

export type ItalianInsuranceType =
  | 'rc_professionale'         // Assicurazione RC Professionale
  | 'rc_verso_terzi'           // RC verso terzi e prestatori d'opera
  | 'decennale_postuma'        // Polizza Decennale Postuma (10-year structural)
  | 'infortuni'                // Assicurazione Infortuni
  | 'multirischio'             // Polizza Multirischio (premises + contents)
  | 'tutela_legale'            // Tutela Legale
  | 'veicoli'                  // Assicurazione Veicoli
  | 'car_ear'                  // CAR/EAR (Construction/Erection All Risks)
  | 'other';

// ============================================
// TRADES (MESTIERI DELL'EDILIZIA)
// ============================================

export type ItalianConstructionTrade =
  | 'idraulico'
  | 'elettricista'
  | 'termoidraulico'
  | 'caldaista'
  | 'frigorista'
  | 'climatista'
  | 'imbianchino'
  | 'pittore_edile'
  | 'falegname'
  | 'carpentiere'
  | 'muratore'
  | 'piastrellista'
  | 'copritetto'
  | 'cartongessista'
  | 'stuccatore'
  | 'fabbro'
  | 'vetraio'
  | 'pavimentista'
  | 'ferraiolo'
  | 'gruista'
  | 'escavatorista'
  | 'impermeabilizzatore'
  | 'ascensorista'
  | 'antennista'
  | 'installatore_fotovoltaico'
  | 'giardiniere'
  | 'geometra'
  | 'direttore_lavori'
  | 'capocantiere'
  | 'other';

// ============================================
// FATTURAZIONE ELETTRONICA (E-Invoicing)
// ============================================

export interface FatturazioneElettronica {
  codiceDestinatario: string;  // 7-char SDI code or '0000000' for PEC
  pecDestinatario?: string;    // PEC email as alternative
  formatoTrasmissione: 'FPA12' | 'FPR12'; // PA (public) or PR (private)
  progressivoInvio: string;    // Unique sending number
  codiceTrasmittente: string;  // Country code + fiscal code of sender
}

// ============================================
// COMPLIANCE DASHBOARD
// ============================================

export interface ItalianComplianceDashboard {
  overallScore: number;  // 0-100
  status: 'compliant' | 'action-required' | 'critical';

  // Partita IVA
  partitaIvaStatus: 'verified' | 'needs-verification' | 'issues-found';
  partitaIvaLastVerified?: string;

  // IVA
  ivaStatus: 'up-to-date' | 'filing-due' | 'overdue';
  nextIvaDeadline?: string;
  ivaBalance?: number;

  // DURC
  durcStatus: 'valid' | 'expiring-soon' | 'expired' | 'irregular';
  durcExpiryDate?: string;

  // Certifications
  certificationsValid: number;
  certificationsExpiringSoon: number;
  certificationsExpired: number;

  // Insurance
  insuranceActive: number;
  insuranceExpiringSoon: number;
  insuranceExpired: number;

  // SOA (if applicable)
  soaActive: boolean;
  soaCategories?: string[];
  soaExpiryDate?: string;

  // E-invoicing
  fatturazioneElettronicaActive: boolean;
  sdiConnected: boolean;

  // Alerts
  alerts: ItalianComplianceAlert[];

  // Upcoming
  upcomingDeadlines: ItalianComplianceDeadline[];
}

export interface ItalianComplianceAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  category: 'partita_iva' | 'iva' | 'durc' | 'certification' | 'insurance' | 'soa' | 'fatturazione' | 'other';
  title: string;
  message: string;
  actionRequired: boolean;
  actionLabel?: string;
  dueDate?: string;
  createdAt: string;
}

export interface ItalianComplianceDeadline {
  id: string;
  type: 'iva-filing' | 'iva-payment' | 'durc-renewal' | 'certification-renewal' | 'insurance-renewal' | 'soa-renewal' | 'f24-payment';
  title: string;
  deadline: string;
  daysUntil: number;
  status: 'upcoming' | 'due-soon' | 'overdue';
  linkedEntityId?: string;
}

// ============================================
// INVOICE COMPLIANCE (Italian Requirements)
// ============================================

export interface ItalianInvoiceComplianceCheck {
  invoiceId: string;
  isCompliant: boolean;
  issues: ItalianInvoiceComplianceIssue[];
  checkedAt: string;
}

export interface ItalianInvoiceComplianceIssue {
  field: string;
  issue: 'missing' | 'invalid' | 'format-error';
  message: string;
  severity: 'error' | 'warning';
  legalReference?: string;
}

// Required fields for Italian invoices (DPR 633/72 + Fatturazione Elettronica)
export const ITALIAN_INVOICE_REQUIREMENTS = [
  { field: 'invoiceNumber', required: true, description: 'Numero progressivo di fattura' },
  { field: 'invoiceDate', required: true, description: 'Data di emissione' },
  { field: 'sellerName', required: true, description: 'Denominazione o ragione sociale del cedente' },
  { field: 'sellerPartitaIva', required: true, description: 'Partita IVA del cedente' },
  { field: 'sellerCodiceFiscale', required: true, description: 'Codice Fiscale del cedente' },
  { field: 'sellerAddress', required: true, description: 'Sede legale del cedente' },
  { field: 'sellerRea', required: false, description: 'Numero REA (Camera di Commercio)' },
  { field: 'buyerName', required: true, description: 'Denominazione o ragione sociale del cessionario' },
  { field: 'buyerPartitaIva', required: true, description: 'Partita IVA del cessionario (se soggetto IVA)' },
  { field: 'buyerCodiceFiscale', required: true, description: 'Codice Fiscale del cessionario' },
  { field: 'buyerAddress', required: true, description: 'Indirizzo del cessionario' },
  { field: 'description', required: true, description: 'Natura, qualità e quantità dei beni/servizi' },
  { field: 'ivaRate', required: true, description: 'Aliquota IVA applicata' },
  { field: 'imponibile', required: true, description: 'Imponibile (base imponibile)' },
  { field: 'imposta', required: true, description: 'Imposta (importo IVA)' },
  { field: 'totalAmount', required: true, description: 'Importo totale del documento' },
  { field: 'paymentTerms', required: true, description: 'Condizioni di pagamento' },
  { field: 'paymentMethod', required: true, description: 'Modalità di pagamento (bonifico, ecc.)' },
  { field: 'codiceDestinatarioOrPec', required: true, description: 'Codice Destinatario SDI o PEC (fattura elettronica)' },
  { field: 'marcaTemporale', required: false, description: 'Marca da bollo virtuale (€2 se esente IVA e importo > €77.47)' },
];

// ============================================
// GDPR / PRIVACY COMPLIANCE
// ============================================

export interface PrivacyConsent {
  type: 'marketing' | 'analytics' | 'data_processing' | 'third_party';
  granted: boolean;
  grantedAt?: string;
  expiresAt?: string;
}

export const ITALIAN_RETENTION_PERIODS = {
  invoices: 10 * 365,       // 10 years (Codice Civile art. 2220)
  taxRecords: 5 * 365,      // 5 years (accertamento fiscale) or 7 years (if no dichiarazione)
  contracts: 10 * 365,
  employeeRecords: 5 * 365, // 5 years after end of employment
  durc: 120,                // 120 days validity
  customerData: 2 * 365,    // 2 years after last contact (Garante Privacy guidance)
  websiteAnalytics: 365,    // 1 year
};


// ---------------------------------------------------------------------------
// Government Portals
// ---------------------------------------------------------------------------

export const ITALIAN_GOVERNMENT_PORTALS = {
  agenziaEntrate: { name: 'Agenzia delle Entrate', url: 'https://www.agenziaentrate.gov.it', description: 'IVA, Fatturazione Elettronica, SDI' },
  inps: { name: 'INPS', url: 'https://www.inps.it', description: 'Contributi previdenziali e pensione' },
  inail: { name: 'INAIL', url: 'https://www.inail.it', description: 'Assicurazione infortuni sul lavoro' },
  cassaEdile: { name: 'Cassa Edile', url: 'https://www.cassaedile.it', description: 'Contributi settore edile e DURC' },
  cameraCommercio: { name: 'Camera di Commercio', url: 'https://www.registroimprese.it', description: 'Registro imprese e visure' },
  enea: { name: 'ENEA', url: 'https://www.efficienzaenergetica.enea.it', description: 'Detrazioni fiscali ristrutturazione ed ecobonus' },
} as const;
