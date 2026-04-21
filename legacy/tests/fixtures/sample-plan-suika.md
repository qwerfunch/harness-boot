# Suika Game Web — Browser-Based Watermelon Merge Puzzle

## Overview

Suika Game Web is a browser-based physics puzzle game where players drop fruits into a container. When two identical fruits collide, they merge into the next-tier fruit. The goal is to create a Watermelon (the largest fruit) and achieve the highest score. The game features realistic 2D physics (gravity, collision, bouncing), 11-tier fruit progression, combo scoring, and a clean mobile-first responsive design faithful to the original Suika Game aesthetic.

Tech stack: TypeScript, HTML5 Canvas, Matter.js (2D physics engine), Vite (bundler).

## Target Users

- Casual gamers looking for a quick, addictive puzzle experience on mobile or desktop browsers
- Fans of the original Suika Game (Nintendo eShop) who want a free web version
- Players who enjoy physics-based merge/combine puzzle mechanics

## Modules

### Physics Module
Wraps Matter.js to provide deterministic 2D physics simulation for the game world.

- World setup: gravity (1.0 downward), fixed container walls (left, right, bottom), and invisible ceiling boundary
- Rigid body creation for each fruit tier with correct radius, density, restitution (bounciness), and friction
- Collision detection: identify when two bodies of the same fruit tier collide
- Body removal and replacement on merge events
- Frame-rate-independent physics stepping (60Hz fixed timestep with interpolation)
- Sleep mode for settled fruits to reduce CPU usage

### Game Module
Core game logic: fruit lifecycle, merge rules, scoring, and game state machine.

- Fruit tier system: 11 tiers from Cherry (tier 1) to Watermelon (tier 11)
- Drop mechanics: player positions a fruit horizontally, then drops it into the container
- Merge system: when two same-tier fruits collide, remove both and spawn next-tier fruit at midpoint
- Next fruit preview: show the next fruit to drop (random from tier 1-5 only)
- Score calculation: base points per merge (tier^2 * 10), combo multiplier for chain merges within 1 second
- Game over detection: any fruit remains above the danger line for 2 continuous seconds after settling
- Game state machine: Title -> Playing -> GameOver, with restart capability

### Renderer Module
Canvas-based rendering pipeline that draws the game world with visual fidelity matching the original Suika Game.

- Double-buffered HTML5 Canvas rendering at device pixel ratio
- Fruit rendering: each tier has distinct color gradient, highlight, shadow, stem/leaf detail, and face expression
- Container rendering: wooden box aesthetic with inner shadow and rounded corners
- Danger line: dashed red line at the top of the play area with pulsing animation when fruits approach
- Merge effects: radial burst particle effect + brief white flash at merge point
- Score popup: floating "+N" text that fades upward at merge location
- UI overlay: current score, best score, next fruit preview panel
- Smooth interpolation between physics steps for fluid 60fps rendering

### Input Module
Handles player input across desktop and mobile with consistent behavior.

- Mouse: move to position fruit horizontally, click to drop
- Touch: touch-move to position, release to drop
- Pointer lock to game container (prevent scroll on mobile while playing)
- Drop cooldown: 500ms minimum between drops to prevent spam
- Input disabled during game over state
- Guide line: vertical dashed line from current fruit to container floor showing drop trajectory

### Audio Module
Sound effects and background music for game feel polish.

- BGM: looping background music (low-volume, cheerful tone)
- SFX: fruit drop (soft thud), fruit merge per tier (progressively satisfying tones), game over jingle
- Volume control: master volume slider, separate BGM/SFX toggles
- Audio context initialization on first user interaction (browser autoplay policy compliance)
- Mute state persisted in localStorage

### UI Module
Game chrome, menus, and responsive layout.

- Title screen: game logo, "Tap to Start" prompt, best score display
- HUD: current score (top-center), next fruit preview (top-right), best score label
- Game over overlay: semi-transparent backdrop, final score, best score (with "NEW!" badge if beaten), "Retry" button
- Responsive layout: 9:16 aspect ratio game container, centered on viewport, scaled to fit mobile screens
- Fruit guide panel: shows all 11 tiers with names (toggle visibility)

