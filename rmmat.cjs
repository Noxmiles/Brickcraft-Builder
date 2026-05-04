const fs = require('fs');
let text = fs.readFileSync('src/App.tsx', 'utf-8');

const s = text.indexOf('const baseplateStudUVsOnCompile =');
const e = text.indexOf('})();', s);
if (s !== -1 && e !== -1) {
  text = text.substring(0, s) + text.substring(e + 5);
}

fs.writeFileSync('src/App.tsx', text);
console.log("Deleted");
