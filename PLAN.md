# Sandbox3D — Engineering Plan

A free-form 3D physics playground in the spirit of Melon Playground: spawn, move, combine and
destroy a large variety of objects and watch them interact.

## 1. Goals & constraints

- **Feel first.** A vertical slice that is fun within 30 seconds: grab a melon, throw it at a
  ragdoll, blow up a barrel. Depth comes from the catalog, not from menus.
- **Data-driven catalog.** Adding an object must never require engine/physics code. Target
  ~180 catalog entries across 10 categories, defined declaratively.
- **High object counts.** Comfortable interaction at 500+ dynamic bodies, hard cap ~900 with
  graceful eviction. Rendering batched with `InstancedMesh`; physics stepped at a fixed 60 Hz.
- **No external assets.** All visuals are procedural geometry + canvas textures + emoji icons, so
  the build stays small, offline-capable and license-clean.
- **Testable headlessly.** Simulation, registry and catalog are pure TypeScript with no DOM,
  Three.js or WebGL imports, so Vitest can step Rapier worlds in Node.

## 2. Stack decision

| Concern      | Choice                                              | Why |
| ------------ | --------------------------------------------------- | --- |
| Bundler      | Vite 8 + TypeScript 5.9                             | Fast dev loop, tiny output, first-class TS |
| Rendering    | Three.js 0.187                                      | Low-level access needed for custom instancing batches |
| Physics      | Rapier3D 0.21 (`@dimforge/rapier3d-compat`, WASM)   | Stable stacking, joints (ragdolls/vehicles/soft bodies), CCD, sleeping, contact-force events |
| Tests        | Vitest 5                                            | Runs Rapier WASM headlessly in Node |
| UI           | Hand-written DOM + CSS                              | No framework overhead; catalog is data-driven DOM |

The repository is an empty shell (README + MIT license), so this stack is the baseline rather than
an integration. 1 world unit = 1 metre, gravity −9.81 m/s².

## 3. Architecture

```
index.html ── src/main.ts ── game/SandboxGame.ts
                                │
        ┌───────────────────────┼─────────────────────────┐
        │                       │                         │
   sim/SimWorld            ui/UI                     render/SceneRenderer
   (pure Rapier)           hud, search, tools        (Three.js)
        │                                               │
   sim/builders.ts                              render/RenderBridge
   (rigid, ragdoll, vehicle,                    (instanced part batches)
    soft, cloth, fluid)                          render/fx.ts (particles)
        │
   catalog/ (pure data + registry)
```

**Hard rule:** `src/sim/**` and `src/catalog/**` may import Rapier and each other, never Three.js,
`window` or `document`. `src/render/**` and `src/ui/**` may import Three.js/DOM. This keeps the
whole simulation unit-testable and prevents render/types leaking into physics.

### File layout

```
src/
  core/        math.ts (seeded RNG, vec helpers), config.ts (tuning constants)
  catalog/     types.ts, materials.ts, shapes.ts, registry.ts,
               blocks.ts props.ts fragile.ts explosives.ts vehicles.ts ragdolls.ts
               nature.ts soft.ts weapons.ts gadgets.ts projectiles.ts index.ts
  sim/         physics.ts (Rapier init), SimWorld.ts, builders.ts, grabber.ts, types.ts
  render/      scene.ts, RenderBridge.ts, batches.ts, geometry.ts, fx.ts, ghost.ts
  game/        SandboxGame.ts, OrbitCamera.ts, input.ts
  ui/          ui.ts
  main.ts      boot / error surface
  style.css
tests/         registry, spawning, physics, interactions, catalog-smoke
```

## 4. Object model (data-driven)