## Fruit Tier Specification

| Tier | Name | Radius (px) | Base Color | Gradient | Points | Density | Restitution |
|------|------|-------------|------------|----------|--------|---------|-------------|
| 1 | Cherry | 17 | #FF0044 | radial #FF3366 -> #CC0033 | 10 | 1.0 | 0.3 |
| 2 | Strawberry | 25 | #FF3366 | radial #FF6688 -> #DD2244 | 40 | 1.0 | 0.3 |
| 3 | Grape | 33 | #9B30FF | radial #B366FF -> #7B00DD | 90 | 1.2 | 0.2 |
| 4 | Dekopon | 40 | #FF8C00 | radial #FFAA33 -> #DD7700 | 160 | 1.3 | 0.2 |
| 5 | Persimmon | 48 | #FF6347 | radial #FF8866 -> #DD4422 | 250 | 1.4 | 0.2 |
| 6 | Apple | 56 | #FF0000 | radial #FF3333 -> #CC0000 | 360 | 1.5 | 0.15 |
| 7 | Pear | 66 | #AADD00 | radial #CCEE44 -> #88BB00 | 490 | 1.6 | 0.15 |
| 8 | Peach | 76 | #FFB6C1 | radial #FFCCD5 -> #FF99AA | 640 | 1.7 | 0.1 |
| 9 | Pineapple | 88 | #FFD700 | radial #FFEE55 -> #DDBB00 | 810 | 1.8 | 0.1 |
| 10 | Melon | 100 | #90EE90 | radial #AAFFAA -> #66CC66 | 1000 | 2.0 | 0.05 |
| 11 | Watermelon | 115 | #2E8B57 | radial #44AA77 -> #1A6B3F | 1210 | 2.2 | 0.05 |

### Fruit Visual Details

Each fruit is rendered as a circle with:
1. **Base**: radial gradient fill (lighter center, darker edge)
2. **Highlight**: white elliptical overlay at top-left (30% opacity) for 3D sheen
3. **Shadow**: darker arc at bottom (20% opacity)
4. **Face**: simple kawaii face (two dot eyes, small mouth) — eyes positioned at 40% from center, mouth at 60%
5. **Stem/Leaf** (Cherry, Apple, Pear only): small brown stem line + green leaf arc at top
6. **Stripe pattern** (Watermelon only): 4 dark green curved stripes over the base gradient
7. **Crown** (Pineapple only): small zigzag crown shape at top in dark green

## Features

### FEAT-001: Physics World Setup
**Category**: physics
**Description**: Initialize Matter.js engine with correct world parameters. Create static container walls (left, right, bottom) as compound body with configurable dimensions. Container interior is 380px wide and 600px tall. Walls are 15px thick. Gravity set to { x: 0, y: 1.0 }. Enable sleeping for performance. Run physics at 60Hz fixed timestep decoupled from render frame rate.
**Acceptance Criteria**:
- Matter.js engine initializes without errors
- Container walls are static (immovable) and visible
- Gravity pulls dynamic bodies downward at consistent rate
- Physics runs at 60Hz regardless of display refresh rate
- Sleeping bodies do not consume simulation cycles
**Core Functions**: `createWorld`, `createContainer`, `stepPhysics`, `configureSleeping`

### FEAT-002: Fruit Drop Mechanics
**Category**: game
**Description**: Player positions a pending fruit horizontally above the container using mouse/touch input. A vertical guide line shows the drop trajectory. On click/release, the fruit is released into the container as a dynamic physics body. After dropping, a 500ms cooldown prevents rapid drops. The next fruit (random from tier 1-5) replaces the pending slot. Pending fruit is constrained to horizontal movement within container bounds minus fruit radius.
**Acceptance Criteria**:
- Pending fruit follows pointer/touch X position within container bounds
- Guide line extends from pending fruit to container floor
- Click/release creates a dynamic body at the pending fruit's position
- 500ms cooldown enforced between consecutive drops
- New pending fruit appears after cooldown, randomly selected from tier 1-5
- Pending fruit cannot be moved or dropped during cooldown
**Core Functions**: `createPendingFruit`, `movePendingFruit`, `dropFruit`, `enforceCooldown`, `selectNextFruit`

