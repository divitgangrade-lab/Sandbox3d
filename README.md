# Sandbox3D

A free-form 3D physics playground in the spirit of Melon Playground. Spawn, grab, stack, smash,
detonate, drive, build and hurl 196 different objects across ten categories. Save worlds, undo
mistakes, inspect live physics, and change gravity on the fly. Everything is procedural. There is no
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
| Left click | Use the active tool (spawn, grab, blast, delete, build) |
| Right drag | Orbit the camera |
| Middle drag / Shift + left drag | Pan |
| Wheel | Zoom |
| WASD / arrows | Pan the camera, or drive while a vehicle engine is running |
| Q / E | Rotate the camera |
| G / S / B / X / V | Grab / Spawn / Blast / Delete / Build tool |
| F | Fire a held or pointed weapon, or toggle a vehicle engine |
| Space | Pause / resume physics |
| T | Slow motion |
| C | Clear the world |
| R | Reset the view |
| H | Controls panel |
| Ctrl / Cmd + Z | Undo the last world edit |
| Ctrl / Cmd + Shift + Z | Redo |
| Ctrl / Cmd + S | Open saves, JSON export and import |
| / | Focus catalog search |

Pick an object in the catalog, adjust **Size**, then click a surface to place it. Grab an object and
drag to move it; release while moving to throw it. Weapons fire toward the cursor.

### Ragdolls

The ten humanoids spawn balanced and hold their posture until something disturbs them. A grab,
hard contact or explosion switches off the balance controller and the normal jointed ragdoll
physics takes over.

### Driving

Press **F** while pointing at a vehicle (or holding one) to start its engine. **W/S** control the
throttle, **A/D** steer, and **F** switches the engine off. The camera follows the vehicle while
driving; right-drag still orbits for a better view.

### Build mode

Press **V** or choose **Build**. Click an object to select it, then use grid-snapped nudges, 15°
rotations, scale steps, duplication and delete from the build panel. Snap and grid size are
adjustable, and every transform is undoable. Selection outlines use full body and part rotation.

### Saves & undo

**Ctrl/Cmd + S** opens the world-save dialog. Saves are named, stored in browser storage, and keep
object poses, colours, sizes, motion, vehicle engines and gravity. Worlds can also be exported and
imported as versioned JSON files. Invalid or newer save files are rejected with a readable message;
unknown old catalog entries are skipped without breaking the rest of the scene. Undo/redo keeps a
bounded 30-step snapshot history.

Hovering an object (or selecting it in a non-build tool) shows a live physics inspector with mass,
velocity, position, rotation, material, collider count, health, engine/fuse details and the
sleeping/held/balanced state. The gravity slider changes the whole world immediately.

## What's in the catalog

| Category | Count | Highlights |
| --- | ---: | --- |
| Blocks | 42 | cubes, planks, beams, pillars, balls, rocks, wedges, dominoes |
| Props | 43 | chairs, tables, sofas, shelves, fridge, crates, barrels, traffic barriers |
| Fragile | 18 | vases, mirrors, bottles, TV, fishbowl, crystal; shatter into physics debris |
| Explosives | 14 | TNT, bombs, mines, rockets, powder kegs, C4, a very big bomb |
| Vehicles | 9 | sedan, sports car, bus, jeep, go-kart, monster truck, tank; drivable wheels |
| Ragdolls | 10 | crash dummies, melon man, zombie, skeleton, robot, knight; 11 jointed bodies |
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
src/sim        Rapier world, entity model, builders, grabber, persistence, history, bounds (DOM-free)
src/render     Three.js scene, instanced batches, render bridge, ghost, particles
src/game       game loop, camera, input, save storage, JSON download
src/ui         catalog, HUD, tools, inspector, saves, help, toasts
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
  cursor speed into a clamped throw impulse. Ragdolls use a spring balance controller that is
  disabled by grabs, impacts and blasts.
- **World state.** Versioned snapshots serialize every body pose and velocity. Undo/redo uses the same
  snapshot format, and restore enforces the body cap and skips incompatible catalog entries.
- **Save storage.** Named slots use localStorage metadata plus one versioned JSON payload per slot;
  export/import uses the same validated format. No server is involved.

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

All core systems have automated coverage in `tests/` (38 tests): registry validation/search,
every catalog entry spawned and simulated, fixed-step physics and raycasts, spawning/caps/bounds,
grab/throw, explosions and chain reactions, destruction/fragments, fluids, weapons, vehicles,
force fields, soft bodies and cloth, ragdoll balance, vehicle driving, snapshot round-trips,
invalid/outdated save rejection, undo/redo limits and rotated selection bounds.

The production bundle is minified and emitted with gzip/brotli copies: roughly 5.2 MB raw JS
(Rapier WASM + Three.js dominate), 1.86 MB gzip, 1.38 MB brotli. The browser pass showed no
application exceptions; the cloud browser did log WebGL context and GPU-performance warnings while
several preview tabs were open at once.

## Credits, contact and licence

Sandbox3D is maintained by [STUDIO OR DEVELOPER NAME] in [CITY, COUNTRY]. Contact: [CONTACT EMAIL].
Registered address: [VERIFIED STREET ADDRESS]. Phone: [LOCAL PHONE NUMBER]. Replace all five
placeholders with the real details before publishing; the build does not fill them in.

World saves live in the browser's localStorage. There is no account system, server-side storage or
analytics script in this build. If accounts, analytics or error reporting are added later, update
this paragraph and have the privacy wording reviewed before release.

The source is MIT-licensed: <https://github.com/divitgangrade-lab/Sandbox3d>.
