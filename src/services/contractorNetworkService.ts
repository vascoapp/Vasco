// =============================================================================
// CONTRACTOR NETWORK SERVICE
// =============================================================================
// Manages contractor network, referrals, and collaboration
// Network effects increase platform value as more contractors join
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';

// ============================================
// TYPES
// ============================================

export interface ContractorProfile {
  id: string;
  name: string;
  companyName?: string;
  avatar?: string;

  // Skills & Specialization
  primarySkill: string;
  skills: string[];
  certifications: string[];
  yearsExperience: number;

  // Location
  city: string;
  region: string;
  serviceRadius: number; // km

  // Ratings & Stats
  rating: number;
  reviewCount: number;
  completedJobs: number;
  referralScore: number; // How reliable for referrals
  responseTime: number; // avg hours to respond

  // Network
  connections: number;
  referralsGiven: number;
  referralsReceived: number;

  // Preferences
  acceptsReferrals: boolean;
  preferredJobTypes: string[];
  minJobValue?: number;
  maxJobValue?: number;

  // Status
  availability: 'available' | 'busy' | 'unavailable';
  nextAvailableDate?: string;
  verified: boolean;
  premiumMember: boolean;
}

export interface Referral {
  id: string;

  // Parties
  fromContractorId: string;
  fromContractorName: string;
  toContractorId: string;
  toContractorName: string;

  // Job details
  customerName: string;
  customerContact?: string;
  jobType: string;
  jobDescription: string;
  estimatedValue: number;
  location: string;

  // Status
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'expired';
  createdAt: string;
  respondedAt?: string;
  completedAt?: string;
  expiresAt: string;

  // Outcome
  actualValue?: number;
  commission?: number;
  commissionPaid: boolean;

  // Feedback
  senderRating?: number;
  senderFeedback?: string;
  receiverRating?: number;
  receiverFeedback?: string;
}

