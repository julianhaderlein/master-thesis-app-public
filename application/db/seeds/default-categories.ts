import * as schema from '@/db/schema';

/**
 * Default categories seeded on first launch.
 * The `id` slug is the display name — format with formatCategoryLabel() for UI.
 * Using fixed slug IDs makes this idempotent (no UUID collisions / duplicate seeds).
 */
export const defaultCategories: (typeof schema.categories.$inferInsert)[] = [
  // Expenses
  { id: 'groceries',      originPeerId: 'system', icon: 'cart-outline',           color: '#4CAF50' },
  { id: 'transport',      originPeerId: 'system', icon: 'car-outline',            color: '#2196F3' },
  { id: 'dining',         originPeerId: 'system', icon: 'restaurant-outline',     color: '#FF9800' },
  { id: 'entertainment',  originPeerId: 'system', icon: 'game-controller-outline', color: '#9C27B0' },
  { id: 'health',         originPeerId: 'system', icon: 'medkit-outline',          color: '#F44336' },
  { id: 'housing',        originPeerId: 'system', icon: 'home-outline',           color: '#795548' },
  { id: 'utilities',      originPeerId: 'system', icon: 'flash-outline',          color: '#FFC107' },
  { id: 'clothing',       originPeerId: 'system', icon: 'shirt-outline',          color: '#E91E63' },
  { id: 'education',      originPeerId: 'system', icon: 'school-outline',         color: '#00BCD4' },
  { id: 'travel',         originPeerId: 'system', icon: 'airplane-outline',       color: '#03A9F4' },
  { id: 'subscriptions',  originPeerId: 'system', icon: 'repeat-outline',         color: '#607D8B' },
  { id: 'personal_care',  originPeerId: 'system', icon: 'cut-outline',            color: '#FF5722' },
  // Income
  { id: 'salary',         originPeerId: 'system', icon: 'briefcase-outline',      color: '#4CAF50' },
  { id: 'freelance',      originPeerId: 'system', icon: 'laptop-outline',         color: '#8BC34A' },
  { id: 'investment',     originPeerId: 'system', icon: 'trending-up-outline',    color: '#009688' },
  { id: 'gift',           originPeerId: 'system', icon: 'gift-outline',           color: '#FF4081' },
  // Other
  { id: 'other',          originPeerId: 'system', icon: 'ellipsis-horizontal-outline', color: '#9E9E9E' },
];
