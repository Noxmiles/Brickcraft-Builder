import * as THREE from 'three';

export const baseplateStudUVsOnCompile = (shader: any) => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <uv_vertex>',
    `
    #include <uv_vertex>
    #ifdef USE_INSTANCING
      vec4 worldPositionForUV = instanceMatrix * vec4(position, 1.0);
      vec2 floorUv = vec2(
         (worldPositionForUV.x + 16.0) / 32.0,
         (-worldPositionForUV.z + 16.0) / 32.0
      );
      #if defined( USE_UV )
        vUv = floorUv;
      #endif
      #if defined( USE_MAP )
        vMapUv = floorUv;
      #endif
      #if defined( USE_NORMALMAP )
        vNormalMapUv = floorUv;
      #endif
      #if defined( USE_ROUGHNESSMAP )
        vRoughnessMapUv = floorUv;
      #endif
    #endif
    `
  );
};

export const randomUVsOnCompile = (shader: any) => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <uv_vertex>',
    `
    #include <uv_vertex>
    #ifdef USE_INSTANCING
      vec2 uvOffset = instanceMatrix[3].xz * 0.137;
    #else
      vec2 uvOffset = modelMatrix[3].xz * 0.137;
    #endif
    #if defined( USE_UV )
      vUv += uvOffset;
    #endif
    #if defined( USE_MAP )
      vMapUv += uvOffset;
    #endif
    #if defined( USE_NORMALMAP )
      vNormalMapUv += uvOffset;
    #endif
    #if defined( USE_ROUGHNESSMAP )
      vRoughnessMapUv += uvOffset;
    #endif
    `
  );
};

