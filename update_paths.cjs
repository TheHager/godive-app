const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'src', 'components', 'ExplorerView.tsx');
let content = fs.readFileSync(p, 'utf8');

// The regex will look for lines inside INITIAL_DIVE_SITES that have an id and a photo
// Actually, we can just replace photo: "https://..." with photo: `/sites/${match_id}.png`

let replaced = content.replace(/id:\s*'([^']+)',.*?photo:\s*"https:\/\/[^"]+"/gs, (match, id) => {
  return match.replace(/photo:\s*"https:\/\/[^"]+"/, `photo: "/sites/${id}.png"`);
});

fs.writeFileSync(p, replaced);
console.log('Successfully updated ExplorerView.tsx photo paths to local /sites/ directory.');
