// =============================================================================
// REPUTATION & REVIEW SERVICE
// =============================================================================
// Manages reviews, ratings, certifications, and reputation scoring
// Feeds into contractor matching and recommendation algorithms
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';

// ============================================
// TYPES
// ============================================

export interface Review {
  id: string;
  projectId: string;
  customerId: string;
  customerName: string;
  rating: number;
  title?: string;
  content: string;
  photos?: string[];
  projectType: string;
  createdAt: string;
  response?: ReviewResponse;
  verified: boolean;
  helpful: number;
  reported: boolean;
}

export interface ReviewResponse {
  content: string;
  createdAt: string;
}

export interface ReputationScore {
  overall: number;
  categories: {
    quality: number;
    communication: number;
    punctuality: number;
    value: number;
    cleanliness: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  percentile: number;
  totalReviews: number;
  responseRate: number;
  avgResponseTime: number;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issuedAt: string;
  expiresAt?: string;
  verified: boolean;
  documentUrl?: string;
}

export interface ReviewRequest {
  id: string;
  projectId: string;
  customerName: string;
  customerEmail: string;
  projectType: string;
  completedAt: string;
  requestedAt: string;
  status: 'pending' | 'completed' | 'expired';
  reminderCount: number;
}

export interface ReviewStats {
  totalReviews: number;
  avgRating: number;
  ratingDistribution: { [key: number]: number };
  recentTrend: number;
  responseRate: number;
  topKeywords: Array<{ word: string; count: number; sentiment: 'positive' | 'negative' }>;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_REVIEWS: Review[] = [
  {
    id: 'rev_1',
    projectId: 'proj_1',
    customerId: 'cust_1',
    customerName: 'Familie de Vries',
    rating: 5,
    title: 'Uitstekend werk!',
    content: 'Zeer tevreden met het schilderwerk. Netjes gewerkt, op tijd klaar en goede communicatie gedurende het hele project.',
    projectType: 'Schilderwerk',
    createdAt: '2025-01-15',
    response: { content: 'Bedankt voor de mooie review! Het was een plezier om bij u te werken.', createdAt: '2025-01-16' },
    verified: true,
    helpful: 8,
    reported: false,
  },
  {
    id: 'rev_2',
    projectId: 'proj_2',
    customerId: 'cust_2',
    customerName: 'Bakkerij Jansen',
    rating: 5,
    content: 'Professioneel bedrijf. De badkamerrenovatie is prachtig geworden. Zeker een aanrader!',
    photos: ['https://example.com/photo1.jpg'],
    projectType: 'Badkamerrenovatie',
    createdAt: '2025-01-10',
    verified: true,
    helpful: 12,
    reported: false,
  },
  {
    id: 'rev_3',
    projectId: 'proj_3',
    customerId: 'cust_3',
    customerName: 'Peter van den Berg',
    rating: 4,
    content: 'Goed werk geleverd. Kleine vertraging door materiaallevertijd, maar verder prima.',
    projectType: 'Keukenrenovatie',
    createdAt: '2024-12-20',
    verified: true,
    helpful: 5,
    reported: false,
  },
  {
    id: 'rev_4',
    projectId: 'proj_4',
    customerId: 'cust_4',
    customerName: 'Sandra Bakker',
    rating: 5,
    title: 'Top vakman',
    content: 'Al de derde keer dat we hier gebruik van maken. Altijd goed resultaat!',
    projectType: 'Schilderwerk',
    createdAt: '2024-12-05',
    response: { content: 'Dank u wel! Fijn om te horen dat u tevreden bent.', createdAt: '2024-12-06' },
    verified: true,
    helpful: 15,
    reported: false,
  },
];

const MOCK_CERTIFICATIONS: Certification[] = [
  { id: 'cert_1', name: 'Erkend Schildersbedrijf', issuer: 'OnderhoudNL', issuedAt: '2022-03-15', verified: true },
  { id: 'cert_2', name: 'VCA Basis', issuer: 'VCA Nederland', issuedAt: '2023-06-01', expiresAt: '2026-06-01', verified: true },
  { id: 'cert_3', name: 'KvK Ingeschreven', issuer: 'Kamer van Koophandel', issuedAt: '2019-01-10', verified: true },
];

// ============================================
// SERVICE CLASS
// ============================================

class ReputationService {
  private reviews: Map<string, Review> = new Map();
  private certifications: Map<string, Certification> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    MOCK_REVIEWS.forEach((r) => this.reviews.set(r.id, r));
    MOCK_CERTIFICATIONS.forEach((c) => this.certifications.set(c.id, c));
  }