### FEAT-003: Fruit Merge System
**Category**: game
**Description**: When two fruits of the same tier collide, both are removed from the physics world and a new fruit of the next tier is spawned at the midpoint of their positions. Merging tier 11 (Watermelon) with another Watermelon removes both without spawning a new fruit (maximum tier reached — bonus 5000 points). Merge must handle chain reactions: if the newly spawned fruit immediately collides with another same-tier fruit, merge again (combo). All merges within a 1-second window count as a combo chain for scoring.
**Acceptance Criteria**:
- Two same-tier fruits colliding triggers merge
- Merged fruit spawns at midpoint of the two removed fruits
- Tier 11 + Tier 11 removes both, awards 5000 bonus points, no new fruit spawned
- Chain merges (combo) detected within 1-second window
- Merge does not occur between fruits of different tiers
- Multiple simultaneous merges in one frame are handled correctly (no duplicate removal)
**Core Functions**: `detectMerge`, `executeMerge`, `spawnMergedFruit`, `trackComboChain`, `handleSimultaneousMerges`
**Business Rules**:
- Watermelon is the maximum tier; merging two Watermelons is the ultimate achievement
- Combo chain window is exactly 1000ms from the first merge in the chain

### FEAT-004: Score System
**Category**: game
**Description**: Score increases on every merge. Base points = tier^2 * 10 (see Fruit Tier Specification). Combo multiplier: 2nd merge in chain = x1.5, 3rd = x2.0, 4th+ = x2.5. Best score persisted in localStorage. Score display updates immediately on merge with floating "+N" popup at merge location.
**Acceptance Criteria**:
- Single merge awards correct base points for the resulting tier
- Combo multiplier applies correctly (1.5x, 2.0x, 2.5x)
- Total score never decreases
- Best score saved to localStorage on game over
- Best score loaded from localStorage on game start
- Score popup shows exact points earned at merge position
**Core Functions**: `calculateMergeScore`, `applyComboMultiplier`, `updateScore`, `saveBestScore`, `loadBestScore`

### FEAT-005: Game Over Detection
**Category**: game
**Description**: A danger line is drawn at Y=80px from the container top. If any fruit body's top edge remains above this line for 2 continuous seconds while it is sleeping (settled, not still falling), the game transitions to GameOver state. The 2-second grace period prevents false game-overs from fruits bouncing above the line momentarily. During the grace period, the danger line pulses red as a warning.
**Acceptance Criteria**:
- Danger line visible at correct Y position
- Fruits bouncing briefly above the line do not trigger game over
- Fruit settled above line for 2+ seconds triggers game over
- Danger line pulses during the 2-second warning period
- Game over freezes physics and disables input
- Dropping fruit that immediately settles above line still has 2-second grace
**Core Functions**: `checkDangerZone`, `startGraceTimer`, `triggerGameOver`, `renderDangerLine`
**Business Rules**:
- Only sleeping (settled) bodies count toward the 2-second timer
- Timer resets if the fruit moves back below the danger line

### FEAT-006: Canvas Rendering Pipeline
**Category**: renderer
**Description**: Implement double-buffered Canvas rendering at native device pixel ratio. Render loop runs via requestAnimationFrame, interpolating physics body positions between fixed timesteps for smooth 60fps visuals. Rendering order: container background -> container walls -> fruits (sorted by Y for overlap) -> danger line -> effects -> UI overlay. Canvas size is responsive: 9:16 aspect ratio, max 420px wide on desktop, full-width on mobile.
**Acceptance Criteria**:
- Canvas renders at device pixel ratio (sharp on Retina displays)
- Rendering is smooth at 60fps with 20+ fruits on screen
- Physics interpolation eliminates visual jitter between timesteps
- Container has wooden box visual with inner shadow
- Render order prevents visual glitches (no z-fighting)
- Canvas resizes correctly on window resize / orientation change
**Core Functions**: `initCanvas`, `renderFrame`, `interpolatePositions`, `renderContainer`, `resizeCanvas`, `sortRenderOrder`

