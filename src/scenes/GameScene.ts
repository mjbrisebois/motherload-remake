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
  FUEL_BURN_IDLE,
  FUEL_BURN_THRUST,
  FUEL_BURN_DRILL,
  WORLD_SEED,
  GAME_WIDTH,
  GAME_HEIGHT,
  FALL_DAMAGE_THRESHOLD,
  FALL_DAMAGE_FACTOR,
  LAVA_DAMAGE_PER_SEC,
  DRILL_INTENT_HOLD,
} from '../config';
import { TileType, World } from '../game/world';
import { generateWorld } from '../game/generator';
import { TILE_META, RENDERED_TILE_TYPES, isDrillable, type TileMeta } from '../game/tiles';
import { PlayerState } from '../game/player';
import {
  UPGRADE_KINDS_ORDERED,
  UPGRADE_TRACKS,
  UpgradeKind,
  effectAt,
} from '../game/upgrades';

const TILESET_KEY = 'tiles';
const POD_KEY = 'pod';

type Direction = 'down' | 'left' | 'right';

function shiftColor(rgb: number, delta: number): number {
  const r = Math.max(0, Math.min(255, ((rgb >> 16) & 0xff) + delta));
  const g = Math.max(0, Math.min(255, ((rgb >> 8) & 0xff) + delta));
  const b = Math.max(0, Math.min(255, (rgb & 0xff) + delta));
  return (r << 16) | (g << 8) | b;
}

interface ShopAction {
  key: string;
  buildLabel: () => { text: string; affordable: boolean; maxed: boolean };
  apply: () => void;
}

export class GameScene extends Phaser.Scene {
  private world!: World;
  private pod!: Phaser.Physics.Arcade.Sprite;
  private tileLayer!: Phaser.Tilemaps.TilemapLayer;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private player!: PlayerState;
  private drillTarget: { col: number; row: number; dir: Direction; type: TileType } | null = null;
  private drillProgress = 0;
  private currentDrillTime = 0;
  private drillStartX = 0;
  private drillStartY = 0;

  private gameOver = false;
  private wasGrounded = false;
  private prevYVelocity = 0;
  private heldDown = 0;
  private heldLeft = 0;
  private heldRight = 0;

  private hudGraphics!: Phaser.GameObjects.Graphics;
  private fuelLabel!: Phaser.GameObjects.Text;
  private hullLabel!: Phaser.GameObjects.Text;
  private cargoLabel!: Phaser.GameObjects.Text;
  private depthLabel!: Phaser.GameObjects.Text;
  private valueLabel!: Phaser.GameObjects.Text;
  private drillingLabel!: Phaser.GameObjects.Text;
  private inventoryTitle!: Phaser.GameObjects.Text;
  private inventoryLines: Map<TileType, Phaser.GameObjects.Text> = new Map();

  private shopGraphics!: Phaser.GameObjects.Graphics;
  private shopTitle!: Phaser.GameObjects.Text;
  private shopHint!: Phaser.GameObjects.Text;
  private shopActionTexts: Phaser.GameObjects.Text[] = [];
  private shopActions: ShopAction[] = [];
  private hotkeys!: Phaser.Input.Keyboard.Key[];
  private restartKey!: Phaser.Input.Keyboard.Key;

