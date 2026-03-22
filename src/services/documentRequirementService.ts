// =============================================================================
// DOCUMENT REQUIREMENT SERVICE
// =============================================================================
// Maps job types/trades to required documents, tracks completion
// =============================================================================

import { useState, useEffect, useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type DocCategory = 'certification' | 'permit' | 'safety' | 'insurance' | 'photo' | 'report' | 'contract';

export interface DocumentRequirement {
  id: string;
  name: string;
  category: DocCategory;
  description: string;
  required: boolean;
  trades: string[]; // Which trades need this
  jobTypes: string[]; // Which job types need this
  validityPeriod?: number; // Days before expiry
}

export interface JobDocumentStatus {
  requirement: DocumentRequirement;
  status: 'missing' | 'uploaded' | 'expired' | 'expiring_soon';
  documentId?: string;
  expiryDate?: Date;
}

// =============================================================================
// REQUIREMENT DEFINITIONS
// =============================================================================

const REQUIREMENTS: DocumentRequirement[] = [
  // Certifications
  { id: 'dr-1', name: 'VCA Certificaat', category: 'certification', description: 'Veiligheid Checklist Aannemers — basis veiligheidscertificering', required: true, trades: ['*'], jobTypes: ['*'], validityPeriod: 3650 },
  { id: 'dr-2', name: 'F-gassen Certificaat', category: 'certification', description: 'Vereist voor werkzaamheden met koelmiddelen', required: true, trades: ['hvac', 'airco', 'warmtepomp'], jobTypes: ['airco', 'warmtepomp', 'koeling'] },
  { id: 'dr-3', name: 'NEN 1010 Bevoegdheid', category: 'certification', description: 'Elektrotechnische installaties norm', required: true, trades: ['elektra', 'electrical'], jobTypes: ['elektra', 'warmtepomp'] },
  { id: 'dr-4', name: 'STEK Registratie', category: 'certification', description: 'Stichting Emissiepreventie Koudetechniek', required: true, trades: ['hvac', 'airco'], jobTypes: ['airco', 'koeling'] },

  // Permits
  { id: 'dr-5', name: 'Omgevingsvergunning', category: 'permit', description: 'Vereist bij bouw/verbouw buiten bestaande constructie', required: false, trades: ['*'], jobTypes: ['nieuwbouw', 'verbouw', 'aanbouw'] },
  { id: 'dr-6', name: 'Sloopmelding', category: 'permit', description: 'Verplicht bij sloopwerk > 10m³ of asbesthoudend', required: false, trades: ['*'], jobTypes: ['sloop', 'verbouw'] },

  // Safety
  { id: 'dr-7', name: 'Risico Inventarisatie (RI&E)', category: 'safety', description: 'Verplicht voor werkgevers', required: false, trades: ['*'], jobTypes: ['*'] },
  { id: 'dr-8', name: 'Werkvergunning', category: 'safety', description: 'Vereist bij werken op hoogte, in besloten ruimten of met vuur', required: false, trades: ['*'], jobTypes: ['hoogte', 'besloten_ruimte'] },
  { id: 'dr-9', name: 'Toolbox Meeting Verslag', category: 'safety', description: 'Veiligheidsoverleg voor aanvang werkzaamheden', required: false, trades: ['*'], jobTypes: ['*'] },

  // Insurance
  { id: 'dr-10', name: 'Aansprakelijkheidsverzekering', category: 'insurance', description: 'Bedrijfsaansprakelijkheidsverzekering (AVB)', required: true, trades: ['*'], jobTypes: ['*'], validityPeriod: 365 },
  { id: 'dr-11', name: 'CAR-verzekering', category: 'insurance', description: 'Construction All Risks — voor grotere projecten', required: false, trades: ['*'], jobTypes: ['nieuwbouw', 'verbouw'] },

  // Photos & Reports
  { id: 'dr-12', name: 'Foto\'s voor aanvang', category: 'photo', description: 'Vastlegging bestaande situatie', required: true, trades: ['*'], jobTypes: ['*'] },
  { id: 'dr-13', name: 'Foto\'s na oplevering', category: 'photo', description: 'Vastlegging eindresultaat', required: true, trades: ['*'], jobTypes: ['*'] },
  { id: 'dr-14', name: 'Opleverrapport', category: 'report', description: 'Ondertekend opleverdocument', required: false, trades: ['*'], jobTypes: ['*'] },
  { id: 'dr-15', name: 'Rookgasanalyse Rapport', category: 'report', description: 'Verplicht na CV-ketel installatie/onderhoud', required: true, trades: ['hvac', 'cv'], jobTypes: ['cv-onderhoud', 'cv-installatie'] },

  // Contract
  { id: 'dr-16', name: 'Getekende offerte', category: 'contract', description: 'Door klant ondertekende offerte/overeenkomst', required: true, trades: ['*'], jobTypes: ['*'] },
];

// =============================================================================
// SERVICE
// =============================================================================

export function getRequirementsForJob(trade?: string, jobType?: string): DocumentRequirement[] {
  return REQUIREMENTS.filter(req => {
    const tradeMatch = req.trades.includes('*') || (trade && req.trades.includes(trade.toLowerCase()));
    const typeMatch = req.jobTypes.includes('*') || (jobType && req.jobTypes.includes(jobType.toLowerCase()));
    return tradeMatch || typeMatch;
  });
}

export function getRequiredForJob(trade?: string, jobType?: string): DocumentRequirement[] {
  return getRequirementsForJob(trade, jobType).filter(r => r.required);
}

export function getMissingDocuments(
  trade?: string,
  jobType?: string,
  uploadedDocIds: string[] = [],
): DocumentRequirement[] {
  return getRequiredForJob(trade, jobType).filter(r => !uploadedDocIds.includes(r.id));
}

export function getDocumentCompleteness(
  trade?: string,
  jobType?: string,
  uploadedDocIds: string[] = [],
): { total: number; completed: number; missing: number; percentage: number } {
  const required = getRequiredForJob(trade, jobType);
  const completed = required.filter(r => uploadedDocIds.includes(r.id)).length;
  const missing = required.length - completed;
  return {
    total: required.length,
    completed,
    missing,
    percentage: required.length > 0 ? Math.round((completed / required.length) * 100) : 100,
  };
}

// =============================================================================
// HOOKS
// =============================================================================

export function useDocumentRequirements(trade?: string, jobType?: string) {
  const requirements = useMemo(() => getRequirementsForJob(trade, jobType), [trade, jobType]);
  const required = useMemo(() => requirements.filter(r => r.required), [requirements]);
  const optional = useMemo(() => requirements.filter(r => !r.required), [requirements]);

  return { requirements, required, optional };
}

export function useDocumentCompleteness(trade?: string, jobType?: string, uploadedDocIds: string[] = []) {
  return useMemo(() => getDocumentCompleteness(trade, jobType, uploadedDocIds), [trade, jobType, uploadedDocIds]);
}

export const CATEGORY_CONFIG: Record<DocCategory, { label: string; icon: string; color: string }> = {
  certification: { label: 'Certificering', icon: 'ribbon-outline', color: '#8B5CF6' },
  permit: { label: 'Vergunning', icon: 'document-text-outline', color: '#3B82F6' },
  safety: { label: 'Veiligheid', icon: 'shield-outline', color: '#F59E0B' },
  insurance: { label: 'Verzekering', icon: 'umbrella-outline', color: '#10B981' },
  photo: { label: 'Foto', icon: 'camera-outline', color: '#EC4899' },
  report: { label: 'Rapport', icon: 'clipboard-outline', color: '#6366F1' },
  contract: { label: 'Contract', icon: 'create-outline', color: '#14B8A6' },
};
