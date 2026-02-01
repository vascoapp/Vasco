// =============================================================================
// KNOWLEDGE BASE & LEARNING CENTER SERVICE
// =============================================================================
// Personalized learning content based on contractor's projects and skill gaps
// Tracks engagement to improve content recommendations
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';

// ============================================
// TYPES
// ============================================

export interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  readTime: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  author: string;
  publishedAt: string;
  updatedAt?: string;
  views: number;
  helpful: number;
  bookmarked?: boolean;
  completed?: boolean;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  steps: TutorialStep[];
  completedSteps: number;
  progress: number;
  prerequisites?: string[];
  skillsGained: string[];
}

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  media?: { type: 'image' | 'video'; url: string };
  completed: boolean;
}

export interface IndustryUpdate {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  category: 'regelgeving' | 'markt' | 'technologie' | 'materialen';
  importance: 'high' | 'medium' | 'low';
  read: boolean;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  targetSkill: string;
  articles: string[];
  tutorials: string[];
  estimatedTime: number;
  progress: number;
  completed: boolean;
}

export interface SkillAssessment {
  skill: string;
  level: 'none' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
  confidence: number;
  basedOn: string;
  suggestedContent: string[];
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_ARTICLES: Article[] = [
  {
    id: 'art_1',
    title: 'Nieuwe BTW-regels voor renovatiewerk 2025',
    summary: 'Overzicht van de belangrijkste wijzigingen in BTW-tarieven voor schilder- en renovatiewerk.',
    content: 'Lorem ipsum...',
    category: 'Regelgeving',
    tags: ['BTW', 'belasting', 'renovatie'],
    readTime: 8,
    difficulty: 'intermediate',
    author: 'Vasco Team',
    publishedAt: '2025-01-15',
    views: 342,
    helpful: 45,
  },
  {
    id: 'art_2',
    title: 'Duurzaam schilderen: Watergedragen verven',
    summary: 'Alles over de overstap naar milieuvriendelijke verfsoorten en hun voordelen.',
    content: 'Lorem ipsum...',
    category: 'Materialen',
    tags: ['duurzaam', 'verf', 'milieu'],
    readTime: 12,
    difficulty: 'beginner',
    author: 'Jan Schilders',
    publishedAt: '2025-01-10',
    views: 528,
    helpful: 72,
  },
  {
    id: 'art_3',
    title: 'Effectieve offertes schrijven die converteren',
    summary: 'Tips en templates voor het opstellen van professionele offertes die klanten overtuigen.',
    content: 'Lorem ipsum...',
    category: 'Business',
    tags: ['offerte', 'verkoop', 'klanten'],
    readTime: 15,
    difficulty: 'beginner',
    author: 'Vasco Team',
    publishedAt: '2025-01-05',
    views: 892,
    helpful: 156,
  },
];

const MOCK_TUTORIALS: Tutorial[] = [
  {
    id: 'tut_1',
    title: 'Perfecte hoeken schilderen',
    description: 'Leer hoe je strakke hoeken en randen schildert zonder afplaktape.',
    category: 'Schilderwerk',
    duration: 25,
    difficulty: 'intermediate',
    steps: [
      { id: 's1', title: 'Voorbereiding', content: 'Zorg voor het juiste materiaal...', completed: true },
      { id: 's2', title: 'Techniek', content: 'Houd de kwast onder een hoek van 45 graden...', completed: true },
      { id: 's3', title: 'Afwerking', content: 'Controleer op oneffenheden...', completed: false },
    ],
    completedSteps: 2,
    progress: 67,
    skillsGained: ['Precieze afwerking', 'Kwasten technieken'],
  },
  {
    id: 'tut_2',
    title: 'Vloerverwarming installeren',
    description: 'Complete handleiding voor het installeren van elektrische vloerverwarming.',
    category: 'Installatie',
    duration: 45,
    difficulty: 'advanced',
    steps: [
      { id: 's1', title: 'Planning', content: 'Meet de ruimte op...', completed: false },
      { id: 's2', title: 'Voorbereiding vloer', content: 'Zorg voor een schone, vlakke ondergrond...', completed: false },
      { id: 's3', title: 'Installatie', content: 'Leg de verwarmingsmatten...', completed: false },
      { id: 's4', title: 'Aansluiting', content: 'Sluit aan op de thermostaat...', completed: false },
    ],
    completedSteps: 0,
    progress: 0,
    prerequisites: ['Basis elektriciteit'],
    skillsGained: ['Vloerverwarming', 'Elektrische installaties'],
  },
];

const MOCK_UPDATES: IndustryUpdate[] = [
  {
    id: 'upd_1',
    title: 'Prijsstijging bouwmaterialen verwacht in Q2',
    summary: 'Analisten voorspellen 8-12% stijging in hout en staal prijzen door internationale vraag.',
    source: 'Bouwend Nederland',
    publishedAt: '2025-01-28',
    category: 'markt',
    importance: 'high',
    read: false,
  },
  {
    id: 'upd_2',
    title: 'Nieuwe isolatie-eisen per 1 juli 2025',
    summary: 'Strengere eisen voor dakisolatie bij renovatieprojecten van kracht.',
    source: 'Rijksoverheid',
    publishedAt: '2025-01-25',
    category: 'regelgeving',
    importance: 'high',
    read: true,
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class KnowledgeBaseService {
  private articles: Map<string, Article> = new Map();
  private tutorials: Map<string, Tutorial> = new Map();
  private updates: Map<string, IndustryUpdate> = new Map();
  private bookmarks: Set<string> = new Set();
  private listeners: Set<() => void> = new Set();

  constructor() {
    MOCK_ARTICLES.forEach((a) => this.articles.set(a.id, a));
    MOCK_TUTORIALS.forEach((t) => this.tutorials.set(t.id, t));
    MOCK_UPDATES.forEach((u) => this.updates.set(u.id, u));
  }

  // Articles
  getArticles(filter?: { category?: string; difficulty?: string }): Article[] {
    let articles = Array.from(this.articles.values());
    if (filter?.category) articles = articles.filter((a) => a.category === filter.category);
    if (filter?.difficulty) articles = articles.filter((a) => a.difficulty === filter.difficulty);
    return articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  getRecommendedArticles(limit: number = 5): Article[] {
    return this.getArticles().slice(0, limit);
  }

  markArticleRead(articleId: string): void {
    const article = this.articles.get(articleId);
    if (article) {
      article.completed = true;
      article.views++;
      trackUserAction('article_read', { articleId, category: article.category });
    }
  }

  bookmarkArticle(articleId: string): void {
    const article = this.articles.get(articleId);
    if (article) {
      article.bookmarked = !article.bookmarked;
      if (article.bookmarked) this.bookmarks.add(articleId);
      else this.bookmarks.delete(articleId);
      this.notifyListeners();
    }
  }

  // Tutorials
  getTutorials(filter?: { category?: string; difficulty?: string }): Tutorial[] {
    let tutorials = Array.from(this.tutorials.values());
    if (filter?.category) tutorials = tutorials.filter((t) => t.category === filter.category);
    if (filter?.difficulty) tutorials = tutorials.filter((t) => t.difficulty === filter.difficulty);
    return tutorials;
  }

  updateTutorialProgress(tutorialId: string, stepId: string): void {
    const tutorial = this.tutorials.get(tutorialId);
    if (tutorial) {
      const step = tutorial.steps.find((s) => s.id === stepId);
      if (step) {
        step.completed = true;
        tutorial.completedSteps = tutorial.steps.filter((s) => s.completed).length;
        tutorial.progress = Math.round((tutorial.completedSteps / tutorial.steps.length) * 100);
        this.notifyListeners();
        trackUserAction('tutorial_step_completed', { tutorialId, stepId });
      }
    }
  }

  // Industry Updates
  getIndustryUpdates(unreadOnly: boolean = false): IndustryUpdate[] {
    let updates = Array.from(this.updates.values());
    if (unreadOnly) updates = updates.filter((u) => !u.read);
    return updates.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  markUpdateRead(updateId: string): void {
    const update = this.updates.get(updateId);
    if (update) {
      update.read = true;
      this.notifyListeners();
    }
  }

  // Skill Assessment
  assessSkills(): SkillAssessment[] {
    return [
      { skill: 'Schilderwerk', level: 'advanced', confidence: 0.9, basedOn: '45 projecten', suggestedContent: ['art_2'] },
      { skill: 'Badkamerrenovatie', level: 'intermediate', confidence: 0.75, basedOn: '12 projecten', suggestedContent: ['tut_2'] },
      { skill: 'Offertes schrijven', level: 'beginner', confidence: 0.6, basedOn: 'Conversieratio 38%', suggestedContent: ['art_3'] },
    ];
  }

  // Learning Paths
  getLearningPaths(): LearningPath[] {
    return [
      {
        id: 'path_1',
        title: 'Professionele offertes',
        description: 'Verbeter je offerte conversie',
        targetSkill: 'Sales',
        articles: ['art_3'],
        tutorials: [],
        estimatedTime: 30,
        progress: 0,
        completed: false,
      },
      {
        id: 'path_2',
        title: 'Duurzaam renoveren',
        description: 'Leer milieuvriendelijk werken',
        targetSkill: 'Duurzaamheid',
        articles: ['art_2'],
        tutorials: [],
        estimatedTime: 45,
        progress: 35,
        completed: false,
      },
    ];
  }

  // Search
  search(query: string): { articles: Article[]; tutorials: Tutorial[] } {
    const q = query.toLowerCase();
    return {
      articles: this.getArticles().filter(
        (a) => a.title.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q))
      ),
      tutorials: this.getTutorials().filter(
        (t) => t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
      ),
    };
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

export const knowledgeBaseService = new KnowledgeBaseService();

// ============================================
// REACT HOOKS
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react';

export function useKnowledgeBase() {
  const [articles, setArticles] = useState<Article[]>(() => knowledgeBaseService.getArticles());
  const [tutorials, setTutorials] = useState<Tutorial[]>(() => knowledgeBaseService.getTutorials());

  useEffect(() => {
    const unsubscribe = knowledgeBaseService.subscribe(() => {
      setArticles(knowledgeBaseService.getArticles());
      setTutorials(knowledgeBaseService.getTutorials());
    });
    return unsubscribe;
  }, []);

  const markArticleRead = useCallback((articleId: string) => {
    knowledgeBaseService.markArticleRead(articleId);
  }, []);

  const bookmarkArticle = useCallback((articleId: string) => {
    knowledgeBaseService.bookmarkArticle(articleId);
  }, []);

  const updateTutorialProgress = useCallback((tutorialId: string, stepId: string) => {
    knowledgeBaseService.updateTutorialProgress(tutorialId, stepId);
  }, []);

  const recommended = useMemo(() => knowledgeBaseService.getRecommendedArticles(), []);
  const skillAssessment = useMemo(() => knowledgeBaseService.assessSkills(), []);
  const learningPaths = useMemo(() => knowledgeBaseService.getLearningPaths(), []);

  return {
    articles,
    tutorials,
    recommended,
    skillAssessment,
    learningPaths,
    markArticleRead,
    bookmarkArticle,
    updateTutorialProgress,
    search: knowledgeBaseService.search,
  };
}

export function useIndustryUpdates() {
  const [updates, setUpdates] = useState<IndustryUpdate[]>(() => knowledgeBaseService.getIndustryUpdates());

  useEffect(() => {
    const unsubscribe = knowledgeBaseService.subscribe(() => {
      setUpdates(knowledgeBaseService.getIndustryUpdates());
    });
    return unsubscribe;
  }, []);

  const markRead = useCallback((updateId: string) => {
    knowledgeBaseService.markUpdateRead(updateId);
  }, []);

  const unreadCount = useMemo(() => updates.filter((u) => !u.read).length, [updates]);

  return { updates, markRead, unreadCount };
}
