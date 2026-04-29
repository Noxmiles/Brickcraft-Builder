import fs from 'fs';

const code = fs.readFileSync('src/App.tsx', 'utf8');
const search = `export default function App() {`;
const component = `
const BatteriesGroup = React.memo(({ blocks, geometries, selectedIds, transformOffset, toggleBlockMeta }: any) => {
  const batteryBlocks = blocks.filter((b: any) => b.partId === 'logic_battery');
  if (batteryBlocks.length === 0) return null;

  return (
    <group>
      {batteryBlocks.map((b: any) => {
        const isSelected = selectedIds.includes(b.id);
        const offsetX = isSelected && transformOffset ? transformOffset[0] : 0;
        const offsetY = isSelected && transformOffset ? transformOffset[1] : 0;
        const offsetZ = isSelected && transformOffset ? transformOffset[2] : 0;
        
        const pos = normalizePos(b.position);
        
        return (
          <group 
            key={b.id} 
            position={[pos[0] + offsetX, pos[1] + offsetY, pos[2] + offsetZ]}
            rotation={[0, b.rotation * (Math.PI / 2), 0]}
            onClick={(e) => {
              e.stopPropagation();
              toggleBlockMeta(b.id, 'isOn');
            }}
            onPointerEnter={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }}
            onPointerLeave={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'auto';
            }}
          >
            {/* Base (Bottom 2/3) - Black */}
            <mesh position={[0, -0.166, 0]} castShadow>
              <boxGeometry args={[2, 0.666, 2]} />
              <meshStandardMaterial color="#111111" roughness={0.4} metalness={0.8} />
            </mesh>
            
            {/* Top (Top 1/3) - Copper */}
            <mesh position={[0, 0.333, 0]} castShadow>
              <boxGeometry args={[2, 0.334, 2]} />
              <meshStandardMaterial color="#b87333" roughness={0.3} metalness={0.9} />
            </mesh>

            {/* Studs if desired - Copper */}
            <group position={[0, 0.5, 0]}>
               { [[0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]].map((studPos, i) => (
                  <mesh key={i} position={[studPos[0], 0.1, studPos[1]]} castShadow>
                    <cylinderGeometry args={[0.2, 0.2, 0.2, 16]} />
                    <meshStandardMaterial color="#b87333" roughness={0.3} metalness={0.9} />
                  </mesh>
               ))}
               <mesh position={[0, 0.05, 0]}>
                 <cylinderGeometry args={[0.25, 0.25, 0.11, 16]} />
                 <meshStandardMaterial 
                   color={b.meta?.isOn ? "#33ff33" : "#444444"} 
                   emissive={b.meta?.isOn ? "#33ff33" : "#000000"} 
                   emissiveIntensity={b.meta?.isOn ? 5 : 0} 
                 />
               </mesh>
            </group>
            {isSelected && <mesh position={[0,0,0]}><boxGeometry args={[2.02, 1.02, 2.02]} /><meshBasicMaterial color="#4dabf7" wireframe transparent opacity={0.6} /></mesh>}
          </group>
        );
      })}
    </group>
  );
});

export default function App() {`;

fs.writeFileSync('src/App.tsx', code.replace(search, component));
console.log('done');
