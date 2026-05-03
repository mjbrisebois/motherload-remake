import Phaser from 'phaser';
import {
  TILE_SIZE,
  WORLD_COLS,
  WORLD_ROWS,
  SURFACE_ROW,
  HORIZ_SPEED,
  THRUST_ACCEL,
  GRAVITY,
  MAX_FALL_SPEED,
  HORIZ_DRAG,
  MAX_FUEL,
  FUEL_BURN_IDLE,
  FUEL_BURN_THRUST,
  FUEL_BURN_DRILL,
  DRILL_TIME_DIRT,
} from '../config';
import { TileType, World } from '../game/world';

const TILESET_KEY = 'tiles';
const POD_KEY = 'pod';
const DIRT_TILE_INDEX = 1;

type Direction = 'down' | 'left' | 'right';

export class GameScene extends Phaser.Scene {
  private world!: World;
  private pod!: Phaser.Physics.Arcade.Sprite;
  private tileLayer!: Phaser.Tilemaps.TilemapLayer;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private fuel = MAX_FUEL;
  private drillTarget: { col: number; row: number; dir: Direction } | null = null;
  private drillProgress = 0;

  private debugText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    this.generatePlaceholderTextures();
  }

  create(): void {
    this.world = new World(WORLD_COLS, WORLD_ROWS, SURFACE_ROW);

    const map = this.make.tilemap({
      data: this.buildTileData(),
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('Failed to load tileset');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('Failed to create tile layer');
    this.tileLayer = layer;
    this.tileLayer.setCollision(DIRT_TILE_INDEX);

    const worldPxW = WORLD_COLS * TILE_SIZE;
    const worldPxH = WORLD_ROWS * TILE_SIZE;
    this.physics.world.setBounds(0, 0, worldPxW, worldPxH);

    const startCol = Math.floor(WORLD_COLS / 2);
    const startX = startCol * TILE_SIZE + TILE_SIZE / 2;
    const startY = (SURFACE_ROW - 2) * TILE_SIZE + TILE_SIZE / 2;
    this.pod = this.physics.add.sprite(startX, startY, POD_KEY);
    this.pod.setCollideWorldBounds(true);
    this.pod.setMaxVelocity(HORIZ_SPEED, MAX_FALL_SPEED);
    this.pod.setDragX(HORIZ_DRAG);
    const body = this.pod.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(GRAVITY);
    body.setSize(28, 28);

    this.physics.add.collider(this.pod, this.tileLayer);

    this.cameras.main.setBounds(0, 0, worldPxW, worldPxH);
    this.cameras.main.startFollow(this.pod, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor(0x4a90e2);

    this.cursors = this.input.keyboard!.createCursorKeys();

    this.debugText = this.add
      .text(12, 12, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(1000);
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const body = this.pod.body as Phaser.Physics.Arcade.Body;
    const c = this.cursors;
    const left = c.left.isDown;
    const right = c.right.isDown;
    const up = c.up.isDown;
    const down = c.down.isDown;

    const fuelEmpty = this.fuel <= 0;

    if (left && !right) {
      body.setAccelerationX(0);
      body.setVelocityX(-HORIZ_SPEED);
    } else if (right && !left) {
      body.setAccelerationX(0);
      body.setVelocityX(HORIZ_SPEED);
    }

    if (up && !fuelEmpty) {
      body.setAccelerationY(-THRUST_ACCEL);
      this.fuel = Math.max(0, this.fuel - FUEL_BURN_THRUST * dt);
    } else {
      body.setAccelerationY(0);
    }

    this.fuel = Math.max(0, this.fuel - FUEL_BURN_IDLE * dt);

    this.handleDrilling(dt, { left, right, down });

    this.updateDebugText();
  }

  private handleDrilling(
    dt: number,
    input: { left: boolean; right: boolean; down: boolean },
  ): void {
    const body = this.pod.body as Phaser.Physics.Arcade.Body;

    let target: { col: number; row: number; dir: Direction } | null = null;
    if (input.down && body.blocked.down) {
      const t = this.tileBelowPod();
      if (this.world.isSolid(t.col, t.row)) target = { ...t, dir: 'down' };
    } else if (input.left && body.blocked.left) {
      const t = this.tileLeftOfPod();
      if (this.world.isSolid(t.col, t.row)) target = { ...t, dir: 'left' };
    } else if (input.right && body.blocked.right) {
      const t = this.tileRightOfPod();
      if (this.world.isSolid(t.col, t.row)) target = { ...t, dir: 'right' };
    }

    if (!target) {
      this.drillTarget = null;
      this.drillProgress = 0;
      return;
    }

    const same =
      this.drillTarget &&
      this.drillTarget.col === target.col &&
      this.drillTarget.row === target.row;
    if (!same) {
      this.drillTarget = target;
      this.drillProgress = 0;
    }

    if (this.fuel <= 0) return;

    this.drillProgress += dt;
    if (this.drillProgress >= DRILL_TIME_DIRT) {
      this.world.setTile(target.col, target.row, TileType.EMPTY);
      this.tileLayer.removeTileAt(target.col, target.row);
      this.fuel = Math.max(0, this.fuel - FUEL_BURN_DRILL);
      this.drillProgress = 0;
      this.drillTarget = null;
    }
  }

  private tileBelowPod(): { col: number; row: number } {
    const x = this.pod.x;
    const y = this.pod.y + 16 + 1;
    return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
  }

  private tileLeftOfPod(): { col: number; row: number } {
    const x = this.pod.x - 16 - 1;
    const y = this.pod.y;
    return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
  }

  private tileRightOfPod(): { col: number; row: number } {
    const x = this.pod.x + 16 + 1;
    const y = this.pod.y;
    return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
  }

  private buildTileData(): number[][] {
    const result: number[][] = [];
    for (let r = 0; r < this.world.rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < this.world.cols; c++) {
        row.push(this.world.getTile(c, r) === TileType.DIRT ? DIRT_TILE_INDEX : 0);
      }
      result.push(row);
    }
    return result;
  }

  private updateDebugText(): void {
    const depth = Math.max(0, Math.floor(this.pod.y / TILE_SIZE) - SURFACE_ROW);
    const fuelPct = Math.round((this.fuel / MAX_FUEL) * 100);
    const drillPct = this.drillTarget
      ? Math.round((this.drillProgress / DRILL_TIME_DIRT) * 100)
      : 0;
    this.debugText.setText(
      [
        `fuel: ${fuelPct}%`,
        `depth: ${depth}m`,
        `drill: ${drillPct}%`,
        `pos: ${Math.round(this.pod.x)}, ${Math.round(this.pod.y)}`,
      ].join('  |  '),
    );
  }

  private generatePlaceholderTextures(): void {
    const dirt = this.add.graphics({ x: 0, y: 0 });
    dirt.fillStyle(0x6b4423, 1);
    dirt.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    dirt.fillStyle(0x4f3219, 1);
    dirt.fillRect(0, 0, TILE_SIZE, 2);
    dirt.fillRect(0, TILE_SIZE - 2, TILE_SIZE, 2);
    dirt.fillRect(0, 0, 2, TILE_SIZE);
    dirt.fillRect(TILE_SIZE - 2, 0, 2, TILE_SIZE);
    dirt.fillStyle(0x8a5a30, 1);
    dirt.fillRect(8, 6, 3, 3);
    dirt.fillRect(20, 14, 2, 2);
    dirt.fillRect(12, 22, 3, 3);
    dirt.generateTexture(TILESET_KEY, TILE_SIZE, TILE_SIZE);
    dirt.destroy();

    const pod = this.add.graphics({ x: 0, y: 0 });
    pod.fillStyle(0xf5d142, 1);
    pod.fillRect(2, 2, 28, 22);
    pod.fillStyle(0x2a3a5a, 1);
    pod.fillRect(8, 6, 16, 10);
    pod.fillStyle(0xc0392b, 1);
    pod.fillTriangle(6, 24, 26, 24, 16, 30);
    pod.lineStyle(2, 0x000000, 1);
    pod.strokeRect(2, 2, 28, 22);
    pod.generateTexture(POD_KEY, 32, 32);
    pod.destroy();
  }
}
