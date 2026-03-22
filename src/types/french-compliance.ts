// =============================================================================
// FRENCH COMPLIANCE - Types
// =============================================================================
// France-specific compliance automation: TVA, SIRET, certifications
// a16z Sphere pattern: "Compliance as executable workflow logic"
// =============================================================================

// ============================================
// SIRET / REGISTRE DU COMMERCE
// ============================================

export interface SiretRegistration {
  siretNumber: string;          // 14 digits (SIREN 9 + NIC 5)
  sirenNumber: string;          // 9 digits — identifies the enterprise
  nicCode: string;              // 5 digits — identifies the establishment
  businessName: string;
  tradeName?: string;
  legalForm: FrenchLegalForm;

  // Address
  address: FrenchAddress;

  // Status
  status: 'active' | 'inactive' | 'dissolved' | 'unknown';
  registrationDate: string;
  lastVerified: string;

  // Activity
  codeApe: string;              // Code APE (NAF) — e.g. "43.22A" for plumbing
  codeApeLabel: string;
  secondaryActivities?: ApeActivity[];

  // Registration
  rcsNumber?: string;           // Registre du Commerce et des Sociétés
  rmNumber?: string;            // Répertoire des Métiers (artisans)

  // Flags
  verificationStatus: 'verified' | 'pending' | 'failed' | 'stale';
  alerts?: SiretAlert[];
}

export type FrenchLegalForm =
  | 'ei'                // Entreprise Individuelle
  | 'eirl'              // EIRL (deprecated but existing)
  | 'micro_entreprise'  // Micro-entreprise (auto-entrepreneur)
  | 'eurl'              // EURL (single-member SARL)
  | 'sarl'              // SARL
  | 'sas'               // SAS
  | 'sasu'              // SASU (single-member SAS)
  | 'sa'                // SA
  | 'snc'               // Société en Nom Collectif
  | 'scp'               // Société Civile Professionnelle
  | 'other';

export interface ApeActivity {
  code: string;
  label: string;
  isMain: boolean;
}

export interface SiretAlert {
  type: 'registration-changed' | 'address-changed' | 'status-changed' | 'activity-changed';
  message: string;
  detectedAt: string;
  previousValue?: string;
  newValue?: string;
}

export interface FrenchAddress {
  street: string;
  streetNumber: string;
  complement?: string;
  postalCode: string;
  city: string;
  country: 'FR';
}

// ============================================
// TVA (VAT)
// ============================================

export interface TvaRegistration {
  tvaNumber: string;               // FR + 2 check digits + SIREN (e.g. FR12345678901)
  isActive: boolean;
  registrationDate: string;
  lastVerified: string;

  // VIES Verification
  viesVerified: boolean;
  viesVerificationDate?: string;

  // Filing Requirements
  filingFrequency: 'monthly' | 'quarterly' | 'yearly';
  regime: TvaRegime;
  nextFilingDeadline: string;

  // Schemes
  franchiseBaseTva: boolean;       // Franchise en base de TVA (micro-entreprise exemption)
  tvaIntracommunautaire: boolean;  // Intra-community VAT registered
}

export type TvaRegime =
  | 'reel_normal'      // Régime réel normal (monthly/quarterly, CA > threshold)
  | 'reel_simplifie'   // Régime réel simplifié (annual + 2 instalments)
  | 'franchise'        // Franchise en base (below threshold, no TVA charged)
  | 'mini_reel';       // Mini-réel (simplified but monthly TVA)

export type TvaRate = 0 | 2.1 | 5.5 | 10 | 20;

export interface TvaRateRule {
  rate: TvaRate;
  description: string;
  applicableTo: string[];
  exceptions?: string[];
}