### FEAT-007: Fruit Rendering
**Category**: renderer
**Description**: Each fruit tier is rendered with distinct visual identity per the Fruit Visual Details specification. Fruits have radial gradient base, highlight overlay, shadow arc, and kawaii face. Special elements: Cherry/Apple/Pear have stem+leaf, Pineapple has crown, Watermelon has stripe pattern. Fruits rotate visually to match their physics body angle. Render quality scales with canvas pixel ratio.
**Acceptance Criteria**:
- All 11 tiers visually distinct and recognizable at game scale
- Gradients, highlights, and shadows render correctly
- Faces are centered and proportional to fruit size
- Stem/leaf renders at correct angle relative to fruit rotation
- Watermelon stripes curve correctly with rotation
- Fruits at small sizes (Cherry, Strawberry) are still identifiable
**Core Functions**: `renderFruit`, `drawFruitBase`, `drawFruitFace`, `drawFruitDetail`, `createFruitTexture`

### FEAT-008: Merge Visual Effects
**Category**: renderer
**Description**: When fruits merge, render visual feedback: (1) radial burst of 12-16 small colored particles emanating from merge point, particles use the merged fruit's color, fade out over 400ms, (2) brief white circle flash expanding from merge point over 200ms, (3) floating score text ("+N") drifting upward from merge point, fading out over 800ms. Effects must not impact rendering performance (max 100 active particles at any time, particle pool reuse).
**Acceptance Criteria**:
- Particle burst visible at merge location with correct fruit color
- White flash circle renders and fades within 200ms
- Score popup text is readable and fades correctly
- Multiple simultaneous merges each produce independent effects
- Particle pool limits active particles to 100 (oldest removed first)
- Effects do not cause frame drops below 55fps
**Core Functions**: `emitMergeParticles`, `renderFlashEffect`, `renderScorePopup`, `updateParticles`, `recycleParticles`

### FEAT-009: Input Handling
**Category**: input
**Description**: Unified input system supporting mouse (desktop) and touch (mobile). Mouse: mousemove positions pending fruit, mousedown/click drops it. Touch: touchmove positions pending fruit, touchend drops it. Pointer events are captured within the game canvas only. On mobile, prevent default scroll/zoom behavior when interacting with the canvas. All input disabled during game over or drop cooldown.
**Acceptance Criteria**:
- Mouse movement smoothly positions pending fruit on desktop
- Touch movement smoothly positions pending fruit on mobile
- Click/tap drops the fruit at current horizontal position
- Page does not scroll or zoom while touching the game canvas on mobile
- Input ignored during 500ms drop cooldown
- Input ignored in GameOver state
- No duplicate events from touch + mouse on hybrid devices
**Core Functions**: `initInputHandlers`, `handlePointerMove`, `handlePointerDrop`, `preventDefaultOnCanvas`, `isInputEnabled`

### FEAT-010: Game State Machine
**Category**: game
**Description**: Game states: Title, Playing, GameOver. Title: show logo, best score, "Tap to Start". Tap transitions to Playing. Playing: active gameplay loop (physics + input + render). GameOver: freeze physics, show overlay with final score, best score comparison, "Retry" button. Retry resets all game state (clear all fruits, reset score, new pending fruit) and transitions to Playing. State transitions are clean — no residual timers, particles, or physics bodies leak between states.
**Acceptance Criteria**:
- Title screen displays on first load
- Tapping title screen starts the game (transitions to Playing)
- GameOver state freezes all gameplay
- GameOver overlay shows final score and best score
- "NEW!" badge shown if final score > best score
- Retry clears all fruits, resets score to 0, transitions to Playing
- No memory leaks on repeated restart cycles
**Core Functions**: `initStateMachine`, `transitionTo`, `resetGameState`, `renderTitleScreen`, `renderGameOverOverlay`