```ts
type Category = 'blocks' | 'props' | 'fragile' | 'explosives' | 'vehicles'
             | 'ragdolls' | 'nature' | 'soft' | 'weapons' | 'gadgets';

interface ObjectDef {
  id: string; name: string; category: Category;
  icon?: string;                    // emoji for the catalog card
  description?: string;
  kind?: 'rigid' | 'ragdoll' | 'vehicle' | 'soft' | 'cloth' | 'fluid';
  shape?: ShapeSpec;                // rigid compound geometry + colliders
  material?: MaterialName;          // density, friction, restitution, PBR look
  colors?: string[];                // random per spawn → free variety
  tags?: string[];                  // searchable, also drives force fields
  spawnScale?: [number, number];    // random size variation
  hidden?: boolean;                 // projectiles: spawnable by weapons, not UI
  behaviors?: {
    destructible?: { hp: number; fragments: number; impactThreshold: number;
                     fragmentColors?: string[]; releaseFluid?: FluidConfig };
    explosive?:    { radius: number; impulse: number; damage: number;
                     fuse?: number; impactTrigger?: boolean; triggerThreshold?: number;
                     shatter?: number; color?: string };
    ragdoll?:      { height?: number; limbScale?: number; head?: 'sphere' | 'box' };
    vehicle?:      { wheels: WheelSpec[]; maxSpeed: number; motorForce: number };
    soft?:         { grid: [number, number, number]; spacing: number; stiffness: number; damping: number };
    cloth?:        { grid: [number, number]; spacing: number; pin: 'top' | 'corners'; stiffness: number };
    fluid?:        { count: number; radius: number };
    weapon?:       { projectile: string; speed: number; cooldown: number; count?: number;
                     spread?: number; muzzle?: [number, number, number] };
    forceField?:   { kind: 'wind' | 'attract' | 'lift'; strength: number; radius: number };
    buoyant?:      { lift: number };
  };
}
```

`ShapeSpec` is a discriminated union of primitives (`box`, `sphere`, `capsule`, `cylinder`,
`cone`, `hull`) with local offsets/rotations and per-part colour/material overrides. A compound
object is simply `{ kind: 'compound', parts: ShapePart[] }`, so a chair or a car is data. Colliders
and visual parts are produced from the same data, guaranteeing that what you see is what collides.

Adding an object = one entry in one catalog file. Behaviors are opt-in mixins; the engine has no
per-object `if`.

## 5. Object catalog plan

10 categories, 196 visible entries plus 6 hidden projectile definitions (202 total). Actual
counts after implementation:

| Category   | Target | Examples & mechanics |
| ---------- | ------ | -------------------- |
| Blocks     | 42     | cubes/planks/beams/pillars in many materials; balls (rubber, bowling, beach); logs, pipes, wedges, cones, dominoes |
| Props      | 43     | chairs, tables, sofas, shelves, TV, fridge, crates, barrels, mugs, pans, signs, traffic barriers, bench, bathtub |
| Fragile    | 18     | wine glass, cup, vase, mirror, window, jar, bulb, plates, crystal, fishbowl — destructible with fragments |
| Explosives | 14     | TNT bundle, bomb, dynamite, grenade, mine, rocket, canister, firework, powder keg, C4, nuke |
| Vehicles   | 9      | sedan, sports car, truck, bus, van, jeep, monster truck, go-kart, tank — chassis + revolute wheel joints and motors |
| Ragdolls   | 10     | dummy variants, melon man, zombie, skeleton, robot, ninja, clown, knight, crash dummy — 11 bodies + spherical joints |
| Nature     | 19     | trees, palms, cactus, rocks/boulders (convex hulls), logs, bushes, flowers, mushrooms, watermelon, pumpkin, snowman |
| Soft       | 13     | jelly cube/ball, gummy worm, beanbag, sponge, balloon; cloth net, banner, trampoline; water balloon, water blob, slime |
| Weapons    | 18     | sword, katana, axe, hammer, bat, crowbar, spear, shield; pistol, shotgun, rifle, rocket launcher, cannon, crossbow |
| Gadgets    | 10     | fan, magnet, windmill, bounce pad, seesaw, catapult, target, balloon, black hole |

Category lists are composed in `src/catalog/index.ts`; helpers (`cube`, `ball`, `chair`, `gun`,
`ragdollOf`) keep each entry to 1–3 lines. Palette arrays per material make every spawn slightly
different without new entries.

## 6. Systems breakdown

### 6.1 Engine & rendering
- WebGLRenderer (antialias, pixel ratio ≤ 2, ACES tone mapping, sRGB), PMREM room environment.
- Sky dome gradient shader, fog, 200 m ground plane with procedural canvas grid texture.
- Directional key light with 2048 shadow map over a 44 m area, hemisphere fill.
- Resize handling, visibility pause, FPS/draw-call telemetry.
- **Instanced batching:** unit geometries (box, sphere, cylinder, cone) + per-instance scale and
  colour; batch key = geometry type + material preset. Compound parts each take an instance slot.
  Batches start at 64 slots and double when full, release slots on despawn, and compute bounding
  spheres periodically for frustum culling. Capsules/hulls use cached per-dimension geometry.
- Ghost preview mesh for the selected spawn, hover AABB highlight, particles/shockwave/scorch FX.

### 6.2 Physics world
- Rapier world, gravity −9.81, ground static cuboid, fixed timestep 1/60 with accumulator, max 4
  substeps per frame, time scale (pause/slow-mo), CCD for fast projectiles.