// Standard French TVA rates
export const TVA_RATES: TvaRateRule[] = [
  {
    rate: 20,
    description: 'Taux normal',
    applicableTo: ['Most goods and services', 'New construction', 'Materials'],
  },
  {
    rate: 10,
    description: 'Taux intermédiaire',
    applicableTo: ['Travaux de rénovation logements > 2 ans', 'Main-d\'oeuvre et fournitures (rénovation)'],
    exceptions: ['Gros oeuvre (fondations, murs porteurs) reste à 20%'],
  },
  {
    rate: 5.5,
    description: 'Taux réduit',
    applicableTo: ['Travaux d\'amélioration énergétique', 'Isolation thermique', 'Chaudière à condensation'],
  },
  {
    rate: 2.1,
    description: 'Taux super-réduit',
    applicableTo: ['Certaines publications', 'Médicaments remboursables'],
  },
  {
    rate: 0,
    description: 'Exonéré / Taux zéro',
    applicableTo: ['Livraisons intracommunautaires', 'Exportations hors UE'],
  },
];

export interface TvaPeriod {
  periodType: 'month' | 'quarter' | 'year';
  periodStart: string;
  periodEnd: string;
  filingDeadline: string;
  paymentDeadline: string;
  status: 'upcoming' | 'due' | 'filed' | 'paid' | 'overdue';
}

export interface TvaCalculation {
  // Outputs (Sales)
  salesExclTva20: number;
  salesExclTva10: number;
  salesExclTva55: number;
  tvaOwed20: number;
  tvaOwed10: number;
  tvaOwed55: number;
  totalTvaOwed: number;

  // Inputs (Purchases)
  purchasesExclTva: number;
  tvaPaid: number;

  // Balance
  tvaBalance: number;  // Positive = owe, Negative = credit

  // Intra-community
  icSales?: number;
  icPurchases?: number;
}

export interface TvaFiling {
  id: string;
  period: TvaPeriod;
  calculation: TvaCalculation;

  // Filing — CA3 (monthly) or CA12 (annual simplified)
  declarationType: 'CA3' | 'CA12' | 'CA12E';
  status: 'draft' | 'generated' | 'submitted' | 'confirmed';
  generatedAt?: string;
  submittedAt?: string;
  referenceNumber?: string;

  // Payment
  paymentStatus: 'pending' | 'paid' | 'credit-carried' | 'refund-requested' | 'refund-received';
  paidAt?: string;
  paymentReference?: string;

  // Audit Trail
  invoicesIncluded: string[];
  expensesIncluded: string[];
  manualAdjustments?: TvaAdjustment[];
}

export interface TvaAdjustment {
  description: string;
  amount: number;
  tvaRate: TvaRate;
  reason: 'correction' | 'private-use' | 'non-deductible' | 'regularisation' | 'other';
}

// ============================================
// CERTIFICATIONS & QUALIFICATIONS
// ============================================

export interface FrenchCertification {
  id: string;

  // Certification Details
  type: FrenchCertificationType;
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

export type FrenchCertificationType =
  // Quality labels
  | 'qualibat'          // Qualibat — qualification for construction companies
  | 'qualipac'          // QualiPAC — heat pump installations
  | 'qualisol'          // QualiSol — solar thermal installations
  | 'qualipv'           // QualiPV — photovoltaic installations
  | 'qualibois'         // QualiBois — wood-burning heating
  | 'qualifelec'        // Qualifelec — electrical trade qualification
  | 'qualigaz'          // Qualigaz — gas installations
  | 'rge'               // RGE — Reconnu Garant de l'Environnement

  // Safety
  | 'caces'             // CACES — equipment/machinery operation
  | 'habilitation_elec' // Habilitation électrique (NF C 18-510)
  | 'sst'               // Sauveteur Secouriste du Travail (first aid)
  | 'amiante_ss3'       // Amiante sous-section 3 (asbestos encapsulation)
  | 'amiante_ss4'       // Amiante sous-section 4 (asbestos proximity)

  // Refrigeration / HVAC
  | 'fluides_frigorigenes' // Attestation de capacité fluides frigorigènes

