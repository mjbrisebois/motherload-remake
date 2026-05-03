export const REFUEL_COST_PER_UNIT = 0.5;
export const REPAIR_COST_PER_UNIT = 0.8;

export function refuelCost(currentFuel: number, maxFuel: number): number {
  const missing = Math.max(0, maxFuel - currentFuel);
  return Math.ceil(missing * REFUEL_COST_PER_UNIT);
}

export function repairCost(currentHull: number, maxHull: number): number {
  const damage = Math.max(0, maxHull - currentHull);
  return Math.ceil(damage * REPAIR_COST_PER_UNIT);
}
