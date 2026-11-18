# Toolcraft App Agent Worklog

## Status

Mode: product

Flux Pass (formerly Event Pass): a WebGL (Three.js r185) 3D event badge on a fabric lanyard for the Spotify "See What You Hear" event. The badge drops in, swings with real physics and can be grabbed and thrown with the mouse or touch; holder details, photo, ferrofluid shape, colours and lanyard print are editable; PNG/JPG export captures the pose on screen.

Active change: pass-010

## Decision Trail

### pass-010 — Artwork uploads removed

- Change ID: pass-010
- Entry type: focused
- Request: "i dont need this" (screenshot of the Artwork section with its two upload boxes).
- Changed owner: `badge-sections.ts` (Artwork section deleted), `app-schema.ts`, `badge-params.ts` (targets `art.front` / `art.back` removed), `badge-art.ts` (full-face override and its cover-draw helper removed; faces always use the template), `badge-media.ts` / `badge-images.ts` (only the person photo is an upload target), `badge-canvas.tsx` (front/back art data attributes), `badge-pipeline.ts`, `app-control-inventory.ts`, `app-acceptance-data.ts` (rows and product description), `app-schema.test.ts`. Also fixed pass-009, which had two "Verification:" lines.
- User-visible result: the panel goes from Ferrofluid placement straight to Lanyard; the only upload left is Upload person.
- Verification: `tsc` clean; `npx vitest run src`: 728 passed, 2 failed (known pass-002 fixed-output checks), 9 skipped; `ai:check`: only the known pass-002 exception; headless panel check shows no Artwork section and no page errors.
- Risks: none new.

### pass-009 — Renamed to Flux Pass