  // Business
  | 'iso_9001'          // Quality management
  | 'iso_14001'         // Environmental management
  | 'mase'              // MASE — safety management system
  | 'nf_habitat'        // NF Habitat certification

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

export interface FrenchInsurance {
  id: string;

  type: FrenchInsuranceType;
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

  // Attestation
  attestationUri?: string;    // Attestation d'assurance (required by law)

  // Contact
  claimPhone?: string;
  claimEmail?: string;

  // Document
  documentUri?: string;
}

export type FrenchInsuranceType =
  | 'rc_professionnelle'   // Responsabilité Civile Professionnelle (RC Pro)
  | 'decennale'            // Garantie Décennale (10-year structural guarantee — mandatory)
  | 'rc_exploitation'      // RC Exploitation (general liability during works)
  | 'dommages_ouvrage'     // Dommages-ouvrage (construction defect pre-financing)
  | 'multirisque_pro'      // Multirisque Professionnelle (business contents + premises)
  | 'protection_juridique'  // Protection Juridique (legal protection)
  | 'prevoyance'           // Prévoyance (disability/death)
  | 'vehicule_pro'         // Véhicule professionnel (fleet)
  | 'other';

// ============================================
// TRADES (ARTISAN MÉTIERS)
// ============================================

export type FrenchArtisanTrade =
  | 'plombier'
  | 'electricien'
  | 'chauffagiste'
  | 'climaticien'
  | 'peintre'
  | 'menuisier'
  | 'charpentier'
  | 'macon'
  | 'carreleur'
  | 'couvreur'
  | 'platrier_plaquiste'
  | 'serrurier'
  | 'vitrier'
  | 'ramoneur'
  | 'etancheiste'
  | 'terrassier'
  | 'demolisseur'
  | 'solier_moquettiste'
  | 'installateur_thermique'
  | 'installateur_sanitaire'
  | 'installateur_gaz'
  | 'installateur_electrique'
  | 'frigoriste'
  | 'ascensoriste'
  | 'metallier_soudeur'
  | 'paysagiste'
  | 'pisciniste'
  | 'domoticien'
  | 'diagnostiqueur_immobilier'
  | 'coordinateur_sps'
  | 'conducteur_travaux'
  | 'other';

// ============================================
// COMPLIANCE DASHBOARD
// ============================================

export interface FrenchComplianceDashboard {
  overallScore: number;  // 0-100
  status: 'compliant' | 'action-required' | 'critical';

  // SIRET
  siretStatus: 'verified' | 'needs-verification' | 'issues-found';
  siretLastVerified?: string;

  // TVA
  tvaStatus: 'up-to-date' | 'filing-due' | 'overdue';
  nextTvaDeadline?: string;
  tvaBalance?: number;

  // Certifications
  certificationsValid: number;
  certificationsExpiringSoon: number;
  certificationsExpired: number;

  // Insurance (Décennale is critical)
  insuranceActive: number;
  insuranceExpiringSoon: number;
  insuranceExpired: number;
  decennaleValid: boolean;       // Mandatory — always highlight

  // RGE status
  rgeActive: boolean;
  rgeExpiryDate?: string;

  // Alerts
  alerts: FrenchComplianceAlert[];

  // Upcoming
  upcomingDeadlines: FrenchComplianceDeadline[];
}

export interface FrenchComplianceAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  category: 'siret' | 'tva' | 'certification' | 'insurance' | 'rge' | 'other';
  title: string;
  message: string;
  actionRequired: boolean;
  actionLabel?: string;
  dueDate?: string;
  createdAt: string;
}

export interface FrenchComplianceDeadline {
  id: string;
  type: 'tva-filing' | 'tva-payment' | 'certification-renewal' | 'insurance-renewal' | 'siret-update' | 'rge-renewal';
  title: string;
  deadline: string;
  daysUntil: number;
  status: 'upcoming' | 'due-soon' | 'overdue';
  linkedEntityId?: string;
}

// ============================================
// INVOICE COMPLIANCE (French Requirements)
// ============================================

