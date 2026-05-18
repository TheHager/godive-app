const fs = require('fs');

let content = fs.readFileSync('src/components/FeedView.tsx', 'utf8');

content = content.replace(
    'import React, { useState, useEffect } from "react";',
    'import React, { useState, useEffect } from "react";\nimport { ReportReasonModal } from "./ReportReasonModal";'
);

content = content.replace(
    'const [isCommenting, setIsCommenting] = useState(false);',
    'const [isCommenting, setIsCommenting] = useState(false);\n  const [reportingPostId, setReportingPostId] = useState<string | null>(null);\n  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);'
);

// We need to inject the logic into PostCard.
// The PostCard component definition:
// const PostCard = ({ post, currentUserId, profile, onEdit }: { post: Post, currentUserId: string | undefined, profile: UserProfile | null, onEdit: (post: Post) => void }) => {
content = content.replace(
    'const [isCommenting, setIsCommenting] = useState(false);',
    'const [isCommenting, setIsCommenting] = useState(false);\n  const [isReportingPost, setIsReportingPost] = useState(false);\n  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null);'
);


// Replace the handleReportComment function
content = content.replace(
    /const handleReportComment = async \(comment: any\) => \{[\s\S]*?\}\s*else\s*\{[\s\S]*?\}\s*\};/m,
    `const handleReportCommentAction = (comment: any) => {
    if (!currentUserId) return;
    const hasReportedComment = comment.reportedBy?.includes(currentUserId);
    if (hasReportedComment) {
      // Just remove report directly
      handleRemoveCommentReport(comment);
    } else {
      setReportingCommentId(comment.id);
    }
  };

  const handleRemoveCommentReport = async (comment: any) => {
    try {
      const commentRef = doc(db, "posts", id, "comments", comment.id);
      const reportsCount = comment.reportsCount || 0;
      await updateDoc(commentRef, {
        reportedBy: arrayRemove(currentUserId),
        reportsCount: increment(-1),
        reported: reportsCount <= 1 ? false : true
      });
    } catch (error) {
      console.error("Error removing comment report:", error);
    }
  };

  const handleReportCommentSubmit = async (reason: string) => {
    if (!currentUserId || !reportingCommentId) return;
    try {
      const commentRef = doc(db, "posts", id, "comments", reportingCommentId);
      // We need to find the actual comment object to get current reportsCount
      const comment = comments.find(c => c.id === reportingCommentId);
      const currentCount = comment?.reportsCount || 0;

      await updateDoc(commentRef, {
        reportedBy: arrayUnion(currentUserId),
        reportDetails: arrayUnion({ uid: currentUserId, reason, timestamp: new Date().toISOString() }),
        reportsCount: increment(1),
        reported: true
      });
      setReportingCommentId(null);
    } catch (error) {
      console.error("Error reporting comment:", error);
    }
  };`
);


// Replace handleReport
content = content.replace(
    /const handleReport = async \(\) => \{[\s\S]*?\}\s*else\s*\{[\s\S]*?\}\s*\};/m,
    `const handleReportAction = () => {
    if (!currentUserId) return;
    if (hasReported) {
      handleRemovePostReport();
    } else {
      setIsReportingPost(true);
    }
  };

  const handleRemovePostReport = async () => {
    try {
      const postRef = doc(db, "posts", id);
      await updateDoc(postRef, {
        reportedBy: arrayRemove(currentUserId),
        reportsCount: increment(-1),
        reported: (reportsCount && reportsCount <= 1) ? false : true
      });
    } catch (error) {
      console.error("Error removing post report:", error);
    }
  };

  const handleReportSubmit = async (reason: string) => {
    if (!currentUserId) return;
    try {
      const postRef = doc(db, "posts", id);
      await updateDoc(postRef, {
        reportedBy: arrayUnion(currentUserId),
        reportDetails: arrayUnion({ uid: currentUserId, reason, timestamp: new Date().toISOString() }),
        reportsCount: increment(1),
        reported: true
      });
      setIsReportingPost(false);
    } catch (error) {
      console.error("Error reporting post:", error);
    }
  };`
);

// Update ActionMenu calls
content = content.replace(
    'onClick: handleReport',
    'onClick: handleReportAction'
);

content = content.replace(
    'onClick: () => handleReportComment(comment)',
    'onClick: () => handleReportCommentAction(comment)'
);

// Inject Modals into PostCard return
content = content.replace(
    'return (\n    <div className="bg-surface-container rounded-3xl p-6 border border-white/5 relative flex flex-col hover:border-white/10 transition-colors">',
    'return (\n    <>\n    <div className="bg-surface-container rounded-3xl p-6 border border-white/5 relative flex flex-col hover:border-white/10 transition-colors">'
);

content = content.replace(
    /<\/div>\n  \);\n};\n\nconst CreatePostModal/m,
    `</div>
      <ReportReasonModal
        isOpen={isReportingPost}
        onClose={() => setIsReportingPost(false)}
        onSubmit={handleReportSubmit}
      />
      <ReportReasonModal
        isOpen={!!reportingCommentId}
        onClose={() => setReportingCommentId(null)}
        onSubmit={handleReportCommentSubmit}
      />
    </>
  );
};

const CreatePostModal`
);


fs.writeFileSync('src/components/FeedView.tsx', content);
