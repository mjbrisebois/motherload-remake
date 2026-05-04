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
    p.inventory.tryAdd(TileType.GOLDIUM);
    p.inventory.tryAdd(TileType.IRONIUM);
    const expected = TILE_META[TileType.GOLDIUM].value + TILE_META[TileType.IRONIUM].value;
    expect(p.sellAll()).toBe(expected);
    expect(p.cash).toBe(50 + expected);
    expect(p.inventory.total()).toBe(0);
  });

  it('refuel fails when full or broke, fully fills with enough cash', () => {
    const p = new PlayerState(0);
    expect(p.refuel()).toBe(false); // already full
    p.fuel = 0;
    expect(p.refuel()).toBe(false); // no cash
    p.cash = 10000;
    expect(p.refuel()).toBe(true);
    expect(p.fuel).toBe(p.maxFuel);
    expect(p.cash).toBeLessThan(10000);
  });

  it('refuel partially when cash is insufficient', () => {
    const p = new PlayerState(0);
    p.fuel = 0;
    p.cash = 10;
    expect(p.refuel()).toBe(true);
    expect(p.cash).toBe(0);
    expect(p.fuel).toBeGreaterThan(0);
    expect(p.fuel).toBeLessThan(p.maxFuel);
  });

  it('repair fails when undamaged or broke, fully fills with enough cash', () => {
    const p = new PlayerState(0);
    expect(p.repair()).toBe(false);
    p.hull = 0;
    expect(p.repair()).toBe(false);
    p.cash = 10000;
    expect(p.repair()).toBe(true);
    expect(p.hull).toBe(p.maxHull);
    expect(p.cash).toBeLessThan(10000);
  });

  it('repair partially when cash is insufficient', () => {
    const p = new PlayerState(0);
    p.hull = 0;
    p.cash = 10;
    expect(p.repair()).toBe(true);
    expect(p.cash).toBe(0);
    expect(p.hull).toBeGreaterThan(0);
    expect(p.hull).toBeLessThan(p.maxHull);
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

  it('takeDamage clamps to zero and isDead reflects state', () => {
    const p = new PlayerState();
    p.takeDamage(0);
    expect(p.hull).toBe(p.maxHull);
    p.takeDamage(10);
    expect(p.hull).toBe(p.maxHull - 10);
    expect(p.isDead()).toBe(false);
    p.takeDamage(99999);
    expect(p.hull).toBe(0);
    expect(p.isDead()).toBe(true);
  });

  it('takeDamage ignores non-positive amounts', () => {
    const p = new PlayerState();
    p.takeDamage(-50);
    expect(p.hull).toBe(p.maxHull);
  });

  it('cargo upgrade increases inventory capacity without losing items', () => {
    const p = new PlayerState(99999999);
    p.inventory.tryAdd(TileType.GOLDIUM);
    const before = p.inventory.capacity;
    expect(p.buyUpgrade(UpgradeKind.CARGO_BAY)).toBe(true);
    expect(p.inventory.capacity).toBeGreaterThan(before);
    expect(p.inventory.count(TileType.GOLDIUM)).toBe(1);
  });
});
