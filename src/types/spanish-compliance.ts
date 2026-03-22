// =============================================================================
// SPANISH COMPLIANCE - Types
// =============================================================================
// Spain-specific compliance automation: IVA, NIF/CIF, certifications
// a16z Sphere pattern: "Compliance as executable workflow logic"
// =============================================================================

// ============================================
// NIF / CIF / REGISTRO MERCANTIL
// ============================================

export interface NifRegistration {
  nifCif: string;             // NIF (personas físicas) or CIF (sociedades)
  businessName: string;
  tradeName?: string;
  legalForm: SpanishLegalForm;

  // Address
  address: SpanishAddress;

  // Status
  status: 'active' | 'inactive' | 'dissolved' | 'unknown';
  registrationDate: string;
  lastVerified: string;

  // Activity
  iaeCode: string;             // Impuesto de Actividades Económicas
  iaeDescription: string;
  cnaeCode?: string;           // CNAE (Clasificación Nacional de Actividades Económicas)
  secondaryActivities?: IaeActivity[];

  // Autonomo / Empresa
  altaAutonomos: boolean;       // Alta en el RETA (Régimen Especial de Trabajadores Autónomos)
  altaAutonomosDate?: string;
  registroMercantilNumber?: string;

  // Flags
  verificationStatus: 'verified' | 'pending' | 'failed' | 'stale';
  alerts?: NifAlert[];
}

export type SpanishLegalForm =
  | 'autonomo'              // Autónomo (self-employed)
  | 'sl'                    // Sociedad Limitada (S.L.)
  | 'slne'                  // Sociedad Limitada Nueva Empresa
  | 'sa'                    // Sociedad Anónima (S.A.)
  | 'sc'                    // Sociedad Civil
  | 'cb'                    // Comunidad de Bienes
  | 'cooperativa'           // Cooperativa
  | 'sll'                   // Sociedad Limitada Laboral
  | 'other';

export interface IaeActivity {
  code: string;
  description: string;
  isMain: boolean;
}

export interface NifAlert {
  type: 'registration-changed' | 'address-changed' | 'status-changed' | 'activity-changed';
  message: string;
  detectedAt: string;
  previousValue?: string;
  newValue?: string;
}

export interface SpanishAddress {
  street: string;
  streetNumber: string;
  floor?: string;
  door?: string;
  postalCode: string;
  city: string;
  province: string;
  country: 'ES';
}

// ============================================
// IVA (VAT)
// ============================================

export interface IvaRegistration {
  nifIva: string;               // ES + NIF (e.g. ESB12345678)
  isActive: boolean;
  registrationDate: string;
  lastVerified: string;

  // VIES Verification
  viesVerified: boolean;
  viesVerificationDate?: string;

  // Filing Requirements
  filingFrequency: 'monthly' | 'quarterly';
  regime: IvaRegime;
  nextFilingDeadline: string;

  // Schemes
  recargoEquivalencia: boolean;  // Recargo de equivalencia (retail surcharge)
  regimenSimplificado: boolean;  // Régimen simplificado
}

export type IvaRegime =
  | 'general'             // Régimen general
  | 'simplificado'        // Régimen simplificado (estimated IVA)
  | 'recargo'             // Recargo de equivalencia
  | 'criterio_caja'       // Criterio de caja (cash basis)
  | 'exento';             // Exempt

export type IvaRate = 0 | 4 | 10 | 21;

export interface IvaRateRule {
  rate: IvaRate;
  description: string;
  applicableTo: string[];
  exceptions?: string[];
}

