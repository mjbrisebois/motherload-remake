# Contributing

## Commands

```
npm run dev         # vite dev server, hot reload at http://localhost:5173
npm run build       # production build (typecheck + vite build)
npm run typecheck   # tsc --noEmit
npm test            # vitest run (one-shot)
npm run test:watch  # vitest watch mode
```

## Architecture

The single most important rule: **pure game logic lives in `src/game/` with no Phaser imports**. Phaser-specific code (rendering, input, physics wiring) lives in `src/scenes/`. Keeping the logic Phaser-free is what makes it unit-testable and what keeps the scene file from sprawling into business rules.

```
src/
  config.ts            tunable constants (every number the player can feel)
  main.ts              Phaser game bootstrap
  game/                pure TypeScript, fully unit-tested
    world.ts           tile grid + TileType enum
    tiles.ts           tile metadata (color, value, drillTime, hardness)
    generator.ts       seeded terrain generation
    rng.ts             mulberry32
    inventory.ts       cargo-bounded ore counts + value math
    economy.ts         refuel/repair cost formulas
    upgrades.ts        five upgrade tracks (cost+value arrays)
    player.ts          PlayerState: cash, fuel, hull, inventory, upgrade levels
    *.test.ts          tests next to source, not in a separate tests/ tree
  scenes/
    GameScene.ts       the entire Phaser scene - world rendering, pod physics,
                       input, drilling, HUD, shop, game over overlay
```

When adding a feature:

1. If it has math or rules, put it in `src/game/`.
2. If it touches sprites, input, sound, or animation, put it in `src/scenes/`.
3. The scene reads from / mutates the pure modules. The pure modules know nothing about Phaser.

## Mechanics

### Pod controls

- Arrow keys to fly. Up = thrust upward (consumes fuel), left/right = horizontal motion, down = drill if grounded.
- **Drill intent hold**: pressing a direction must persist for `DRILL_INTENT_HOLD` seconds before a drill starts. Short taps don't drill. The held timer keeps counting through a drill so chain-drilling has no per-tile gate; it only resets when you release.
- **Grounded check**: drilling in any direction requires the pod to be sitting on a solid tile (geometric check via tile under pod center). Flying past a wall and pressing into it does not drill — matches the original.
- **Drill commitment**: once a drill starts, releasing the key does not cancel it. The physics body is disabled, the pod lerps into the target tile's center over `drillTime`, and the body is re-enabled with `body.reset` after the tile is removed from the layer.
- **Auto-center**: drilling lerps the pod's perpendicular axis to the target tile's column/row center. Chain-drilling down keeps you aligned in a column.

### Vertical magnet

When the pod is moving vertically (`|vy| > MAGNET_VY_THRESHOLD`) with no horizontal input AND the column in the direction of travel is open, the pod is gently nudged toward that column's center at `MAGNET_PULL_SPEED`. Auto-aligns flying into and out of 1-tile shafts.

### Side movement

Acceleration-based, not instant velocity. `HORIZ_ACCEL` ramps the pod toward the cap, `HORIZ_DRAG` opposes motion when no input. Result: a tap nudges a few pixels; a hold ramps over ~0.4s. Two caps: `GROUND_HORIZ_SPEED` (slow, precise) when grounded, `HORIZ_SPEED` (fast) when airborne.

### Engine and cargo

- `engineMultiplier` (from `UPGRADE_TRACKS[ENGINE].values[level]`) scales **only** upward thrust, not horizontal speed.
- Cargo weight: `thrust = THRUST_ACCEL * engineMultiplier - CARGO_THRUST_PENALTY * cargoLoad`, where `cargoLoad = inventory.total() / inventory.capacity`. Empty cargo: full thrust. Full cargo: thrust reduced by up to `CARGO_THRUST_PENALTY`.

### Tile system

`TileType` is intentionally numbered to match Phaser tilemap GIDs. Names match the original game:

- 0 EMPTY, 1 DIRT, 2 ROCK, 3 IRONIUM, 4 BRONZIUM, 5 SILVERIUM, 6 GOLDIUM, 7 PLATINIUM, 8 EINSTEINIUM, 9 RUBY, 10 EMERALD, 11 DIAMOND, 12 AMAZONITE, 13 LAVA

The tilemap tileset uses `firstgid=1`, so data value `0` renders nothing and `1..13` index the strip. Tile graphics are generated procedurally in `generatePlaceholderTextures()` from `TILE_META` — no asset files.

Hardness controls drillability: ores all have hardness 0; rock has hardness 1 (needs drill upgrade ≥ 1); lava has hardness 99 (effectively undrillable).

### Generator

Deterministic given a seed. Per tile:

1. Rock probability ramps with depth (full strength by row 350).
2. Lava probability ramps with depth (starts at row 250+ underground, peaks near bedrock).
3. Cumulative ore probability based on per-ore depth-band triangular distribution. Ten ore tiers stretch across depths 0–495.
4. Fallback to dirt.

Tests assert: deterministic for same seed, no lava in shallow rows, no deep gems near surface, no ironium past its band, no amazonite shallow, sanity counts of every ore across the full depth.

### Hazards

