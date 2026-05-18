const fs = require('fs');

let content = fs.readFileSync('src/components/BuddyView.tsx', 'utf8');

content = content.replace(
    'import React, { useState, useEffect } from "react";',
    'import React, { useState, useEffect } from "react";\nimport { ReportReasonModal } from "./ReportReasonModal";'
);

content = content.replace(
    'const [showMap, setShowMap] = useState(false);',
    'const [showMap, setShowMap] = useState(false);\n  const [isReportingEvent, setIsReportingEvent] = useState(false);'
);


content = content.replace(
    /const handleReport = async \(\) => \{[\s\S]*?\}\s*else\s*\{[\s\S]*?\}\s*\};/m,
    `const handleReportAction = () => {
    if (!profile?.id || isHost) return;
    if (hasReported) {
      handleRemoveReport();
    } else {
      setIsReportingEvent(true);
    }
  };

  const handleRemoveReport = async () => {
    if (!profile?.id) return;
    try {
      const eventRef = doc(db, "events", event.id);
      await updateDoc(eventRef, {
        reportedBy: arrayRemove(profile.id),
        reportsCount: increment(-1),
        reported: event.reportsCount && event.reportsCount <= 1 ? false : true
      });
    } catch (error) {
      console.error("Error removing event report:", error);
    }
  };

  const handleReportSubmit = async (reason: string) => {
    if (!profile?.id) return;
    try {
      const eventRef = doc(db, "events", event.id);
      await updateDoc(eventRef, {
        reportedBy: arrayUnion(profile.id),
        reportDetails: arrayUnion({ uid: profile.id, reason, timestamp: new Date().toISOString() }),
        reportsCount: increment(1),
        reported: true
      });
      setIsReportingEvent(false);
    } catch (error) {
      console.error("Error reporting event:", error);
    }
  };`
);


content = content.replace(
    'onClick: handleReport',
    'onClick: handleReportAction'
);


// Inject modal at bottom of EventCard
content = content.replace(
    'return (\n    <div className="bg-surface-container rounded-3xl p-6 border border-white/5 flex flex-col h-full hover:border-white/10 transition-colors relative group">',
    'return (\n    <>\n    <div className="bg-surface-container rounded-3xl p-6 border border-white/5 flex flex-col h-full hover:border-white/10 transition-colors relative group">'
);

content = content.replace(
    /<\/div>\n  \);\n};\n\nconst CreateEventModal/m,
    `</div>
      <ReportReasonModal
        isOpen={isReportingEvent}
        onClose={() => setIsReportingEvent(false)}
        onSubmit={handleReportSubmit}
      />
    </>
  );
};

const CreateEventModal`
);


fs.writeFileSync('src/components/BuddyView.tsx', content);
