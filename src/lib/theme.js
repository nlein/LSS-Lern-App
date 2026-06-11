export const DARK_COLORS = {
  bg: '#0f0f1a',
  surface: '#1a1a2e',
  surfaceHigh: '#252540',
  border: '#2e2e4e',
  accent: '#4a9eff',
  accentDim: '#1e3a5f',
  correct: '#22c55e',
  correctDim: '#14532d',
  wrong: '#ef4444',
  wrongDim: '#450a0a',
  partial: '#f59e0b',
  partialDim: '#451a03',
  text: '#e2e8f0',
  textSub: '#94a3b8',
  textMuted: '#475569',
  commission: '#a855f7',
  commissionDim: '#2e1065',
};

export const LIGHT_COLORS = {
  bg: '#f5f5f8',
  surface: '#ffffff',
  surfaceHigh: '#f0f0f5',
  border: '#dde1ea',
  accent: '#1a56db',
  accentDim: '#e8f0fe',
  correct: '#15803d',
  correctDim: '#dcfce7',
  wrong: '#dc2626',
  wrongDim: '#fee2e2',
  partial: '#b45309',
  partialDim: '#fef3c7',
  text: '#111827',
  textSub: '#374151',
  textMuted: '#6b7280',
  commission: '#7c3aed',
  commissionDim: '#ede9fe',
};

// Default export stays dark for any remaining direct imports
export const COLORS = DARK_COLORS;

export const FONT_SIZES = {
  small:  { body: 14, question: 16, option: 14, label: 12 },
  medium: { body: 16, question: 18, option: 15, label: 13 },
  large:  { body: 18, question: 21, option: 17, label: 14 },
};
