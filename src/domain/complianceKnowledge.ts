export type CountryCode = 'UK' | 'NL' | 'DE' | 'FR' | 'ES' | 'IT';

export type LanguageCode = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

export type LocalizedText = Partial<Record<LanguageCode, string>>;

export type RoleScope = 'contractor';

export type ProjectScope = 'new_build' | 'renovation' | 'maintenance' | 'all';

export type RequirementLevel = 'mandatory' | 'recommended' | 'optional';

export interface ComplianceKnowledgeBase {
  version: string;
  countries: CountryCompliance[];
}

export interface CountryCompliance {
  country: CountryCode;
  trades: TradeCompliance[];
  registryChecks: RegistryCheck[];
}

export interface TradeCompliance {
  tradeId: string;
  tradeLabel: string;
  tradeLabelLocalizations?: LocalizedText;
  projectScope: ProjectScope;
  requirements: ComplianceRequirement[];
  evidence: EvidenceItem[];
  checklists: ChecklistItem[];
}

export interface ComplianceRequirement {
  id: string;
  title: string;
  titleLocalizations?: LocalizedText;
  description: string;
  descriptionLocalizations?: LocalizedText;
  level: RequirementLevel;
  roleScope: RoleScope;
  applicabilityNotes?: string;
  applicabilityNotesLocalizations?: LocalizedText;
}

export interface EvidenceItem {
  id: string;
  label: string;
  labelLocalizations?: LocalizedText;
  description?: string;
  descriptionLocalizations?: LocalizedText;
  required: boolean;
  acceptableFormats?: string[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  labelLocalizations?: LocalizedText;
  required: boolean;
  helpText?: string;
  helpTextLocalizations?: LocalizedText;
}

export interface RegistryCheck {
  id: string;
  label: string;
  labelLocalizations?: LocalizedText;
  description: string;
  descriptionLocalizations?: LocalizedText;
  inputs: RegistryInput[];
  outputs: RegistryOutput[];
}

export interface RegistryInput {
  key: string;
  label: string;
  labelLocalizations?: LocalizedText;
  required: boolean;
}

export interface RegistryOutput {
  key: string;
  label: string;
  labelLocalizations?: LocalizedText;
  required: boolean;
}
