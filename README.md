# FPV vs Interceptor

**Live demo:** https://jason9075.github.io/fpv_vs_interceptor/

An interactive three.js site that compares how an **FPV quadcopter** and a **tailsitter-style interceptor drone** respond to the same stick inputs: which axis each stick rotates, and which direction of velocity it produces.

> **FPV: thrust points up, so you tilt to move. Interceptor: thrust points along the nose, so it goes where it points.**

Both drones are driven by the same sticks at the same time, side by side, so the differences are immediately visible.

## Key ideas

| Stick | FPV Drone | Interceptor |
|---|---|---|
| Throttle ↑ | Accelerates along body **up** → climbs | Accelerates along the **nose** → speeds up |
| Pitch (push) | Nose down → horizontal thrust → moves **forward**, loses altitude unless you add throttle | Nose down → velocity follows the nose → **dives** |
| Roll | Banks → **slides sideways**, heading unchanged | Spins around the nose (thrust) axis → **velocity direction unchanged** |
| Yaw | Turns the nose only → existing velocity keeps **drifting** | Swings the nose → velocity follows → **turns** |

At the motor level, the interceptor's roll and yaw are **swapped** compared to a quad. The axis driven by motor reaction torque is slower: yaw on the FPV, roll on the interceptor.

## Features

- **Side-by-side or single view.** One renderer split into two viewports with scissor tests, and a separate scene for each drone.
- **Inputs:**
  - On-screen virtual sticks (mouse or touch)
  - Keyboard
  - Gamepad API, with remappable axes
  - Mode 1 or Mode 2 stick layout
- **Flight modes:**
  - Acro (rate) mode: stick deflection sets the rotation rate.
  - Angle mode: stick deflection sets a target angle.
- **Visuals:**
  - Body axis gizmo: roll is red, pitch is green, yaw is blue. The active axis is highlighted, and a rotation arc shows its direction.
  - Vector arrows: thrust is yellow, velocity is cyan (with its horizontal and vertical components), gravity is gray.
  - A flight trail colored by speed.
- **HUD:**
  - Attitude, angular rates, and speed in both body and world frames.
  - For the interceptor, also sideslip and flight path angle γ.
  - A live text explanation of what the current input is doing.
- **Cameras:** chase, FPV (onboard with camera tilt), and orbit.
- **Other:** pause, reset, light and dark themes, a mobile layout, and a lil-gui panel for tuning parameters live.

## Controls

| Key | Action |
|---|---|
| `W` / `S` | Throttle up / down |
| `A` / `D` | Yaw left / right |
| `↑` / `↓` | Pitch forward (nose down) / back |
| `←` / `→` | Roll left / right |
| `R` | Reset |
| `P` | Pause |
| `C` | Cycle camera |

Mid throttle equals hover thrust (T = m·g) for both drones.

## Getting started

Requires Node.js 18+ and, optionally, [just](https://github.com/casey/just).

```bash
just dev        # or: npm install && npm run dev
```

| `just` recipe | Description |
|---|---|
| `just dev [port]` | Start the Vite dev server |
| `just dev-lan [port]` | Dev server exposed on LAN (for phone testing) |
| `just test` | Run physics unit tests (Vitest) |
| `just check` | Type check |
| `just build` | Type check and build to `dist/` |
| `just preview` | Build and preview |
| `just ci` | Type check, test, and build |
| `just clean` | Remove `dist/` |

The build is a fully static site (`base: './'`). Every push to `main` runs tests, builds and deploys to GitHub Pages via `.github/workflows/deploy.yml` (repo Settings → Pages → Source: **GitHub Actions**).

## Physics model

The model is deliberately simple. The goal is correct directions and an intuitive feel, not a high-fidelity simulation.

- Fixed timestep of 1/240 s, with several substeps per frame.
- Rotation:
  - Each axis responds to the stick with first-order lag toward its target rate, with a time constant τ per axis.
  - Attitude is integrated as a quaternion.
- Forces:
  - **thrust** along the body thrust axis (`+Y` for the FPV, nose `-Z` for the interceptor)
  - **gravity**
  - **quadratic drag** `−k|v|v`
- The interceptor adds a lateral drag term `−c·v⊥`, where `v⊥` is the part of the velocity perpendicular to the nose. This lets the velocity follow the nose and provides body "lift" at an angle of attack.
- The interceptor spawns in a **level cruise trim**, solved numerically by `solveCruiseTrim`: about 10° nose-up at about 35 m/s with mid throttle.

All parameters live in `src/config.ts`.

## Project structure

```
src/
├── main.ts                 # App wiring, settings bar, main loop, rendering
├── config.ts               # All tunable parameters
├── input/                  # InputState, virtual sticks, keyboard, gamepad, rate curve
├── physics/                # Shared drone model, FPV / interceptor dynamics, telemetry, tests
├── scene/                  # World, drone meshes, vector arrows, axis gizmo, trail, camera rig
└── ui/                     # HUD, explainer text, input bars
```

See [`guideline`](./guideline) for the full design spec (in Traditional Chinese).

## Tech stack

Vite 5 · TypeScript 5 · three.js 0.169 · lil-gui · Vitest
