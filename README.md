# Sandbox3D

A free-form 3D physics playground in the spirit of Melon Playground. Spawn, grab, stack, smash,
detonate and hurl **196 different objects** across ten categories. Everything is procedural — no
external art, textures or models.

Built with **Three.js**, **Rapier3D**, **TypeScript** and **Vite**.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Other useful commands:

```bash
npm test           # headless Vitest suite (registry, physics, spawning, interactions)
npm run typecheck  # strict TypeScript
npm run build      # typecheck + minified production build into dist/ + gzip/brotli copies + size report
npm run size       # raw / gzip / brotli sizes of dist/assets
```

Node 20+ is recommended. Rapier ships as WASM and is initialized before the first world is built.

## GitHub Pages

The published site is served from the main branch root. `index.html` is a small launcher: on GitHub
Pages it redirects to the production build in `dist/`, while local development goes to the Vite
source entry `app.html`. This keeps the existing Pages branch source working without a Pages
settings change.

After changing source, run `npm run build` and commit the updated `dist/` output. `npm run dev`
still serves the TypeScript source at `http://localhost:3000` through the launcher.

## Controls

| Input | Action |
| --- | --- |
| Left click | Use the active tool (spawn, grab, blast, delete) |
| Right drag | Orbit the camera |
| Middle drag / Shift + left drag | Pan |
| Wheel | Zoom |
| WASD / arrows | Pan the camera |
| Q / E | Rotate the camera |
| G / S / B / X | Grab / Spawn / Blast / Delete tool |
| F | Fire a held or pointed weapon, or toggle a vehicle engine |
| Space | Pause / resume physics |
| T | Slow motion |
| C | Clear the world |
| R | Reset the view |
| H | Controls panel |
| / | Focus catalog search |

Pick an object in the catalog, adjust **Size**, then click a surface to place it. Grab an object and
drag to move it; release while moving to throw it. Weapons fire toward the cursor.

## What's in the catalog

| Category | Count | Highlights |
| --- | ---: | --- |
| Blocks | 42 | cubes, planks, beams, pillars, balls, rocks, wedges, dominoes |
| Props | 43 | chairs, tables, sofas, shelves, fridge, crates, barrels, traffic barriers |
| Fragile | 18 | vases, mirrors, bottles, TV, fishbowl, crystal — shatter into physics debris |
| Explosives | 14 | TNT, bombs, mines, rockets, powder kegs, C4, a very big bomb |
| Vehicles | 9 | sedan, sports car, bus, jeep, go-kart, monster truck, tank — drivable wheels |
| Ragdolls | 10 | crash dummies, melon man, zombie, skeleton, robot, knight — 11 jointed bodies |
| Nature | 19 | trees, cacti, boulders, fruit, ice, mushrooms, flowers |
| Soft & Fluids | 13 | jelly lattices, spring cloth, water balloons, water/slime particle blobs |
| Weapons | 18 | swords, axes, bats, shield, pistol, shotgun, rifle, rocket launcher, cannon |
| Gadgets | 10 | wind fan, magnet, black hole, helium balloon, seesaw, catapult, target |

Every entry is data. The simulation resolves rigid compounds, ragdolls, vehicles, spring soft
bodies, cloth and fluid groups from declarative configs.

## Architecture

```
src/core       math, seeded RNG, tuning constants
src/catalog    object definitions, materials, shapes, registry + validation
src/sim        Rapier world, entity model, builders, joint-based grabber (DOM-free)
src/render     Three.js scene, instanced batches, render bridge, ghost, particles
src/game       game loop, camera, input
src/ui         catalog, HUD, tools, help, toasts
tests          headless core-system tests
```

- **Data-driven catalog.** `src/catalog/*.ts` contains definitions; `registry.ts` validates every
  entry at startup. Adding an object is one entry + one registry line (the files are already
  registered), with no engine changes.
- **Simulation/render split.** `src/sim` and `src/catalog` never import Three.js or touch the DOM,
  so Rapier worlds run headlessly in Vitest.
- **Instanced rendering.** Unit box/sphere/cylinder/cone geometries with per-instance transform and
  colour, batched by geometry + material; capsules and convex hulls use cached geometry.
- **Fixed step.** 1/60 s accumulator capped at four substeps, CCD projectiles, sleeping bodies,
  kill plane, and a 900-body cap with oldest-first eviction.
- **Destruction.** Contact-force events shatter destructibles into velocity-inheriting fragments;
  explosions apply falloff impulses, chain-detonate other explosives, release fluid and shake the
  camera.
- **Interaction.** A kinematic anchor + spherical joint grabs any dynamic body; release converts
  cursor speed into a clamped throw impulse.

## Adding an object

Add one entry to a catalog file, for example:

```ts
{
  id: 'mega-plank',
  name: 'Mega Plank',
  icon: '🪵',
  category: 'blocks',
  material: 'wood',
  colors: PALETTES.wood,
  parts: [box(4, 0.18, 0.5)],
  tags: ['block', 'long'],
  description: 'A very long plank',
}
```

Restart the dev server and it appears in the catalog, search, recipes and physics with no other
code changes. Run `npm test` to validate it.

## Performance & verification

The browser pass was run against a production-shaped dev build: 60 fps at the 11-object starter
scene, and 60 fps / 39 draw calls with 200 instanced cubes and 200 dynamic bodies. The renderer
batches parts by material and geometry, reuses scratch matrices, recomputes batch bounds on a timer
for frustum culling, and lowers render resolution automatically if sustained frame rate drops.

All core systems have automated coverage in `tests/` (29 tests): registry validation/search,
every catalog entry spawned and simulated, fixed-step physics and raycasts, spawning/caps/bounds,
grab/throw, explosions and chain reactions, destruction/fragments, fluids, weapons, vehicles,
force fields, soft bodies and cloth.

The production bundle is minified and emitted with gzip/brotli copies: roughly 5.0 MB raw JS
(Rapier WASM + Three.js dominate), 1.78 MB gzip, 1.31 MB brotli. The browser pass was clean of
application console errors and warnings.
