const fs = require('fs');

let content = fs.readFileSync('src/types.ts', 'utf8');

content = content.replace(
    'reportedBy?: string[];',
    'reportedBy?: string[];\n  reportDetails?: { uid: string; reason: string; timestamp: string }[];'
);

content = content.replace(
    'reportedBy?: string[];',
    'reportedBy?: string[];\n  reportDetails?: { uid: string; reason: string; timestamp: string }[];'
);

fs.writeFileSync('src/types.ts', content);
