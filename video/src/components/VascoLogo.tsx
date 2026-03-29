import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Colors } from '../data/theme';

export const VascoLogo: React.FC<{ size?: number }> = ({ size = 80 }) => (
  <div style={{
    width: size,
    height: size,
    borderRadius: size * 0.25,
    backgroundColor: Colors.hermesOrange,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <span style={{
      fontSize: size * 0.5,
      fontWeight: 800,
      color: Colors.white,
      fontFamily: 'Inter, sans-serif',
    }}>
      V
    </span>
  </div>
);

export const VascoBranding: React.FC<{ position?: 'top' | 'bottom' }> = ({ position = 'bottom' }) => (
  <div style={{
    position: 'absolute',
    [position]: 60,
    left: 0,
    right: 0,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  }}>
    <VascoLogo size={36} />
    <span style={{
      fontSize: 20,
      fontWeight: 700,
      color: Colors.white,
      fontFamily: 'Inter, sans-serif',
      letterSpacing: 1,
    }}>
      VASCO
    </span>
  </div>
);

export const CTABanner: React.FC<{ text: string; subtext?: string }> = ({ text, subtext }) => (
  <div style={{
    position: 'absolute',
    bottom: 120,
    left: 40,
    right: 40,
    backgroundColor: Colors.hermesOrange,
    borderRadius: 20,
    padding: '24px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  }}>
    <span style={{
      fontSize: 28,
      fontWeight: 700,
      color: Colors.white,
      fontFamily: 'Inter, sans-serif',
      textAlign: 'center',
    }}>
      {text}
    </span>
    {subtext && (
      <span style={{
        fontSize: 18,
        fontWeight: 400,
        color: 'rgba(255,255,255,0.85)',
        fontFamily: 'Inter, sans-serif',
        textAlign: 'center',
      }}>
        {subtext}
      </span>
    )}
  </div>
);
