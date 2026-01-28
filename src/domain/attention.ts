export type AttentionTone = 'default' | 'warning' | 'danger';

export type AttentionItem = {
  id: string;
  title: string;
  subtitle?: string;
  why?: string;
  impact?: string;
  tag?: string;
  tone: AttentionTone;
  route: string;
  priority: number;
};
