const fs = require('fs');

let content = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

// 1. First, fix the onClick and add console.log
content = content.replace(
    /onClick=\{\(\) => setSelectedReportedItem\(item\)\}/,
    "onClick={() => { console.log('Button clicked', item); setSelectedReportedItem(item); }}"
);

// 2. Ensure the file has Fragments <> and </> if it doesn't already
if (!content.includes('<>')) {
    content = content.replace(
        'return (\n    <div className="flex h-full flex-col overflow-y-auto bg-background text-on-surface p-4 sm:p-6 lg:p-8 scrollbar-thin pb-32">',
        'return (\n    <>\n    <div className="flex h-full flex-col overflow-y-auto bg-background text-on-surface p-4 sm:p-6 lg:p-8 scrollbar-thin pb-32">'
    );
}

// 3. Add the modal at the very end. The file currently ends with:
//           </div>
//
//
//     </div>
//   );
// };
if (!content.includes('<ReportedContentDetailModal')) {
    content = content.replace(
        /<\/div>\n  \);\n};\n?$/,
        '    </div>\n    {selectedReportedItem && (\n      <ReportedContentDetailModal \n        item={selectedReportedItem} \n        onClose={() => setSelectedReportedItem(null)} \n      />\n    )}\n    </>\n  );\n};\n'
    );
} else {
    console.log('Modal rendering is already in the file! (This is unexpected based on the tail output)');
}

fs.writeFileSync('src/components/AdminView.tsx', content);