  // Reviews
  getReviews(filter?: { rating?: number; projectType?: string }): Review[] {
    let reviews = Array.from(this.reviews.values());
    if (filter?.rating) reviews = reviews.filter((r) => r.rating === filter.rating);
    if (filter?.projectType) reviews = reviews.filter((r) => r.projectType === filter.projectType);
    return reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getReviewStats(): ReviewStats {
    const reviews = this.getReviews();
    const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => distribution[r.rating]++);

    return {
      totalReviews: reviews.length,
      avgRating: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length,
      ratingDistribution: distribution,
      recentTrend: 0.2,
      responseRate: 75,
      topKeywords: [
        { word: 'professioneel', count: 8, sentiment: 'positive' },
        { word: 'netjes', count: 6, sentiment: 'positive' },
        { word: 'communicatie', count: 5, sentiment: 'positive' },
      ],
    };
  }

  respondToReview(reviewId: string, content: string): void {
    const review = this.reviews.get(reviewId);
    if (review && !review.response) {
      review.response = { content, createdAt: new Date().toISOString() };
      this.notifyListeners();
      trackUserAction('review_responded', { reviewId });
    }
  }

  requestReview(projectId: string, customerEmail: string): ReviewRequest {
    const request: ReviewRequest = {
      id: `req_${Date.now()}`,
      projectId,
      customerName: 'Klant',
      customerEmail,
      projectType: 'Project',
      completedAt: new Date().toISOString(),
      requestedAt: new Date().toISOString(),
      status: 'pending',
      reminderCount: 0,
    };
    trackUserAction('review_requested', { projectId });
    return request;
  }

  // Reputation Score
  getReputationScore(): ReputationScore {
    const reviews = this.getReviews();
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    return {
      overall: Math.round(avgRating * 20),
      categories: {
        quality: 92,
        communication: 88,
        punctuality: 85,
        value: 90,
        cleanliness: 94,
      },
      trend: 'improving',
      percentile: 78,
      totalReviews: reviews.length,
      responseRate: 75,
      avgResponseTime: 4,
    };
  }

  // Certifications
  getCertifications(): Certification[] {
    return Array.from(this.certifications.values());
  }

  addCertification(cert: Omit<Certification, 'id' | 'verified'>): Certification {
    const newCert: Certification = {
      ...cert,
      id: `cert_${Date.now()}`,
      verified: false,
    };
    this.certifications.set(newCert.id, newCert);
    this.notifyListeners();
    trackUserAction('certification_added', { name: cert.name });
    return newCert;
  }

  // Subscription
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => l());
  }
}

export const reputationService = new ReputationService();

// ============================================
// REACT HOOKS
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react';

export function useReviews(filter?: { rating?: number; projectType?: string }) {
  const [reviews, setReviews] = useState<Review[]>(() => reputationService.getReviews(filter));

  useEffect(() => {
    const unsubscribe = reputationService.subscribe(() => {
      setReviews(reputationService.getReviews(filter));
    });
    return unsubscribe;
  }, [filter?.rating, filter?.projectType]);

  const respondToReview = useCallback((reviewId: string, content: string) => {
    reputationService.respondToReview(reviewId, content);
  }, []);

  const stats = useMemo(() => reputationService.getReviewStats(), [reviews]);

  return { reviews, respondToReview, stats, requestReview: reputationService.requestReview };
}

export function useReputation() {
  const score = useMemo(() => reputationService.getReputationScore(), []);
  const certifications = useMemo(() => reputationService.getCertifications(), []);

  return { score, certifications, addCertification: reputationService.addCertification };
}
