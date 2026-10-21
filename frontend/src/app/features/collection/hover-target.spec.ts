import { isHoverMatch } from './hover-target';

describe('isHoverMatch', () => {
  it('hovering one Recently Edited loadout lights only that loadout among its frame', () => {
    const target = { frame: 'Mesa', loadoutId: 'a' };
    expect(isHoverMatch(target, 'Mesa', 'a')).toBe(true);
    expect(isHoverMatch(target, 'Mesa', 'b')).toBe(false);
  });

  it('it still lights the frame card in the grid (which stands for the whole frame)', () => {
    expect(isHoverMatch({ frame: 'Mesa', loadoutId: 'a' }, 'Mesa', null)).toBe(true);
  });

  it('hovering a grid card lights every loadout of that frame', () => {
    const target = { frame: 'Mesa', loadoutId: null };
    expect(isHoverMatch(target, 'Mesa', 'a')).toBe(true);
    expect(isHoverMatch(target, 'Mesa', 'b')).toBe(true);
  });

  it('never lights other frames, or anything when nothing is hovered', () => {
    expect(isHoverMatch({ frame: 'Mesa', loadoutId: null }, 'Volt', 'x')).toBe(false);
    expect(isHoverMatch(null, 'Mesa', 'a')).toBe(false);
  });
});
