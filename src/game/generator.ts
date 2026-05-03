import { mulberry32, type Rng } from './rng';
import { TileType, World } from './world';

interface OreRule {
  type: TileType;
  startDepth: number;
  peakDepth: number;
  endDepth: number;
  peakProb: number;
}

const ORE_RULES: readonly OreRule[] = [
  { type: TileType.COPPER, startDepth: 0, peakDepth: 6, endDepth: 35, peakProb: 0.14 },
  { type: TileType.IRON, startDepth: 6, peakDepth: 25, endDepth: 70, peakProb: 0.12 },
  { type: TileType.SILVER, startDepth: 25, peakDepth: 55, endDepth: 110, peakProb: 0.09 },
  { type: TileType.GOLD, startDepth: 55, peakDepth: 90, endDepth: 160, peakProb: 0.07 },
  { type: TileType.PLATINUM, startDepth: 95, peakDepth: 140, endDepth: 200, peakProb: 0.05 },
  { type: TileType.RUBY, startDepth: 130, peakDepth: 175, endDepth: 220, peakProb: 0.04 },
  { type: TileType.DIAMOND, startDepth: 160, peakDepth: 200, endDepth: 220, peakProb: 0.03 },
];

const ROCK_PROB_SHALLOW = 0.0;
const ROCK_PROB_DEEP = 0.06;
const ROCK_RAMP_DEPTH = 80;

const LAVA_MIN_DEPTH = 60;
const LAVA_MAX_DEPTH = 200;
const LAVA_PEAK_PROB = 0.045;

function oreProb(rule: OreRule, depth: number): number {
  if (depth < rule.startDepth || depth >= rule.endDepth) return 0;
  if (depth <= rule.peakDepth) {
    const span = rule.peakDepth - rule.startDepth;
    if (span <= 0) return rule.peakProb;
    return rule.peakProb * ((depth - rule.startDepth) / span);
  }
  const span = rule.endDepth - rule.peakDepth;
  if (span <= 0) return rule.peakProb;
  return rule.peakProb * ((rule.endDepth - depth) / span);
}

function rockProbAtDepth(depth: number): number {
  if (depth <= 0) return ROCK_PROB_SHALLOW;
  if (depth >= ROCK_RAMP_DEPTH) return ROCK_PROB_DEEP;
  const t = depth / ROCK_RAMP_DEPTH;
  return ROCK_PROB_SHALLOW + (ROCK_PROB_DEEP - ROCK_PROB_SHALLOW) * t;
}

function lavaProbAtDepth(depth: number): number {
  if (depth < LAVA_MIN_DEPTH || depth >= LAVA_MAX_DEPTH) return 0;
  const span = LAVA_MAX_DEPTH - LAVA_MIN_DEPTH;
  const t = (depth - LAVA_MIN_DEPTH) / span;
  return LAVA_PEAK_PROB * t;
}

function pickTile(depth: number, rand: Rng): TileType {
  if (rand() < rockProbAtDepth(depth)) return TileType.ROCK;
  if (rand() < lavaProbAtDepth(depth)) return TileType.LAVA;
  const roll = rand();
  let cum = 0;
  for (const rule of ORE_RULES) {
    cum += oreProb(rule, depth);
    if (roll < cum) return rule.type;
  }
  return TileType.DIRT;
}

export interface GenerationConfig {
  cols: number;
  rows: number;
  surfaceRow: number;
  seed: number;
}

export function generateWorld(config: GenerationConfig): World {
  const world = new World(config.cols, config.rows, config.surfaceRow);
  const rand = mulberry32(config.seed);
  for (let r = config.surfaceRow; r < config.rows; r++) {
    const depth = r - config.surfaceRow;
    for (let c = 0; c < config.cols; c++) {
      world.setTile(c, r, pickTile(depth, rand));
    }
  }
  return world;
}
