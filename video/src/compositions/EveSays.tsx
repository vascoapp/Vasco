// =============================================================================
// EVE SAYS — AI tip template (10-15s vertical TikTok)
// =============================================================================
// Vasco logo animation (2s) → Tip text typewriter (5s) → CTA (3s)
// =============================================================================

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring, Sequence } from 'remotion';
import { Colors } from '../data/theme';
import { VascoLogo, VascoBranding, CTABanner } from '../components/VascoLogo';

export interface EveSaysProps {
  tipTitle: string;
  tipBody: string;
  tradeEmoji: string;
  tradeName: string;
  ctaText: string;
  language: string;
}

export const EveSays: React.FC<EveSaysProps> = ({
  tipTitle, tipBody, tradeEmoji, tradeName, ctaText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 15 } });
  const headerOpacity = interpolate(frame, [fps * 1, fps * 1.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Typewriter effect for tip body
  const charsVisible = Math.floor(interpolate(frame, [fps * 2, fps * 8], [0, tipBody.length], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }));
  const visibleText = tipBody.slice(0, charsVisible);

  const ctaOpacity = interpolate(frame, [fps * 9, fps * 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      backgroundColor: Colors.background,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top gradient */}
      <div style={{
        height: 4,
        background: `linear-gradient(90deg, ${Colors.hermesOrange}, ${Colors.hermesOrange}88)`,
      }} />

      {/* Logo + EVE header */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 160, gap: 20,
      }}>
        <div style={{ transform: `scale(${logoScale})` }}>
          <VascoLogo size={100} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          opacity: headerOpacity,
        }}>
          <span style={{
            fontSize: 20, fontWeight: 700, color: Colors.hermesOrange,
            fontFamily: 'Inter, sans-serif',
            backgroundColor: Colors.hermesOrange + '15',
            padding: '6px 16px', borderRadius: 20,
          }}>
            EVE says
          </span>
          <span style={{ fontSize: 28 }}>{tradeEmoji}</span>
          <span style={{
            fontSize: 18, fontWeight: 500, color: Colors.textSecondary,
            fontFamily: 'Inter, sans-serif',
          }}>
            {tradeName}
          </span>
        </div>
      </div>

      {/* Tip card */}
      <Sequence from={fps * 1.5}>
        <div style={{
          position: 'absolute', top: 420, left: 48, right: 48,
          backgroundColor: Colors.surfacePrimary,
          borderRadius: 24, padding: '36px 32px',
          borderLeft: `5px solid ${Colors.hermesOrange}`,
        }}>
          <span style={{
            fontSize: 28, fontWeight: 700, color: Colors.textPrimary,
            fontFamily: 'Inter, sans-serif', display: 'block',
            marginBottom: 16,
          }}>
            {tipTitle}
          </span>
          <span style={{
            fontSize: 22, fontWeight: 400, color: Colors.textSecondary,
            fontFamily: 'Inter, sans-serif', lineHeight: 1.6,
          }}>
            {visibleText}
            <span style={{
              color: Colors.hermesOrange,
              opacity: frame % 30 > 15 ? 1 : 0, // Blinking cursor
            }}>|</span>
          </span>
        </div>
      </Sequence>

      {/* CTA */}
      <Sequence from={fps * 9} durationInFrames={fps * 4}>
        <div style={{ opacity: ctaOpacity }}>
          <CTABanner text={ctaText} subtext="AI-powered insights for contractors" />
          <VascoBranding position="bottom" />
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
