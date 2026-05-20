import { BusinessProfile } from '../domain/business';

// Default/empty seed — used for fresh accounts.
export const businessProfile: BusinessProfile = {
  isComplete: false,
  completenessPercent: 60,
};

// R78 US foundation: seed business profile for contractor@vasco.us.dev so
// the demo flow renders realistic US invoices (EIN, TX address, ACH bank
// details, sales-tax-eligible). Triggers when getCurrentCountry() returns
// 'US' on user-change.
export const US_BUSINESS_PROFILE: BusinessProfile = {
  isComplete: true,
  completenessPercent: 100,
  businessName: "Reynolds Heating & Cooling",
  email: "mike@reynoldshvac.com",
  phone: "+1 512 555 0142",
  address: "2847 Burnet Road, Austin, TX 78757",
  city: "Austin",
  postcode: "78757",
  website: "https://reynoldshvac.com",
  country: 'US',
  state: 'TX',
  trade: "gas-hvac",
  businessType: "llc",
  teamSize: 'small',
  vatScheme: 'standard', // US has no VAT — 'standard' is the no-op default
  // Federal EIN format XX-XXXXXXX
  registrationNumber: "75-1234567",
  // R74: ACH bank details (US analogue of IBAN/BIC)
  routingNumber: "111000025", // Bank of America Texas routing
  bankAccountNumber: "1234567890123",
  invoicePrefix: "INV",
  quotePrefix: "EST",
  defaultPaymentTerms: 14,
  serviceAreaRadius: 30,
  certifications: [
    "EPA 608 (HVAC)",
    "NATE (HVAC)",
    "OSHA 30",
    "State Contractor License — TX TACLA85432C",
  ],
  enabledPaymentMethods: ['credit_card', 'apple_pay'],
};
