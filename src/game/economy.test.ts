import { describe, expect, it } from 'vitest';
import { refuelCost, repairCost, REFUEL_COST_PER_UNIT, REPAIR_COST_PER_UNIT } from './economy';

describe('refuelCost', () => {
  it('is zero when full', () => {
    expect(refuelCost(100, 100)).toBe(0);
    expect(refuelCost(150, 100)).toBe(0);
  });

  it('is ceil(missing * rate)', () => {
    expect(refuelCost(0, 100)).toBe(Math.ceil(100 * REFUEL_COST_PER_UNIT));
    expect(refuelCost(33, 100)).toBe(Math.ceil(67 * REFUEL_COST_PER_UNIT));
  });
});

describe('repairCost', () => {
  it('is zero when undamaged', () => {
    expect(repairCost(100, 100)).toBe(0);
  });

  it('is ceil(damage * rate)', () => {
    expect(repairCost(0, 100)).toBe(Math.ceil(100 * REPAIR_COST_PER_UNIT));
    expect(repairCost(75, 200)).toBe(Math.ceil(125 * REPAIR_COST_PER_UNIT));
  });
});
