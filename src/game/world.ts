export enum TileType {
  EMPTY = 0,
  DIRT = 1,
}

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

    for (let r = surfaceRow; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.tiles[r * cols + c] = TileType.DIRT;
      }
    }
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
