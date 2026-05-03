import { describe, expect, it } from 'vitest';
import {
  UPGRADE_KINDS_ORDERED,
  UPGRADE_TRACKS,
  UpgradeKind,
  costAt,
  effectAt,
  maxLevel,
} from './upgrades';

describe('upgrade tracks', () => {
  it('has one entry per kind in UPGRADE_KINDS_ORDERED', () => {
    expect(UPGRADE_KINDS_ORDERED.length).toBe(Object.keys(UPGRADE_TRACKS).length);
    for (const kind of UPGRADE_KINDS_ORDERED) {
      expect(UPGRADE_TRACKS[kind]).toBeDefined();
    }
  });

  it('values has length costs.length + 1 for every track', () => {
    for (const track of Object.values(UPGRADE_TRACKS)) {
      expect(track.values.length).toBe(track.costs.length + 1);
    }
  });

  it('costs are strictly increasing', () => {
    for (const track of Object.values(UPGRADE_TRACKS)) {
      for (let i = 1; i < track.costs.length; i++) {
        expect(track.costs[i]).toBeGreaterThan(track.costs[i - 1]!);
      }
    }
  });

  it('costAt returns null when maxed', () => {
    const track = UPGRADE_TRACKS[UpgradeKind.FUEL_TANK];
    expect(costAt(track, maxLevel(track))).toBeNull();
    expect(costAt(track, maxLevel(track) + 5)).toBeNull();
  });

  it('costAt returns the right cost at intermediate levels', () => {
    const track = UPGRADE_TRACKS[UpgradeKind.FUEL_TANK];
    expect(costAt(track, 0)).toBe(track.costs[0]);
    expect(costAt(track, 2)).toBe(track.costs[2]);
  });

  it('effectAt clamps to last value at max level', () => {
    const track = UPGRADE_TRACKS[UpgradeKind.DRILL];
    const last = track.values[track.values.length - 1];
    expect(effectAt(track, track.values.length - 1)).toBe(last);
    expect(effectAt(track, track.values.length + 99)).toBe(last);
  });

  it('effectAt clamps negative levels to first value', () => {
    const track = UPGRADE_TRACKS[UpgradeKind.HULL];
    expect(effectAt(track, -1)).toBe(track.values[0]);
  });
});