- `SimWorld` owns entities → bodies → parts, collider→entity map, body counter, event queue.
- Sleeping enabled; damping defaults; kill plane at y = −50; cap 900 dynamic bodies with oldest-first
  eviction and a UI notice.
- Raycast against every collider directly for spawn/delete/explode/grab (Rapier's query pipeline is
  stale before the first step), returning entity + body index + point + normal.
- Events surfaced to the game layer: `blast`, `break`, `cap`, `spawn`, `weapon`.

### 6.3 Spawning & selection
- Spawn from catalog at raycast hit, lifted clear of the surface; random Y rotation and size within
  the def's range; scale slider multiplier 0.5–2×.
- Click a catalog card to select it (auto-switch to Spawn tool); search by name/tag/description;
  category chips with counts; cards show icon, name, tag hints.
- Tools: Grab (G), Spawn (S), Blast (B), Delete (X). Blast spawns a radial impulse + VFX; Delete
  removes a whole group (fluid blob/ragdoll).
- Ghost preview follows the cursor and snaps to surfaces.
- Clear-all, reset view, pause, slow-mo. Keyboard shortcuts overlay.

### 6.4 Grab / throw
- Spring-free, stable **joint grab**: kinematic anchor body at the hit point + spherical joint to
  the grabbed body's local hit point. The anchor follows the cursor ray at fixed depth; anchor
  Y is clamped above the floor. Wheel/vehicle/ragdoll parts each grab individually.
- Release computes cursor velocity over the last 100 ms and applies an impulse (mass-scaled,
  clamped) plus angular kick, so you can hurl a washing machine at a clown.
- Hover highlight shows the AABB under the cursor for Grab/Delete/Blast.

### 6.5 Interactions & destruction
- Contact-force events (Rapier `CONTACT_FORCE_EVENTS`) feed destructible HP; glass shatters when
  energy exceeds a threshold. Breaking removes the entity, emits FX, spawns 6–16 physical
  fragments inheriting velocity, and optionally releases fluid.
- Explosions: radial impulse with distance falloff and upward bias, area damage, chain reactions
  with short randomized fuses, shatter debris, shockwave/flash/scorch/screen shake. Mines trigger
  on contact; bombs/grenades on fuse.
- Weapons: `behaviors.weapon` spawns its projectile def at the muzzle with spread; `F` fires a
  grabbed/nearest weapon, with recoil and cooldown. Projectiles can be explosive.
- Force-field gadgets: wind fans push nearby bodies, magnets attract metal-tagged objects, balloons
  get buoyancy; all processed in the fixed step.
- Ragdolls: head/torso/hips/two-segment arms and legs (11 bodies) joined with spherical joints.
- Vehicles: chassis compound body + 4 cylinder wheels on revolute joints; `F` toggles the motor.
- Soft bodies: lattice of spheres joined by Rapier spring joints → squashy jelly.
- Cloth: particle grid with structural springs and pinned edges → trampoline/net/banner.
- Fluids: capped clusters of small spheres in one group that splash, flow and are removed together.

### 6.6 Camera & UI
- Orbit/pan/zoom camera with damping; right-drag orbit, middle/shift-drag pan, wheel zoom,
  WASD/arrows pan, Q/E rotate, R reset. Clamped polar/distance.
- Right catalog sidebar (search + category chips + item grid + selected footer), top status bar
  (FPS, objects, bodies, draw calls), bottom toolbar (tools, scale, pause/slow/clear/help).
- Dark "workshop" theme with lime/melon accent, responsive collapse on narrow screens, toasts,
  first-run help panel.

## 7. Performance strategy

1. **Fixed 60 Hz physics**, accumulator with substep cap, no per-frame allocations in the step.
2. **Sleeping bodies** (Rapier default) + damping; grab/explosion wake only affected bodies.
3. **Instanced rendering** by unit geometry + material; per-instance colour and transform.
   Reuse `Matrix4`/`Quaternion` scratch objects; no per-part object churn per frame.
4. **Culling:** batch bounding sphere recomputed on a timer for frustum culling; cap pixel ratio,
   shadow map size and fog distance.
5. **Caps & cleanup:** 900-body cap, oldest eviction, kill plane, fluid/cloth/debris particle caps,
   projectile lifetime cleanup.
6. **FX pooling:** one 1600-particle `Points` system, pooled shockwave/scorch meshes.
7. **Bundle:** Vite production build, esbuild minify, CSS minify, no assets; gzip size report.
8. **HUD telemetry** to catch regressions: FPS, entity/body counts, draw calls.