export const { roughnessMap, floorRoughnessMap, studFloorRoughnessMap, studFloorNormalMap, microRoughnessMap, normalMap, floorNormalMap, customEnvMap } = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Base: Semi-glossy plastic (#11 to #22 is very shiny, #33+ is more matte)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 1024, 1024);
    
    // 1. Fine Pitting / Dust (Dots)
    for (let i = 0; i < 400; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 1024;
        const v = Math.floor(Math.random() * 40) + 40;
        const size = Math.random() * 2 + 1; // Much smaller dots
        ctx.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.4})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    // 2. Play Wear Scratches (Irregular lines)
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const len = Math.random() * 60 + 20; // Longer scratches
      const angle = Math.random() * Math.PI * 2;
      const v = Math.floor(Math.random() * 100) + 120; // High roughness value
      const opacity = Math.random() * 0.3 + 0.1;
      
      ctx.strokeStyle = `rgba(${v},${v},${v},${opacity})`;
      ctx.lineWidth = Math.random() * 1.5 + 0.5; // Thinner lines
      ctx.beginPath();
      ctx.moveTo(x, y);
      const midX = x + Math.cos(angle) * (len * 0.5) + (Math.random() - 0.5) * 10;
      const midY = y + Math.sin(angle) * (len * 0.5) + (Math.random() - 0.5) * 10;
      ctx.lineTo(midX, midY);
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      ctx.stroke();
    }
    
    // 3. Rubbed areas / Smudges (Heavy wear patches)
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const r = Math.random() * 30 + 10;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      const intensity = Math.floor(Math.random() * 60) + 150;
      grad.addColorStop(0, `rgba(${intensity}, ${intensity}, ${intensity}, 0.25)`);
      grad.addColorStop(1, 'rgba(26, 26, 26, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  const baseTex = new THREE.CanvasTexture(canvas);
  baseTex.wrapS = baseTex.wrapT = THREE.RepeatWrapping;
  
  // Versions for different scales
  const rMap = baseTex.clone();
  rMap.repeat.set(0.5, 0.5); // 1 repeat per 2 units, same as the floor
  
  const mMap = baseTex.clone();
  mMap.repeat.set(0.5, 0.5); // Better for bricks/studs

  // Generate Normal Map from Roughness Map
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = 1024;
  normalCanvas.height = 1024;
  const nCtx = normalCanvas.getContext('2d');
  if (ctx && nCtx) {
     const imgData = ctx.getImageData(0, 0, 1024, 1024);
     const nData = nCtx.createImageData(1024, 1024);
     const data = imgData.data;
     const nd = nData.data;
     const w = 1024;
     const h = 1024;
     
     // Simple discrete difference to approximate local gradient
     for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
           const i = (y * w + x) * 4;
           // Red channel holds grayscale height
           const c = data[i] / 255.0; 
           
           const cxX = x < w - 1 ? data[i + 4] / 255.0 : c;
           const cyY = y < h - 1 ? data[i + w * 4] / 255.0 : c;
           
           // Height difference
           const dx = (c - cxX) * 15.0; // strength multiplier
           const dy = (c - cyY) * 15.0;
           const dz = 1.0;
           
           // Normalize vector
           const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
           const nx = dx / len;
           const ny = dy / len;
           const nz = dz / len;
           
           // Map from [-1, 1] to [0, 255]
           nd[i] = Math.floor((nx * 0.5 + 0.5) * 255);     // R represents X
           nd[i+1] = Math.floor((ny * 0.5 + 0.5) * 255);   // G represents Y
           nd[i+2] = Math.floor((nz * 0.5 + 0.5) * 255);   // B represents Z
           nd[i+3] = 255;                                  // Alpha
        }
     }
     nCtx.putImageData(nData, 0, 0);
  }
  
  const normalTex = new THREE.CanvasTexture(normalCanvas);
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  
  const nMap = normalTex.clone();
  nMap.repeat.set(1, 1);
  
  const floorNMap = normalTex.clone();
  floorNMap.repeat.set(16, 16);

  // Custom Environment Map (Simple Studio Lighting)
  const envCanvas = document.createElement('canvas');
  envCanvas.width = 512;
  envCanvas.height = 512;
  const envCtx = envCanvas.getContext('2d');
  if (envCtx) {
     envCtx.fillStyle = '#0a0a0a'; // very dark ambient
     envCtx.fillRect(0,0,512,512);

     envCtx.fillStyle = '#ffffff';
     envCtx.beginPath();
     envCtx.arc(128, 128, 60, 0, Math.PI*2); // key light
     envCtx.fill();
     
     envCtx.fillStyle = '#4488ff';
     envCtx.beginPath();
     envCtx.arc(384, 128, 40, 0, Math.PI*2); // rim light
     envCtx.fill();

     envCtx.fillStyle = '#ff8844';
     envCtx.beginPath();
     envCtx.arc(256, 384, 80, 0, Math.PI*2); // fill light
     envCtx.fill();

     // Soften
     envCtx.filter = 'blur(20px)';
     envCtx.drawImage(envCanvas, 0, 0);
  }
  const customEnvTex = new THREE.CanvasTexture(envCanvas);
  customEnvTex.mapping = THREE.EquirectangularReflectionMapping;

  return {
     roughnessMap: rMap,
     floorRoughnessMap: baseTex,
     studFloorRoughnessMap: baseTex.clone(),
     microRoughnessMap: mMap,
     normalMap: nMap,
     floorNormalMap: floorNMap,
     studFloorNormalMap: floorNMap.clone(),
     customEnvMap: customEnvTex
  };
})();

Array.from([floorRoughnessMap, studFloorRoughnessMap, floorNormalMap, studFloorNormalMap]).forEach((t) => {
   if (t) {
     if (t === studFloorRoughnessMap || t === studFloorNormalMap) {
       t.repeat.set(16, 16);
     } else {
       t.repeat.set(8, 8); 
     }
     t.needsUpdate = true;
   }
});

export const getGhostMaterial = (baseColor: string, isNightMode: boolean = false) => {
    return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.4,
        roughness: 0.3,
        metalness: 0.1,
        transmission: 0.5,
        thickness: 0.5,
        clearcoat: 1.0,
        emissive: isNightMode ? baseColor : '#000000',
        emissiveIntensity: isNightMode ? 0.8 : 0.2,
        depthWrite: false,
    });
};
