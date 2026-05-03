import { TILE_META } from './tiles';
import { TileType } from './world';

export class Inventory {
  readonly capacity: number;
  private counts: Map<TileType, number> = new Map();

  constructor(capacity: number) {
    if (capacity <= 0) throw new Error('capacity must be positive');
    this.capacity = capacity;
  }

  count(type: TileType): number {
    return this.counts.get(type) ?? 0;
  }

  total(): number {
    let sum = 0;
    for (const v of this.counts.values()) sum += v;
    return sum;
  }

  isFull(): boolean {
    return this.total() >= this.capacity;
  }

  tryAdd(type: TileType): boolean {
    if (type === TileType.EMPTY) return false;
    if (this.isFull()) return false;
    this.counts.set(type, this.count(type) + 1);
    return true;
  }

  clear(): void {
    this.counts.clear();
  }

  totalValue(): number {
    let v = 0;
    for (const [type, count] of this.counts) {
      v += TILE_META[type].value * count;
    }
    return v;
  }

  entries(): Array<[TileType, number]> {
    const result: Array<[TileType, number]> = [];
    for (const [type, count] of this.counts) {
      if (count > 0) result.push([type, count]);
    }
    result.sort((a, b) => a[0] - b[0]);
    return result;
  }
}
