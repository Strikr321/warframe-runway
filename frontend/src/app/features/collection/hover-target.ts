/**
 * What the pointer is over on the Collection page, shared by the grid and the Recently Edited
 * row. A grid card is a whole frame (`loadoutId` null); a Recently Edited card is one loadout.
 */
export interface HoverTarget {
  frame: string;
  loadoutId: string | null;
}

/** Whether a card showing `loadoutId` of `frame` should light up for this hover. */
export function isHoverMatch(
  target: HoverTarget | null,
  frame: string,
  loadoutId: string | null,
): boolean {
  if (!target || target.frame !== frame) return false;
  return target.loadoutId === null || loadoutId === null || target.loadoutId === loadoutId;
}