Targets: 60 fps at 200+ bodies on integrated GPUs, < 2.5 s cold load on broadband, app JS+WASM
under ~1.9 MB gzipped / ~1.4 MB brotli. The browser stress check hit 60 fps and 39 draw calls with
200 bodies; the production bundle measured 1.78 MB gzip / 1.31 MB brotli.

## 8. Testing plan (Vitest, Node)

- **registry**: unique ids, valid categories/shapes/colors, search, counts, category coverage,
  every visible def builds in a headless world.
- **spawning**: rigid/spawn options, random scale, group kinds (ragdoll/vehicle/soft/cloth/fluid)
  produce expected body counts, caps evict oldest, kill plane cleanup, double-remove safety.
- **physics**: gravity free-fall, fixed timestep accumulator, resting/sleeping, raycast hits,
  pause/time scale.
- **interactions**: grab joint attaches/releases and throws, explosion impulse falloff and chain
  reaction, destructible break → fragments, fluid release, weapon projectile + cooldown, force
  fields, vehicle motor toggle, soft-body deformation, cloth pinning.
- **catalog smoke**: every entry spawns, simulates 30 steps and is removed without throwing.

Run `npm test`, `npm run typecheck`, `npm run build`, then a browser manual pass for console
errors/warnings, visuals and controls.

## 9. Milestones

1. **Scaffold** — Vite/TS config, catalog types + registry + materials, headless `SimWorld`,
   rigid spawning, tests green.
2. **Vertical slice** — renderer, instanced bridge, camera, input, spawn/grab/throw, blast, UI shell.
3. **Catalog expansion** — all categories, ragdolls, vehicles, soft/cloth/fluid, explosives,
   fragile shattering, weapons, gadgets.
4. **Polish** — ghost preview, hover highlight, VFX, screen shake, HUD, help, toasts, responsive CSS.
5. **Harden** — tests for every system, bugfix pass, production build, perf tuning.
6. **Ship** — logical commits, pull/rebase remote, re-test, push.

## 10. Risks & mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Rapier WASM loading in browser/Vite | `rapier3d-compat` inlines WASM as base64; call `init()` once before world creation |
| Joint-heavy scenes (ragdolls/cloth) tanking FPS | Cap bodies, spring counts, limit cloth grids, sleep |
| Instancing complexity (colour/materials/compounds) | Unit geometry + per-instance colour; batch per material; release/zero-scale hidden slots |
| Destruction event storms | Per-entity damage cooldown, contact-force thresholds, fragment caps |
| Grab instability on heavy objects | Kinematic anchor + joint, mass-scaled impulse clamp, damping while held |
| Catalog data errors | Registry validation at startup + catalog smoke test spawning every def |
| Mobile/weak GPUs | Pixel ratio cap, shadow toggle at low FPS, quality auto-degrade |

## 11. Definition of done

- 196 data-defined objects across all categories, all spawnable and interactive.
- Grab/throw, destruction, explosions, ragdolls, vehicles, soft bodies, fluids, weapons working.
- No console errors/warnings during a manual pass; tests and production build green.
- Committed and pushed to `origin`.

## 12. Implementation status

- **Catalog:** 196 visible definitions + 6 hidden projectile definitions (202 total), all validated;
  counts are Blocks 42, Props 43, Fragile 18, Explosives 14, Vehicles 9, Ragdolls 10, Nature 19,
  Soft & Fluids 13, Weapons 18, Gadgets 10.
- **Model deviation:** rigid/vehicle objects use `parts: ShapePart[]` directly rather than a separate
  `ShapeSpec` compound wrapper. Ragdoll/vehicle/soft/cloth/fluid configs live at the top level of
  `ObjectDef`, not inside `behaviors`.
- **Raycasting:** Rapier's query pipeline is stale before the first step, so picking iterates every
  collider with `castRayAndGetNormal`; this also fixes immediate spawn/grab picking.
- **Rendering:** instanced batches start at 64 slots and double; capsule/hull geometry is cached;
  batch bounding spheres are recomputed every 120 frames for culling.
- **Verification:** strict TypeScript clean; Vitest 29/29 passing across 5 files; production build
  green with Oxc minification, gzip/brotli copies generated. Browser pass: 60 fps starter scene,
  60 fps and 39 draw calls with 200 instanced cubes, no application console errors; the only
  warnings are WebGL driver readback notices from the cloud screenshot environment.
- **Bundle:** 5.0 MB raw JS, 1.78 MB gzip, 1.31 MB brotli (Rapier WASM + Three.js dominate).
- **Serve note:** cloud previews use the reserved port 3000, so the dev script is bound there.
