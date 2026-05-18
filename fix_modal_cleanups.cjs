const fs = require('fs');

let content = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

// 1. Add useEffect to imports
content = content.replace(
    'import React, { useState } from "react";',
    'import React, { useState, useEffect } from "react";'
);

const updatedModalCode = `
export const ReportedContentDetailModal = ({ item, onClose }: { item: ReportedItem, onClose: () => void }) => {
  const [reporterNames, setReporterNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchReporterNames = async () => {
      if (!item.reportedBy || item.reportedBy.length === 0) return;

      const names: Record<string, string> = {};
      await Promise.all(
        item.reportedBy.map(async (uid) => {
          try {
            const userDoc = await getDocs(query(collection(db, "users"), where("id", "==", uid)));
            if (!userDoc.empty) {
              names[uid] = userDoc.docs[0].data().displayName || uid;
            } else {
              names[uid] = uid; // fallback
            }
          } catch (e) {
            names[uid] = uid; // fallback
          }
        })
      );
      setReporterNames(names);
    };

    fetchReporterNames();
  }, [item.reportedBy]);

  const renderValue = (key: string, value: any): React.ReactNode => {
    if (value === null || value === undefined) return <span className="text-on-surface-variant italic">Not provided</span>;
    if (typeof value === 'boolean') return value ? "Yes" : "No";

    // Handle Profile Images (userPhotoUrl, photoURL)
    const lowerKey = key.toLowerCase();
    const isProfilePic = lowerKey === 'userphotourl' || lowerKey === 'photourl';
    if (typeof value === 'string' && value.startsWith('http') && isProfilePic) {
        return <img src={value} alt="User Profile" className="w-12 h-12 rounded-full object-cover border border-white/10" />;
    }

    // Handle Images
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
  };

  const getFilteredData = () => {
    if (!item.originalData) return null;
    // Ensure we exclude eventId as requested, along with authorId and path which are in original data sometimes
    const { id, userId, hostId, reported, reportsCount, reportedBy, authorId, eventId, documentPath, ...rest } = item.originalData;
    return rest;
  };

  const filteredData = getFilteredData();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-surface-container-high rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-surface-container">
          <div>
            <h2 className="text-xl font-black tracking-tight text-on-surface">Reported Content Details</h2>
            <div className="flex gap-2 mt-1">
              <span className="text-xs font-bold uppercase tracking-widest text-error bg-error/10 border border-error/20 px-2 py-0.5 rounded-md">
                {item.type}
              </span>
              <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1">
                <Flag size={12} className="text-error" /> {item.reportsCount} report(s)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition-colors border border-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Reported By</h3>
              <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                {item.reportedBy && item.reportedBy.length > 0 ? (
                  <ul className="list-disc pl-5 text-sm space-y-1 text-on-surface">
                    {item.reportedBy.map((userId, idx) => (
                      <li key={idx} className="break-all">{reporterNames[userId] || userId}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-sm text-on-surface-variant italic">No reporters recorded</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Content Data</h3>
              <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                {!filteredData || Object.keys(filteredData).length === 0 ? (
                   <div className="text-sm text-on-surface-variant italic">No content available</div>
                ) : (
                   <div className="flex flex-col gap-4">
                     {Object.entries(filteredData).map(([key, value]) => (
                       <div key={key} className="flex flex-col gap-1 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                         <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{key}</span>
                         <div className="text-sm">{renderValue(key, value)}</div>
                       </div>
                     ))}
                   </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};`;

content = content.replace(
    /export const ReportedContentDetailModal = \(\{ item, onClose \}: \{ item: ReportedItem, onClose: \(\) => void \}\) => \{[\s\S]*?export const AdminView/m,
    updatedModalCode + '\n\nexport const AdminView'
);

fs.writeFileSync('src/components/AdminView.tsx', content);
