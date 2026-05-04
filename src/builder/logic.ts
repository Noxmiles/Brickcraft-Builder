import { PART_MAP } from './partsData';

export function calculateLogicState(blocks: any[]): Record<string, number> {
  const logicBlocks = blocks.filter(b => b.partId.startsWith('logic_'));
  const nextState: Record<string, number> = {};
  
  // Batteries that are active get full power (15)
  logicBlocks.forEach(b => {
    if (b.partId === 'logic_battery' && b.meta?.isOn) {
      nextState[b.id] = 15;
    }
  });

  let queue = logicBlocks.filter(b => nextState[b.id] === 15);
  
  while(queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const currentPower = nextState[current.id];
    if (currentPower <= 1) continue;
    
    logicBlocks.forEach(neighbor => {
      if (neighbor.id === current.id || neighbor.partId === 'logic_battery') return;
      
      const cPart = PART_MAP.get(current.partId);
      const nPart = PART_MAP.get(neighbor.partId);
      if (!cPart || !nPart) return;

      const cxSize = (current.rotation % 2 === 1 ? cPart.size[1] : cPart.size[0]) * 0.5;
      const czSize = (current.rotation % 2 === 1 ? cPart.size[0] : cPart.size[1]) * 0.5;
      const nxSize = (neighbor.rotation % 2 === 1 ? nPart.size[1] : nPart.size[0]) * 0.5;
      const nzSize = (neighbor.rotation % 2 === 1 ? nPart.size[0] : nPart.size[1]) * 0.5;
      
      const dx = Math.abs(neighbor.position[0] - current.position[0]);
      const dz = Math.abs(neighbor.position[2] - current.position[2]);
      const dy = Math.abs(neighbor.position[1] - current.position[1]);
      
      // Touch condition with tolerance for grid misalignment
      const dxMax = (cxSize + nxSize) / 2 + 0.2;
      const dzMax = (czSize + nzSize) / 2 + 0.2;

      const touchX = dx <= dxMax;
      const touchZ = dz <= dzMax;
      
      // Check if it's purely diagonal (touching only on the corner)
      // If dx is close to dxMax AND dz is close to dzMax, it's diagonal.
      const isDiagonal = dx > dxMax - 0.35 && dz > dzMax - 0.35;
      
      let isValidTouch = touchX && touchZ && !isDiagonal;
      if (current.partId === 'logic_battery' || neighbor.partId === 'logic_battery') {
         isValidTouch = touchX && touchZ; // Allows diagonal "schräg dazu" for battery
      }
      
      // Height check - must basically touch on Y
      const touchY = dy <= (cPart.size[2] + nPart.size[2]) / 2 + 0.1;
      
      if (isValidTouch && touchY) {
        if (!nextState[neighbor.id]) {
          nextState[neighbor.id] = 15; // Unbegrenzte Reichweite
          queue.push(neighbor);
        }
      }
    });
  }

  return nextState;
}
