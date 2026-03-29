// =============================================================================
// DID YOU KNOW — Trade fact template (15-21s vertical TikTok)
// =============================================================================
// Hook text (2s) → Trade icon pulse (1s) → Stat counter animation (4s) →
// Fact explanation (5s) → CTA card (4s) → Vasco branding (2s)
// =============================================================================

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring, Sequence } from 'remotion';
import { Colors, VIDEO } from '../data/theme';
import { VascoBranding, CTABanner } from '../components/VascoLogo';

export interface DidYouKnowProps {
  hookText: string;
  tradeEmoji: string;
  tradeName: string;
  tradeColor: string;
  statValue: string;          // "73%", "8 hours", "€1,200"
  statLabel: string;          // "of contractors lose money on quotes"
  factText: string;           // Extended explanation
  ctaText: string;            // "Download Vasco — free for contractors"
  ctaSubtext?: string;
  language: string;
}

export const DidYouKnow: React.FC<DidYouKnowProps> = ({
  hookText, tradeEmoji, tradeName, tradeColor,
  statValue, statLabel, factText,
  ctaText, ctaSubtext,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animation phases
  const hookOpacity = interpolate(frame, [0, 10, fps * 2 - 10, fps * 2], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const iconScale = spring({ frame: frame - fps * 2, fps, config: { damping: 12 } });
  const statProgress = interpolate(frame, [fps * 3, fps * 7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const factOpacity = interpolate(frame, [fps * 7, fps * 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ctaOpacity = interpolate(frame, [fps * 13, fps * 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const brandOpacity = interpolate(frame, [fps * 16, fps * 17], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: Colors.background }}>
      {/* Gradient top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 6,
        background: `linear-gradient(90deg, ${tradeColor}, ${Colors.hermesOrange})`,
      }} />

      {/* Hook text — first 2 seconds */}
      <Sequence from={0} durationInFrames={fps * 3}>
        <AbsoluteFill style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 60, opacity: hookOpacity,
        }}>
          <span style={{
            fontSize: 48, fontWeight: 800, color: Colors.textPrimary,
            fontFamily: 'Inter, sans-serif', textAlign: 'center',
            lineHeight: 1.2, letterSpacing: -1,
          }}>
            {hookText}
          </span>
        </AbsoluteFill>
      </Sequence>

      {/* Trade icon pulse */}
      <Sequence from={fps * 2} durationInFrames={fps * 2}>
        <AbsoluteFill style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 20,
        }}>
          <div style={{
            fontSize: 120,
            transform: `scale(${iconScale})`,
          }}>
            {tradeEmoji}
          </div>
          <span style={{
            fontSize: 32, fontWeight: 700, color: tradeColor,
            fontFamily: 'Inter, sans-serif',
            opacity: interpolate(iconScale, [0, 1], [0, 1]),
          }}>
            {tradeName}
          </span>
        </AbsoluteFill>
      </Sequence>

      {/* Stat counter */}
      <Sequence from={fps * 3} durationInFrames={fps * 5}>
        <AbsoluteFill style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16, padding: 60,
        }}>
          <span style={{
            fontSize: 96, fontWeight: 800, color: Colors.hermesOrange,
            fontFamily: 'Inter, sans-serif',
            opacity: statProgress,
            transform: `scale(${interpolate(statProgress, [0, 0.5, 1], [0.5, 1.1, 1])})`,
          }}>
            {statValue}
          </span>
          <span style={{
            fontSize: 28, fontWeight: 500, color: Colors.textSecondary,
            fontFamily: 'Inter, sans-serif', textAlign: 'center',
            opacity: interpolate(statProgress, [0.3, 0.7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}>
            {statLabel}
          </span>
        </AbsoluteFill>
      </Sequence>

      {/* Fact explanation */}
      <Sequence from={fps * 7} durationInFrames={fps * 6}>
        <AbsoluteFill style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 60, opacity: factOpacity,
        }}>
          <div style={{
            backgroundColor: Colors.surfacePrimary,
            borderRadius: 24, padding: '40px 36px',
            borderLeft: `6px solid ${Colors.hermesOrange}`,
            maxWidth: 900,
          }}>
            <span style={{
              fontSize: 30, fontWeight: 500, color: Colors.textPrimary,
              fontFamily: 'Inter, sans-serif', lineHeight: 1.5,
            }}>
              {factText}
            </span>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* CTA */}
      <Sequence from={fps * 13} durationInFrames={fps * 5}>
        <div style={{ opacity: ctaOpacity }}>
          <CTABanner text={ctaText} subtext={ctaSubtext} />
        </div>
      </Sequence>

      {/* Branding */}
      <Sequence from={fps * 16}>
        <div style={{ opacity: brandOpacity }}>
          <VascoBranding position="bottom" />
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
