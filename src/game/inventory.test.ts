import { describe, expect, it } from 'vitest';
import { Inventory } from './inventory';
import { TileType } from './world';
import { TILE_META } from './tiles';

describe('Inventory', () => {
  it('rejects non-positive capacity', () => {
    expect(() => new Inventory(0)).toThrow();
    expect(() => new Inventory(-1)).toThrow();
  });

  it('starts empty', () => {
    const inv = new Inventory(10);
    expect(inv.total()).toBe(0);
    expect(inv.isFull()).toBe(false);
    expect(inv.count(TileType.GOLDIUM)).toBe(0);
    expect(inv.totalValue()).toBe(0);
    expect(inv.entries()).toEqual([]);
  });

  it('tryAdd increments counts and respects capacity', () => {
    const inv = new Inventory(3);
    expect(inv.tryAdd(TileType.GOLDIUM)).toBe(true);
    expect(inv.tryAdd(TileType.BRONZIUM)).toBe(true);
    expect(inv.tryAdd(TileType.GOLDIUM)).toBe(true);
    expect(inv.total()).toBe(3);
    expect(inv.isFull()).toBe(true);
    expect(inv.tryAdd(TileType.IRONIUM)).toBe(false);
    expect(inv.count(TileType.GOLDIUM)).toBe(2);
    expect(inv.count(TileType.BRONZIUM)).toBe(1);
    expect(inv.count(TileType.IRONIUM)).toBe(0);
  });

  it('refuses EMPTY tiles', () => {
    const inv = new Inventory(5);
    expect(inv.tryAdd(TileType.EMPTY)).toBe(false);
    expect(inv.total()).toBe(0);
  });

  it('totalValue sums per-type values', () => {
    const inv = new Inventory(10);
    inv.tryAdd(TileType.IRONIUM);
    inv.tryAdd(TileType.IRONIUM);
    inv.tryAdd(TileType.GOLDIUM);
    expect(inv.totalValue()).toBe(
      2 * TILE_META[TileType.IRONIUM].value + TILE_META[TileType.GOLDIUM].value,
    );
  });

  it('entries are sorted by tile type and skip zeros', () => {
    const inv = new Inventory(10);
    inv.tryAdd(TileType.GOLDIUM);
    inv.tryAdd(TileType.IRONIUM);
    inv.tryAdd(TileType.BRONZIUM);
    const types = inv.entries().map(([t]) => t);
    expect(types).toEqual([TileType.IRONIUM, TileType.BRONZIUM, TileType.GOLDIUM]);
  });

  it('clear empties everything', () => {
    const inv = new Inventory(5);
    inv.tryAdd(TileType.GOLDIUM);
    inv.tryAdd(TileType.BRONZIUM);
    inv.clear();
    expect(inv.total()).toBe(0);
    expect(inv.totalValue()).toBe(0);
  });
});