export interface ConnectionRequest {
  id: string;
  fromContractorId: string;
  fromContractorName: string;
  toContractorId: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface NetworkStats {
  totalContractors: number;
  totalReferrals: number;
  totalValueReferred: number;
  avgCommissionRate: number;
  topSkills: Array<{ skill: string; count: number }>;
  topRegions: Array<{ region: string; count: number }>;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_CONTRACTORS: ContractorProfile[] = [
  {
    id: 'contractor_1',
    name: 'Jan van der Berg',
    companyName: 'Van der Berg Installaties',
    primarySkill: 'Loodgieter',
    skills: ['Loodgieter', 'CV-monteur', 'Sanitair'],
    certifications: ['UNETO-VNI', 'Erkend Installateur'],
    yearsExperience: 15,
    city: 'Amsterdam',
    region: 'Noord-Holland',
    serviceRadius: 30,
    rating: 4.8,
    reviewCount: 127,
    completedJobs: 342,
    referralScore: 92,
    responseTime: 2,
    connections: 24,
    referralsGiven: 18,
    referralsReceived: 31,
    acceptsReferrals: true,
    preferredJobTypes: ['Badkamer renovatie', 'CV installatie', 'Lekkage'],
    minJobValue: 500,
    availability: 'available',
    verified: true,
    premiumMember: true,
  },
  {
    id: 'contractor_2',
    name: 'Pieter de Groot',
    companyName: 'De Groot Elektra',
    primarySkill: 'Elektricien',
    skills: ['Elektricien', 'Domotica', 'Zonnepanelen'],
    certifications: ['NEN 1010', 'Erkend Installateur'],
    yearsExperience: 12,
    city: 'Haarlem',
    region: 'Noord-Holland',
    serviceRadius: 25,
    rating: 4.9,
    reviewCount: 89,
    completedJobs: 256,
    referralScore: 88,
    responseTime: 3,
    connections: 19,
    referralsGiven: 12,
    referralsReceived: 22,
    acceptsReferrals: true,
    preferredJobTypes: ['Volledige installatie', 'Domotica', 'Storingen'],
    availability: 'available',
    verified: true,
    premiumMember: false,
  },
  {
    id: 'contractor_3',
    name: 'Mohammed El Amrani',
    companyName: 'El Amrani Stukadoors',
    primarySkill: 'Stukadoor',
    skills: ['Stukadoor', 'Sierpleister', 'Wanden'],
    certifications: ['NOA Vakdiploma'],
    yearsExperience: 8,
    city: 'Utrecht',
    region: 'Utrecht',
    serviceRadius: 40,
    rating: 4.7,
    reviewCount: 64,
    completedJobs: 178,
    referralScore: 85,
    responseTime: 4,
    connections: 15,
    referralsGiven: 8,
    referralsReceived: 14,
    acceptsReferrals: true,
    preferredJobTypes: ['Nieuwbouw', 'Renovatie', 'Sierpleister'],
    minJobValue: 1000,
    availability: 'busy',
    nextAvailableDate: '2025-02-15',
    verified: true,
    premiumMember: false,
  },
  {
    id: 'contractor_4',
    name: 'Lisa Jansen',
    companyName: 'Jansen Schilderwerken',
    primarySkill: 'Schilder',
    skills: ['Schilder', 'Behanger', 'Lakwerk'],
    certifications: ['Erkend Schildersbedrijf'],
    yearsExperience: 10,
    city: 'Amsterdam',
    region: 'Noord-Holland',
    serviceRadius: 20,
    rating: 4.9,
    reviewCount: 156,
    completedJobs: 423,
    referralScore: 95,
    responseTime: 1,
    connections: 31,
    referralsGiven: 27,
    referralsReceived: 45,
    acceptsReferrals: true,
    preferredJobTypes: ['Binnen schilderwerk', 'Buiten schilderwerk', 'Lakwerk'],
    availability: 'available',
    verified: true,
    premiumMember: true,
  },
  {
    id: 'contractor_5',
    name: 'Kees Bakker',
    companyName: 'Bakker Tegelzetters',
    primarySkill: 'Tegelzetter',
    skills: ['Tegelzetter', 'Natuursteen', 'Badkamers'],
    certifications: ['NOA Vakdiploma'],
    yearsExperience: 20,
    city: 'Den Haag',
    region: 'Zuid-Holland',
    serviceRadius: 35,
    rating: 4.6,
    reviewCount: 98,
    completedJobs: 312,
    referralScore: 82,
    responseTime: 6,
    connections: 12,
    referralsGiven: 5,
    referralsReceived: 19,
    acceptsReferrals: true,
    preferredJobTypes: ['Badkamer', 'Keuken', 'Vloeren'],
    availability: 'available',
    verified: true,
    premiumMember: false,
  },
];

const MOCK_REFERRALS: Referral[] = [
  {
    id: 'ref_1',
    fromContractorId: 'me',
    fromContractorName: 'Jij',
    toContractorId: 'contractor_1',
    toContractorName: 'Jan van der Berg',
    customerName: 'Familie Smit',
    jobType: 'Badkamer renovatie',
    jobDescription: 'Complete badkamerrenovatie inclusief sanitair en tegels',
    estimatedValue: 8500,
    location: 'Amsterdam',
    status: 'completed',
    createdAt: '2025-01-10',
    respondedAt: '2025-01-10',
    completedAt: '2025-01-28',
    expiresAt: '2025-01-17',
    actualValue: 9200,
    commission: 460,
    commissionPaid: true,
    senderRating: 5,
    senderFeedback: 'Top vakman, klant zeer tevreden!',
    receiverRating: 5,
    receiverFeedback: 'Bedankt voor de goede lead!',
  },
  {
    id: 'ref_2',
    fromContractorId: 'contractor_4',
    fromContractorName: 'Lisa Jansen',
    toContractorId: 'me',
    toContractorName: 'Jij',
    customerName: 'Bakkerij Jansen',
    jobType: 'Binnen schilderwerk',
    jobDescription: 'Schilderen van kantoor en opslagruimte',
    estimatedValue: 3500,
    location: 'Haarlem',
    status: 'pending',
    createdAt: '2025-01-30',
    expiresAt: '2025-02-06',
    commissionPaid: false,
  },
  {
    id: 'ref_3',
    fromContractorId: 'me',
    fromContractorName: 'Jij',
    toContractorId: 'contractor_2',
    toContractorName: 'Pieter de Groot',
    customerName: 'Peter van Dijk',
    jobType: 'Elektrische installatie',
    jobDescription: 'Groepenkast vervangen en extra stopcontacten',
    estimatedValue: 2200,
    location: 'Amstelveen',
    status: 'accepted',
    createdAt: '2025-01-25',
    respondedAt: '2025-01-25',
    expiresAt: '2025-02-01',
    commissionPaid: false,
  },
];

const MOCK_CONNECTION_REQUESTS: ConnectionRequest[] = [
  {
    id: 'conn_1',
    fromContractorId: 'contractor_3',
    fromContractorName: 'Mohammed El Amrani',
    toContractorId: 'me',
    message: 'Hallo! Ik werk veel in Utrecht en omgeving. Zou graag samenwerken voor projecten.',
    status: 'pending',
    createdAt: '2025-01-29',
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class ContractorNetworkService {
  private contractors: Map<string, ContractorProfile> = new Map();
  private referrals: Map<string, Referral> = new Map();
  private connectionRequests: Map<string, ConnectionRequest> = new Map();
  private myConnections: Set<string> = new Set(['contractor_1', 'contractor_4']);
  private listeners: Set<() => void> = new Set();

  constructor() {
    MOCK_CONTRACTORS.forEach((c) => this.contractors.set(c.id, c));
    MOCK_REFERRALS.forEach((r) => this.referrals.set(r.id, r));
    MOCK_CONNECTION_REQUESTS.forEach((c) => this.connectionRequests.set(c.id, c));
  }

  // -----------------------------------------
  // Contractor Discovery
  // -----------------------------------------

  /**
   * Search contractors by skill, location, or name
   */
  searchContractors(params: {
    query?: string;
    skill?: string;
    region?: string;
    available?: boolean;
    verified?: boolean;
  }): ContractorProfile[] {
    let results = Array.from(this.contractors.values());

    if (params.query) {
      const q = params.query.toLowerCase();
      results = results.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.companyName?.toLowerCase().includes(q) ||
          c.skills.some((s) => s.toLowerCase().includes(q))
      );
    }
    if (params.skill) {
      results = results.filter((c) =>
        c.skills.some((s) => s.toLowerCase() === params.skill?.toLowerCase())
      );
    }
    if (params.region) {
      results = results.filter((c) => c.region === params.region);
    }
    if (params.available) {
      results = results.filter((c) => c.availability === 'available');
    }
    if (params.verified) {
      results = results.filter((c) => c.verified);
    }

    // Sort by referral score
    return results.sort((a, b) => b.referralScore - a.referralScore);
  }

  /**
   * Get contractor by ID
   */
  getContractor(contractorId: string): ContractorProfile | undefined {
    return this.contractors.get(contractorId);
  }

  /**
   * Get recommended contractors for a job type
   */
  getRecommendedContractors(jobType: string, location?: string): ContractorProfile[] {
    let results = Array.from(this.contractors.values()).filter(
      (c) =>
        c.acceptsReferrals &&
        c.availability !== 'unavailable' &&
        (c.skills.some((s) => s.toLowerCase().includes(jobType.toLowerCase())) ||
          c.preferredJobTypes.some((t) => t.toLowerCase().includes(jobType.toLowerCase())))
    );

    if (location) {
      // Prioritize same region
      results.sort((a, b) => {
        const aMatch = a.city.toLowerCase() === location.toLowerCase() || a.region.toLowerCase().includes(location.toLowerCase());
        const bMatch = b.city.toLowerCase() === location.toLowerCase() || b.region.toLowerCase().includes(location.toLowerCase());
        if (aMatch && !bMatch) return -1;
        if (bMatch && !aMatch) return 1;
        return b.referralScore - a.referralScore;
      });
    }

    return results.slice(0, 5);
  }

  /**
   * Get my connections
   */
  getMyConnections(): ContractorProfile[] {
    return Array.from(this.contractors.values()).filter((c) =>
      this.myConnections.has(c.id)
    );
  }

  // -----------------------------------------
  // Connection Management
  // -----------------------------------------

  /**
   * Send connection request
   */
  sendConnectionRequest(toContractorId: string, message?: string): ConnectionRequest {
    const request: ConnectionRequest = {
      id: `conn_${Date.now()}`,
      fromContractorId: 'me',
      fromContractorName: 'Jij',
      toContractorId,
      message,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.connectionRequests.set(request.id, request);
    this.notifyListeners();

    trackUserAction('connection_request_sent', {
      toContractorId,
    });

    return request;
  }

  /**
   * Get pending connection requests (received)
   */
  getPendingConnectionRequests(): ConnectionRequest[] {
    return Array.from(this.connectionRequests.values()).filter(
      (r) => r.toContractorId === 'me' && r.status === 'pending'
    );
  }

  /**
   * Accept connection request
   */
  acceptConnectionRequest(requestId: string): void {
    const request = this.connectionRequests.get(requestId);
    if (!request) return;

    request.status = 'accepted';
    this.myConnections.add(request.fromContractorId);
    this.notifyListeners();

    trackUserAction('connection_request_accepted', {
      fromContractorId: request.fromContractorId,
    });
  }

  /**
   * Decline connection request
   */
  declineConnectionRequest(requestId: string): void {
    const request = this.connectionRequests.get(requestId);
    if (request) {
      request.status = 'declined';
      this.notifyListeners();
    }
  }

  /**
   * Check if connected
   */
  isConnected(contractorId: string): boolean {
    return this.myConnections.has(contractorId);
  }

  // -----------------------------------------
  // Referral Management
  // -----------------------------------------

  /**
   * Get all referrals
   */
  getReferrals(filter?: {
    direction?: 'sent' | 'received';
    status?: Referral['status'];
  }): Referral[] {
    let referrals = Array.from(this.referrals.values());

    if (filter?.direction === 'sent') {
      referrals = referrals.filter((r) => r.fromContractorId === 'me');
    } else if (filter?.direction === 'received') {
      referrals = referrals.filter((r) => r.toContractorId === 'me');
    }

    if (filter?.status) {
      referrals = referrals.filter((r) => r.status === filter.status);
    }

    return referrals.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get pending referrals (received)
   */
  getPendingReferrals(): Referral[] {
    return this.getReferrals({ direction: 'received', status: 'pending' });
  }

  /**
   * Send a referral
   */
  sendReferral(params: {
    toContractorId: string;
    customerName: string;
    customerContact?: string;
    jobType: string;
    jobDescription: string;
    estimatedValue: number;
    location: string;
  }): Referral {
    const toContractor = this.contractors.get(params.toContractorId);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const referral: Referral = {
      id: `ref_${Date.now()}`,
      fromContractorId: 'me',
      fromContractorName: 'Jij',
      toContractorId: params.toContractorId,
      toContractorName: toContractor?.name || 'Onbekend',
      customerName: params.customerName,
      customerContact: params.customerContact,
      jobType: params.jobType,
      jobDescription: params.jobDescription,
      estimatedValue: params.estimatedValue,
      location: params.location,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      commissionPaid: false,
    };

    this.referrals.set(referral.id, referral);
    this.notifyListeners();

    trackUserAction('referral_sent', {
      referralId: referral.id,
      toContractorId: params.toContractorId,
      jobType: params.jobType,
      estimatedValue: params.estimatedValue,
    });

    return referral;
  }

  /**
   * Accept a referral
   */
  acceptReferral(referralId: string): void {
    const referral = this.referrals.get(referralId);
    if (!referral) return;

    referral.status = 'accepted';
    referral.respondedAt = new Date().toISOString();
    this.notifyListeners();

    trackUserAction('referral_accepted', {
      referralId,
      fromContractorId: referral.fromContractorId,
    });
  }

  /**
   * Decline a referral
   */
  declineReferral(referralId: string, reason?: string): void {
    const referral = this.referrals.get(referralId);
    if (!referral) return;

    referral.status = 'declined';
    referral.respondedAt = new Date().toISOString();
    this.notifyListeners();

    trackUserAction('referral_declined', {
      referralId,
      reason,
    });
  }

  /**
   * Complete a referral
   */
  completeReferral(
    referralId: string,
    actualValue: number,
    feedback?: { rating: number; comment?: string }
  ): void {
    const referral = this.referrals.get(referralId);
    if (!referral) return;

    referral.status = 'completed';
    referral.completedAt = new Date().toISOString();
    referral.actualValue = actualValue;
    referral.commission = actualValue * 0.05; // 5% commission

    if (feedback) {
      if (referral.toContractorId === 'me') {
        referral.receiverRating = feedback.rating;
        referral.receiverFeedback = feedback.comment;
      } else {
        referral.senderRating = feedback.rating;
        referral.senderFeedback = feedback.comment;
      }
    }

    this.notifyListeners();

    trackUserAction('referral_completed', {
      referralId,
      actualValue,
      commission: referral.commission,
    });
  }

  // -----------------------------------------
  // Statistics
  // -----------------------------------------

  /**
   * Get my referral statistics
   */
  getMyStats(): {
    referralsSent: number;
    referralsReceived: number;
    totalEarnedFromReferrals: number;
    totalPaidInCommissions: number;
    avgRatingGiven: number;
    avgRatingReceived: number;
    connectionCount: number;
  } {
    const sent = this.getReferrals({ direction: 'sent' });
    const received = this.getReferrals({ direction: 'received' });

    const completedSent = sent.filter((r) => r.status === 'completed');
    const completedReceived = received.filter((r) => r.status === 'completed');

    return {
      referralsSent: sent.length,
      referralsReceived: received.length,
      totalEarnedFromReferrals: completedReceived.reduce((sum, r) => sum + (r.actualValue || 0), 0),
      totalPaidInCommissions: completedSent.reduce((sum, r) => sum + (r.commission || 0), 0),
      avgRatingGiven: this.calculateAvgRating(completedSent.map((r) => r.senderRating)),
      avgRatingReceived: this.calculateAvgRating(completedReceived.map((r) => r.receiverRating)),
      connectionCount: this.myConnections.size,
    };
  }

  /**
   * Get network statistics
   */
  getNetworkStats(): NetworkStats {
    const allReferrals = Array.from(this.referrals.values());
    const skillCounts: Record<string, number> = {};
    const regionCounts: Record<string, number> = {};

    this.contractors.forEach((c) => {
      c.skills.forEach((s) => {
        skillCounts[s] = (skillCounts[s] || 0) + 1;
      });
      regionCounts[c.region] = (regionCounts[c.region] || 0) + 1;
    });

    return {
      totalContractors: this.contractors.size,
      totalReferrals: allReferrals.length,
      totalValueReferred: allReferrals.reduce((sum, r) => sum + r.estimatedValue, 0),
      avgCommissionRate: 5,
      topSkills: Object.entries(skillCounts)
        .map(([skill, count]) => ({ skill, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      topRegions: Object.entries(regionCounts)
        .map(([region, count]) => ({ region, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  }

  private calculateAvgRating(ratings: (number | undefined)[]): number {
    const validRatings = ratings.filter((r): r is number => r !== undefined);
    if (validRatings.length === 0) return 0;
    return validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length;
  }

  // -----------------------------------------
  // Subscription
  // -----------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const contractorNetworkService = new ContractorNetworkService();

// ============================================
// REACT HOOKS
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react';

export function useContractorNetwork() {
  const [, setUpdate] = useState(0);

  useEffect(() => {
    const unsubscribe = contractorNetworkService.subscribe(() => {
      setUpdate((u) => u + 1);
    });
    return unsubscribe;
  }, []);

  const searchContractors = useCallback(
    (params: Parameters<typeof contractorNetworkService.searchContractors>[0]) => {
      return contractorNetworkService.searchContractors(params);
    },
    []
  );

  const getRecommendedContractors = useCallback(
    (jobType: string, location?: string) => {
      return contractorNetworkService.getRecommendedContractors(jobType, location);
    },
    []
  );

  return {
    myConnections: contractorNetworkService.getMyConnections(),
    pendingConnectionRequests: contractorNetworkService.getPendingConnectionRequests(),
    searchContractors,
    getRecommendedContractors,
    sendConnectionRequest: contractorNetworkService.sendConnectionRequest.bind(contractorNetworkService),
    acceptConnectionRequest: contractorNetworkService.acceptConnectionRequest.bind(contractorNetworkService),
    declineConnectionRequest: contractorNetworkService.declineConnectionRequest.bind(contractorNetworkService),
    isConnected: contractorNetworkService.isConnected.bind(contractorNetworkService),
    myStats: contractorNetworkService.getMyStats(),
    networkStats: contractorNetworkService.getNetworkStats(),
  };
}

export function useReferrals(filter?: { direction?: 'sent' | 'received'; status?: Referral['status'] }) {
  const [referrals, setReferrals] = useState<Referral[]>(() =>
    contractorNetworkService.getReferrals(filter)
  );

  useEffect(() => {
    const unsubscribe = contractorNetworkService.subscribe(() => {
      setReferrals(contractorNetworkService.getReferrals(filter));
    });
    return unsubscribe;
  }, [filter?.direction, filter?.status]);

  const sendReferral = useCallback(
    (params: Parameters<typeof contractorNetworkService.sendReferral>[0]) => {
      return contractorNetworkService.sendReferral(params);
    },
    []
  );

  const acceptReferral = useCallback((referralId: string) => {
    contractorNetworkService.acceptReferral(referralId);
  }, []);

  const declineReferral = useCallback((referralId: string, reason?: string) => {
    contractorNetworkService.declineReferral(referralId, reason);
  }, []);

  const completeReferral = useCallback(
    (
      referralId: string,
      actualValue: number,
      feedback?: { rating: number; comment?: string }
    ) => {
      contractorNetworkService.completeReferral(referralId, actualValue, feedback);
    },
    []
  );

  const pendingCount = useMemo(
    () => contractorNetworkService.getPendingReferrals().length,
    [referrals]
  );

  return {
    referrals,
    pendingCount,
    sendReferral,
    acceptReferral,
    declineReferral,
    completeReferral,
  };
}

export function useContractorProfile(contractorId: string) {
  return useMemo(
    () => contractorNetworkService.getContractor(contractorId),
    [contractorId]
  );
}