// Standard Spanish IVA rates
export const IVA_RATES: IvaRateRule[] = [
  {
    rate: 21,
    description: 'Tipo general',
    applicableTo: ['Most goods and services', 'Construction materials', 'Professional services'],
  },
  {
    rate: 10,
    description: 'Tipo reducido',
    applicableTo: ['Obras de renovación de viviendas (uso particular)', 'Ejecuciones de obra (vivienda nueva)'],
    exceptions: ['Materiales con IVA propio si se facturan por separado'],
  },
  {
    rate: 4,
    description: 'Tipo superreducido',
    applicableTo: ['Pan, leche, huevos, frutas', 'Libros, periódicos', 'Medicamentos de uso humano'],
  },
  {
    rate: 0,
    description: 'Exento / Tipo cero',
    applicableTo: ['Entregas intracomunitarias', 'Exportaciones fuera de la UE'],
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
  salesExclIva21: number;
  salesExclIva10: number;
  salesExclIva4: number;
  ivaOwed21: number;
  ivaOwed10: number;
  ivaOwed4: number;
  totalIvaOwed: number;

  // Inputs (Purchases)
  purchasesExclIva: number;
  ivaPaid: number;

  // Balance
  ivaBalance: number;  // Positive = owe, Negative = refund

  // Intra-community
  icSales?: number;
  icPurchases?: number;

  // Recargo de equivalencia (if applicable)
  recargoAmount?: number;
}

export interface IvaFiling {
  id: string;
  period: IvaPeriod;
  calculation: IvaCalculation;

  // Filing — Modelo 303 (quarterly/monthly) or Modelo 390 (annual summary)
  modeloType: '303' | '390' | '349';
  status: 'draft' | 'generated' | 'submitted' | 'confirmed';
  generatedAt?: string;
  submittedAt?: string;
  referenceNumber?: string;

  // Payment
  paymentStatus: 'pending' | 'paid' | 'compensated' | 'refund-requested' | 'refund-received';
  paidAt?: string;
  paymentReference?: string;

  // Audit Trail
  invoicesIncluded: string[];
  expensesIncluded: string[];
  manualAdjustments?: IvaAdjustment[];
}

export interface IvaAdjustment {
  description: string;
  amount: number;
  ivaRate: IvaRate;
  reason: 'correction' | 'private-use' | 'non-deductible' | 'regularisation' | 'other';
}

// ============================================
// CERTIFICATIONS & LICENSES
// ============================================

export interface SpanishCertification {
  id: string;

  // Certification Details
  type: SpanishCertificationType;
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

export type SpanishCertificationType =
  // Installer authorizations
  | 'instalador_autorizado_bt'   // Instalador autorizado de baja tensión (categoría básica/especialista)
  | 'instalador_autorizado_at'   // Instalador autorizado de alta tensión
  | 'instalador_gas'             // Instalador de gas (categorías A, B, C)
  | 'instalador_climatizacion'   // Instalador de climatización
  | 'rite'                       // RITE — Reglamento de Instalaciones Térmicas en Edificios
  | 'instalador_fontaneria'      // Instalador de fontanería / fontanero autorizado

  // Safety
  | 'prl_basico'                 // PRL Básico (20h) — Prevención de Riesgos Laborales
  | 'prl_oficio'                 // PRL por oficio (20h specific trade)
  | 'recurso_preventivo'         // Recurso Preventivo (60h)
  | 'coordinador_seguridad'      // Coordinador de Seguridad y Salud
  | 'tpc'                        // Tarjeta Profesional de la Construcción

  // Refrigeration
  | 'gases_fluorados'            // Certificado manipulación gases fluorados

  // Construction qualifications
  | 'certificado_profesionalidad' // Certificado de profesionalidad (official trade qualification)
  | 'titulo_fp'                  // Título de Formación Profesional

  // Business / Quality
  | 'iso_9001'                   // Quality management
  | 'iso_14001'                  // Environmental management
  | 'clasificacion_contratista'  // Clasificación de contratista (public works)

  // Energy
  | 'certificacion_energetica'   // Certificación de eficiencia energética
  | 'instalador_ree'             // Instalador de energías renovables

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

export interface SpanishInsurance {
  id: string;

  type: SpanishInsuranceType;
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

export type SpanishInsuranceType =
  | 'rc_profesional'           // Seguro de Responsabilidad Civil Profesional
  | 'rc_explotacion'           // Seguro de RC de Explotación
  | 'seguro_decenal'           // Seguro Decenal (10-year structural — required for residential)
  | 'accidentes_convenio'      // Seguro de Accidentes de Convenio
  | 'accidentes_autonomo'      // Seguro de Accidentes para Autónomos
  | 'multirriesgo'             // Seguro Multirriesgo (premises + contents)
  | 'vehiculo'                 // Seguro de Vehículos
  | 'defensa_juridica'         // Defensa Jurídica
  | 'other';

// ============================================
// TRADES (OFICIOS DE CONSTRUCCIÓN)
// ============================================

export type SpanishConstructionTrade =
  | 'fontanero'
  | 'electricista'
  | 'instalador_gas'
  | 'climatizador'
  | 'pintor'
  | 'carpintero'
  | 'albanil'
  | 'alicatador'
  | 'tejador'
  | 'yesista'
  | 'escayolista'
  | 'cerrajero'
  | 'vidriero'
  | 'solador'
  | 'ferrallista'
  | 'encofrador'
  | 'gruista'
  | 'operador_maquinaria'
  | 'impermeabilizador'
  | 'instalador_ascensores'
  | 'instalador_telecomunicaciones'
  | 'instalador_energias_renovables'
  | 'jardinero_paisajista'
  | 'pocero'
  | 'jefe_obra'
  | 'aparejador'
  | 'other';

// ============================================
// COMPLIANCE DASHBOARD
// ============================================

export interface SpanishComplianceDashboard {
  overallScore: number;  // 0-100
  status: 'compliant' | 'action-required' | 'critical';

  // NIF
  nifStatus: 'verified' | 'needs-verification' | 'issues-found';
  nifLastVerified?: string;

  // IVA
  ivaStatus: 'up-to-date' | 'filing-due' | 'overdue';
  nextIvaDeadline?: string;
  ivaBalance?: number;

  // Autónomo
  altaAutonomosActive: boolean;
  cuotaAutonomos?: number;       // Monthly RETA contribution

  // Certifications
  certificationsValid: number;
  certificationsExpiringSoon: number;
  certificationsExpired: number;

  // Insurance
  insuranceActive: number;
  insuranceExpiringSoon: number;
  insuranceExpired: number;

  // TPC (Tarjeta Profesional de la Construcción)
  tpcValid: boolean;
  tpcExpiryDate?: string;

  // Alerts
  alerts: SpanishComplianceAlert[];

  // Upcoming
  upcomingDeadlines: SpanishComplianceDeadline[];
}

export interface SpanishComplianceAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  category: 'nif' | 'iva' | 'certification' | 'insurance' | 'autonomo' | 'other';
  title: string;
  message: string;
  actionRequired: boolean;
  actionLabel?: string;
  dueDate?: string;
  createdAt: string;
}

export interface SpanishComplianceDeadline {
  id: string;
  type: 'iva-filing' | 'iva-payment' | 'certification-renewal' | 'insurance-renewal' | 'nif-update' | 'autonomo-quota';
  title: string;
  deadline: string;
  daysUntil: number;
  status: 'upcoming' | 'due-soon' | 'overdue';
  linkedEntityId?: string;
}

// ============================================
// INVOICE COMPLIANCE (Spanish Requirements)
// ============================================

export interface SpanishInvoiceComplianceCheck {
  invoiceId: string;
  isCompliant: boolean;
  issues: SpanishInvoiceComplianceIssue[];
  checkedAt: string;
}

export interface SpanishInvoiceComplianceIssue {
  field: string;
  issue: 'missing' | 'invalid' | 'format-error';
  message: string;
  severity: 'error' | 'warning';
  legalReference?: string;
}

// Required fields for Spanish invoices (Reglamento de facturación RD 1619/2012)
export const SPANISH_INVOICE_REQUIREMENTS = [
  { field: 'invoiceNumber', required: true, description: 'Número de factura (serie + número secuencial)' },
  { field: 'invoiceDate', required: true, description: 'Fecha de expedición' },
  { field: 'sellerName', required: true, description: 'Nombre y apellidos o razón social del emisor' },
  { field: 'sellerNif', required: true, description: 'NIF del emisor' },
  { field: 'sellerAddress', required: true, description: 'Domicilio del emisor' },
  { field: 'buyerName', required: true, description: 'Nombre y apellidos o razón social del destinatario' },
  { field: 'buyerNif', required: true, description: 'NIF del destinatario' },
  { field: 'buyerAddress', required: true, description: 'Domicilio del destinatario' },
  { field: 'description', required: true, description: 'Descripción de las operaciones (bienes o servicios)' },
  { field: 'ivaRate', required: true, description: 'Tipo impositivo de IVA aplicado' },
  { field: 'baseImponible', required: true, description: 'Base imponible (importe antes de IVA)' },
  { field: 'cuotaIva', required: true, description: 'Cuota de IVA' },
  { field: 'totalAmount', required: true, description: 'Importe total de la factura' },
  { field: 'retencionIrpf', required: false, description: 'Retención de IRPF (si aplica)' },
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

export const SPANISH_RETENTION_PERIODS = {
  invoices: 6 * 365,        // 6 years (Código de Comercio art. 30)
  taxRecords: 4 * 365,      // 4 years (Ley General Tributaria)
  contracts: 6 * 365,
  employeeRecords: 4 * 365, // 4 years after end of employment
  customerData: 3 * 365,    // 3 years after last contact (AEPD recommendation)
  websiteAnalytics: 365,    // 1 year
};


// ---------------------------------------------------------------------------
// Government Portals
// ---------------------------------------------------------------------------

export const SPANISH_GOVERNMENT_PORTALS = {
  aeat: { name: 'Agencia Tributaria', url: 'https://www.agenciatributaria.gob.es', description: 'IVA, IRPF, Modelo 303/390' },
  tesoreria: { name: 'Tesorería General', url: 'https://www.seg-social.es', description: 'Seguridad Social y cotizaciones' },
  camaraComercio: { name: 'Cámara de Comercio', url: 'https://www.camara.es', description: 'Registro y trámites empresariales' },
  sepe: { name: 'SEPE', url: 'https://www.sepe.es', description: 'Empleo y prestaciones' },
  registroMercantil: { name: 'Registro Mercantil', url: 'https://www.registromercantil.es', description: 'Registro de sociedades' },
  mitma: { name: 'MITMA', url: 'https://www.mitma.gob.es', description: 'Ministerio de Transportes y licencias de obra' },
} as const;
