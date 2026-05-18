const fs = require('fs');

let feedContent = fs.readFileSync('src/components/FeedView.tsx', 'utf8');

// I need to add <ReportReasonModal /> into the return block of PostCard
// In PostCard, the outermost element in the return statement needs to be a fragment.
feedContent = feedContent.replace(
    'return (\n    <div className="bg-surface-container rounded-3xl p-6 border border-white/5 relative flex flex-col hover:border-white/10 transition-colors">',
    'return (\n    <>\n    <div className="bg-surface-container rounded-3xl p-6 border border-white/5 relative flex flex-col hover:border-white/10 transition-colors">'
);

feedContent = feedContent.replace(
    /<\/div>\n  \);\n};\n\nconst CreatePostModal/m,
    `</div>\n      <ReportReasonModal \n        isOpen={isReportingPost}\n        onClose={() => setIsReportingPost(false)}\n        onSubmit={handleReportSubmit}\n      />\n      <ReportReasonModal \n        isOpen={!!reportingCommentId}\n        onClose={() => setReportingCommentId(null)}\n        onSubmit={handleReportCommentSubmit}\n      />\n    </>\n  );\n};\n\nconst CreatePostModal`
);

// Fix click propagation on ActionMenu button in FeedView
// (actually, the ActionMenu handles its own stopPropagation)
// Wait, the user asked to fix the specific ActionMenu item's onClick.
// We can just add it to handleReportAction instead.
feedContent = feedContent.replace(
    'const handleReportAction = () => {',
    'const handleReportAction = (e?: any) => {\n    if (e) { e.preventDefault(); e.stopPropagation(); }'
);
feedContent = feedContent.replace(
    'const handleReportCommentAction = (comment: any) => {',
    'const handleReportCommentAction = (comment: any, e?: any) => {\n    if (e) { e.preventDefault(); e.stopPropagation(); }'
);
feedContent = feedContent.replace(
    'onClick: () => handleReportCommentAction(comment)',
    'onClick: (e?: any) => handleReportCommentAction(comment, e)'
);

fs.writeFileSync('src/components/FeedView.tsx', feedContent);


let buddyContent = fs.readFileSync('src/components/BuddyView.tsx', 'utf8');

buddyContent = buddyContent.replace(
    'return (\n    <motion.div ',
    'return (\n    <>\n    <motion.div '
);

buddyContent = buddyContent.replace(
    /<\/motion.div>\n  \);\n};\n\nconst CreateEventModal/m,
    `</motion.div>\n      <ReportReasonModal \n        isOpen={isReportingEvent}\n        onClose={() => setIsReportingEvent(false)}\n        onSubmit={handleReportSubmit}\n      />\n    </>\n  );\n};\n\nconst CreateEventModal`
);

buddyContent = buddyContent.replace(
    'const handleReportAction = () => {',
    'const handleReportAction = (e?: any) => {\n    if (e) { e.preventDefault(); e.stopPropagation(); }'
);

fs.writeFileSync('src/components/BuddyView.tsx', buddyContent);


let reportModalContent = fs.readFileSync('src/components/ReportReasonModal.tsx', 'utf8');

reportModalContent = reportModalContent.replace(
    'className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"',
    'className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"'
);

fs.writeFileSync('src/components/ReportReasonModal.tsx', reportModalContent);
