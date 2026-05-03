import { describe, expect, it } from 'vitest';
import { generateWorld } from './generator';
import { TileType } from './world';

const CONFIG = { cols: 30, rows: 220, surfaceRow: 8, seed: 12345 };

function emptyCounts(): Record<TileType, number> {
  return {
    [TileType.EMPTY]: 0,
    [TileType.DIRT]: 0,
    [TileType.ROCK]: 0,
    [TileType.COPPER]: 0,
    [TileType.IRON]: 0,
    [TileType.SILVER]: 0,
    [TileType.GOLD]: 0,
    [TileType.PLATINUM]: 0,
    [TileType.RUBY]: 0,
    [TileType.DIAMOND]: 0,
    [TileType.LAVA]: 0,
  };
}

function tally(seed: number): Record<TileType, number> {
  const w = generateWorld({ ...CONFIG, seed });
  const counts = emptyCounts();
  for (let r = 0; r < CONFIG.rows; r++) {
    for (let c = 0; c < CONFIG.cols; c++) {
      counts[w.getTile(c, r)]++;
    }
  }
  return counts;
}

function tallyDepthBand(seed: number, fromDepth: number, toDepth: number): Record<TileType, number> {
  const w = generateWorld({ ...CONFIG, seed });
  const counts = emptyCounts();
  for (let r = CONFIG.surfaceRow + fromDepth; r < CONFIG.surfaceRow + toDepth; r++) {
    for (let c = 0; c < CONFIG.cols; c++) {
      counts[w.getTile(c, r)]++;
    }
  }
  return counts;
}

describe('generateWorld', () => {
  it('leaves rows above surface empty', () => {
    const w = generateWorld(CONFIG);
    for (let r = 0; r < CONFIG.surfaceRow; r++) {
      for (let c = 0; c < CONFIG.cols; c++) {
        expect(w.getTile(c, r)).toBe(TileType.EMPTY);
      }
    }
  });

  it('fills every tile below surface (no empties)', () => {
    const w = generateWorld(CONFIG);
    for (let r = CONFIG.surfaceRow; r < CONFIG.rows; r++) {
      for (let c = 0; c < CONFIG.cols; c++) {
        expect(w.getTile(c, r)).not.toBe(TileType.EMPTY);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const a = generateWorld(CONFIG);
    const b = generateWorld(CONFIG);
    for (let r = 0; r < CONFIG.rows; r++) {
      for (let c = 0; c < CONFIG.cols; c++) {
        expect(a.getTile(c, r)).toBe(b.getTile(c, r));
      }
    }
  });

  it('produces different worlds for different seeds', () => {
    const a = generateWorld({ ...CONFIG, seed: 1 });
    const b = generateWorld({ ...CONFIG, seed: 2 });
    let differences = 0;
    for (let r = 0; r < CONFIG.rows; r++) {
      for (let c = 0; c < CONFIG.cols; c++) {
        if (a.getTile(c, r) !== b.getTile(c, r)) differences++;
      }
    }
    expect(differences).toBeGreaterThan(100);
  });

  it('puts no diamond near the surface', () => {
    const counts = tallyDepthBand(CONFIG.seed, 0, 100);
    expect(counts[TileType.DIAMOND]).toBe(0);
    expect(counts[TileType.RUBY]).toBe(0);
  });

  it('puts no copper deep below its end depth', () => {
    const counts = tallyDepthBand(CONFIG.seed, 50, 100);
    expect(counts[TileType.COPPER]).toBe(0);
  });

  it('produces some of each ore across the full depth (sanity)', () => {
    const counts = tally(CONFIG.seed);
    expect(counts[TileType.DIRT]).toBeGreaterThan(0);
    expect(counts[TileType.COPPER]).toBeGreaterThan(0);
    expect(counts[TileType.IRON]).toBeGreaterThan(0);
    expect(counts[TileType.SILVER]).toBeGreaterThan(0);
    expect(counts[TileType.GOLD]).toBeGreaterThan(0);
    expect(counts[TileType.PLATINUM]).toBeGreaterThan(0);
    expect(counts[TileType.RUBY]).toBeGreaterThan(0);
    expect(counts[TileType.DIAMOND]).toBeGreaterThan(0);
    expect(counts[TileType.ROCK]).toBeGreaterThan(0);
  });

  it('puts no lava in the top 60 rows of underground', () => {
    const counts = tallyDepthBand(CONFIG.seed, 0, 60);
    expect(counts[TileType.LAVA]).toBe(0);
  });

  it('produces lava at deeper depths', () => {
    const counts = tallyDepthBand(CONFIG.seed, 100, 200);
    expect(counts[TileType.LAVA]).toBeGreaterThan(0);
  });
});
