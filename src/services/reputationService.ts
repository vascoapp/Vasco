// =============================================================================
// REPUTATION & REVIEW SERVICE
// =============================================================================
// Manages reviews, ratings, certifications, and reputation scoring
// Feeds into contractor matching and recommendation algorithms
// =============================================================================

import { Linking, Share } from 'react-native';
import { trackUserAction } from '../intelligence/intelligenceEngine';
import { renderTemplate, hasConsent, type Locale } from './whatsappTemplateService';

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
    // R31: dropped MOCK_REVIEWS + MOCK_CERTIFICATIONS seed (was injecting
    // fake 5-star reviews + fake credentials into every contractor's
    // reputation singleton). reputationService is mostly off the main
    // contractor flow today, but `requestReview` (R288) does land in the
    // queue, and any consumer reading reviews/certs would have seen
    // someone else's fake reputation. Test setups call __seedMockData.
  }

  /** @internal Test-only mock seeder. */
  __seedMockData(): void {
    MOCK_REVIEWS.forEach((r) => this.reviews.set(r.id, r));
    MOCK_CERTIFICATIONS.forEach((c) => this.certifications.set(c.id, c));
    this.notifyListeners();
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

  /**
   * Request a customer review. R288: was a stub that built an in-memory
   * object and emitted a tracking event — nothing reached the customer.
   * Now actually delivers via WhatsApp (with consent), email (mailto), or
   * Share sheet, in that priority order.
   */
  async requestReview(opts: {
    projectId: string;
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    businessName?: string;
    locale?: Locale;
    reviewLink: string;
    /** R37: customer tag — picks gentle/standard/firm tone variant. */
    customerTag?: 'vip' | 'loyal' | 'new' | 'risky' | 'inactive';
  }): Promise<ReviewRequest & { delivered: boolean; channel: 'whatsapp' | 'email' | 'share' | 'none' }> {
    const customerName = opts.customerName ?? 'Klant';
    const businessName = opts.businessName ?? 'Vasco';
    const locale = (opts.locale ?? 'nl') as Locale;
    // R37: use tag-aware variant when tag is supplied, falls back to standard
    // template otherwise (preserves backward compat with existing callers).
    const text = opts.customerTag
      ? (await import('./whatsappTemplateService')).renderReviewRequestForTag(locale, {
          customer: customerName,
          link: opts.reviewLink,
          business: businessName,
        }, opts.customerTag)
      : renderTemplate('review_request', locale, {
          customer: customerName,
          link: opts.reviewLink,
          business: businessName,
        });

    let channel: 'whatsapp' | 'email' | 'share' | 'none' = 'none';
    let delivered = false;

    // 1. WhatsApp first — only when consent recorded + phone present.
    if (opts.customerPhone && opts.customerId && (await hasConsent(opts.customerId))) {
      const phone = opts.customerPhone.replace(/[^\d]/g, '');
      if (phone.length >= 8) {
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
        try {
          await Linking.openURL(url);
          channel = 'whatsapp';
          delivered = true;
        } catch {}
      }
    }

    // 2. Email fallback — mailto: link via Linking.
    if (!delivered && opts.customerEmail) {
      const subject = encodeURIComponent(`${businessName} — review`);
      const body = encodeURIComponent(text);
      try {
        await Linking.openURL(`mailto:${opts.customerEmail}?subject=${subject}&body=${body}`);
        channel = 'email';
        delivered = true;
      } catch {}
    }

    // 3. Share sheet last resort — contractor picks the channel.
    if (!delivered) {
      try {
        await Share.share({ message: text, title: `${businessName} — review` });
        channel = 'share';
        delivered = true;
      } catch {}
    }

    const request: ReviewRequest = {
      id: `req_${Date.now()}`,
      projectId: opts.projectId,
      customerName,
      customerEmail: opts.customerEmail ?? '',
      projectType: 'Project',
      completedAt: new Date().toISOString(),
      requestedAt: new Date().toISOString(),
      status: delivered ? 'pending' : 'pending', // pending until customer responds either way
      reminderCount: 0,
    };
    trackUserAction('review_requested', { projectId: opts.projectId, channel, delivered });
    return { ...request, delivered, channel };
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

/**
 * @deprecated R300: zero UI consumers. Exported in `src/services/index.ts`
 * but no screen imports it. Keep for the day a reputation dashboard ships;
 * delete when sure that's not happening.
 */
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

/**
 * @deprecated R300: zero UI consumers. Same caveat as `useReviews` — kept
 * for a future reputation dashboard. The `requestReview` call from
 * R288 is on `reputationService` directly, not via this hook.
 */
export function useReputation() {
  const score = useMemo(() => reputationService.getReputationScore(), []);
  const certifications = useMemo(() => reputationService.getCertifications(), []);

  return { score, certifications, addCertification: reputationService.addCertification };
}
