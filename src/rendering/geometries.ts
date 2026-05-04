import * as THREE from 'three';
import { useMemo } from 'react';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PARTS, GRID_UNIT_WIDTH, GRID_UNIT_HEIGHT, STUD_HEIGHT, STUD_RADIUS } from '../builder/partsData';

export function useBrickGeometries() {
  return useMemo(() => {
    const geometries: Record<string, { visual: THREE.BufferGeometry, collision: THREE.BufferGeometry, edges: THREE.BufferGeometry, size: number[] }> = {};
    
    PARTS.forEach(part => {
      const [w, d, h] = part.size;
      const wActual = w * GRID_UNIT_WIDTH; 
      const dActual = d * GRID_UNIT_WIDTH;
      const hActual = h * GRID_UNIT_HEIGHT;
      
      const visualParts = [];
      const edgeParts = [];
      
      // Base Shape
      const isRound = part.type === 'cylinder' || (part.type === 'tile' && part.id.includes('round'));
      const roofT = Math.min(0.1, hActual); // ensure roof is not thicker than the piece
      
      if ((part.type === 'box' || part.type === 'tile' || part.type === 'brick' || part.type === 'plate') && !isRound) {
         const body = new THREE.BoxGeometry(wActual, hActual, dActual);
         visualParts.push(body);
         edgeParts.push(body);
      } else if (part.type === 'slope') {
         // Standard Slope
         const geometry = new THREE.BufferGeometry();
         const h2 = hActual/2;
         const w2 = wActual/2;
         const d2 = dActual/2;
         // Front is lower, Back is higher (assuming slope rises along -Z)
         const vertices = new Float32Array([
            // Bottom face
           -w2, -h2, -d2,   w2, -h2, -d2,   w2, -h2,  d2,
           -w2, -h2, -d2,   w2, -h2,  d2,  -w2, -h2,  d2,
            // Back face (tall)
           -w2, -h2, -d2,  -w2,  h2, -d2,   w2,  h2, -d2,
           -w2, -h2, -d2,   w2,  h2, -d2,   w2, -h2, -d2,
            // Front face (short - 1 plate height)
           -w2, -h2,  d2,   w2, -h2,  d2,   w2, -h2+0.1,  d2,
           -w2, -h2,  d2,   w2, -h2+0.1,  d2,  -w2, -h2+0.1,  d2,
            // Left Triangle
           -w2, -h2, -d2,  -w2, -h2,  d2,  -w2,  h2, -d2,
           -w2, -h2,  d2,  -w2, -h2+0.1,  d2,  -w2,  h2, -d2,
            // Right Triangle
            w2, -h2, -d2,   w2,  h2, -d2,   w2, -h2,  d2,
            w2, -h2,  d2,   w2,  h2, -d2,   w2, -h2+0.1,  d2,
            // Sloped top face
           -w2,  h2, -d2,  -w2, -h2+0.1,  d2,   w2, -h2+0.1,  d2,
           -w2,  h2, -d2,   w2, -h2+0.1,  d2,   w2,  h2, -d2,
         ]);
         geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
         geometry.computeVertexNormals();
         visualParts.push(geometry);
         edgeParts.push(new THREE.BoxGeometry(wActual, hActual, dActual)); // Approx edge
      } else if (part.type === 'corner') {
         // L-shape Corner. 2x2 or 3x3 L shapes.
         // Let's compose it of two boxes.
         // Arm 1 (Z-axis arm): wActual x hActual x dActual
         const b1 = new THREE.BoxGeometry(wActual, hActual, GRID_UNIT_WIDTH);
         b1.translate(0, 0, (dActual - GRID_UNIT_WIDTH) / -2);
         // Arm 2 (X-axis arm): (wActual - 1 unit) x hActual x 1 unit
         const b2 = new THREE.BoxGeometry(GRID_UNIT_WIDTH, hActual, dActual - GRID_UNIT_WIDTH);
         b2.translate((wActual - GRID_UNIT_WIDTH) / -2, 0, GRID_UNIT_WIDTH / 2);
         
         visualParts.push(b1, b2);
         edgeParts.push(b1, b2);
      } else if (isRound) {
         const cyl = new THREE.CylinderGeometry(wActual/2, wActual/2, hActual, 16);
         visualParts.push(cyl);
         edgeParts.push(cyl);
      } else if (part.type === 'slope_inv') {
          // Inverted Slope
         const geometry = new THREE.BufferGeometry();
         const h2 = hActual/2;
         const w2 = wActual/2;
         const d2 = dActual/2;
         const vertices = new Float32Array([
            // Top face (full size)
           -w2,  h2, -d2,   w2,  h2, -d2,   w2,  h2,  d2,
           -w2,  h2, -d2,   w2,  h2,  d2,  -w2,  h2,  d2,
            // Back face (tall)
           -w2, -h2, -d2,  -w2,  h2, -d2,   w2,  h2, -d2,
           -w2, -h2, -d2,   w2,  h2, -d2,   w2, -h2, -d2,
            // Front face (short - 1 plate height)
           -w2,  h2-0.1,  d2,   w2,  h2-0.1,  d2,   w2,  h2,  d2,
           -w2,  h2-0.1,  d2,   w2,  h2,  d2,  -w2,  h2,  d2,
            // Left Triangle
           -w2, -h2, -d2,  -w2,  h2-0.1,  d2,  -w2,  h2, -d2,
           -w2,  h2-0.1,  d2,  -w2,  h2,  d2,  -w2,  h2, -d2,
            // Right Triangle
            w2, -h2, -d2,   w2,  h2, -d2,   w2,  h2-0.1,  d2,
            w2,  h2-0.1,  d2,   w2,  h2, -d2,   w2,  h2,  d2,
            // Sloped bottom face
           -w2, -h2, -d2,  -w2,  h2-0.1,  d2,   w2,  h2-0.1,  d2,
           -w2, -h2, -d2,   w2,  h2-0.1,  d2,   w2, -h2, -d2,
         ]);
         geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
         geometry.computeVertexNormals();
         visualParts.push(geometry);
         edgeParts.push(new THREE.BoxGeometry(wActual, hActual, dActual)); 
      } else if (part.type === 'cone') {
          const cone = new THREE.ConeGeometry(wActual/2, hActual, 16);
          visualParts.push(cone);
          edgeParts.push(cone);
      } else if (part.type === 'wedge_plate') {
          // Simplified Wedge Plate as a triangle-ish box
          // Broad back, pointed front
          const geometry = new THREE.BufferGeometry();
          const h2 = hActual/2;
          const w2 = wActual/2;
          const d2 = dActual/2;
          const vertices = new Float32Array([
             // Bottom
            -w2, -h2, -d2,    w2, -h2, -d2,    0, -h2,  d2,
             // Top
            -w2,  h2, -d2,    0,  h2,  d2,    w2,  h2, -d2,
             // Back
            -w2, -h2, -d2,   -w2,  h2, -d2,    w2,  h2, -d2,
            -w2, -h2, -d2,    w2,  h2, -d2,    w2, -h2, -d2,
             // Left
            -w2, -h2, -d2,     0, -h2,  d2,     0,  h2,  d2,
            -w2, -h2, -d2,     0,  h2,  d2,   -w2,  h2, -d2,
             // Right
             w2, -h2, -d2,    w2,  h2, -d2,     0,  h2,  d2,
             w2, -h2, -d2,     0,  h2,  d2,     0, -h2,  d2
          ]);
          geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
          geometry.computeVertexNormals();
          visualParts.push(geometry);
          edgeParts.push(new THREE.BoxGeometry(wActual, hActual, dActual));
      } else if (part.type === 'slope_2studs') {
          // Double slope (roof peak)
          const geometry = new THREE.BufferGeometry();
          const h2 = hActual/2;
          const w2 = wActual/2;
          const d2 = dActual/2;
          
          const vertices = new Float32Array([
             // Bottom face
            -w2, -h2, -d2,   w2, -h2, -d2,   w2, -h2,  d2,
            -w2, -h2, -d2,   w2, -h2,  d2,  -w2, -h2,  d2,
             // Flat Top piece (1 plate tall)
            -w2,  h2, -0.1,  w2,  h2, -0.1,  w2,  h2,  0.1,
            -w2,  h2, -0.1,  w2,  h2,  0.1, -w2,  h2,  0.1,
             // Flat Front/Back vertical walls (short)
            -w2, -h2,  d2,   w2, -h2,  d2,   w2, -h2+0.1,  d2,
            -w2, -h2,  d2,   w2, -h2+0.1,  d2, -w2, -h2+0.1,  d2,
            
            -w2, -h2, -d2,  -w2, -h2+0.1, -d2,  w2, -h2+0.1, -d2,
            -w2, -h2, -d2,   w2, -h2+0.1, -d2,  w2, -h2, -d2,

             // Sloped front
            -w2,  h2,  0.1,  w2, -h2+0.1,  d2,  -w2, -h2+0.1,  d2,
            -w2,  h2,  0.1,  w2,  h2,  0.1,   w2, -h2+0.1,  d2,
             
             // Sloped back
            -w2, -h2+0.1, -d2,  w2, -h2+0.1, -d2, -w2,  h2, -0.1,
             w2, -h2+0.1, -d2,  w2,  h2, -0.1,  -w2,  h2, -0.1,
             
             // Left side (2 triangles + 1 rect)
            -w2, -h2+0.1,  d2, -w2,  h2,  0.1, -w2, -h2+0.1, -0.1,
            -w2, -h2+0.1, -0.1, -w2,  h2,  0.1, -w2,  h2, -0.1,
            -w2, -h2+0.1, -0.1, -w2,  h2, -0.1, -w2, -h2+0.1, -d2,
             // Right side
             w2, -h2+0.1,  d2,  w2, -h2+0.1, -0.1,  w2,  h2,  0.1,
             w2, -h2+0.1, -0.1,  w2,  h2, -0.1,  w2,  h2,  0.1,
             w2, -h2+0.1, -0.1,  w2, -h2+0.1, -d2,  w2,  h2, -0.1,
          ]);
          geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
          geometry.computeVertexNormals();
          visualParts.push(geometry);
          edgeParts.push(new THREE.BoxGeometry(wActual, hActual, dActual));
      } else {
         const body = new THREE.BoxGeometry(wActual, hActual, dActual);
         visualParts.push(body);
         edgeParts.push(body);
      }

      // Add Studs
      if (part.type !== 'tile' && part.type !== 'slope' && part.type !== 'slope_inv' && part.type !== 'cone') {
        const studGeo = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 8);
        const topY = hActual / 2 + STUD_HEIGHT / 2;
        
        let studPositions: {x: number, z: number}[] = [];

        if (part.type === 'jumper' || part.type === 'jumper_round') {
           studPositions.push({ x: 0, z: 0 }); // Single center stud
        } else if (part.type === 'corner') {
           // L shape studs
           for (let ix = 0; ix < w; ix++) {
             for (let iz = 0; iz < d; iz++) {
               if (ix === 0 || iz === 0) {
                 const sx = (ix - w/2 + 0.5) * GRID_UNIT_WIDTH;
                 const sz = (iz - d/2 + 0.5) * GRID_UNIT_WIDTH;
                 studPositions.push({ x: sx, z: sz });
               }
             }
           }
        } else if (part.type === 'wedge_plate') {
           // Approximate stud placements for wedge
           if (w===3 && d===3) {
             studPositions.push({ x: -GRID_UNIT_WIDTH, z: -GRID_UNIT_WIDTH });
             studPositions.push({ x: 0, z: -GRID_UNIT_WIDTH });
             studPositions.push({ x: GRID_UNIT_WIDTH, z: -GRID_UNIT_WIDTH });
             studPositions.push({ x: -GRID_UNIT_WIDTH/2, z: 0 });
             studPositions.push({ x: GRID_UNIT_WIDTH/2, z: 0 });
             studPositions.push({ x: 0, z: GRID_UNIT_WIDTH });
           }
        } else if (part.type === 'slope_2studs') {
           // Only add studs to the top flat part
           const sx = (-w/2 + 0.5) * GRID_UNIT_WIDTH;
           const sz = 0;
           studPositions.push({ x: sx, z: sz });
           if (w > 1) studPositions.push({ x: Math.abs(sx), z: sz });
        } else {
           for (let ix = 0; ix < w; ix++) {
             for (let iz = 0; iz < d; iz++) {
               if (isRound && Math.sqrt(Math.pow(ix - w/2 + 0.5, 2) + Math.pow(iz - d/2 + 0.5, 2)) > w/2) continue;
               
               const sx = (ix - w/2 + 0.5) * GRID_UNIT_WIDTH;
               const sz = (iz - d/2 + 0.5) * GRID_UNIT_WIDTH;
               studPositions.push({ x: sx, z: sz });
             }
           }
        }

        studPositions.forEach(pos => {
            const m = new THREE.Matrix4().makeTranslation(pos.x, topY, pos.z);
            const stud = studGeo.clone();
            stud.applyMatrix4(m);
            visualParts.push(stud);
            edgeParts.push(stud);
        });
      }

      visualParts.forEach(g => {
        if (!g.attributes.normal) g.computeVertexNormals();
        if (!g.attributes.uv) {
          const uvs = new Float32Array(g.attributes.position.count * 2);
          g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        }
      });
      edgeParts.forEach(g => {
        if (!g.attributes.normal) g.computeVertexNormals();
        if (!g.attributes.uv) {
          const uvs = new Float32Array(g.attributes.position.count * 2);
          g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        }
      });

      const mergedVisual = mergeGeometries(visualParts.map(g => g.index ? g.toNonIndexed() : g)) || visualParts[0];
      const mergedEdges = mergeGeometries(edgeParts.map(g => g.index ? g.toNonIndexed() : g)) || edgeParts[0];
      
      const collisionBase = new THREE.BoxGeometry(wActual, hActual, dActual);

      geometries[part.id] = {
        visual: mergedVisual,
        collision: collisionBase,
        edges: mergedEdges,
        size: [wActual, hActual, dActual]
      };
    });
    
    return geometries;
  }, []);
}
