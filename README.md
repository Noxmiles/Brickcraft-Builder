<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Brickcraft Builder & Tower Defense

A high-performance, voxel-based building simulator combined with a fully-fledged Tower Defense game engine. Built with React and Three.js (`@react-three/fiber`).

View your app in AI Studio: https://ai.studio/apps/b6ef3c3b-406b-4412-8753-e44a313cb8ef

---

## 🎯 Overview

This application consists of two deeply integrated systems:
1.  **Builder Mode**: A free-form 3D sandbox where users place Lego-like bricks, plates, and electronic components. It features grid-snapping, structural physics (gravity), collision detection, and logic propagation (electrical circuits).
2.  **Tower Defense Mode**: A game engine where the user's custom-built structures become the playing field. Enemies pathfind around (or over) the placed blocks to reach a central crystal, while tower blocks shoot projectiles. 

## 🧠 For Developers & AI Agents (Architecture Guidelines)

If you are a human developer or an AI assistant analyzing this codebase, you **must** adhere to these architectural principles. The app heavily relies on strict separation of concerns to achieve smooth 60 FPS in the browser while simulating thousands of entities.

### 1. State Separation (React vs. Engine)
- **UI & Static State**: Managed by React `useState` (e.g., placed blocks, active categories, UI menus). If it only updates on user input, it lives in React.
- **Simulation State**: Managed by `TDEngine` (`src/td/tdEngine.ts`). Enemies, projectiles, and tower cooldowns are continuously mutating. **Do not** put enemy positions or projectile arrays in React state. Doing so will trigger continuous re-renders and kill performance.

### 2. High-Performance Three.js (`InstancedMesh`)
- **NEVER** use `blocks.map((b) => <mesh ... />)` for dynamic, high-volume entities like enemies, projectiles, or health bars.
- Look at `src/td/components/`. We use `THREE.InstancedMesh` heavily.
- We map entity properties to Matrix4 transformations within the `useFrame` loop directly, bypassing React's reconciliation phase.

### 3. Voxel Space vs. World Space
- **Continuous World Space**: Three.js coordinates (X, Y, Z float values).
- **Discrete Voxel Space**: The abstract game grid used by pathfinding.
  - `X` and `Z` axes: 1 Voxel = `0.5` World Units.
  - `Y` axis: 1 Voxel = `0.2` World Units (the height of a plate).
  - Ground floor is offset (`-0.4` world Y).
- Always use the `voxelToWorld` mapping from `src/core/config.ts` to convert between grids.

### 4. Zero-Allocation Philosophy (The TD Engine)
- Inside `src/td/tdEngine.ts`, we aggressively avoid allocating new objects during the Game `tick` loop.
- Instead of using `Array.filter` or pushing new objects, we recycle objects in fixed-size arrays (`TD_CONFIG.MAX_PROJECTILES`, `MAX_ENEMIES`), utilizing an `active` boolean flag. This practically eliminates JavaScript Garbage Collection (GC) stutters.

---

## 🚀 Key Features

### 🏗️ Advanced Builder Mechanics
- **Grid-Snapping & Collision Detection**: Precise place-and-click building system with complex geometric collision boundaries (`src/builder/collision.ts`).
- **Structural Physics & Stability**: Real-time evaluation of structural integrity (`src/builder/physics.ts`). Unsupported blocks fall down instantly.
- **Logic & Power Grids**: Internal "Redstone-like" propagation system calculating power states across connected blocks via Bidirectional Search (`src/builder/logic.ts`).
- **Undo/Redo System**: Full action history tracking.

### ⚔️ Tower Defense Engine
- **Custom Pathfinding**: VoxelGrid-based A* pathfinding (`src/td/tdPathfinding.ts`) that evaluates the abstract 3D grid and calculates clear paths avoiding solid structures.
- **Dynamic Recoil & Effects**: Rapid and heavy towers evaluate their targeting and visually recoil independently using a decoupled CustomEvent system.
- **Procedural Animations**: Enemy wobbling and walking sequences are mathematically calculated using `Math.sin(clock.elapsedTime)` rather than heavy bone-based rigged animations.

### 💾 I/O & State Management
- **Save/Load Files**: Serialize architectural creations into JSON and load them later via file drop or clipboard paste (`src/builder/io.ts`).

---

## 📂 Directory Structure

```text
src/
├── builder/           # Core building logic (domain)
│   ├── collision.ts   # Geometric collision boundaries computation
│   ├── grid.ts        # Mathematical grid/world transformations
│   ├── io.ts          # Save/Load serialization format
│   ├── logic.ts       # Circuit/Power propagation algorithms
│   ├── partsData.ts   # Brick definitions, dimensions, & color mappings
│   └── physics.ts     # Structural stability & gravity validation
│
├── core/              # Shared types, globally accessible configs
│   ├── config.ts      # Global limits (TD_CONFIG), Voxel layouts
│   ├── types.ts       # Strict TS interfaces for Blocks, Enemies, Projectiles
│   └── audio.ts       # Multi-channel web audio scheduling
│
├── td/                # Tower Defense Engine & Renderers (domain)
│   ├── components/    # Splitted InstancedMesh renderers for performance
│   │   ├── EnemyRenderer.tsx
│   │   ├── ProjectileRenderer.tsx
│   │   ├── TowerRenderer.tsx
│   │   └── HealthBarRenderer.tsx
│   ├── tdEngine.ts    # Game Engine loop, logic ticks, physics rules
│   ├── tdPathfinding.ts # A* pathfinder & VoxelGrid abstraction
│   └── tdSimulation.tsx # R3F Container managing the simulation render cycle
│
├── App.tsx            # Main Orchestrator, HTML UI overlay, R3F Canvas
└── main.tsx           # React root
```

---

## 💻 Run Locally

This repo contains everything you need to run the app locally.

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up environment variables (optional, for Gemini AI features if any are used):
   Copy `.env.example` to `.env.local` and add your API key.
   ```bash
   cp .env.example .env.local
   ```
   ```env
   GEMINI_API_KEY="YOUR_KEY_HERE"
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 🧪 Testing
The architecture has been computationally designed disconnected from DOM logic, allowing logic testing via Vitest:
```bash
npm run test
```
