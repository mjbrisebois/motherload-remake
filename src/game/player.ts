import { Inventory } from './inventory';
import {
  UPGRADE_KINDS_ORDERED,
  UPGRADE_TRACKS,
  UpgradeKind,
  costAt,
  effectAt,
  maxLevel,
} from './upgrades';
import { REFUEL_COST_PER_UNIT, REPAIR_COST_PER_UNIT, refuelCost, repairCost } from './economy';

export class PlayerState {
  cash: number;
  fuel: number;
  hull: number;
  readonly inventory: Inventory;
  private levels: Map<UpgradeKind, number>;

  constructor(initialCash = 0) {
    this.cash = initialCash;
    this.levels = new Map(UPGRADE_KINDS_ORDERED.map((k) => [k, 0]));
    this.fuel = this.maxFuel;
    this.hull = this.maxHull;
    this.inventory = new Inventory(this.maxCargo);
  }

  upgradeLevel(kind: UpgradeKind): number {
    return this.levels.get(kind) ?? 0;
  }

  get maxFuel(): number {
    return effectAt(UPGRADE_TRACKS[UpgradeKind.FUEL_TANK], this.upgradeLevel(UpgradeKind.FUEL_TANK));
  }
  get maxCargo(): number {
    return effectAt(UPGRADE_TRACKS[UpgradeKind.CARGO_BAY], this.upgradeLevel(UpgradeKind.CARGO_BAY));
  }
  get maxHull(): number {
    return effectAt(UPGRADE_TRACKS[UpgradeKind.HULL], this.upgradeLevel(UpgradeKind.HULL));
  }
  get drillLevel(): number {
    return this.upgradeLevel(UpgradeKind.DRILL);
  }
  get engineMultiplier(): number {
    return effectAt(UPGRADE_TRACKS[UpgradeKind.ENGINE], this.upgradeLevel(UpgradeKind.ENGINE));
  }

  sellAll(): number {
    const earned = this.inventory.totalValue();
    this.cash += earned;
    this.inventory.clear();
    return earned;
  }

  refuelCost(): number {
    return refuelCost(this.fuel, this.maxFuel);
  }

  refuel(): boolean {
    const cost = this.refuelCost();
    if (cost <= 0) return false;
    if (this.cash <= 0) return false;
    const spent = Math.min(this.cash, cost);
    const fuelAdded = spent / REFUEL_COST_PER_UNIT;
    this.cash -= spent;
    this.fuel = Math.min(this.maxFuel, this.fuel + fuelAdded);
    return true;
  }

  repairCost(): number {
    return repairCost(this.hull, this.maxHull);
  }

  repair(): boolean {
    const cost = this.repairCost();
    if (cost <= 0) return false;
    if (this.cash <= 0) return false;
    const spent = Math.min(this.cash, cost);
    const hullAdded = spent / REPAIR_COST_PER_UNIT;
    this.cash -= spent;
    this.hull = Math.min(this.maxHull, this.hull + hullAdded);
    return true;
  }

  upgradeCost(kind: UpgradeKind): number | null {
    return costAt(UPGRADE_TRACKS[kind], this.upgradeLevel(kind));
  }

  isMaxed(kind: UpgradeKind): boolean {
    return this.upgradeLevel(kind) >= maxLevel(UPGRADE_TRACKS[kind]);
  }

  takeDamage(amount: number): void {
    if (amount <= 0) return;
    this.hull = Math.max(0, this.hull - amount);
  }

  isDead(): boolean {
    return this.hull <= 0;
  }

  buyUpgrade(kind: UpgradeKind): boolean {
    const cost = this.upgradeCost(kind);
    if (cost === null) return false;
    if (this.cash < cost) return false;
    this.cash -= cost;
    this.levels.set(kind, this.upgradeLevel(kind) + 1);
    if (kind === UpgradeKind.CARGO_BAY) this.inventory.capacity = this.maxCargo;
    return true;
  }
}
