// =============================================================================
// BEFORE/AFTER — Job showcase template (10-15s vertical TikTok)
// =============================================================================
// Before photo (3s) → Swipe transition (1s) → After photo (3s) →
// Trade + location overlay (2s) → CTA (3s)
// =============================================================================

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Sequence } from 'remotion';
import { Colors } from '../data/theme';
import { VascoBranding, CTABanner } from '../components/VascoLogo';

export interface BeforeAfterProps {
  beforeImageUrl: string;      // URL or local path
  afterImageUrl: string;
  tradeEmoji: string;
  tradeName: string;
  tradeColor: string;
  location: string;            // "Amsterdam, NL"
  contractorQuote?: string;    // "Completed in 3 days"
  ctaText: string;
  language: string;
}

export const BeforeAfter: React.FC<BeforeAfterProps> = ({
  beforeImageUrl, afterImageUrl,
  tradeEmoji, tradeName, tradeColor, location,
  contractorQuote, ctaText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Swipe position: 0 = full before, 1 = full after
  const swipeProgress = interpolate(frame, [fps * 3, fps * 4], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const labelOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const overlayOpacity = interpolate(frame, [fps * 5, fps * 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ctaOpacity = interpolate(frame, [fps * 8, fps * 9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: Colors.black }}>
      {/* Before image */}
      <AbsoluteFill>
        <div style={{
          width: '100%', height: '100%',
          backgroundImage: `url(${beforeImageUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          clipPath: `inset(0 ${swipeProgress * 100}% 0 0)`,
        }} />
      </AbsoluteFill>

      {/* After image */}
      <AbsoluteFill>
        <div style={{
          width: '100%', height: '100%',
          backgroundImage: `url(${afterImageUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          clipPath: `inset(0 0 0 ${(1 - swipeProgress) * 100}%)`,
        }} />
      </AbsoluteFill>

      {/* Swipe divider line */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        left: `${(1 - swipeProgress) * 100}%`,
        width: 4, backgroundColor: Colors.white,
        boxShadow: '0 0 20px rgba(0,0,0,0.5)',
      }} />

      {/* Before/After labels */}
      <div style={{
        position: 'absolute', top: 100, left: 40,
        opacity: labelOpacity * (1 - swipeProgress),
      }}>
        <span style={{
          fontSize: 36, fontWeight: 800, color: Colors.white,
          fontFamily: 'Inter, sans-serif',
          textShadow: '0 2px 8px rgba(0,0,0,0.6)',
          backgroundColor: 'rgba(0,0,0,0.4)', padding: '8px 20px', borderRadius: 12,
        }}>
          BEFORE
        </span>
      </div>
      <div style={{
        position: 'absolute', top: 100, right: 40,
        opacity: swipeProgress,
      }}>
        <span style={{
          fontSize: 36, fontWeight: 800, color: Colors.white,
          fontFamily: 'Inter, sans-serif',
          textShadow: '0 2px 8px rgba(0,0,0,0.6)',
          backgroundColor: Colors.success + 'CC', padding: '8px 20px', borderRadius: 12,
        }}>
          AFTER
        </span>
      </div>

      {/* Trade + location overlay */}
      <Sequence from={fps * 5} durationInFrames={fps * 5}>
        <div style={{
          position: 'absolute', bottom: 300, left: 40, right: 40,
          opacity: overlayOpacity,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            backgroundColor: 'rgba(0,0,0,0.6)', padding: '16px 24px',
            borderRadius: 16, backdropFilter: 'blur(10px)',
          }}>
            <span style={{ fontSize: 40 }}>{tradeEmoji}</span>
            <div>
              <span style={{
                fontSize: 24, fontWeight: 700, color: Colors.white,
                fontFamily: 'Inter, sans-serif', display: 'block',
              }}>
                {tradeName}
              </span>
              <span style={{
                fontSize: 16, color: 'rgba(255,255,255,0.7)',
                fontFamily: 'Inter, sans-serif',
              }}>
                📍 {location}
              </span>
            </div>
          </div>
          {contractorQuote && (
            <span style={{
              fontSize: 20, fontWeight: 500, color: Colors.white,
              fontFamily: 'Inter, sans-serif',
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
              fontStyle: 'italic',
            }}>
              "{contractorQuote}"
            </span>
          )}
        </div>
      </Sequence>

      {/* CTA */}
      <Sequence from={fps * 8} durationInFrames={fps * 4}>
        <div style={{ opacity: ctaOpacity }}>
          <CTABanner text={ctaText} />
          <VascoBranding position="bottom" />
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
