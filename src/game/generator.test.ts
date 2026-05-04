import { describe, expect, it } from 'vitest';
import { generateWorld } from './generator';
import { TileType } from './world';

const CONFIG = { cols: 30, rows: 510, surfaceRow: 8, seed: 12345 };

function emptyCounts(): Record<TileType, number> {
  return {
    [TileType.EMPTY]: 0,
    [TileType.DIRT]: 0,
    [TileType.ROCK]: 0,
    [TileType.IRONIUM]: 0,
    [TileType.BRONZIUM]: 0,
    [TileType.SILVERIUM]: 0,
    [TileType.GOLDIUM]: 0,
    [TileType.PLATINIUM]: 0,
    [TileType.EINSTEINIUM]: 0,
    [TileType.RUBY]: 0,
    [TileType.EMERALD]: 0,
    [TileType.DIAMOND]: 0,
    [TileType.AMAZONITE]: 0,
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

  it('puts no deep gems near the surface', () => {
    const counts = tallyDepthBand(CONFIG.seed, 0, 200);
    expect(counts[TileType.RUBY]).toBe(0);
    expect(counts[TileType.EMERALD]).toBe(0);
    expect(counts[TileType.DIAMOND]).toBe(0);
    expect(counts[TileType.AMAZONITE]).toBe(0);
    expect(counts[TileType.EINSTEINIUM]).toBe(0);
  });

  it('puts no ironium deep below its end depth', () => {
    const counts = tallyDepthBand(CONFIG.seed, 80, 200);
    expect(counts[TileType.IRONIUM]).toBe(0);
  });

  it('puts no amazonite shallow', () => {
    const counts = tallyDepthBand(CONFIG.seed, 0, 420);
    expect(counts[TileType.AMAZONITE]).toBe(0);
  });

  it('produces some of each ore across the full depth (sanity)', () => {
    const counts = tally(CONFIG.seed);
    expect(counts[TileType.DIRT]).toBeGreaterThan(0);
    expect(counts[TileType.IRONIUM]).toBeGreaterThan(0);
    expect(counts[TileType.BRONZIUM]).toBeGreaterThan(0);
    expect(counts[TileType.SILVERIUM]).toBeGreaterThan(0);
    expect(counts[TileType.GOLDIUM]).toBeGreaterThan(0);
    expect(counts[TileType.PLATINIUM]).toBeGreaterThan(0);
    expect(counts[TileType.EINSTEINIUM]).toBeGreaterThan(0);
    expect(counts[TileType.RUBY]).toBeGreaterThan(0);
    expect(counts[TileType.EMERALD]).toBeGreaterThan(0);
    expect(counts[TileType.DIAMOND]).toBeGreaterThan(0);
    expect(counts[TileType.AMAZONITE]).toBeGreaterThan(0);
    expect(counts[TileType.ROCK]).toBeGreaterThan(0);
  });

  it('puts no lava in the top 250 rows of underground', () => {
    const counts = tallyDepthBand(CONFIG.seed, 0, 250);
    expect(counts[TileType.LAVA]).toBe(0);
  });

  it('produces lava at deeper depths', () => {
    const counts = tallyDepthBand(CONFIG.seed, 300, 490);
    expect(counts[TileType.LAVA]).toBeGreaterThan(0);
  });
});
