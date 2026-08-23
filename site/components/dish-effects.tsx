import type { MenuCategory } from '../lib/catalog';

/**
 * A wisp or a glint, matched to what the dish actually is.
 *
 * Coffee steams regardless of hot/iced — the cup drawn in the tile is always
 * the hot one — and a food item steams only when it is named as served hot
 * (`hot: true` in lib/catalog.ts), so a cold sandwich never looks like it is
 * smoking. Everything else — cold drinks, bakery, dessert — gets a small
 * glint instead: sugar or condensation catching light, not heat.
 *
 * One component rather than three copies of this branch, because the same
 * dish appears on the home page, the menu grid and the dish sheet, and the
 * three had already drifted out of sync once (only the home grid steamed).
 */
export function DishEffects({ category, hot }: { category: MenuCategory; hot?: boolean }) {
  if (category === 'coffee' || hot) {
    return (
      <>
        <span className="steam steam-one" aria-hidden />
        <span className="steam steam-two" aria-hidden />
      </>
    );
  }

  return (
    <>
      <span className="glint glint-one" aria-hidden />
      <span className="glint glint-two" aria-hidden />
    </>
  );
}
