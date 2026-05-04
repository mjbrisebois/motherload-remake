import { TileType } from './world';

export interface TileMeta {
  name: string;
  baseColor: number;
  accentColor: number | null;
  value: number;
  drillTime: number;
  hardness: number;
}

const DIRT_BROWN = 0x6b4423;

export const TILE_META: Record<TileType, TileMeta> = {
  [TileType.EMPTY]: {
    name: 'empty',
    baseColor: 0x000000,
    accentColor: null,
    value: 0,
    drillTime: 0,
    hardness: 0,
  },
  [TileType.DIRT]: {
    name: 'dirt',
    baseColor: DIRT_BROWN,
    accentColor: null,
    value: 0,
    drillTime: 0.4,
    hardness: 0,
  },
  [TileType.ROCK]: {
    name: 'rock',
    baseColor: 0x6e6e76,
    accentColor: null,
    value: 0,
    drillTime: 1.5,
    hardness: 1,
  },
  [TileType.IRONIUM]: {
    name: 'ironium',
    baseColor: DIRT_BROWN,
    accentColor: 0xb87333,
    value: 5,
    drillTime: 0.5,
    hardness: 0,
  },
  [TileType.BRONZIUM]: {
    name: 'bronzium',
    baseColor: DIRT_BROWN,
    accentColor: 0xa19d94,
    value: 12,
    drillTime: 0.55,
    hardness: 0,
  },
  [TileType.SILVERIUM]: {
    name: 'silverium',
    baseColor: DIRT_BROWN,
    accentColor: 0xd0d0d0,
    value: 30,
    drillTime: 0.6,
    hardness: 0,
  },
  [TileType.GOLDIUM]: {
    name: 'goldium',
    baseColor: DIRT_BROWN,
    accentColor: 0xffd23f,
    value: 60,
    drillTime: 0.7,
    hardness: 0,
  },
  [TileType.PLATINIUM]: {
    name: 'platinium',
    baseColor: DIRT_BROWN,
    accentColor: 0xe5e4e2,
    value: 120,
    drillTime: 0.85,
    hardness: 0,
  },
  [TileType.EINSTEINIUM]: {
    name: 'einsteinium',
    baseColor: DIRT_BROWN,
    accentColor: 0xb6ff3c,
    value: 180,
    drillTime: 0.92,
    hardness: 0,
  },
  [TileType.RUBY]: {
    name: 'ruby',
    baseColor: DIRT_BROWN,
    accentColor: 0xe0115f,
    value: 250,
    drillTime: 1.0,
    hardness: 0,
  },
  [TileType.EMERALD]: {
    name: 'emerald',
    baseColor: DIRT_BROWN,
    accentColor: 0x2ecc71,
    value: 375,
    drillTime: 1.1,
    hardness: 0,
  },
  [TileType.DIAMOND]: {
    name: 'diamond',
    baseColor: DIRT_BROWN,
    accentColor: 0xb9f2ff,
    value: 500,
    drillTime: 1.2,
    hardness: 0,
  },
  [TileType.AMAZONITE]: {
    name: 'amazonite',
    baseColor: DIRT_BROWN,
    accentColor: 0x2e8b8b,
    value: 850,
    drillTime: 1.4,
    hardness: 0,
  },
  [TileType.LAVA]: {
    name: 'lava',
    baseColor: 0xff4500,
    accentColor: 0xffd24a,
    value: 0,
    drillTime: 999,
    hardness: 99,
  },
};

export const RENDERED_TILE_TYPES: readonly TileType[] = [
  TileType.DIRT,
  TileType.ROCK,
  TileType.IRONIUM,
  TileType.BRONZIUM,
  TileType.SILVERIUM,
  TileType.GOLDIUM,
  TileType.PLATINIUM,
  TileType.EINSTEINIUM,
  TileType.RUBY,
  TileType.EMERALD,
  TileType.DIAMOND,
  TileType.AMAZONITE,
  TileType.LAVA,
];

export function isDrillable(type: TileType, drillLevel: number): boolean {
  if (type === TileType.EMPTY) return false;
  return TILE_META[type].hardness <= drillLevel;
}