- **Fall damage**: when transitioning airborne to grounded with `prevYVelocity > FALL_DAMAGE_THRESHOLD`, take `(velocity - threshold) * FALL_DAMAGE_FACTOR`. Tracking uses last-frame velocity since post-collision velocity is 0.
- **Lava damage**: `LAVA_DAMAGE_PER_SEC` while any of the four cardinal-adjacent tiles is `LAVA`.
- **Out of fuel below surface**: instant game over, "OUT OF FUEL" title.
- **Hull at 0**: instant game over, "GAME OVER" title.

### Shop

Auto-shows when `pod.y < SURFACE_ROW * TILE_SIZE`. Hotkeys 1–8 (see README for the menu). Lines color: green (affordable), gold (maxed), gray (broke or no-op).

Refuel and repair are partial: spend whatever cash you have and fill proportionally.

### HUD

Top-left, 200×122. Three bars: FUEL, HULL, CARGO with state-driven colors. DEPTH and `$value` (ore worth preview) below. Drill status line at bottom.

Top-right: inventory panel auto-shows when player has ≥1 ore, packs visible types only, lines tinted by ore accent color.

## Tuning constants

All in `src/config.ts`. **Current values are playtest-tuned. Do not change them without asking** — they reflect deliberate feel decisions, not arbitrary defaults.

| Constant | Value | What it does |
|---|---|---|
| `HORIZ_SPEED` | 500 | Top horizontal speed in air |
| `GROUND_HORIZ_SPEED` | 200 | Top horizontal speed when grounded |
| `HORIZ_ACCEL` | 1200 | Side ramp rate |
| `HORIZ_DRAG` | 600 | Decel when no horiz input |
| `THRUST_ACCEL` | 1400 | Base upward thrust before engine multiplier |
| `GRAVITY` | 600 | Constant downward accel |
| `MAX_FALL_SPEED` | 600 | Terminal velocity (and upward cap) |
| `FUEL_BURN_IDLE` | 0.4 | Per second, always |
| `FUEL_BURN_THRUST` | 3.0 | Per second while pressing up |
| `FUEL_BURN_DRILL` | 0.3 | Once per tile drilled |
| `FALL_DAMAGE_THRESHOLD` | 350 | Velocity below which falls don't damage |
| `FALL_DAMAGE_FACTOR` | 0.18 | hp per (px/s above threshold) |
| `LAVA_DAMAGE_PER_SEC` | 35 | While adjacent to lava |
| `DRILL_INTENT_HOLD` | 0.36 | Seconds to hold before drill triggers |
| `CARGO_THRUST_PENALTY` | 200 | Max thrust loss at full cargo |
| `MAGNET_PULL_SPEED` | 80 | Vertical-shaft snap rate (px/s) |
| `MAGNET_VY_THRESHOLD` | 30 | Min vy for magnet to engage |
| `WORLD_COLS` / `WORLD_ROWS` | 50 / 500 | Underground extent (~2450m at 5m/tile) |
| `SURFACE_ROW` | 8 | Rows of sky above ground |
| `TILE_SIZE` | 32 | Pixels per tile |
| `METERS_PER_TILE` | 5 | HUD depth display only; no gameplay effect |
| `WORLD_SEED` | 1337 | Terrain seed (changing it regenerates everything) |

`UPGRADE_TRACKS` in `src/game/upgrades.ts` has hand-tuned `costs` and `values` arrays per track — also playtest-tuned.

## Testing

- **What we test**: pure logic in `src/game/` — RNG determinism, world get/set, generator (seed determinism, depth-band assertions, sanity counts), inventory math, economy formulas, player transactions (sell, refuel, repair, buyUpgrade including partial paths and edge cases), upgrade track shape.
- **What we deliberately don't test**: Phaser scene behavior. Headless Phaser is flaky; canvas E2E has no DOM to assert against. Visual feel is verified by playtesting.
- **Current**: 48 tests across 7 files. If you add a feature with non-trivial math, add a test.

When running tests, save output to a tmp file so it can be grepped:

```
npm test 2>&1 > /tmp/test-output.txt
```

## Commits

- Single quotes in commit messages, not double quotes (`git commit -m '...'`). Special characters in the body don't need escaping that way.
- Commit messages tend to be a few short paragraphs explaining the why and the shape of the change. See `git log` for tone.
- GPG signing is enabled. Don't bypass with `--no-gpg-sign`; if the passphrase times out, retry.
- Don't reference any AI assistant in commits, PRs, or co-authors.

## Roadmap

### Done

1. Vite + TypeScript + Phaser + Vitest scaffold
2. Pod movement, drilling, fuel, camera follow
3. Seeded terrain with 7 ore types + rocks
4. Inventory + structured HUD
5. Surface town + 5-track upgrade shop
6. Hull damage, lava, fall damage, game over + restart
7. Feel pass: drill commitment, intent-hold, grounded check, partial refuel/repair
8. Feel pass: slim hitbox, vertical magnet, cargo weight, side acceleration, split air/ground speed cap

### Likely next directions

- **Save/load** to localStorage — `PlayerState` serializes cleanly; world also needs per-tile state. Round-trip tests.
- **Sound effects** (Kenney free pack): drill, sell, upgrade, lava, hull-hit, game-over.
- **Drilling particles** / tile-break animation.
- **Mother Lode endgame** at world bottom (specific encounter at depth ~200).
- **Real art** — only after gameplay is fully tuned. Replace `generatePlaceholderTextures()`.
- **Consumables**: dynamite (one-shot tile blast), teleporter (instant return to surface).
- **Gas pockets** — solid hazard that explodes when adjacent to a drill.
