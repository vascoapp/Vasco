// =============================================================================
// PRICE CHECK — Supplier comparison template (15-21s vertical TikTok)
// =============================================================================
// Hook (2s) → Split comparison (6s) → Savings callout (4s) → CTA (4s)
// =============================================================================

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring, Sequence } from 'remotion';
import { Colors } from '../data/theme';
import { VascoBranding, CTABanner } from '../components/VascoLogo';

export interface PriceCheckProps {
  hookText: string;
  materialName: string;
  supplierA: { name: string; price: number };
  supplierB: { name: string; price: number };
  savingsAmount: number;
  savingsPercent: number;
  ctaText: string;
  language: string;
}

export const PriceCheck: React.FC<PriceCheckProps> = ({
  hookText, materialName,
  supplierA, supplierB,
  savingsAmount, savingsPercent,
  ctaText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hookOpacity = interpolate(frame, [0, 10, fps * 2 - 10, fps * 2], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const barProgress = interpolate(frame, [fps * 3, fps * 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const savingsScale = spring({ frame: frame - fps * 7, fps, config: { damping: 10, stiffness: 100 } });
  const ctaOpacity = interpolate(frame, [fps * 11, fps * 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const cheaperSupplier = supplierA.price <= supplierB.price ? supplierA : supplierB;
  const maxPrice = Math.max(supplierA.price, supplierB.price);

  return (
    <AbsoluteFill style={{ backgroundColor: Colors.background }}>
      {/* Hook */}
      <Sequence from={0} durationInFrames={fps * 3}>
        <AbsoluteFill style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 60, opacity: hookOpacity,
        }}>
          <span style={{
            fontSize: 44, fontWeight: 800, color: Colors.textPrimary,
            fontFamily: 'Inter, sans-serif', textAlign: 'center', lineHeight: 1.2,
          }}>
            {hookText}
          </span>
        </AbsoluteFill>
      </Sequence>

      {/* Price comparison */}
      <Sequence from={fps * 2} durationInFrames={fps * 6}>
        <AbsoluteFill style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: 60, gap: 40,
        }}>
          <span style={{
            fontSize: 28, fontWeight: 700, color: Colors.textSecondary,
            fontFamily: 'Inter, sans-serif', textAlign: 'center',
          }}>
            {materialName}
          </span>

          {[supplierA, supplierB].map((supplier, i) => {
            const isWinner = supplier.name === cheaperSupplier.name;
            const barWidth = barProgress * (supplier.price / maxPrice) * 100;
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{
                    fontSize: 24, fontWeight: 600, color: Colors.textPrimary,
                    fontFamily: 'Inter, sans-serif',
                  }}>
                    {supplier.name}
                  </span>
                  <span style={{
                    fontSize: 32, fontWeight: 800,
                    color: isWinner ? Colors.success : Colors.textPrimary,
                    fontFamily: 'Inter, sans-serif',
                  }}>
                    €{supplier.price.toFixed(2)}
                  </span>
                </div>
                <div style={{
                  height: 40, backgroundColor: '#E5E7EB', borderRadius: 12,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 12,
                    width: `${barWidth}%`,
                    backgroundColor: isWinner ? Colors.success : Colors.hermesOrange,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            );
          })}
        </AbsoluteFill>
      </Sequence>

      {/* Savings callout */}
      <Sequence from={fps * 7} durationInFrames={fps * 5}>
        <AbsoluteFill style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16,
        }}>
          <div style={{
            transform: `scale(${savingsScale})`,
            backgroundColor: Colors.success + '15',
            borderRadius: 24, padding: '32px 48px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              fontSize: 72, fontWeight: 800, color: Colors.success,
              fontFamily: 'Inter, sans-serif',
            }}>
              €{savingsAmount.toFixed(0)}
            </span>
            <span style={{
              fontSize: 24, fontWeight: 600, color: Colors.success,
              fontFamily: 'Inter, sans-serif',
            }}>
              {savingsPercent}% cheaper at {cheaperSupplier.name}
            </span>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* CTA */}
      <Sequence from={fps * 11} durationInFrames={fps * 7}>
        <div style={{ opacity: ctaOpacity }}>
          <CTABanner text={ctaText} subtext="Vasco finds the best deals for you" />
          <VascoBranding position="bottom" />
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