### FEAT-011: Audio System
**Category**: audio
**Description**: Web Audio API-based sound system. BGM: single looping track, starts on first user interaction (browser autoplay policy). SFX: drop sound (soft thud), merge sounds (11 different tones, progressively higher pitch for higher tiers), game over jingle. Volume control with master slider. Separate mute toggles for BGM and SFX. Mute preferences saved in localStorage. Audio assets loaded asynchronously — game starts immediately, sounds play when ready.
**Acceptance Criteria**:
- BGM starts after first user interaction, loops seamlessly
- Drop sound plays on each fruit drop
- Merge sound pitch corresponds to resulting fruit tier
- Game over jingle plays once on GameOver transition
- Volume slider adjusts all audio proportionally
- BGM and SFX can be independently muted
- Mute state persists across page reloads via localStorage
- Game is fully playable before audio assets finish loading
**Core Functions**: `initAudioContext`, `loadAudioAssets`, `playBGM`, `playSFX`, `setVolume`, `toggleMute`, `persistAudioPreferences`

### FEAT-012: Responsive UI Layout
**Category**: ui
**Description**: Game container maintains 9:16 aspect ratio, centered in viewport. Desktop: max 420px wide with decorative side margins. Mobile: full viewport width, height constrained to viewport height. HUD elements positioned relative to container: score top-center, next fruit preview top-right (outside container on desktop, overlaid on mobile). Fruit guide panel (showing all 11 tiers) accessible via button, slides in from right edge. All text uses system font stack for fast rendering.
**Acceptance Criteria**:
- Game container maintains 9:16 aspect ratio at all viewport sizes
- Desktop: centered with max 420px width
- Mobile portrait: full width, no horizontal overflow, no scrollbar
- Mobile landscape: game area centered with black bars on sides
- HUD elements scale proportionally with container
- Fruit guide panel shows all 11 tiers with names and visual
- Font renders crisply at all sizes (no sub-pixel blur)
**Core Functions**: `calculateLayout`, `applyResponsiveLayout`, `renderHUD`, `renderNextFruitPreview`, `toggleFruitGuide`

### FEAT-013: Application Entry-Point Wiring
**Category**: integration
**Description**: Wire every module (Physics, Game, Renderer, Input, Audio, UI) into a single runnable application. The entry point (`src/main.ts`) constructs module instances in the correct dependency order, injects cross-module references, registers the render loop via `requestAnimationFrame`, and surfaces runtime errors. Booting `npm run dev` must produce a playable Title screen within 2 seconds on a cold load with the Vite HMR banner visible in stdout.
**Acceptance Criteria**:
- `src/main.ts` exports a `bootstrap()` function that returns a handle for teardown (used by HMR)
- Module construction order respects dependency graph: Physics -> Game -> Renderer -> Input -> Audio -> UI
- Module wiring failures throw a descriptive `BootstrapError` naming the failing module (not a generic stack trace)
- `index.html` mounts to `#app` and imports `src/main.ts` as an ES module
- `npm run build` produces a bundle under 150KB gzipped (per NFRs) with zero unresolved imports
- `npm run dev` starts the Vite dev server and logs `Local: http://localhost:5173` to stdout within 3 seconds
- Opening the dev server in a browser displays the Title screen and responds to "Tap to Start"
- Hot-module reload preserves game state when a non-entry module is edited
**Core Functions**: `bootstrap`, `wireModules`, `registerRenderLoop`, `handleBootstrapError`, `teardown`
**Business Rules**:
- Wiring is the ONLY integration-strategy feature; it depends on every other feature
- The entry point must NOT contain game logic — it only wires pre-built modules

## Integration Points

### Physics -> Game
- Collision event (`collisionStart`) triggers merge check in Game Module
- Game Module calls Physics Module to remove merged bodies and create new body
- Game Module queries body positions and sleep states for game over detection
- Event format: `{ bodyA: MatterBody, bodyB: MatterBody, pairs: CollisionPair[] }`

