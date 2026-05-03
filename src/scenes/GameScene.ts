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
  WORLD_SEED,
  DRILL_LEVEL,
  CARGO_CAPACITY,
} from '../config';
import { TileType, World } from '../game/world';
import { generateWorld } from '../game/generator';
import { TILE_META, RENDERED_TILE_TYPES, isDrillable, type TileMeta } from '../game/tiles';
import { Inventory } from '../game/inventory';

const TILESET_KEY = 'tiles';
const POD_KEY = 'pod';

type Direction = 'down' | 'left' | 'right';

function shiftColor(rgb: number, delta: number): number {
  const r = Math.max(0, Math.min(255, ((rgb >> 16) & 0xff) + delta));
  const g = Math.max(0, Math.min(255, ((rgb >> 8) & 0xff) + delta));
  const b = Math.max(0, Math.min(255, (rgb & 0xff) + delta));
  return (r << 16) | (g << 8) | b;
}

export class GameScene extends Phaser.Scene {
  private world!: World;
  private pod!: Phaser.Physics.Arcade.Sprite;
  private tileLayer!: Phaser.Tilemaps.TilemapLayer;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private fuel = MAX_FUEL;
  private inventory = new Inventory(CARGO_CAPACITY);
  private drillTarget: { col: number; row: number; dir: Direction; type: TileType } | null = null;
  private drillProgress = 0;
  private currentDrillTime = 0;

