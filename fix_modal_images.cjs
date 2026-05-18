const fs = require('fs');

let content = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

const renderValueFnCode = `  const renderValue = (key: string, value: any): React.ReactNode => {
    if (value === null || value === undefined) return <span className="text-on-surface-variant italic">Not provided</span>;
    if (typeof value === 'boolean') return value ? "Yes" : "No";

    // Handle Images
    const lowerKey = key.toLowerCase();
    const isImageKey = lowerKey.includes('image') || lowerKey.includes('photo');
    if (typeof value === 'string' && (value.startsWith('data:image/') || (value.startsWith('http') && isImageKey))) {
        return <img src={value} alt="Reported content" className="w-full max-h-64 object-contain rounded-md mt-2 bg-black/10" />;
    }

    // Handle Clickable Links
    if (typeof value === 'string' && value.startsWith('http')) {
        return <a href={value} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline break-all">{value}</a>;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return <span className="text-on-surface break-words">{value}</span>;
    }

    // Handle Arrays (Chips)
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-on-surface-variant italic">None</span>;
      return (
        <div className="flex flex-wrap gap-2 mt-1">
          {value.map((v, i) => (
            <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-xs font-mono break-all">
              {String(v)}
            </span>
          ))}
        </div>
      );
    }

    // Handle Objects & Timestamps
    if (typeof value === 'object') {
      if ('seconds' in value && typeof value.seconds === 'number') {
        return new Date(value.seconds * 1000).toLocaleString();
      }
      return <pre className="text-xs font-mono text-on-surface-variant bg-black/20 p-2 rounded-lg mt-1 overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>;
    }
    return String(value);
  };`;

// Replace the old renderValue function
content = content.replace(
    /const renderValue = \(value: any\): React.ReactNode => \{[\s\S]*?return String\(value\);\n  \};/m,
    renderValueFnCode
);

// We must also update where renderValue is called.
// From: renderValue(value)
// To: renderValue(key, value)
content = content.replace(/\{renderValue\(value\)\}/g, "{renderValue(key, value)}");

fs.writeFileSync('src/components/AdminView.tsx', content);
