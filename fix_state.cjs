const fs = require('fs');

let feedContent = fs.readFileSync('src/components/FeedView.tsx', 'utf8');

// Add the state variables to PostCard
feedContent = feedContent.replace(
    'const [isEditing, setIsEditing] = useState(false);',
    'const [isEditing, setIsEditing] = useState(false);\n  const [isReportingPost, setIsReportingPost] = useState(false);'
);

// We also need to add it to FeedView because my previous patch failed to do it right,
// let's just make sure it's inside PostCard where it is needed.

fs.writeFileSync('src/components/FeedView.tsx', feedContent);

let buddyContent = fs.readFileSync('src/components/BuddyView.tsx', 'utf8');

buddyContent = buddyContent.replace(
    'const [isJoining, setIsJoining] = useState(false);',
    'const [isJoining, setIsJoining] = useState(false);\n  const [isReportingEvent, setIsReportingEvent] = useState(false);'
);

fs.writeFileSync('src/components/BuddyView.tsx', buddyContent);
