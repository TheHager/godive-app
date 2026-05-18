const fs = require('fs');

let feedContent = fs.readFileSync('src/components/FeedView.tsx', 'utf8');

// I need to add <ReportReasonModal /> into the return block of PostCard
// Currently it ends like this:
//   );
// };
//
// const CreatePostModal

feedContent = feedContent.replace(
    'return (\n    <div className="bg-surface-container rounded-3xl p-6 border border-white/5 relative flex flex-col hover:border-white/10 transition-colors">',
    'return (\n    <>\n    <div className="bg-surface-container rounded-3xl p-6 border border-white/5 relative flex flex-col hover:border-white/10 transition-colors">'
);

feedContent = feedContent.replace(
    /<\/div>\n  \);\n};\n\nconst CreatePostModal/m,
    `</div>\n      <ReportReasonModal \n        isOpen={isReportingPost}\n        onClose={() => setIsReportingPost(false)}\n        onSubmit={handleReportSubmit}\n      />\n      <ReportReasonModal \n        isOpen={!!reportingCommentId}\n        onClose={() => setReportingCommentId(null)}\n        onSubmit={handleReportCommentSubmit}\n      />\n    </>\n  );\n};\n\nconst CreatePostModal`
);

fs.writeFileSync('src/components/FeedView.tsx', feedContent);


let buddyContent = fs.readFileSync('src/components/BuddyView.tsx', 'utf8');

buddyContent = buddyContent.replace(
    'return (\n    <div className="bg-surface-container rounded-3xl p-6 border border-white/5 flex flex-col h-full hover:border-white/10 transition-colors relative group">',
    'return (\n    <>\n    <div className="bg-surface-container rounded-3xl p-6 border border-white/5 flex flex-col h-full hover:border-white/10 transition-colors relative group">'
);

buddyContent = buddyContent.replace(
    /<\/div>\n  \);\n};\n\nconst CreateEventModal/m,
    `</div>\n      <ReportReasonModal \n        isOpen={isReportingEvent}\n        onClose={() => setIsReportingEvent(false)}\n        onSubmit={handleReportSubmit}\n      />\n    </>\n  );\n};\n\nconst CreateEventModal`
);

fs.writeFileSync('src/components/BuddyView.tsx', buddyContent);