### Game -> Renderer
- Game state changes (score update, game over, state transition) push render updates
- Fruit positions read from Physics bodies each frame for Renderer interpolation
- Merge events emit effect requests (particles, flash, score popup) to Renderer
- Renderer reads game state to determine which overlay to show (title, HUD, game over)

### Game -> Audio
- Drop event triggers drop SFX
- Merge event triggers tier-specific merge SFX
- Combo chain merge triggers escalating pitch SFX
- GameOver transition triggers game over jingle
- State transitions control BGM (play on Playing, pause on GameOver)

### Input -> Game
- Pointer position updates pending fruit horizontal position in Game Module
- Drop action triggers Game Module's `dropFruit`
- Input Module queries Game Module for input-enabled state (cooldown, game state)

### UI -> Game
- "Tap to Start" triggers state transition Title -> Playing
- "Retry" button triggers state transition GameOver -> Playing (via reset)
- Fruit guide toggle is UI-only (no game state impact)
- Volume/mute controls route through Audio Module

## Business Rules

1. **Drop fruit selection**: Pending fruit is randomly selected from tier 1-5 only. Higher tiers (6-11) can only be obtained through merging. This ensures gameplay requires strategy, not luck.

2. **Merge physics accuracy**: The merged fruit spawns at the exact midpoint of the two colliding fruits' centers. It inherits no velocity from the parents — it enters the world at rest and falls under gravity. This prevents unpredictable chain reactions from inherited momentum.

3. **Combo timing window**: All merges within 1000ms of the first merge in a chain count as a combo. The timer resets after 1000ms of no merges. The combo multiplier caps at 2.5x (4th+ merge). This rewards skillful drop placement without making combos overpowered.

4. **Game over grace period**: The 2-second grace only applies to sleeping (settled) bodies above the danger line. A fruit actively falling or bouncing above the line does not start the timer. If a settled fruit is bumped back below the line by a new drop, the timer resets. This prevents frustrating false game-overs.

5. **Drop cooldown is fixed**: The 500ms cooldown between drops cannot be bypassed. This is a core game balance mechanic — faster drops would trivialize positioning strategy.

6. **Watermelon double-merge reward**: Merging two Watermelons awards 5000 bonus points (separate from the tier-based score). Both Watermelons are removed, creating space. This is the ultimate skill expression and should feel rewarding.

7. **Audio-independent gameplay**: The game must be fully functional with audio disabled or before audio loads. No gameplay logic depends on audio playback completion. Audio is enhancement only.

## Non-Functional Requirements

- **Performance**: Maintain 60fps with up to 30 simultaneous fruits on mid-range mobile devices (2020+ smartphones). Physics step must complete within 8ms. Render must complete within 8ms. Total frame budget: 16.67ms.
- **Bundle Size**: Total JavaScript bundle < 150KB gzipped (excluding audio assets). Audio assets lazy-loaded.
- **Compatibility**: Chrome 90+, Safari 15+, Firefox 90+, Edge 90+. iOS Safari and Android Chrome mobile support required.
- **Responsiveness**: Playable on viewports from 320px to 2560px width. Touch and mouse input. No horizontal scroll.
- **Accessibility**: Game container has appropriate ARIA role. Score announced to screen readers on game over. High contrast mode for danger line.
- **Offline**: Service worker caches all game assets for offline play after first load.

## Success Criteria

1. All 13 features pass acceptance criteria with automated tests (physics simulation tests use deterministic seeding); FEAT-013 verifies end-to-end boot via Gate 5 Runtime Smoke
2. Fruit merge chain reactions work correctly up to 5+ cascading merges in a single frame
3. 60fps maintained with 30 fruits on screen on iPhone 12 / Pixel 5 equivalent
4. Game is fully playable on mobile Safari with touch controls — no scroll interference, no zoom
5. Score system matches specification exactly: tier^2 * 10 base, combo multipliers verified
6. Watermelon double-merge awards 5000 bonus and removes both fruits
7. Game over detection has zero false positives (no game over from bouncing fruits)
8. Best score persists across browser sessions via localStorage
