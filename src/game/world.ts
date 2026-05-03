export enum TileType {
  EMPTY = 0,
  DIRT = 1,
  ROCK = 2,
  COPPER = 3,
  IRON = 4,
  SILVER = 5,
  GOLD = 6,
  PLATINUM = 7,
  RUBY = 8,
  DIAMOND = 9,
}

export const ALL_SOLID_TYPES: readonly TileType[] = [
  TileType.DIRT,
  TileType.ROCK,
  TileType.COPPER,
  TileType.IRON,
  TileType.SILVER,
  TileType.GOLD,
  TileType.PLATINUM,
  TileType.RUBY,
  TileType.DIAMOND,
];

export class World {
  readonly cols: number;
  readonly rows: number;
  readonly surfaceRow: number;
  private tiles: Uint8Array;

  constructor(cols: number, rows: number, surfaceRow: number) {
    if (cols <= 0 || rows <= 0) {
      throw new Error('cols and rows must be positive');
    }
    if (surfaceRow < 0 || surfaceRow >= rows) {
      throw new Error('surfaceRow out of range');
    }
    this.cols = cols;
    this.rows = rows;
    this.surfaceRow = surfaceRow;
    this.tiles = new Uint8Array(cols * rows);
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  getTile(col: number, row: number): TileType {
    if (!this.inBounds(col, row)) return TileType.EMPTY;
    return this.tiles[row * this.cols + col] as TileType;
  }

  setTile(col: number, row: number, type: TileType): void {
    if (!this.inBounds(col, row)) return;
    this.tiles[row * this.cols + col] = type;
  }

  isSolid(col: number, row: number): boolean {
    return this.getTile(col, row) !== TileType.EMPTY;
  }
}
