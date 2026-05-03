import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * ============================================================================
 *                       🧱 BRICKCRAFT TOWER DEFENSE 🧱                        
 * ============================================================================
 * 
 * PROJECT STRUCTURE & FILE REFERENCES (Table of Contents):
 * 
 * /src/
 *  ├── main.tsx                # Application Entry Point (You are here!)
 *  ├── App.tsx                 # Main UI, React State, Drag & Drop Logic, and Render Loop integration
 *  ├── parts.ts                # Definitions for physical bricks, logical parts, and grid math
 *  ├── tdEngine.ts             # Core Tower Defense Game Logic (Zero-allocation/React-independent)
 *  ├── tdSimulation.tsx        # High-performance Three.js visual simulation of the TD engine
 *  ├── tdPathfinding.ts        # A* Pathfinder using the voxel grid for enemies to navigate
 *  ├── CrystalGeometry.tsx     # Original stylized energy crystal geometry
 *  └── CrystalGeometryV2.tsx   # Updated v2 LEGO-style energy crystal geometry
 * 
 * ARCHITECTURE OVERVIEW:
 * The application is split into "Build Mode" (voxel placement, UI in App.tsx) 
 * and "Play Mode" (Simulation via tdEngine + tdSimulation). The engine strictly 
 * handles logical coordinates and data, while the simulation bridges data into 
 * instance meshes for 60fps rendering.
 * ============================================================================
 */

/**
 * Entry point for the React application.
 * Initializes the root React tree and attaches it to the DOM.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The main application shell component */}
    <App />
  </StrictMode>,
);
