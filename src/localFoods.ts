// Common Nepali and South Asian dishes with rough numbers for one typical serving.
// These are estimates, not lab values: real portions and recipes vary a lot. Always editable after picking.
import type { Saved } from './foodCore';

export type Dish = { name: string; serving: string; kcal: number; protein: number };

export const LOCAL_DISHES: Dish[] = [
  { name: 'Dal bhat', serving: '1 plate with tarkari', kcal: 650, protein: 18 },
  { name: 'Cooked rice', serving: '1 cup', kcal: 200, protein: 4 },
  { name: 'Dal', serving: '1 bowl', kcal: 180, protein: 10 },
  { name: 'Aloo tarkari', serving: '1 serving', kcal: 150, protein: 3 },
  { name: 'Saag', serving: '1 serving', kcal: 100, protein: 4 },
  { name: 'Gundruk soup', serving: '1 bowl', kcal: 60, protein: 3 },
  { name: 'Dhido', serving: '1 serving with soup', kcal: 450, protein: 12 },
  { name: 'Roti or chapati', serving: '1 piece', kcal: 100, protein: 3 },
  { name: 'Paratha', serving: '1 plain', kcal: 250, protein: 5 },
  { name: 'Aloo paratha', serving: '1 piece', kcal: 300, protein: 6 },
  { name: 'Steamed chicken momo', serving: '10 pieces', kcal: 400, protein: 22 },
  { name: 'Steamed veg momo', serving: '10 pieces', kcal: 300, protein: 9 },
  { name: 'Fried chicken momo', serving: '10 pieces', kcal: 550, protein: 22 },
  { name: 'Chicken chow mein', serving: '1 plate', kcal: 550, protein: 18 },
  { name: 'Thukpa', serving: '1 bowl', kcal: 400, protein: 18 },
  { name: 'Chicken curry', serving: '1 serving', kcal: 300, protein: 25 },
  { name: 'Paneer curry', serving: '1 serving', kcal: 330, protein: 15 },
  { name: 'Chicken biryani', serving: '1 plate', kcal: 600, protein: 28 },
  { name: 'Khichdi', serving: '1 bowl', kcal: 300, protein: 10 },
  { name: 'Boiled egg', serving: '1 egg', kcal: 75, protein: 6 },
  { name: 'Omelette', serving: '2 eggs', kcal: 220, protein: 13 },
  { name: 'Chiura with curd', serving: '1 plate', kcal: 350, protein: 10 },
  { name: 'Curd', serving: '1 cup', kcal: 150, protein: 8 },
  { name: 'Lassi', serving: '1 glass', kcal: 180, protein: 6 },
  { name: 'Milk tea with sugar', serving: '1 cup', kcal: 100, protein: 2 },
  { name: 'Samosa', serving: '1 piece', kcal: 260, protein: 4 },
  { name: 'Pakora', serving: '5 pieces', kcal: 250, protein: 5 },
  { name: 'Sel roti', serving: '1 piece', kcal: 150, protein: 2 },
  { name: 'Chatamari', serving: '1 piece', kcal: 200, protein: 8 },
  { name: 'Choila', serving: '1 serving', kcal: 250, protein: 22 },
  { name: 'Sukuti', serving: '50 g', kcal: 150, protein: 25 },
  { name: 'Dosa', serving: '1 plain', kcal: 170, protein: 4 },
  { name: 'Idli', serving: '2 pieces', kcal: 100, protein: 4 },
  { name: 'Fried rice', serving: '1 plate', kcal: 500, protein: 12 },
  { name: 'Pani puri', serving: '6 pieces', kcal: 200, protein: 3 },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Dishes whose name contains every word typed. An empty query gives the first `n` (the everyday ones). */
export function findDishes(query: string, n = 6): Dish[] {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length) return LOCAL_DISHES.slice(0, n);
  return LOCAL_DISHES.filter((d) => words.every((w) => norm(`${d.name} ${d.serving}`).includes(w))).slice(0, n);
}

/** Scale a dish for half a serving, double, and so on. Calories to whole numbers, protein to one decimal. */
export function scaleDish(d: Dish, times: number) {
  return { kcal: Math.round(d.kcal * times), protein: Math.round(d.protein * times * 10) / 10 };
}

/** Dishes shaped like saved meals, leaving out any whose name the user already saved. */
export function dishesAsSaved(saved: Saved[]): Saved[] {
  const have = new Set(saved.map((s) => norm(s.name)));
  return LOCAL_DISHES.filter((d) => !have.has(norm(d.name))).map((d) => ({ id: `local-${norm(d.name)}`, name: d.name, kcal: d.kcal, protein: d.protein }));
}
