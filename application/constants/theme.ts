/**
 * Design tokens for the app — all hardcoded colours, spacing, and typography
 * values should be referenced from here rather than inlined.
 */

export const Colors = {
  // Primary brand
  primary: '#007AFF',
  primaryDark: '#0A58CA',
  primaryLight: '#99C9FF',
  primarySubtle: '#EBF4FF',

  // Semantic
  income: '#4CAF50',
  incomeLight: '#4CD964',
  expense: '#F44336',
  danger: '#dc3545',
  dangerDark: '#d32f2f',
  warning: '#FFD60A',
  warningBg: '#FFF3CD',
  warningText: '#856404',

  // Text
  text: '#111',
  textDark: '#1a1a1a',
  textSecondary: '#333',
  textTertiary: '#555',
  textMuted: '#666',
  textFaint: '#888',
  textPlaceholder: '#999',
  textDisabled: '#aaa',
  textLight: '#9E9E9E',

  // Borders & dividers
  border: '#ddd',
  borderLight: '#eee',
  borderMedium: '#ccc',
  divider: '#e0e0e0',
  dividerLight: '#e8e8e8',

  // Backgrounds
  background: '#fff',
  backgroundSubtle: '#f9f9f9',
  backgroundFaint: '#fafafa',
  backgroundMuted: '#f5f5f5',
  backgroundLight: '#f0f0f0',

  // Absolute
  white: '#fff',
  black: '#000',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  xxl: 20,
  title: 24,
  display: 32,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};