export interface FrenchInvoiceComplianceCheck {
  invoiceId: string;
  isCompliant: boolean;
  issues: FrenchInvoiceComplianceIssue[];
  checkedAt: string;
}

export interface FrenchInvoiceComplianceIssue {
  field: string;
  issue: 'missing' | 'invalid' | 'format-error';
  message: string;
  severity: 'error' | 'warning';
  legalReference?: string;
}

// Required fields for French invoices (Code de commerce + CGI)
export const FRENCH_INVOICE_REQUIREMENTS = [
  { field: 'invoiceNumber', required: true, description: 'Numéro de facture (séquentiel, sans rupture)' },
  { field: 'invoiceDate', required: true, description: 'Date d\'émission' },
  { field: 'sellerName', required: true, description: 'Dénomination sociale du vendeur' },
  { field: 'sellerAddress', required: true, description: 'Adresse du siège social' },
  { field: 'sellerSiret', required: true, description: 'Numéro SIRET' },
  { field: 'sellerRcs', required: true, description: 'Numéro RCS et ville du greffe' },
  { field: 'sellerTva', required: true, description: 'Numéro TVA intracommunautaire' },
  { field: 'buyerName', required: true, description: 'Nom ou dénomination sociale de l\'acheteur' },
  { field: 'buyerAddress', required: true, description: 'Adresse de l\'acheteur' },
  { field: 'description', required: true, description: 'Désignation des biens ou services rendus' },
  { field: 'quantity', required: true, description: 'Quantité' },
  { field: 'unitPrice', required: true, description: 'Prix unitaire HT' },
  { field: 'tvaRate', required: true, description: 'Taux de TVA applicable par ligne' },
  { field: 'tvaAmount', required: true, description: 'Montant de TVA' },
  { field: 'totalHt', required: true, description: 'Total HT' },
  { field: 'totalTtc', required: true, description: 'Total TTC' },
  { field: 'paymentTerms', required: true, description: 'Date d\'échéance et conditions de règlement' },
  { field: 'latePaymentPenalty', required: true, description: 'Taux de pénalités de retard' },
  { field: 'recoveryIndemnity', required: true, description: 'Indemnité forfaitaire de recouvrement (40€)' },
  { field: 'decennaleReference', required: false, description: 'Référence assurance décennale (si applicable)' },
];

// ============================================
// GDPR / RGPD COMPLIANCE
// ============================================

export interface RGPDConsent {
  type: 'marketing' | 'analytics' | 'data_processing' | 'third_party';
  granted: boolean;
  grantedAt?: string;
  expiresAt?: string;
}

export const FRENCH_RETENTION_PERIODS = {
  invoices: 10 * 365,       // 10 years (Code de commerce L123-22)
  contracts: 10 * 365,
  employeeRecords: 5 * 365, // 5 years after end of contract
  customerData: 3 * 365,    // 3 years after last contact (CNIL recommendation)
  websiteAnalytics: 13 * 30, // 13 months (CNIL)
};


// ---------------------------------------------------------------------------
// Government Portals
// ---------------------------------------------------------------------------

export const FRENCH_GOVERNMENT_PORTALS = {
  urssaf: { name: 'URSSAF', url: 'https://www.urssaf.fr', description: 'Cotisations sociales et auto-entrepreneur' },
  impots: { name: 'Impots.gouv', url: 'https://www.impots.gouv.fr', description: 'Déclarations TVA et impôts' },
  chambreMetiers: { name: 'Chambre des Métiers', url: 'https://www.artisanat.fr', description: 'Immatriculation et formation artisan' },
  chorusPro: { name: 'Chorus Pro', url: 'https://chorus-pro.gouv.fr', description: 'Facturation électronique B2G' },
  infogreffe: { name: 'Infogreffe', url: 'https://www.infogreffe.fr', description: 'Registre du commerce et Kbis' },
  qualibat: { name: 'Qualibat', url: 'https://www.qualibat.com', description: 'Certifications et qualifications BTP' },
} as const;
