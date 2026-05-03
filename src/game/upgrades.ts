export enum UpgradeKind {
  FUEL_TANK = 'FUEL_TANK',
  CARGO_BAY = 'CARGO_BAY',
  HULL = 'HULL',
  DRILL = 'DRILL',
  ENGINE = 'ENGINE',
}

export interface UpgradeTrack {
  kind: UpgradeKind;
  name: string;
  costs: readonly number[];
  values: readonly number[];
  unit: string;
}

export const UPGRADE_TRACKS: Record<UpgradeKind, UpgradeTrack> = {
  [UpgradeKind.FUEL_TANK]: {
    kind: UpgradeKind.FUEL_TANK,
    name: 'Fuel Tank',
    costs: [100, 250, 600, 1500, 3500],
    values: [100, 150, 220, 320, 460, 650],
    unit: 'fuel',
  },
  [UpgradeKind.CARGO_BAY]: {
    kind: UpgradeKind.CARGO_BAY,
    name: 'Cargo Bay',
    costs: [150, 400, 1000, 2500, 6000],
    values: [15, 25, 40, 60, 85, 120],
    unit: 'slots',
  },
  [UpgradeKind.HULL]: {
    kind: UpgradeKind.HULL,
    name: 'Hull',
    costs: [120, 300, 700, 1700, 4000],
    values: [100, 140, 190, 250, 320, 400],
    unit: 'hp',
  },
  [UpgradeKind.DRILL]: {
    kind: UpgradeKind.DRILL,
    name: 'Drill',
    costs: [300, 700, 1500, 3500, 8000],
    values: [0, 1, 2, 3, 4, 5],
    unit: 'lvl',
  },
  [UpgradeKind.ENGINE]: {
    kind: UpgradeKind.ENGINE,
    name: 'Engine',
    costs: [200, 500, 1200, 2800, 6500],
    values: [1.0, 1.2, 1.45, 1.7, 2.0, 2.4],
    unit: 'x thrust',
  },
};

export const UPGRADE_KINDS_ORDERED: readonly UpgradeKind[] = [
  UpgradeKind.FUEL_TANK,
  UpgradeKind.CARGO_BAY,
  UpgradeKind.HULL,
  UpgradeKind.DRILL,
  UpgradeKind.ENGINE,
];

export function maxLevel(track: UpgradeTrack): number {
  return track.costs.length;
}

export function costAt(track: UpgradeTrack, level: number): number | null {
  if (level >= track.costs.length) return null;
  return track.costs[level] ?? null;
}

export function effectAt(track: UpgradeTrack, level: number): number {
  const idx = Math.min(Math.max(0, level), track.values.length - 1);
  return track.values[idx] ?? 0;
}
