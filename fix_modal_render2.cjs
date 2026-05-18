const fs = require('fs');

let content = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

// The file currently has NO <> wrapping the return
// And NO modal rendering at the bottom.

// Let's first wrap the main return in <>
content = content.replace(
    'return (\n    <div className="flex h-full flex-col overflow-y-auto bg-background text-on-surface p-4 sm:p-6 lg:p-8 scrollbar-thin pb-32">',
    'return (\n    <>\n    <div className="flex h-full flex-col overflow-y-auto bg-background text-on-surface p-4 sm:p-6 lg:p-8 scrollbar-thin pb-32">'
);


// Let's replace the last </div> with the ending </div>, the modal, and the closing </>
content = content.replace(
    /<\/div>\n  \);\n};\n$/,
    '    </div>\n    {selectedReportedItem && (\n      <ReportedContentDetailModal \n        item={selectedReportedItem} \n        onClose={() => setSelectedReportedItem(null)} \n      />\n    )}\n    </>\n  );\n};\n'
);


// Finally, add the console.log to the onClick
content = content.replace(
    /onClick=\{\(\) => setSelectedReportedItem\(item\)\}/,
    "onClick={() => { console.log('Button clicked', item); setSelectedReportedItem(item); }}"
);

fs.writeFileSync('src/components/AdminView.tsx', content);
