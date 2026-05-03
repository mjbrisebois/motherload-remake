import { describe, expect, it } from 'vitest';
import { PlayerState } from './player';
import { TileType } from './world';
import { TILE_META } from './tiles';
import { UPGRADE_TRACKS, UpgradeKind, costAt, effectAt, maxLevel } from './upgrades';

describe('PlayerState', () => {
  it('starts with full fuel/hull/cargo and zero cash by default', () => {
    const p = new PlayerState();
    expect(p.cash).toBe(0);
    expect(p.fuel).toBe(p.maxFuel);
    expect(p.hull).toBe(p.maxHull);
    expect(p.inventory.total()).toBe(0);
    expect(p.inventory.capacity).toBe(p.maxCargo);
  });

  it('initial caps match the level-0 effects', () => {
    const p = new PlayerState();
    expect(p.maxFuel).toBe(effectAt(UPGRADE_TRACKS[UpgradeKind.FUEL_TANK], 0));
    expect(p.maxCargo).toBe(effectAt(UPGRADE_TRACKS[UpgradeKind.CARGO_BAY], 0));
    expect(p.maxHull).toBe(effectAt(UPGRADE_TRACKS[UpgradeKind.HULL], 0));
    expect(p.drillLevel).toBe(0);
    expect(p.engineMultiplier).toBe(1);
  });

  it('sellAll empties inventory and adds value to cash', () => {
    const p = new PlayerState(50);
    p.inventory.tryAdd(TileType.GOLD);
    p.inventory.tryAdd(TileType.COPPER);
    const expected = TILE_META[TileType.GOLD].value + TILE_META[TileType.COPPER].value;
    expect(p.sellAll()).toBe(expected);
    expect(p.cash).toBe(50 + expected);
    expect(p.inventory.total()).toBe(0);
  });

  it('refuel only succeeds with enough cash and partial fuel', () => {
    const p = new PlayerState(0);
    expect(p.refuel()).toBe(false); // already full
    p.fuel = 0;
    expect(p.refuel()).toBe(false); // no cash
    p.cash = 10000;
    expect(p.refuel()).toBe(true);
    expect(p.fuel).toBe(p.maxFuel);
  });

  it('repair only succeeds when damaged with enough cash', () => {
    const p = new PlayerState(0);
    expect(p.repair()).toBe(false);
    p.hull = 0;
    expect(p.repair()).toBe(false);
    p.cash = 10000;
    expect(p.repair()).toBe(true);
    expect(p.hull).toBe(p.maxHull);
  });

  it('buyUpgrade fails when broke and succeeds with cash', () => {
    const p = new PlayerState(0);
    expect(p.buyUpgrade(UpgradeKind.DRILL)).toBe(false);
    const cost = costAt(UPGRADE_TRACKS[UpgradeKind.DRILL], 0)!;
    p.cash = cost;
    expect(p.buyUpgrade(UpgradeKind.DRILL)).toBe(true);
    expect(p.cash).toBe(0);
    expect(p.drillLevel).toBe(1);
  });

  it('buyUpgrade returns false when maxed', () => {
    const p = new PlayerState(99999999);
    const lvls = maxLevel(UPGRADE_TRACKS[UpgradeKind.FUEL_TANK]);
    for (let i = 0; i < lvls; i++) {
      expect(p.buyUpgrade(UpgradeKind.FUEL_TANK)).toBe(true);
    }
    expect(p.isMaxed(UpgradeKind.FUEL_TANK)).toBe(true);
    expect(p.buyUpgrade(UpgradeKind.FUEL_TANK)).toBe(false);
  });

  it('cargo upgrade increases inventory capacity without losing items', () => {
    const p = new PlayerState(99999999);
    p.inventory.tryAdd(TileType.GOLD);
    const before = p.inventory.capacity;
    expect(p.buyUpgrade(UpgradeKind.CARGO_BAY)).toBe(true);
    expect(p.inventory.capacity).toBeGreaterThan(before);
    expect(p.inventory.count(TileType.GOLD)).toBe(1);
  });
});
