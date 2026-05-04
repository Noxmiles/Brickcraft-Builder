import { normalizePos } from './grid';

export const parseSaveFile = (content: string) => {
  const lines = content.split('\n');
  const newBlocks: any[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('=') || trimmed.startsWith('-') || trimmed.startsWith('PART-ID') || trimmed.startsWith('BRICKCRAFT')) continue;
    
    // Very simple whitespace parsing (wait, space parsing needs to consider everything)
    const match = trimmed.match(/^(\S+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+(\S+)\s*(\S+)?/);
    if (match) {
      const partId = match[1];
      const x = parseFloat(match[2]);
      const y = parseFloat(match[3]);
      const z = parseFloat(match[4]);
      const rot = parseFloat(match[5]);
      const col = match[6];
      const mat = match[7];
      
      const internalX = (x / 2) - 32;
      const internalZ = (z / 2) - 32;
      const internalY = y - 0.5;

      newBlocks.push({
        id: Math.random().toString(36).substring(2, 9),
        partId,
        position: [internalX, internalY, internalZ],
        rotation: rot,
        color: col,
        material: mat === 'undefined' ? undefined : mat
      });
    }
  }
  return newBlocks;
};

export const generateSaveData = (blocks: any[]) => {
  let data = "================================================================================\n";
  data += "BRICKCRAFT SAVE - BOUNDED GRID (64x32x64)\n";
  data += "================================================================================\n";
  data += "PART-ID".padEnd(35) + "X".padEnd(10) + "Y".padEnd(10) + "Z".padEnd(10) + "ROT".padEnd(10) + "COLOR".padEnd(10) + "MATERIAL\n";
  data += "----------------------------------------------------------------------------------------------------\n";
  
  blocks.forEach(b => {
    const p = normalizePos(b.position);
    // Coordinate Mapping: internal units -> stud system
    const outX = (p[0] + 32) * 2; 
    const outZ = (p[2] + 32) * 2; 
    const normalizedY = p[1] + 0.5;
    
    data += String(b.partId).padEnd(35) + 
            outX.toFixed(2).padEnd(10) + 
            normalizedY.toFixed(2).padEnd(10) + 
            outZ.toFixed(2).padEnd(10) + 
            String(b.rotation || 0).padEnd(10) + 
            String(b.color || '#ffffff').padEnd(10) + 
            (b.material || 'solid') + "\n";
  });
  return data;
};
