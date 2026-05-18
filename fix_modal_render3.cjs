const fs = require('fs');

let content = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

// The main return starts with:
// return (
//     <div className="mx-auto max-w-4xl p-6 relative">

// We need to change it to:
// return (
//     <>
//     <div className="mx-auto max-w-4xl p-6 relative">

content = content.replace(
    'return (\n    <div className="mx-auto max-w-4xl p-6 relative">',
    'return (\n    <>\n    <div className="mx-auto max-w-4xl p-6 relative">'
);

// We need to add the console.log to the onClick
content = content.replace(
    /onClick=\{\(\) => setSelectedReportedItem\(item\)\}/,
    "onClick={() => { console.log('Button clicked', item); setSelectedReportedItem(item); }}"
);

fs.writeFileSync('src/components/AdminView.tsx', content);