  private hudGraphics!: Phaser.GameObjects.Graphics;
  private fuelLabel!: Phaser.GameObjects.Text;
  private cargoLabel!: Phaser.GameObjects.Text;
  private depthLabel!: Phaser.GameObjects.Text;
  private valueLabel!: Phaser.GameObjects.Text;
  private drillingLabel!: Phaser.GameObjects.Text;
  private inventoryTitle!: Phaser.GameObjects.Text;
  private inventoryLines: Map<TileType, Phaser.GameObjects.Text> = new Map();

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    this.generatePlaceholderTextures();
  }

  create(): void {
    this.world = generateWorld({
      cols: WORLD_COLS,
      rows: WORLD_ROWS,
      surfaceRow: SURFACE_ROW,
      seed: WORLD_SEED,
    });

    const map = this.make.tilemap({
      data: this.buildTileData(),
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0, 1);
    if (!tileset) throw new Error('Failed to load tileset');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('Failed to create tile layer');
    this.tileLayer = layer;
    this.tileLayer.setCollisionBetween(TileType.DIRT, TileType.DIAMOND);

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

    this.createHud();
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

    this.updateHud();
  }

  private handleDrilling(
    dt: number,
    input: { left: boolean; right: boolean; down: boolean },
  ): void {
    const body = this.pod.body as Phaser.Physics.Arcade.Body;
    const TOUCH = 2;

    let target: { col: number; row: number; dir: Direction; type: TileType } | null = null;

    const tryTarget = (col: number, row: number, dir: Direction) => {
      const type = this.world.getTile(col, row);
      if (type === TileType.EMPTY) return;
      if (!isDrillable(type, DRILL_LEVEL)) return;
      if (TILE_META[type].value > 0 && this.inventory.isFull()) return;
      target = { col, row, dir, type };
    };

    if (input.down) {
      const col = Math.floor(this.pod.x / TILE_SIZE);
      const row = Math.floor((body.bottom + TOUCH) / TILE_SIZE);
      tryTarget(col, row, 'down');
    }
    if (!target && input.left) {
      const col = Math.floor((body.left - TOUCH) / TILE_SIZE);
      const row = Math.floor(this.pod.y / TILE_SIZE);
      tryTarget(col, row, 'left');
    }
    if (!target && input.right) {
      const col = Math.floor((body.right + TOUCH) / TILE_SIZE);
      const row = Math.floor(this.pod.y / TILE_SIZE);
      tryTarget(col, row, 'right');
    }

    if (!target) {
      this.drillTarget = null;
      this.drillProgress = 0;
      this.currentDrillTime = 0;
      return;
    }

    const t: { col: number; row: number; dir: Direction; type: TileType } = target;
    const same =
      this.drillTarget && this.drillTarget.col === t.col && this.drillTarget.row === t.row;
    if (!same) {
      this.drillTarget = t;
      this.drillProgress = 0;
      this.currentDrillTime = TILE_META[t.type].drillTime;
    }

    if (this.fuel <= 0) return;

    this.drillProgress += dt;
    if (this.drillProgress >= this.currentDrillTime) {
      if (TILE_META[t.type].value > 0) this.inventory.tryAdd(t.type);
      this.world.setTile(t.col, t.row, TileType.EMPTY);
      this.tileLayer.removeTileAt(t.col, t.row);
      this.fuel = Math.max(0, this.fuel - FUEL_BURN_DRILL);
      this.drillProgress = 0;
      this.drillTarget = null;
      this.currentDrillTime = 0;
    }
  }

  private buildTileData(): number[][] {
    const result: number[][] = [];
    for (let r = 0; r < this.world.rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < this.world.cols; c++) {
        row.push(this.world.getTile(c, r));
      }
      result.push(row);
    }
    return result;
  }

  private createHud(): void {
    const labelStyle = {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#e8e8e8',
    } as const;
    const titleStyle = {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#a0a0a0',
    } as const;

    this.hudGraphics = this.add.graphics().setScrollFactor(0).setDepth(1000);

    this.add.text(20, 16, 'FUEL', titleStyle).setScrollFactor(0).setDepth(1001);
    this.fuelLabel = this.add
      .text(180, 16, '', labelStyle)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1001);

    this.add.text(20, 38, 'CARGO', titleStyle).setScrollFactor(0).setDepth(1001);
    this.cargoLabel = this.add
      .text(180, 38, '', labelStyle)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1001);

    this.depthLabel = this.add
      .text(20, 64, '', labelStyle)
      .setScrollFactor(0)
      .setDepth(1001);
    this.valueLabel = this.add
      .text(180, 64, '', labelStyle)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1001);

    this.drillingLabel = this.add
      .text(20, 84, '', labelStyle)
      .setScrollFactor(0)
      .setDepth(1001);

    const invX = 1280 - 200;
    this.inventoryTitle = this.add
      .text(invX + 12, 12, 'INVENTORY', titleStyle)
      .setScrollFactor(0)
      .setDepth(1001);
    let lineY = 32;
    for (const type of RENDERED_TILE_TYPES) {
      if (TILE_META[type].value <= 0) continue;
      const meta = TILE_META[type];
      const colorHex = '#' + meta.baseColor.toString(16).padStart(6, '0');
      const accentHex =
        meta.accentColor !== null
          ? '#' + meta.accentColor.toString(16).padStart(6, '0')
          : colorHex;
      const line = this.add
        .text(invX + 12, lineY, '', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: accentHex,
        })
        .setScrollFactor(0)
        .setDepth(1001)
        .setVisible(false);
      this.inventoryLines.set(type, line);
      lineY += 18;
    }
  }

  private updateHud(): void {
    const fuelRatio = this.fuel / MAX_FUEL;
    const cargoRatio = this.inventory.total() / this.inventory.capacity;
    const fuelColor = fuelRatio < 0.2 ? 0xff5555 : fuelRatio < 0.5 ? 0xf5b342 : 0x55cc55;
    const cargoColor = this.inventory.isFull() ? 0xff5555 : 0x6db8ff;

    this.hudGraphics.clear();
    this.hudGraphics.fillStyle(0x000000, 0.55);
    this.hudGraphics.fillRoundedRect(8, 8, 200, 100, 6);
    this.drawHudBar(20, 30, 160, 6, fuelRatio, fuelColor);
    this.drawHudBar(20, 52, 160, 6, cargoRatio, cargoColor);

    const fuelPct = Math.round(fuelRatio * 100);
    this.fuelLabel.setText(`${fuelPct}%`);
    this.cargoLabel.setText(`${this.inventory.total()}/${this.inventory.capacity}`);

    const depth = Math.max(0, Math.floor(this.pod.y / TILE_SIZE) - SURFACE_ROW);
    this.depthLabel.setText(`DEPTH ${depth}m`);
    this.valueLabel.setText(`$${this.inventory.totalValue()}`);

    if (this.drillTarget && this.currentDrillTime > 0) {
      const pct = Math.round((this.drillProgress / this.currentDrillTime) * 100);
      const name = TILE_META[this.drillTarget.type].name;
      this.drillingLabel.setText(`drilling ${name} ${pct}%`);
    } else if (this.inventory.isFull()) {
      this.drillingLabel.setText('CARGO FULL');
    } else {
      this.drillingLabel.setText('');
    }

    const entries = this.inventory.entries();
    this.inventoryTitle.setVisible(entries.length > 0);
    for (const line of this.inventoryLines.values()) line.setVisible(false);
    if (entries.length > 0) {
      this.hudGraphics.fillStyle(0x000000, 0.55);
      this.hudGraphics.fillRoundedRect(1280 - 200, 8, 192, 28 + 18 * entries.length, 6);
      let lineY = 32;
      for (const [type, count] of entries) {
        const line = this.inventoryLines.get(type);
        if (!line) continue;
        line.setY(lineY);
        line.setText(`${TILE_META[type].name.padEnd(9)} ${count}`);
        line.setVisible(true);
        lineY += 18;
      }
    }
  }

  private drawHudBar(
    x: number,
    y: number,
    w: number,
    h: number,
    ratio: number,
    fillColor: number,
  ): void {
    this.hudGraphics.fillStyle(0x222222, 1);
    this.hudGraphics.fillRect(x, y, w, h);
    const clamped = Math.max(0, Math.min(1, ratio));
    this.hudGraphics.fillStyle(fillColor, 1);
    this.hudGraphics.fillRect(x, y, w * clamped, h);
  }

  private generatePlaceholderTextures(): void {
    const stripWidth = RENDERED_TILE_TYPES.length * TILE_SIZE;
    const g = this.add.graphics({ x: 0, y: 0 });
    for (let i = 0; i < RENDERED_TILE_TYPES.length; i++) {
      const type = RENDERED_TILE_TYPES[i];
      if (type === undefined) continue;
      this.drawTileToStrip(g, i * TILE_SIZE, 0, TILE_META[type]);
    }
    g.generateTexture(TILESET_KEY, stripWidth, TILE_SIZE);
    g.destroy();

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

  private drawTileToStrip(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    meta: TileMeta,
  ): void {
    const dark = shiftColor(meta.baseColor, -50);
    const light = shiftColor(meta.baseColor, 25);

    g.fillStyle(meta.baseColor, 1);
    g.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    g.fillStyle(dark, 1);
    g.fillRect(x, y, TILE_SIZE, 2);
    g.fillRect(x, y + TILE_SIZE - 2, TILE_SIZE, 2);
    g.fillRect(x, y, 2, TILE_SIZE);
    g.fillRect(x + TILE_SIZE - 2, y, 2, TILE_SIZE);

    g.fillStyle(light, 1);
    g.fillRect(x + 7, y + 6, 2, 2);
    g.fillRect(x + 21, y + 13, 2, 2);
    g.fillRect(x + 13, y + 23, 2, 2);

    if (meta.accentColor !== null) {
      g.fillStyle(meta.accentColor, 1);
      g.fillCircle(x + 10, y + 10, 3);
      g.fillCircle(x + 22, y + 17, 2.5);
      g.fillCircle(x + 14, y + 24, 2.5);
    }
  }
}
