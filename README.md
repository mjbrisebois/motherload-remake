# Motherload

A near-clone of XGen Studios' 2004 Flash game *Motherlode* / *Motherload*: pilot a mining pod, drill down through layered ore, return to the surface to sell, refuel, repair, and upgrade. Original code, original placeholder art.

**Status**: in development. The full v1 loop is playable end-to-end (mine, sell, upgrade, hazards, game over). Currently in tuning passes.

## How to play

Arrow keys to fly. Up = thrust upward against gravity. Left/right = horizontal motion.

Press into a solid tile and **hold** for a moment to drill — short taps are ignored. Drilling only works when the pod is on the ground. Once a drill starts it commits, and the pod auto-centers on the tile.

Return to the sky zone (above the surface) and the **shop** appears at the bottom of the screen. Number keys trigger actions:

- `1` SELL ALL ore
- `2` REFUEL (partial spend if you can't afford a full tank)
- `3` REPAIR hull (partial spend if you can't afford full)
- `4` Fuel Tank · `5` Cargo Bay · `6` Hull · `7` Drill · `8` Engine

The drill upgrade unlocks **rocks**. Stay away from **lava**, falls hurt, and running out of fuel underground is a game over. Press `R` to restart after a game over.

## Quick start

```
npm install
npm run dev
```

Open http://localhost:5173.

## Tech

TypeScript + Phaser 3 + Vite + Vitest. Browser-only, no backend.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for architecture, conventions, and tuning details.
