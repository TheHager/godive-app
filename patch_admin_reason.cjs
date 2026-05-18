const fs = require('fs');

let content = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

// Filter reportDetails out of main loop
content = content.replace(
    'const { id, userId, hostId, reported, reportsCount, reportedBy, authorId, eventId, documentPath, ...rest } = item.originalData;',
    'const { id, userId, hostId, reported, reportsCount, reportedBy, authorId, eventId, documentPath, reportDetails, ...rest } = item.originalData;'
);

// We need to render the report reason next to the display name.
// First let's find the "Reported By" block.
content = content.replace(
    /<li key=\{idx\} className="break-all">\{reporterNames\[userId\] \|\| userId\}<\/li>/,
    `<li key={idx} className="break-all flex flex-col mb-2">
                        <span className="font-bold">{reporterNames[userId] || userId}</span>
                        {item.originalData?.reportDetails?.find((r: any) => r.uid === userId)?.reason && (
                          <span className="text-xs text-on-surface-variant italic mt-0.5 border-l-2 border-white/10 pl-2">
                            "{item.originalData.reportDetails.find((r: any) => r.uid === userId).reason}"
                          </span>
                        )}
                      </li>`
);

fs.writeFileSync('src/components/AdminView.tsx', content);