- Change ID: pass-009
- Entry type: focused
- Request: "what name should i give to this project?" → "flux pass".
- Changed owner: `app-identity.ts` (id `flux-pass`, title "Flux Pass"), `app-schema.ts` (panel title), `app-acceptance-data.ts` (productName), `app-defaults.json` (appId `flux-pass` so the user's saved defaults still apply), `badge-export.ts` (PNG/JPG file name `flux-pass`, resource keys), `badge-pipeline.ts` (runtime id), comments, `app-cover.json`, `package.json` / `package-lock.json` name, folder `event-pass` → `flux-pass` and the `.claude/launch.json` entry.
- `index.html`: title and `toolcraft-app-title` meta changed to "Flux Pass" at the user's request ("Yes, break the rule"). Contract exception: the integrity checker (`scripts/check-toolcraft-integrity.mjs`) now reports `modified index.html` and `modified src/app/app-identity.ts` (both hash-protected), in addition to the known pass-002 boundary finding.
- User-visible result: panel title "Flux Pass", exports download as `flux-pass.png`; the browser's per-app workspace (localStorage, keyed by app id) starts fresh from the saved defaults.
- Verification: dev server restarted from `flux-pass/` and verified its identity with the new title; tab reads "Flux Pass"; clean headless load with both badges, grab and layout switch, no page errors; `npx vitest run src`: 728 passed, 2 failed (known pass-002 checks).
- Risks: Risk: the integrity check flags `index.html` and `app-identity.ts` until the app is regenerated from Toolcraft with the new identity.

### pass-008 — Every badge drops in differently

- Change ID: pass-008
- Entry type: focused
- Request: "when we drop the badge, can we have different move on them, atm its the same one for both".
- Changed owner: `badge-physics.ts` (`createBadgeDropVariation`: per-badge random start delay 0-0.28 s, drop duration 0.38-0.68 s, height 0.85-1.25x, spin ±0.3-1.4 rad, in-plane tilt up to ±0.5 rad, sideways lean 0.1-0.45 (biased outward for the two-badge layout) and depth lean; `reset(drop)` draws a fresh variation every drop; optional `random` source for tests), `badge-layout.ts` (type), product test (seeded variations differ, lean outward, five runs all settle on the right sides).
- User-visible result: on load, on Drop badge and on switching layouts, each badge falls with its own timing, spin, tilt and swing, different every time.
- Verification: `tsc` clean; `npx vitest run src` (see below); `ai:check` only the known pass-002 exception; headless capture of a Drop badge replay shows the two badges in different poses mid-drop; no page errors.
- Risks: Risk: an inward swing after the drop can make the two badges brush each other (they now collide, which reads as part of the drop).

### pass-007 — Spotify icon on the lanyard

- Change ID: pass-007
- Entry type: focused
- Request: "instead of this thing, can we have spotify logo there" (screenshot of the diamond mark on the strap).
- Changed owner: `badge-art.ts` (`drawMark` replaced by `drawSpotifyIcon`, which fills the Spotify icon path from `badge-vectors.ts` at half the strap height in the strap ink colour).
- User-visible result: each lanyard repeat starts with the Spotify icon instead of the diamond.
- Verification: `tsc` clean; product tests 20 passed; `ai:check` only the known pass-002 exception; headless render of the strap tile and the live straps.
- Risks: none new.

### pass-006 — Badges collide

- Change ID: pass-006
- Entry type: focused
- Request: "can we have the two cards interact with each other, like clashing or something".
- Changed owner: `badge-physics.ts` (step split into `beginStep` / `solveIteration` / `endStep`; `collide()`: 5x5 sample points of each card are tested against the other card's plate; a point inside the plate's outline within the card-thickness contact distance is pushed back to the side it came from at the start of the step (no tunnelling) and the plate the other way, distributed to both cards' corners with bilinear weights; edge-on hits between nearly coplanar cards push along the card's width/height instead, so cards knock each other sideways; new `BadgeWorld` steps all badges in lockstep and interleaves contacts with each solver iteration), `badge-canvas.tsx` (one `BadgeWorld` per layout; `data-badge-contacts` counter), product tests (face-on knock, edge-on sideways shove, separation and sleep afterwards).
- User-visible result: throwing one badge into the other knocks it away (spins, swings, sideways shove) instead of passing through; both settle back on their resting sides.
- Verification: `tsc` clean; `npx vitest run src`: 727 passed, 2 failed (known pass-002 fixed-output checks), 9 skipped; `ai:check`: only the known pass-002 exception. Headless Chromium (`clash-check.mjs`): the back badge flung into the front badge registered contacts (24-54 contact steps), frames show the front badge knocked and the cards pressed together without interpenetrating, both returned to rest; no page errors.
- Risks: Risk: straps and clips do not collide (only the cards). Risk: very fast throws that skip a whole card in one 1/120 s step are caught by the start-of-step side test only while the point is still inside the other card's outline.

### pass-005 — Front and back from the updated Figma designs

- Change ID: pass-005
- Entry type: focused
- Request: "the designs are in figma now" (screenshot of Card / Front and Card / Back).
- Source checked: Figma 215:1342 (Card / Front, updated) and 226:831 (Card / Back), layer geometry read through the Plugin API.
- Changed owner: `badge-art.ts` (`BADGE_LAYOUT`: front person 1156x1435 centred at (640, 782.5), name 163.81 px from y 1156 with the same stagger/step ratios, role centred at y 1590; back FLUX box at (96, 220), ferrofluid 1240x1271 centred at (640, 1007.6) drawn over FLUX, presented-by badge at 1.7046x anchored bottom-right on the 96 px margins; FLUX, ferrofluid and presented-by removed from the front), `badge-sections.ts` (descriptions: ferrofluid and presented-by now live on the back), product test (new name positions), cover.
- User-visible result: front shows the large person, staggered name and centred role; back shows FLUX, the chosen ferrofluid and the Spotify badge, matching the Figma frames; all controls still apply (ferrofluid placement and presented-by now affect the back).
- Verification: `tsc` clean; `npx vitest run src`: 725 passed, 2 failed (known pass-002 fixed-output checks), 9 skipped; `ai:check`: only the known pass-002 exception; headless render of both faces compared with the Figma screenshot; no page errors.
- Risks: Risk: on the front the person image reaches near the top of the card where the clip slot is cut.

### pass-004 — Two badges: front and back side by side

- Change ID: pass-004
- Entry type: focused
- Request: "can we add a second ID badge there ... so maybe we can have the back and the front visible in two separate ways".
- Changed owner: `badge-physics.ts` (options `anchorX` and `restYaw`; the strap twist spring returns to the resting side, so a back badge settles showing its back), new `badge-layout.ts` (One: one badge at centre; Two: anchors at ±0.62, right badge rests at yaw π), `badge-params.ts` / `badge-sections.ts` (Camera › Badges: One / Two, default Two), `badge-camera.ts` (keeps the pair's width visible), `badge-scene.js` (per-badge `BadgeRig` with shared materials/textures; hit test returns the badge index; the strap aligns with whichever card edge is closer so a back-facing card does not twist the strap 180°), `badge-canvas.tsx` (one simulation per badge, grab by index, drop resets all, layout change rebuilds with a drop-in), `badge-live.ts` / `badge-export.ts` (PNG captures every badge on screen; rest poses per badge without a live preview), inventory, acceptance row, product test, cover.
- Also fixed: three code-health findings that the pass-003 entry missed because only the last lines of `ai:check` were read (`badge-presets.ts` cache maps holding decoded images, and the viewport-lock getter in `badge-canvas.tsx` typed as `unknown`). The caches are now plain records and the getter is typed `HTMLCanvasElement | null`.
- User-visible result: by default two badges hang side by side, the left showing the front, the right the back; both can be grabbed and thrown independently; Camera › Badges › One returns to a single badge.
- Verification: `tsc` clean; `npx vitest run src`: 725 passed, 2 failed (known pass-002 fixed-output checks), 9 skipped; `ai:check`: only the known pass-002 exception in `badge-viewport-dom.js`. Headless Chromium (`pair-check.mjs`, `lock-check.mjs`): 2 badges settle (front + back), the right badge was grabbed and dragged, switching to One leaves 1 badge, viewport lock unchanged, no page errors.
- Risks: Risk: the two badges do not collide; a thrown badge can pass through the other.

### pass-003 — FLUX card template from Figma with themes, people and ferrofluid pickers

- Change ID: pass-003
- Entry type: focused
- Request: "I want to build something like this" (Figma node 215:1342, "Card / Front — 1280×1800") "Where we can edit a lot of stuff": theme modes 1-3 from the Figma variables selectable in the app; pre-selected people assets plus one image upload; ferrofluid shapes to switch with size controls; role as a dropdown (Media, Artist…) or custom text; the person's name on one or two lines, centred, customisable. Back of the card: undecided.
- Source/reference checked: Figma file "Project 2 - bootcamp explore": card node 215:1342 (layer geometry, fonts, fills and variable bindings read through the Plugin API), Theme collection (Mode 1 Crayola Blue / Lime Yellow, Mode 2 Brilliant Rose / Icy Aqua, Mode 3 Crimson Carrot / Periwinkle; ink FLUX V2 Ink Black), assets section 185:909 (people/01-08, ferrofluid/01-16). Assets: the transparent original image fills (not the white-flattened renders) downscaled to a 1229 px long edge in `public/badge/{people,ferrofluid}` with 200 px picker thumbnails; FLUX wordmark and Spotify logo as vector paths in `badge-vectors.ts`. Font: Neue Haas Grotesk Display Pro 75 Bold, used by family name from the local install (not bundled), with Helvetica Neue / Arial fallbacks.
- Changed owner: `badge-theme.ts` (modes), `badge-presets.ts` (asset lists, URLs, loader), `badge-vectors.ts`, `badge-params.ts` (new targets: card.theme, card.presentedBy, holder.role/roleCustom/firstName/lastName, name.layout/size/y, person.preset/scale/x/y, ferro.shape/scale/rotation/x/y, strap.style; removed ID, event footer and card/ink/accent colours), `badge-art.ts` (front rebuilt from the Figma layout: theme background, FLUX box, ferrofluid, person, staggered or one-line centred name boxes, role box, presented-by Spotify badge; back = theme, chosen ferrofluid, presented-by, FLUX), `badge-sections.ts` (Card, Role, Name, Person, Person placement, Upload person, Ferrofluid, Ferrofluid placement, Artwork, Lanyard with Theme/Custom colours, Physics, Camera, Background), `badge-media.ts` / `badge-images.ts` / `badge-export.ts` (preset loading in preview and export), `badge-scene.js` (printed faces render their texture as un-tone-mapped emissive with a light clearcoat and no environment haze so theme colours stay exact), inventory, acceptance rows, product tests, cover.
- User-visible result: default card matches the Figma front (Carrot theme, Media, John Smith, person 07, ferrofluid 01); theme, role/custom role, name layout/size/position, person and ferrofluid pickers with placement sliders, person upload and strap theme colours all update the 3D badge live. Export PNG colour check at 4K: orange (255,73,15) vs #FF4401, ink (8,26,34) vs #01161E.
- Verification: `tsc` clean; `npx vitest run src`: 724 passed, 2 failed (the known pass-002 fixed-output contract checks), 9 skipped; `ai:check`: reported as only the known pass-002 exception, but that read missed three findings (corrected in pass-004). Headless Chromium (`.toolcraft/scratch/front-check.mjs`, `controls-check.mjs`, `cover.mjs`): front/back textures rendered and compared with the Figma screenshot; Blue theme, Custom role "Headliner", one-line name, person 02 and ferrofluid 05 driven through the real panel; no page errors; local font detected.
- Risks: Risk: the display font is read from the local install; on a machine without Neue Haas Grotesk Display Pro the fallback (Helvetica Neue / Arial) changes the type. Risk: the back design is a placeholder until the user decides. Risk: `public/badge` adds about 17 MB of PNGs.

### pass-002 — One locked view (deliberate contract exception)

- Change ID: pass-002
- Entry type: focused
- Request: "can we turn off infinity canvas, it does not make sense for this app", then, after being told the contract forbids it: "fix it, break rules, this should be the only view of the app like this, locked viewport".
- Changed owner: `app-schema.ts` (canvas `sizing: fixed-output`, `size` 1920x1080, `draggable: false`; toolbar `radar: false`, `zoom: false`), new `badge/badge-viewport.ts` (`useBadgeViewportLock`: cover zoom = artboard covers the window, offset 0; snaps back via `canvas.setViewport` whenever zoom/offset differ), new `badge/badge-viewport-dom.js/.d.ts` (window capture listeners that stop wheel/pinch aimed at the badge canvas before the runtime canvas navigation, plus window resize), `badge-canvas.tsx` (uses the lock), `badge-pipeline.ts` (canvas size/Infinity targets removed), `app-acceptance-data.ts` (Infinity and viewport pan/zoom rows and ownership removed; `stage.locked-view` row with `canvasSizingCoverage: "fixed-output-size"`), `app-schema.test.ts`, product test (cover zoom).
- User-visible result: Settings shows only Background, Background color and Workspace (no Infinity canvas, Aspect ratio, Canvas width/height); toolbar shows undo, redo and theme only; the artboard always covers the window, centred, and scroll, Ctrl+wheel, pinch and Space-drag do nothing to the view.
- Contract exceptions (user-approved): (1) `fixed-output` sizing in an app with export: the framework meta-test `app-acceptance.base-coverage.test.ts` reports 2 failures ("Product/output apps with export actions must use canvas.sizing mode \"editable-output\""); (2) `npm run ai:check` reports one product-boundary violation in `badge-viewport-dom.js` (window listeners are "imperative host mutation"); the runtime exposes no option to disable wheel/pinch navigation. Framework files untouched.
- Verification: `tsc` clean; `npx vitest run src`: 718 passed, 2 failed (the expected fixed-output contract checks above), 9 skipped. Headless Chromium (`.toolcraft/scratch/lock-check.mjs`) at 1630x1019: canvas rect stayed `-91,0,1812,1019` (zoom 94.35%) after wheel, Ctrl+wheel and Space-drag; no Infinity/Aspect ratio/zoom UI; no page errors.
- Risks: Risk: `verify:delivery` cannot pass while these exceptions stand. Risk: if the panel covers part of a narrow window the badge sits behind its edge; the framework shows its desktop-only notice below 1024px anyway.

### pass-001 — First product delivery

- Change ID: pass-001
- Request: "yeah bro basically something 3d, and that we can play with the mouse, physics like dragging etc for something like this" (with an ID-card-on-lanyard mockup image), followed by "https://www.framer.com/marketplace/components/badge-3d-interactive/ like this bro". "i will provide the base design later, then we can switch name, image etc etc, lets build the app first".
- Task type: first product delivery (new multi-capability product, custom renderer, CPU physics).
- User-visible result: a canvas with a 3D badge (rounded card with thickness, slot, glossy finish, steel split ring, painted swivel clip, printed fabric strap) that drops in on load, swings, and follows the pointer when grabbed, keeping momentum when released. Sections Pass holder, Artwork, Card colours, Lanyard, Physics, Camera, Background; Export PNG/JPG.
- Source/reference checked: the user's static ID-card mockup (composition and template layout only) and the public description of the Framer "Badge 3D Interactive" component (behaviour list only: drop-in, swing, drag and throw with inertia, folding/twisting strap, editable texts/colours/art, camera Y and zoom). No code or art from either was reused.
- Reference inputs: None (no video, GIF or frame-sequence motion reference was supplied).
- Docs/contracts read: AGENTS.md, workflow.md, core/timeline-animation.md, core/control-selection.md (view interaction), schema-reference.md (text controls, view interaction), component-rules.md (text controls); the user's existing ferrofluid-lab Toolcraft app (same runtime) was used as the structural template for the Three.js renderer, pipeline, export, workload and acceptance data.
- Contract rules applied: runtime-shell-required, canvas-no-app-ui, canvas-surface-preserved, interaction-surface-ownership, controls-section-inventory-required, output-export-required, renderer-technique-inventory, renderer-gpu-provider (Three.js WebGL provider), renderer-view-interaction (fixed-camera with explicit user-request authority), timeline-mode-choice (autonomous, no timeline), acceptance-product-observable, persistence-policy-explicit.
- View interaction intent: fixed-camera. Authority: explicit user request quoting "physics like dragging"; a primary drag on the card grabs it physically, so camera orbit would compete for the same gesture. Camera framing is edited with Zoom and Camera Y.
- Interaction ownership: the panel owns every card, lanyard, physics and camera property (`badge-properties`, global scope); the canvas owns viewport pan and zoom. Grabbing/throwing the badge is canvas-only physics that writes no schema value (the pose is transient simulation state), so it has no ownership entry (the validator requires a schema target) and is covered by the `stage.drag` runtime acceptance row on `physics.frame`. No operation is mirrored.
- Animation intent: autonomous. The only motion is real-time physics reacting to the drop-in and the pointer; there is no transport, loop or video export.
- Decision: Verlet/position-based physics in plain TypeScript (`badge-physics.ts`): a 14-segment strap of light particles from a fixed anchor above the frame, a rigid card of five heavy particles (clip point + four corners) held by all-pair distance constraints, a minimum-distance bend constraint so the strap folds without kinking, a soft surface point constraint for the grab (pivots the card around the grabbed spot, release keeps velocity), a kinematic anchor that eases down for the drop-in, and sleep once at rest. Three.js scene (`badge-scene.js`): extruded rounded card with a slot hole, separate front/back faces with canvas-drawn artwork, clearcoat material, RoomEnvironment PMREM lighting with Neutral tone mapping, steel split ring + painted capsule clip, and a ribbon strap rebuilt per frame from a centripetal Catmull-Rom curve with parallel-transported width and the twist distributed toward the card's orientation; the strap print reads correctly from both sides. Artwork (`badge-art.ts`) is drawn into offscreen canvases and shared by preview and export.
- Alternatives rejected: a physics library (Rapier/cannon; heavier dependency for a rope and one rigid card); orbit camera (conflicts with grabbing the card under a primary drag); timeline playback (no authored animation or video was requested).
- State/output mapping: `badge.*` text/colour values and `badge.photo`/`badge.frontArt`/`badge.backArt` uploads → `readBadgeParams` + decoded images → `getBadgeArt` textures; `strap.*` → strap texture, clip colour and strap rest length; `physics.gravity`/`physics.drag` → simulation settings; `physics.drop` action → `requestBadgeDrop` → simulation reset with drop-in; `view.zoom`/`view.cameraY` → `getBadgeCamera`; pointer on the canvas → `BadgeScene.hitCard` / `pointerOnPlane` → physics grab; export → `badgeExportRenderer` (live pose, or rest pose without a live preview) into an offscreen retained `BadgeScene`.
- Implementation notes: Three.js is imported through `three-untyped.js/.d.ts` and the scene is authored as JS with a typed `.d.ts`, as in ferrofluid-lab, because the boundary type walker overflows on Three's Object3D graph. `csstype` is pinned to 3.2.3 through npm `overrides`: the fresh install resolved 3.2.4, whose `pathLength: "none"` type breaks typechecking of the signed timeline components.
- Verification: see Verification below.
- Risks: see Risks below.

## Decisions

### Renderer

- Decision: Custom Three.js WebGL renderer (preview canvas + retained offscreen export renderer), pipeline `event-pass-three-v1` with passes preview-scene, preview-render, export-scene, export-render; physics on the CPU.
- Reason: a lit 3D card with thickness, metal clip and a twisting fabric strap needs a GPU mesh renderer; every pass is a stateless render pass.
- Evidence: `src/app/badge/badge-scene.js`, `badge-pipeline.ts`, `app-performance.ts` rendererTechnique (gpu provider `three`).

### View Interaction

- Decision: fixed-camera.
- Reason: the user asked to play with the badge by dragging it with physics; the primary drag belongs to the badge.
- Evidence: `appProductReadiness.viewInteraction` with `explicit-user-request` authority.
- Mode: fixed-camera. Source: user request. Alternatives: orbit rejected (same gesture as grabbing). Targets: none.

### Interaction Ownership

- Decision: canvas owns grab/throw, pan and zoom; panel owns properties.
- Reason: physics interaction only makes sense under the pointer; text, images and colours need precise entry.
- Evidence: `appProductReadiness.interactionOwnership`.

### Timeline

- Decision: no timeline; autonomous physics.
- Reason: no authored animation, loop or video export was requested.
- Evidence: `appTransferMode.animationIntent` mode `autonomous`.

### Layers

- Decision: no Layers.
- Reason: no layer workflow was requested.
- Evidence: no `layersModule()`.

### Controls

- Decision: sections Pass holder (first name, last name, role, ID, event, photo), Artwork (front/back uploads), Card colours, Lanyard (text, strap/ink/clip colours, length), Physics (gravity, air drag, Drop badge), Camera (zoom, camera Y), Background source pair.
- Reason: grouped by edited entity and reset scope.
- Evidence: `src/app/badge/badge-sections.ts`, `src/app/app-control-inventory.ts`.

### Export

- Decision: image only (toolcraft-default); SVG and video not requested.
- Reason: the user asked for an interactive badge; PNG captures the current pose.
- Evidence: `appProductReadiness.exportIntent`, `imageExportModule()`.

### Performance

- Decision: workload dimensions preview-pixels (runtime state), export-long-edge and export-pixels; every control is `responsiveness`. The simulation and render loop run only while the badge moves and sleep at rest; they pause during viewport pan/zoom and in hidden tabs (rAF).
- Reason: keep a laptop idle when nothing moves.
- Evidence: `src/app/badge/badge-workload.ts`, `app-performance.ts`. No measured performance was run (first delivery is functional only).

Canonical control values and selected-entity isolation must follow runtime representations and the declared selection owner. Render-scale-enabled products record functional `renderScaleCoverage`; prose never substitutes for asserted backing-quality proof.

## Evidence

- Source reviewed: the user's mockup image, the Framer component's public description, local Toolcraft docs, the ferrofluid-lab app as structural template.
- Contract applied: product decisions above; framework files untouched.

## Verification

Verification tier: Tier 4
Reason: first product delivery with a custom renderer, CPU physics, media upload and export.
Run: `tsc`, focused Vitest product/contract tests, a browser check of the rendered badge; then bare `npm run verify:delivery` once if the environment allows.
Skip: `npm run verify:perf` and measured performance (not authorised).

Results:
- `tsc -p tsconfig.json --noEmit`: clean (after the csstype pin).
- `npx vitest run src`: 104 files passed, 719 tests passed / 9 skipped (framework contract validators + 10 product tests: rest pose, drop-in to sleep, grab follow and throw momentum, untwist back to face the camera, strap length, param clamping, camera framing, export supersample, upload size).
- `npm run ai:check`: code health passed (28 files) after replacing `useCallback`-wrapped DOM handlers with plain functions and removing `onPointerLeave` (the canvas-handle exception allows only pointer down/move/up/cancel and lost capture).
- `npm run files:check`: passed.
- Headless Chromium diagnostics (`.toolcraft/scratch/drag-check.mjs`, `edit-check.mjs`, `cover.mjs`; captures in `.toolcraft/browser-artifacts/`): drop-in settles; hovering the card sets the grab cursor; dragging moves the card under the pointer; a fast release throws it, it swings and untwists to face the camera; First/Last name and Role edits and a photo upload update the card live; Export PNG downloads `event-pass.png` at 4096x2304 with transparent background; no page or console errors. The in-app Browser pane was hidden, so animation could not be watched there.
- Fix found during verification: without strap torsion a thrown card kept spinning and settled edge-on; a twist spring with damping (`applyTwistSpring`) now turns it back to face the camera.
- Cover: `public/toolcraft/cover.png` (1920x1080) from Export PNG at 4K of the default badge at rest with Background on; `app-cover.json`, `app-cover-state.json`.
- `npm run verify:delivery`: not run. The product Playwright acceptance spec (`e2e/product-badge.spec.ts`) referenced by the acceptance rows is not written yet, so the protected runner cannot mint the initial receipt.
- Measured performance: not run (not authorised).

## Risks

- Risk: `e2e/product-badge.spec.ts` (browser acceptance for every row) is still to be written; no protected delivery receipt exists.

- Risk: The strap is a flat ribbon without thickness; very tight folds can show it edge-on.
- Risk: PNG export uses the live pose; without a mounted preview it falls back to the rest pose.
- Risk: The preview canvas carries `data-toolcraft-canvas-handle` so pointer handlers on the product canvas pass the boundary, as in ferrofluid-lab.
