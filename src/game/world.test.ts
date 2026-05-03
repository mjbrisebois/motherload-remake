import { describe, expect, it } from 'vitest';
import { TileType, World } from './world';

describe('World', () => {
  it('rejects non-positive dimensions', () => {
    expect(() => new World(0, 10, 0)).toThrow();
    expect(() => new World(10, 0, 0)).toThrow();
  });

  it('rejects out-of-range surface row', () => {
    expect(() => new World(10, 10, -1)).toThrow();
    expect(() => new World(10, 10, 10)).toThrow();
  });

  it('starts with all tiles empty', () => {
    const w = new World(4, 4, 1);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        expect(w.getTile(c, r)).toBe(TileType.EMPTY);
      }
    }
  });

  it('treats out-of-bounds reads as empty', () => {
    const w = new World(4, 4, 0);
    expect(w.getTile(-1, 0)).toBe(TileType.EMPTY);
    expect(w.getTile(0, -1)).toBe(TileType.EMPTY);
    expect(w.getTile(4, 0)).toBe(TileType.EMPTY);
    expect(w.getTile(0, 4)).toBe(TileType.EMPTY);
  });

  it('setTile overwrites and isSolid reflects it', () => {
    const w = new World(4, 4, 0);
    expect(w.isSolid(0, 2)).toBe(false);
    w.setTile(0, 2, TileType.DIRT);
    expect(w.isSolid(0, 2)).toBe(true);
    w.setTile(0, 2, TileType.GOLD);
    expect(w.getTile(0, 2)).toBe(TileType.GOLD);
    expect(w.isSolid(0, 2)).toBe(true);
    w.setTile(0, 2, TileType.EMPTY);
    expect(w.isSolid(0, 2)).toBe(false);
  });

  it('setTile out-of-bounds is a no-op', () => {
    const w = new World(4, 4, 0);
    expect(() => w.setTile(-1, 0, TileType.DIRT)).not.toThrow();
    expect(() => w.setTile(99, 99, TileType.DIRT)).not.toThrow();
  });
});