  private gameOverGraphics!: Phaser.GameObjects.Graphics;
  private gameOverTitle!: Phaser.GameObjects.Text;
  private gameOverSubtitle!: Phaser.GameObjects.Text;
  private gameOverHint!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    this.generatePlaceholderTextures();
  }

  create(): void {
    this.player = new PlayerState();
    this.drillTarget = null;
    this.drillProgress = 0;
    this.currentDrillTime = 0;
    this.drillStartX = 0;
    this.drillStartY = 0;
    this.gameOver = false;
    this.wasGrounded = false;
    this.prevYVelocity = 0;
    this.heldDown = 0;
    this.heldLeft = 0;
    this.heldRight = 0;
    this.inventoryLines = new Map();
    this.shopActionTexts = [];
    this.shopActions = [];

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
    this.tileLayer.setCollisionBetween(TileType.DIRT, TileType.LAVA);

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
    this.buildShopActions();
    this.createShopUi();
    this.createGameOverOverlay();

    const kc = Phaser.Input.Keyboard.KeyCodes;
    this.hotkeys = [
      this.input.keyboard!.addKey(kc.ONE),
      this.input.keyboard!.addKey(kc.TWO),
      this.input.keyboard!.addKey(kc.THREE),
      this.input.keyboard!.addKey(kc.FOUR),
      this.input.keyboard!.addKey(kc.FIVE),
      this.input.keyboard!.addKey(kc.SIX),
      this.input.keyboard!.addKey(kc.SEVEN),
      this.input.keyboard!.addKey(kc.EIGHT),
    ];
    this.restartKey = this.input.keyboard!.addKey(kc.R);
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const body = this.pod.body as Phaser.Physics.Arcade.Body;

    if (this.gameOver) {
      body.setVelocity(0, 0);
      body.setAcceleration(0, 0);
      if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
        this.scene.restart();
      }
      return;
    }

    const c0 = this.cursors;
    this.heldDown = c0.down.isDown ? this.heldDown + dt : 0;
    this.heldLeft = c0.left.isDown ? this.heldLeft + dt : 0;
    this.heldRight = c0.right.isDown ? this.heldRight + dt : 0;

    const drilling = this.drillTarget !== null;

    if (drilling) {
      this.advanceDrill(dt);
    } else {
      const c = this.cursors;
      const left = c.left.isDown;
      const right = c.right.isDown;
      const up = c.up.isDown;
      const down = c.down.isDown;

      const horizSpeed = HORIZ_SPEED * this.player.engineMultiplier;
      const thrust = THRUST_ACCEL * this.player.engineMultiplier;
      body.setMaxVelocity(horizSpeed, MAX_FALL_SPEED);

      const fuelEmpty = this.player.fuel <= 0;

      if (left && !right) {
        body.setAccelerationX(0);
        body.setVelocityX(-horizSpeed);
      } else if (right && !left) {
        body.setAccelerationX(0);
        body.setVelocityX(horizSpeed);
      }

      if (up && !fuelEmpty) {
        body.setAccelerationY(-thrust);
        this.player.fuel = Math.max(0, this.player.fuel - FUEL_BURN_THRUST * dt);
      } else {
        body.setAccelerationY(0);
      }

      this.player.fuel = Math.max(0, this.player.fuel - FUEL_BURN_IDLE * dt);

      this.handleFallDamage(body);
      this.tryStartDrill({ left, right, down });
      this.handleShopInput();
    }

    this.handleLavaDamage(body, dt);

    if (this.player.isDead()) {
      this.triggerGameOver('GAME OVER');
    } else if (this.player.fuel <= 0 && this.pod.y > SURFACE_ROW * TILE_SIZE) {
      this.triggerGameOver('OUT OF FUEL');
    }

    this.updateHud();
    this.updateShopUi();
  }

  private handleFallDamage(body: Phaser.Physics.Arcade.Body): void {
    const grounded = body.blocked.down;
    if (grounded && !this.wasGrounded && this.prevYVelocity > FALL_DAMAGE_THRESHOLD) {
      const damage = (this.prevYVelocity - FALL_DAMAGE_THRESHOLD) * FALL_DAMAGE_FACTOR;
      this.player.takeDamage(damage);
    }
    this.wasGrounded = grounded;
    this.prevYVelocity = body.velocity.y;
  }

  private handleLavaDamage(body: Phaser.Physics.Arcade.Body, dt: number): void {
    if (!this.isAdjacentToLava(body)) return;
    this.player.takeDamage(LAVA_DAMAGE_PER_SEC * dt);
  }

  private isAdjacentToLava(body: Phaser.Physics.Arcade.Body): boolean {
    const checks = [
      { x: body.center.x, y: body.bottom + 1 },
      { x: body.center.x, y: body.top - 1 },
      { x: body.left - 1, y: body.center.y },
      { x: body.right + 1, y: body.center.y },
    ];
    for (const p of checks) {
      const col = Math.floor(p.x / TILE_SIZE);
      const row = Math.floor(p.y / TILE_SIZE);
      if (this.world.getTile(col, row) === TileType.LAVA) return true;
    }
    return false;
  }

  private triggerGameOver(reason: string): void {
    if (this.gameOver) return;
    this.gameOver = true;
    if (this.drillTarget !== null) {
      const body = this.pod.body as Phaser.Physics.Arcade.Body;
      body.enable = true;
      this.drillTarget = null;
      this.drillProgress = 0;
      this.currentDrillTime = 0;
    }
    this.gameOverGraphics.setVisible(true);
    this.gameOverTitle.setText(reason);
    this.gameOverTitle.setVisible(true);
    this.gameOverSubtitle.setText(`final cash: $${this.player.cash}`);
    this.gameOverSubtitle.setVisible(true);
    this.gameOverHint.setVisible(true);
  }

  private isAtSurface(): boolean {
    return this.pod.y < SURFACE_ROW * TILE_SIZE;
  }

  private handleShopInput(): void {
    if (!this.isAtSurface()) return;
    for (let i = 0; i < this.shopActions.length; i++) {
      const key = this.hotkeys[i];
      const action = this.shopActions[i];
      if (key && action && Phaser.Input.Keyboard.JustDown(key)) {
        action.apply();
      }
    }
  }

  private tryStartDrill(input: { left: boolean; right: boolean; down: boolean }): void {
    if (this.drillTarget !== null) return;
    if (this.player.fuel <= 0) return;

    const body = this.pod.body as Phaser.Physics.Arcade.Body;
    const target = this.findDrillTarget(body, input);
    if (!target) return;

    const held =
      target.dir === 'down'
        ? this.heldDown
        : target.dir === 'left'
          ? this.heldLeft
          : this.heldRight;
    if (held < DRILL_INTENT_HOLD) return;

    this.drillTarget = target;
    this.drillProgress = 0;
    this.currentDrillTime =
      TILE_META[target.type].drillTime / (1 + 0.2 * this.player.drillLevel);
    this.drillStartX = this.pod.x;
    this.drillStartY = this.pod.y;

    body.enable = false;
  }

  private isGrounded(body: Phaser.Physics.Arcade.Body): boolean {
    const TOUCH = 2;
    const col = Math.floor(this.pod.x / TILE_SIZE);
    const row = Math.floor((body.bottom + TOUCH) / TILE_SIZE);
    return this.world.isSolid(col, row);
  }

  private findDrillTarget(
    body: Phaser.Physics.Arcade.Body,
    input: { left: boolean; right: boolean; down: boolean },
  ): { col: number; row: number; dir: Direction; type: TileType } | null {
    if (!this.isGrounded(body)) return null;
    const TOUCH = 2;

    const tryDir = (col: number, row: number, dir: Direction) => {
      const type = this.world.getTile(col, row);
      if (type === TileType.EMPTY) return null;
      if (!isDrillable(type, this.player.drillLevel)) return null;
      if (TILE_META[type].value > 0 && this.player.inventory.isFull()) return null;
      return { col, row, dir, type };
    };

    if (input.down) {
      const col = Math.floor(this.pod.x / TILE_SIZE);
      const row = Math.floor((body.bottom + TOUCH) / TILE_SIZE);
      const t = tryDir(col, row, 'down');
      if (t) return t;
    }
    if (input.left) {
      const col = Math.floor((body.left - TOUCH) / TILE_SIZE);
      const row = Math.floor(this.pod.y / TILE_SIZE);
      const t = tryDir(col, row, 'left');
      if (t) return t;
    }
    if (input.right) {
      const col = Math.floor((body.right + TOUCH) / TILE_SIZE);
      const row = Math.floor(this.pod.y / TILE_SIZE);
      const t = tryDir(col, row, 'right');
      if (t) return t;
    }
    return null;
  }

  private advanceDrill(dt: number): void {
    const t = this.drillTarget;
    if (!t) return;

    if (this.player.fuel <= 0) return;

    this.drillProgress += dt;
    const targetX = t.col * TILE_SIZE + TILE_SIZE / 2;
    const targetY = t.row * TILE_SIZE + TILE_SIZE / 2;
    const ratio = Math.min(1, this.drillProgress / this.currentDrillTime);
    this.pod.setPosition(
      this.drillStartX + (targetX - this.drillStartX) * ratio,
      this.drillStartY + (targetY - this.drillStartY) * ratio,
    );

    if (this.drillProgress >= this.currentDrillTime) {
      this.completeDrill(targetX, targetY);
    }
  }

  private completeDrill(targetX: number, targetY: number): void {
    const t = this.drillTarget;
    if (!t) return;

    if (TILE_META[t.type].value > 0) this.player.inventory.tryAdd(t.type);
    this.world.setTile(t.col, t.row, TileType.EMPTY);
    this.tileLayer.removeTileAt(t.col, t.row);
    this.player.fuel = Math.max(0, this.player.fuel - FUEL_BURN_DRILL);

    this.pod.setPosition(targetX, targetY);
    const body = this.pod.body as Phaser.Physics.Arcade.Body;
    body.reset(targetX, targetY);
    body.enable = true;

    this.drillTarget = null;
    this.drillProgress = 0;
    this.currentDrillTime = 0;
    this.prevYVelocity = 0;
    this.wasGrounded = false;
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

  private buildShopActions(): void {
    const upgradeAction = (i: number, kind: UpgradeKind): ShopAction => ({
      key: String(i + 1),
      buildLabel: () => {
        const track = UPGRADE_TRACKS[kind];
        const lvl = this.player.upgradeLevel(kind);
        const cost = this.player.upgradeCost(kind);
        if (cost === null) {
          return { text: `${i + 1} ${track.name}  MAXED`, affordable: false, maxed: true };
        }
        const next = effectAt(track, lvl + 1);
        const nextStr = Number.isInteger(next) ? `${next}` : next.toFixed(2);
        return {
          text: `${i + 1} ${track.name} L${lvl}->${lvl + 1} ${nextStr}${track.unit} $${cost}`,
          affordable: this.player.cash >= cost,
          maxed: false,
        };
      },
      apply: () => {
        this.player.buyUpgrade(kind);
      },
    });

    this.shopActions = [
      {
        key: '1',
        buildLabel: () => {
          const v = this.player.inventory.totalValue();
          return {
            text: `1 SELL ALL  $${v}`,
            affordable: v > 0,
            maxed: false,
          };
        },
        apply: () => {
          this.player.sellAll();
        },
      },
      {
        key: '2',
        buildLabel: () => {
          const cost = this.player.refuelCost();
          if (cost === 0) return { text: '2 REFUEL  (full)', affordable: false, maxed: false };
          return {
            text: `2 REFUEL    $${cost}`,
            affordable: this.player.cash > 0,
            maxed: false,
          };
        },
        apply: () => {
          this.player.refuel();
        },
      },
      {
        key: '3',
        buildLabel: () => {
          const cost = this.player.repairCost();
          if (cost === 0) return { text: '3 REPAIR  (ok)', affordable: false, maxed: false };
          return {
            text: `3 REPAIR    $${cost}`,
            affordable: this.player.cash > 0,
            maxed: false,
          };
        },
        apply: () => {
          this.player.repair();
        },
      },
    ];
    UPGRADE_KINDS_ORDERED.forEach((kind, idx) => {
      this.shopActions.push(upgradeAction(3 + idx, kind));
    });
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

    this.add.text(20, 14, 'FUEL', titleStyle).setScrollFactor(0).setDepth(1001);
    this.fuelLabel = this.add
      .text(180, 14, '', labelStyle)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1001);

    this.add.text(20, 36, 'HULL', titleStyle).setScrollFactor(0).setDepth(1001);
    this.hullLabel = this.add
      .text(180, 36, '', labelStyle)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1001);

    this.add.text(20, 58, 'CARGO', titleStyle).setScrollFactor(0).setDepth(1001);
    this.cargoLabel = this.add
      .text(180, 58, '', labelStyle)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1001);

    this.depthLabel = this.add.text(20, 84, '', labelStyle).setScrollFactor(0).setDepth(1001);
    this.valueLabel = this.add
      .text(180, 84, '', labelStyle)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1001);

    this.drillingLabel = this.add.text(20, 104, '', labelStyle).setScrollFactor(0).setDepth(1001);

    const invX = GAME_WIDTH - 200;
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

  private createShopUi(): void {
    const titleStyle = {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffd866',
    } as const;
    const lineStyle = {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#e8e8e8',
    } as const;

    this.shopGraphics = this.add.graphics().setScrollFactor(0).setDepth(1000);

    const panelX = 16;
    const panelY = GAME_HEIGHT - 150;

    this.shopTitle = this.add
      .text(panelX + 16, panelY + 10, '', titleStyle)
      .setScrollFactor(0)
      .setDepth(1001);

    this.shopHint = this.add
      .text(GAME_WIDTH - 16 - panelX, panelY + 10, 'press a number to act', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#888',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1001);

    const cols = 3;
    const colWidth = (GAME_WIDTH - 32 - 32) / cols;
    for (let i = 0; i < this.shopActions.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = panelX + 20 + col * colWidth;
      const y = panelY + 38 + row * 26;
      const t = this.add
        .text(x, y, '', lineStyle)
        .setScrollFactor(0)
        .setDepth(1001);
      this.shopActionTexts.push(t);
    }
  }

  private updateShopUi(): void {
    const visible = this.isAtSurface();
    this.shopGraphics.clear();
    this.shopGraphics.setVisible(visible);
    this.shopTitle.setVisible(visible);
    this.shopHint.setVisible(visible);
    for (const t of this.shopActionTexts) t.setVisible(visible);

    if (!visible) return;

    const panelX = 16;
    const panelY = GAME_HEIGHT - 150;
    const panelW = GAME_WIDTH - 32;
    const panelH = 130;
    this.shopGraphics.fillStyle(0x000000, 0.7);
    this.shopGraphics.fillRoundedRect(panelX, panelY, panelW, panelH, 6);
    this.shopGraphics.lineStyle(1, 0xffd866, 0.5);
    this.shopGraphics.strokeRoundedRect(panelX, panelY, panelW, panelH, 6);

    this.shopTitle.setText(`TOWN                                            CASH $${this.player.cash}`);

    for (let i = 0; i < this.shopActions.length; i++) {
      const action = this.shopActions[i];
      const text = this.shopActionTexts[i];
      if (!action || !text) continue;
      const built = action.buildLabel();
      text.setText(built.text);
      const color = built.maxed ? '#ffd866' : built.affordable ? '#aaffaa' : '#888888';
      text.setColor(color);
    }
  }

  private updateHud(): void {
    const fuelRatio = this.player.fuel / this.player.maxFuel;
    const hullRatio = this.player.hull / this.player.maxHull;
    const cargoRatio = this.player.inventory.total() / this.player.inventory.capacity;
    const fuelColor = fuelRatio < 0.2 ? 0xff5555 : fuelRatio < 0.5 ? 0xf5b342 : 0x55cc55;
    const hullColor = hullRatio < 0.25 ? 0xff5555 : hullRatio < 0.6 ? 0xf5b342 : 0xff7766;
    const cargoColor = this.player.inventory.isFull() ? 0xff5555 : 0x6db8ff;

    this.hudGraphics.clear();
    this.hudGraphics.fillStyle(0x000000, 0.55);
    this.hudGraphics.fillRoundedRect(8, 8, 200, 122, 6);
    this.drawHudBar(20, 28, 160, 6, fuelRatio, fuelColor);
    this.drawHudBar(20, 50, 160, 6, hullRatio, hullColor);
    this.drawHudBar(20, 72, 160, 6, cargoRatio, cargoColor);

    const fuelPct = Math.round(fuelRatio * 100);
    this.fuelLabel.setText(`${fuelPct}%`);
    this.hullLabel.setText(`${Math.ceil(this.player.hull)}/${this.player.maxHull}`);
    this.cargoLabel.setText(`${this.player.inventory.total()}/${this.player.inventory.capacity}`);

    const depth = Math.max(0, Math.floor(this.pod.y / TILE_SIZE) - SURFACE_ROW);
    this.depthLabel.setText(`DEPTH ${depth}m`);
    this.valueLabel.setText(`$${this.player.inventory.totalValue()}`);

    if (this.drillTarget && this.currentDrillTime > 0) {
      const pct = Math.round((this.drillProgress / this.currentDrillTime) * 100);
      const name = TILE_META[this.drillTarget.type].name;
      this.drillingLabel.setText(`drilling ${name} ${pct}%`);
    } else if (this.player.inventory.isFull()) {
      this.drillingLabel.setText('CARGO FULL');
    } else {
      this.drillingLabel.setText('');
    }

    const entries = this.player.inventory.entries();
    this.inventoryTitle.setVisible(entries.length > 0);
    for (const line of this.inventoryLines.values()) line.setVisible(false);
    if (entries.length > 0) {
      this.hudGraphics.fillStyle(0x000000, 0.55);
      this.hudGraphics.fillRoundedRect(GAME_WIDTH - 200, 8, 192, 28 + 18 * entries.length, 6);
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

  private createGameOverOverlay(): void {
    this.gameOverGraphics = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(2000)
      .setVisible(false);
    this.gameOverGraphics.fillStyle(0x000000, 0.78);
    this.gameOverGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.gameOverTitle = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 'GAME OVER', {
        fontFamily: 'monospace',
        fontSize: '64px',
        color: '#ff5555',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001)
      .setVisible(false);

    this.gameOverSubtitle = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#e8e8e8',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001)
      .setVisible(false);

    this.gameOverHint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70, 'press R to restart', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#a0a0a0',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001)
      .setVisible(false);
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
