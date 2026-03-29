// =============================================================================
// COMPLIANCE ALERT — Country-specific regulation template (15-21s vertical)
// =============================================================================
// Country flag + regulation (2s) → Countdown animation (4s) →
// "Vasco tracks this" (4s) → CTA (4s)
// =============================================================================

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring, Sequence } from 'remotion';
import { Colors } from '../data/theme';
import { VascoBranding, CTABanner } from '../components/VascoLogo';

export interface ComplianceAlertProps {
  countryFlag: string;         // "🇳🇱"
  countryName: string;         // "Netherlands"
  regulationName: string;      // "VCA Safety Certificate"
  deadlineText: string;        // "Expires March 2026"
  daysLeft: number;
  consequence: string;         // "€5,000 fine if expired"
  tradeEmoji: string;
  tradeName: string;
  ctaText: string;
  language: string;
}

export const ComplianceAlert: React.FC<ComplianceAlertProps> = ({
  countryFlag, countryName, regulationName,
  deadlineText, daysLeft, consequence,
  tradeEmoji, tradeName, ctaText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerScale = spring({ frame, fps, config: { damping: 12 } });
  const countdownProgress = interpolate(frame, [fps * 3, fps * 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const alertPulse = Math.sin(frame * 0.15) * 0.1 + 1; // Gentle pulse
  const trackOpacity = interpolate(frame, [fps * 7, fps * 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ctaOpacity = interpolate(frame, [fps * 11, fps * 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const urgencyColor = daysLeft <= 30 ? Colors.error : daysLeft <= 90 ? Colors.warning : Colors.info;

  return (
    <AbsoluteFill style={{ backgroundColor: Colors.background }}>
      {/* Alert stripe top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 8,
        backgroundColor: urgencyColor,
      }} />

      {/* Country + Regulation header */}
      <Sequence from={0} durationInFrames={fps * 3}>
        <AbsoluteFill style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 20,
        }}>
          <span style={{
            fontSize: 120, transform: `scale(${headerScale})`,
          }}>
            {countryFlag}
          </span>
          <span style={{
            fontSize: 36, fontWeight: 800, color: Colors.textPrimary,
            fontFamily: 'Inter, sans-serif', textAlign: 'center',
          }}>
            {regulationName}
          </span>
          <span style={{
            fontSize: 20, fontWeight: 500, color: Colors.textSecondary,
            fontFamily: 'Inter, sans-serif',
          }}>
            {countryName} · {tradeEmoji} {tradeName}
          </span>
        </AbsoluteFill>
      </Sequence>

      {/* Countdown */}
      <Sequence from={fps * 3} durationInFrames={fps * 5}>
        <AbsoluteFill style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 24,
        }}>
          <div style={{
            transform: `scale(${alertPulse})`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              fontSize: 96, fontWeight: 800, color: urgencyColor,
              fontFamily: 'Inter, sans-serif',
            }}>
              {Math.round(daysLeft * countdownProgress)}
            </span>
            <span style={{
              fontSize: 28, fontWeight: 600, color: urgencyColor,
              fontFamily: 'Inter, sans-serif',
            }}>
              days remaining
            </span>
          </div>
          <span style={{
            fontSize: 22, fontWeight: 500, color: Colors.textSecondary,
            fontFamily: 'Inter, sans-serif', textAlign: 'center',
            opacity: interpolate(countdownProgress, [0.5, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}>
            {deadlineText}
          </span>
          <div style={{
            backgroundColor: urgencyColor + '15',
            borderRadius: 16, padding: '16px 28px', marginTop: 8,
            opacity: interpolate(countdownProgress, [0.7, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}>
            <span style={{
              fontSize: 20, fontWeight: 600, color: urgencyColor,
              fontFamily: 'Inter, sans-serif',
            }}>
              ⚠️ {consequence}
            </span>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Vasco tracks this */}
      <Sequence from={fps * 7} durationInFrames={fps * 5}>
        <AbsoluteFill style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 60, opacity: trackOpacity,
        }}>
          <div style={{
            backgroundColor: Colors.surfacePrimary,
            borderRadius: 24, padding: '40px 36px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            <span style={{ fontSize: 48 }}>🛡️</span>
            <span style={{
              fontSize: 32, fontWeight: 700, color: Colors.textPrimary,
              fontFamily: 'Inter, sans-serif', textAlign: 'center',
            }}>
              Vasco tracks all your certifications
            </span>
            <span style={{
              fontSize: 20, fontWeight: 400, color: Colors.textSecondary,
              fontFamily: 'Inter, sans-serif', textAlign: 'center',
            }}>
              Get alerts 30, 60, 90 days before expiry
            </span>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* CTA */}
      <Sequence from={fps * 11} durationInFrames={fps * 7}>
        <div style={{ opacity: ctaOpacity }}>
          <CTABanner text={ctaText} />
          <VascoBranding position="bottom" />
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
