/** Format a category id slug for display (e.g. 'fast_food' → 'Fast Food') */
export function formatCategoryLabel(id: string): string {
  return id
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Returns '#fff' or '#000' depending on which has better contrast
 * against the given hex background color (WCAG relative luminance).
 */
export function getContrastColor(hex: string): '#fff' | '#000' {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#000';
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.35 ? '#000' : '#fff';
}
