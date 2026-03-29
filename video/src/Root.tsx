import React from 'react';
import { Composition } from 'remotion';
import { VIDEO } from './data/theme';
import { DidYouKnow, type DidYouKnowProps } from './compositions/DidYouKnow';
import { PriceCheck, type PriceCheckProps } from './compositions/PriceCheck';
import { BeforeAfter, type BeforeAfterProps } from './compositions/BeforeAfter';
import { EveSays, type EveSaysProps } from './compositions/EveSays';
import { ComplianceAlert, type ComplianceAlertProps } from './compositions/ComplianceAlert';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DidYouKnow"
        component={DidYouKnow}
        durationInFrames={VIDEO.durationFrames.standard}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          hookText: 'Did you know? 73% of contractors lose money on quotes',
          tradeEmoji: '🔧',
          tradeName: 'Plumbing',
          tradeColor: '#3B82F6',
          statValue: '73%',
          statLabel: 'of contractors undercharge on their first quote',
          factText: 'Vasco AI analyzes local market data and your job history to suggest optimal pricing. Stop leaving money on the table.',
          ctaText: 'Download Vasco — free',
          ctaSubtext: 'AI-powered quoting for contractors',
          language: 'EN',
        } satisfies DidYouKnowProps}
      />

      <Composition
        id="PriceCheck"
        component={PriceCheck}
        durationInFrames={VIDEO.durationFrames.standard}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          hookText: 'Are you overpaying for materials?',
          materialName: 'PIR Insulation Board 120mm',
          supplierA: { name: 'Rockwool', price: 38.50 },
          supplierB: { name: 'Knauf', price: 32.20 },
          savingsAmount: 6.30,
          savingsPercent: 16,
          ctaText: 'Vasco finds the best deals',
          language: 'EN',
        } satisfies PriceCheckProps}
      />

      <Composition
        id="BeforeAfter"
        component={BeforeAfter}
        durationInFrames={VIDEO.durationFrames.medium}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          beforeImageUrl: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=1080&h=1920&fit=crop',
          afterImageUrl: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1080&h=1920&fit=crop',
          tradeEmoji: '🎨',
          tradeName: 'Painting',
          tradeColor: '#8B5CF6',
          location: 'Amsterdam, NL',
          contractorQuote: 'Completed in 3 days',
          ctaText: 'Showcase your work on Vasco',
          language: 'EN',
        } satisfies BeforeAfterProps}
      />

      <Composition
        id="EveSays"
        component={EveSays}
        durationInFrames={VIDEO.durationFrames.medium}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          tipTitle: 'Get paid 2 weeks faster',
          tipBody: 'Send your invoice within 24 hours of completing the job. Contractors who invoice same-day get paid on average 14 days sooner than those who wait a week. Vasco does this automatically.',
          tradeEmoji: '🔧',
          tradeName: 'Plumbing',
          ctaText: 'Let EVE handle your invoicing',
          language: 'EN',
        } satisfies EveSaysProps}
      />

      <Composition
        id="ComplianceAlert"
        component={ComplianceAlert}
        durationInFrames={VIDEO.durationFrames.standard}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          countryFlag: '🇬🇧',
          countryName: 'United Kingdom',
          regulationName: 'Gas Safe Registration',
          deadlineText: 'Expires March 2026',
          daysLeft: 45,
          consequence: '£5,000 fine + criminal prosecution',
          tradeEmoji: '🔥',
          tradeName: 'Gas / HVAC',
          ctaText: 'Never miss a deadline',
          language: 'EN',
        } satisfies ComplianceAlertProps}
      />
    </>
  );
};
