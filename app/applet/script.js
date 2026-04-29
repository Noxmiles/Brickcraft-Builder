import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'Shift+Klick auf die Batterie, um sie ein- oder auszuschalten.',
  'Klicke (mit Interaktionswerkzeug) auf die Batterie, um sie ein- oder auszuschalten.'
);

const target = `                    </div>
                    <div className="grid grid-cols-2 gap-3">`;

const replacement = `                    </div>
                    <div className="space-y-4 mb-6 mt-6 px-1">
                       <h3 className="text-[10px] uppercase tracking-[0.25em] font-black text-gray-400">Leuchtfarben</h3>
                       <div className="grid grid-cols-4 gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                         {COLORS.filter(c => c.isGlow).map(c => (
                           <button
                             key={c.value}
                             className={\`w-full aspect-square rounded-lg cursor-pointer transition-all hover:scale-110 active:scale-90 shadow-sm \${currentColor === c.value ? 'scale-110 ring-2 ring-blue-500 ring-offset-2 z-10 shadow-lg' : ''}\`}
                             style={{ backgroundColor: c.value }}
                             onClick={() => setCurrentColor(c.value)}
                             title={c.name}
                           />
                         ))}
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">`;

code = code.replace(target, replacement);
fs.writeFileSync('src/App.tsx', code);
console.log("Done");
