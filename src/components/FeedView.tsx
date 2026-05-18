import { UserProfile } from "../types";
import React, { useEffect, useState, useRef } from "react";
import { Heart, MessageSquare, MoreVertical, MapPin, Tag, Trophy, X as CloseIcon, Edit2, Trash2, Flag, ArrowUpRight, Plus, Compass, Clock, Users, Settings, User as UserIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "../lib/utils";
import { computeBadgesWithStats } from "../constants/badges";
import { useUser } from "../contexts/UserContext";
import { useAuth } from "../contexts/AuthContext";
import { collection, onSnapshot, query, orderBy, limit, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, increment, serverTimestamp, addDoc, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ActionMenu } from "./ActionMenu";

export const FeedView = ({ setView, onNavigateToEvent }: { setView: (v: any) => void, onNavigateToEvent: (id: string) => void }) => {
  const { pinnedBadgeId, badgeStats } = useUser();
  const { profile } = useAuth();
  const allBadges = computeBadgesWithStats(badgeStats);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "expeditions" | "friends">("all");
  const [sortBy, setSortBy] = useState<"date" | "popular">("date");
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const sortField = sortBy === "popular" ? "likesCount" : "timestamp";
    const q = query(
      collection(db, "posts"),
      orderBy(sortField, "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Check for changes (new likes or comments)
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const data = change.doc.data();
          const oldData = change.oldIndex !== -1 && snapshot.docs[change.oldIndex] ? snapshot.docs[change.oldIndex].data() : null;

          if (data.userId === profile?.id) {
            // It's my post, check for new likes
            if (data.likesCount > (oldData?.likesCount || 0)) {

              setToastMessage("Someone liked your post!");
              setTimeout(() => setToastMessage(null), 3000);
            }
            if (data.commentsCount > (oldData?.commentsCount || 0)) {
              setToastMessage("Someone commented on your post!");
              setTimeout(() => setToastMessage(null), 3000);
            }
          }
        }
      });
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Mocking some data that might be missing in older docs or for variety
        likesCount: (doc.data() as any).likesCount || 0,
        likes: (doc.data() as any).likesCount?.toLocaleString() || "0",
        comments: (doc.data() as any).commentsCount?.toString() || "0",
        likedBy: (doc.data() as any).likedBy || [],
        reportsCount: (doc.data() as any).reportsCount || 0,
        reportedBy: (doc.data() as any).reportedBy || [],
        user: ((doc.data() as any).userId === profile?.id ? profile?.displayName : (doc.data() as any).userDisplayName) || "Explorer",
        avatar: (doc.data() as any).userPhotoURL,
        isCurrentUser: (doc.data() as any).userId === profile?.id
      }));
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, "posts");
    });

    return () => unsubscribe();
  }, [profile?.id, sortBy]);

  const filteredPosts = posts.filter(p => {
    if (activeFilter === "expeditions") return !!p.eventId;
    if (activeFilter === "friends") return p.userId === profile?.id || profile?.friends?.includes(p.userId);
    return true;
  });

  if (loading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-secondary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 p-6 max-w-2xl mx-auto min-h-[100dvh] pb-32">
      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface whitespace-nowrap">Community Feed</h2>
          </div>
          <div className="relative z-10 shrink-0 mr-4">
            <ActionMenu 
              triggerIcon={<Settings size={24} className="text-on-surface-variant" />}
              buttonClassName="hover:bg-white/10"
              items={[
                { label: "Type", isHeader: true },
                { label: "All Posts", icon: <Tag size={16} />, onClick: () => setActiveFilter("all"), active: activeFilter === "all" },
                { label: "Expeditions", icon: <Compass size={16} />, onClick: () => setActiveFilter("expeditions"), active: activeFilter === "expeditions" },
                { label: "Friends Only", icon: <Users size={16} />, onClick: () => setActiveFilter("friends"), active: activeFilter === "friends" },
                { isDivider: true },
                { label: "Sort By", isHeader: true },
                { label: "Recent", icon: <Clock size={16} />, onClick: () => setSortBy("date"), active: sortBy === "date" },
                { label: "Popular", icon: <Trophy size={16} />, onClick: () => setSortBy("popular"), active: sortBy === "popular" }
              ]}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-12">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <p className="text-xl font-bold">No {activeFilter === "expeditions" ? "expeditions" : activeFilter === "friends" ? "posts from friends" : "posts"} shared yet.</p>
            <p className="text-sm">Be the first to share your underwater voyage!</p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <PostCard 
              key={post.id} 
              {...post} 
              currentUserId={profile?.id}
              setView={setView}
              onNavigateToEvent={onNavigateToEvent}
              pinnedBadge={post.isCurrentUser && pinnedBadgeId ? allBadges.find(b => b.id === pinnedBadgeId) : null} 
            />
          ))
        )}
      </div>

      {profile?.id && (
        <button
          onClick={() => setShowCreatePostModal(true)}
          className="fixed bottom-24 right-6 sm:bottom-8 sm:right-8 z-40 flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-secondary text-on-secondary shadow-[0_0_40px_rgba(76,214,251,0.3)] transition-all hover:bg-secondary-container hover:scale-110 hover:-rotate-12 active:scale-95 border border-white/20"
          title="Create Post"
        >
          <Plus size={28} />
        </button>
      )}

      <CreatePostModal 
        isOpen={showCreatePostModal}
        onClose={() => setShowCreatePostModal(false)}
        profile={profile}
      />
    </div>
  );
};

const PostCard = ({ id, user, userId, location, title, content, image, avatar, likesCount, comments, tags, pinnedBadge, isCurrentUser, currentUserId, likedBy, reportsCount, reportedBy, timestamp, updatedAt, eventId, setView, onNavigateToEvent }: any) => {
  const { profile } = useAuth();
  const [showOptions, setShowOptions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedCommentContent, setEditedCommentContent] = useState("");
  const optionsRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!showComments) return;
    const q = query(
      collection(db, "posts", id, "comments"),
      orderBy("timestamp", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCommentsList(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `posts/${id}/comments`);
    });
    return () => unsubscribe();
  }, [id, showComments]);

  const handleAddComment = async () => {
    if (!commentText.trim() || !profile) return;
    try {
      await addDoc(collection(db, "posts", id, "comments"), {
        userId: profile.id,
        userDisplayName: profile.displayName || "Unknown Diver",
        userPhotoURL: profile.photoURL,
        content: commentText.trim(),
        timestamp: serverTimestamp(),
        reportsCount: 0,
        reportedBy: [],
        likesCount: 0,
        likedBy: []
      });
      await updateDoc(doc(db, "posts", id), {
        commentsCount: increment(1)
      });
      if (userId !== profile.id) {
        await updateDoc(doc(db, "users", profile.id), {
          rankingPoints: increment(1)
        });
      }
      setCommentText("");
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editedCommentContent.trim()) return;
    try {
      await updateDoc(doc(db, "posts", id, "comments", commentId), {
        content: editedCommentContent,
        timestamp: serverTimestamp() // Assuming edit updates timestamp as well, or we can just leave it as is if it violates Rules. Wait, rule says: `data.timestamp == request.time`. So we MUST update it
      });
      setEditingCommentId(null);
    } catch (error) {
      console.error("Error editing comment:", error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, "posts", id, "comments", commentId));
      await updateDoc(doc(db, "posts", id), {
        commentsCount: increment(-1)
      });
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const handleToggleCommentLike = async (comment: any) => {
    if (!currentUserId) return;
    try {
      const commentRef = doc(db, "posts", id, "comments", comment.id);
      const hasLikedComment = comment.likedBy?.includes(currentUserId);
      if (hasLikedComment) {
        await updateDoc(commentRef, {
          likedBy: arrayRemove(currentUserId),
          likesCount: increment(-1)
        });
        await updateDoc(doc(db, "users", currentUserId), {
          rankingPoints: increment(-1)
        });
      } else {
        await updateDoc(commentRef, {
          likedBy: arrayUnion(currentUserId),
          likesCount: increment(1)
        });
        await updateDoc(doc(db, "users", currentUserId), {
          rankingPoints: increment(1)
        });
      }
    } catch (error) {
      console.error("Error toggling comment like:", error);
    }
  };

  const handleReportCommentAction = (comment: any) => {
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
  };

  const hasLiked = likedBy?.includes(currentUserId);
  const hasReported = reportedBy?.includes(currentUserId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, "posts", id));
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await updateDoc(doc(db, "posts", id), { 
        content: editedContent,
        updatedAt: serverTimestamp()
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating post:", error);
    }
  };

  const handleToggleLike = async () => {
    if (!currentUserId) return;
    try {
      const postRef = doc(db, "posts", id);
      if (hasLiked) {
        await updateDoc(postRef, {
          likedBy: arrayRemove(currentUserId),
          likesCount: increment(-1)
        });
        await updateDoc(doc(db, "users", currentUserId), {
          rankingPoints: increment(-1)
        });
      } else {
        await updateDoc(postRef, {
          likedBy: arrayUnion(currentUserId),
          likesCount: increment(1)
        });
        await updateDoc(doc(db, "users", currentUserId), {
          rankingPoints: increment(1)
        });
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleReportAction = () => {
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
  };



  const isVideo = image?.startsWith("data:video");

  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl bg-surface-container-high/20 backdrop-blur-3xl border border-white/5 shadow-2xl relative">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {avatar ? (
            <img src={avatar} alt={user} className="h-12 w-12 shrink-0 rounded-full border border-white/10 object-cover shadow-lg" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface/50 text-secondary shadow-lg">
              <UserIcon size={24} />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-black tracking-tight text-primary">{user}</h4>
              {pinnedBadge && (
                <div 
                  className={cn("flex items-center justify-center p-1 rounded-full", `bg-${pinnedBadge.color}/20 text-${pinnedBadge.color}`)} 
                  title={`Pinned Badge: ${pinnedBadge.label}`}
                >
                  <pinnedBadge.icon size={12} className="text-primary" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
              <MapPin size={10} />
              {location?.replace(/\s*\(\s*GPS\s*\)\s*/i, '')}
            </div>
            {timestamp && (
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant/40 mt-0.5 font-medium">
                {formatDate(timestamp)}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <ActionMenu 
            items={(isCurrentUser || (profile as any)?.role === 'superadmin' || (profile as any)?.role === 'moderator' || profile?.email?.toLowerCase() === 'tobias.h.jensen@gmail.com') ? [
              { label: "Edit Post", icon: <Edit2 size={16} />, onClick: () => setIsEditing(true) },
              { label: "Delete Post", icon: <Trash2 size={16} />, onClick: handleDelete, destructive: true }
            ] : [
              { label: hasReported ? "Remove Report" : "Report Post", icon: <Flag size={16} className={cn(hasReported && "fill-current")} />, onClick: handleReportAction, destructive: true }
            ]}
          />
        </div>
      </div>

      {image && (
        <>
          <div 
            className="relative aspect-[4/3] w-full overflow-hidden bg-surface-container cursor-pointer"
            onClick={() => setShowFullImage(true)}
          >
            {isVideo ? (
              <video src={image} className="h-full w-full object-cover" controls playsInline />
            ) : (
              <img src={image} alt="Post" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            )}
          </div>

          <AnimatePresence>
            {showFullImage && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
                onClick={() => setShowFullImage(false)}
              >
                <div onClick={(e) => e.stopPropagation()} className="relative flex items-center justify-center h-full w-full">
                  <TransformWrapper
                    initialScale={1}
                    minScale={0.5}
                    maxScale={4}
                    centerOnInit={true}
                  >
                    <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                      {isVideo ? (
                        <motion.video 
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.9, opacity: 0 }}
                          src={image} 
                          controls
                          playsInline
                          className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl" 
                        />
                      ) : (
                        <motion.img 
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.9, opacity: 0 }}
                          src={image} 
                          alt="Full view" 
                          className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl cursor-grab active:cursor-grabbing" 
                        />
                      )}
                    </TransformComponent>
                  </TransformWrapper>
                </div>
                <button 
                  className="absolute top-6 right-6 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition-colors hover:bg-white/20"
                  onClick={(e) => { e.stopPropagation(); setShowFullImage(false); }}
                >
                  <CloseIcon size={24} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <div className="p-6">
        <div className="mb-6 flex gap-6">
          <button 
            onClick={handleToggleLike}
            className={cn(
              "flex items-center gap-2 font-black transition-colors group/btn",
              hasLiked ? "text-primary hover:text-primary/80" : "text-on-surface-variant hover:text-secondary"
            )}
          >
            <Heart size={24} className={cn(
              "transition-transform group-active/btn:scale-125",
              hasLiked && "fill-primary"
            )} />
            <span>{likesCount?.toLocaleString() || "0"}</span>
          </button>
          <button 
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-2 font-black text-on-surface-variant transition-colors hover:text-secondary"
          >
            <MessageSquare size={24} />
            <span>{comments}</span>
          </button>
        </div>

        {eventId && (
          <button 
            onClick={() => onNavigateToEvent(eventId)}
            className="flex items-center gap-2 rounded-xl bg-secondary/10 px-4 py-2.5 text-xs font-black text-secondary transition-all hover:bg-secondary/20 active:scale-95 mb-4"
          >
            <span>View Event</span>
            <ArrowUpRight size={14} />
          </button>
        )}

        {title && (
          <h3 className="text-xl font-bold text-on-surface mb-2">{title}</h3>
        )}

        {isEditing ? (
          <div className="mb-6 flex flex-col gap-2">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full resize-none rounded-xl border border-white/10 bg-surface-container p-3 text-sm text-on-surface outline-none focus:border-secondary"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => { setIsEditing(false); setEditedContent(content); }}
                className="rounded-xl px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                className="rounded-xl bg-secondary/20 px-4 py-2 text-xs font-black text-secondary hover:bg-secondary/30 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-on-surface mb-6">
            {content}
          </p>
        )}

        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-4 overflow-hidden border-t border-white/10 pt-4"
            >
              <div className="flex max-h-60 flex-col gap-4 overflow-y-auto no-scrollbar pb-2">
                {commentsList.map((comment) => {
                  const isCommentOwner = comment.userId === profile?.id;
                  const isPostOwner = isCurrentUser;
                  const hasReportedComment = comment.reportedBy?.includes(currentUserId);

                  return (
                    <div key={comment.id} className="group/comment flex gap-3">
                      {comment.userPhotoURL ? (
                        <img src={comment.userPhotoURL} alt={comment.userDisplayName} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface/50 text-secondary">
                          <UserIcon size={16} />
                        </div>
                      )}
                      <div className="flex w-full flex-col">
                        <div className="flex justify-between items-start">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-black text-primary">{comment.userDisplayName}</span>
                            {comment.timestamp && (
                              <span className="text-[10px] text-on-surface-variant/60">{formatDate(comment.timestamp)}</span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <ActionMenu
                              items={(isCommentOwner || (profile as any)?.role === 'superadmin' || (profile as any)?.role === 'moderator' || profile?.email?.toLowerCase() === 'tobias.h.jensen@gmail.com') ? [
                                { label: "Edit Comment", icon: <Edit2 size={16} />, onClick: () => { setEditingCommentId(comment.id); setEditedCommentContent(comment.content); } },
                                { label: "Delete Comment", icon: <Trash2 size={16} />, onClick: () => handleDeleteComment(comment.id), destructive: true }
                              ] : [
                                ...(isPostOwner ? [{ label: "Delete Comment", icon: <Trash2 size={16} />, onClick: () => handleDeleteComment(comment.id), destructive: true }] : []),
                                { label: hasReportedComment ? "Remove Report" : "Report Comment", icon: <Flag size={16} className={cn(hasReportedComment && "fill-current")} />, onClick: () => handleReportCommentAction(comment), destructive: true }
                              ]}
                            />
                          </div>
                        </div>

                        {editingCommentId === comment.id ? (
                          <div className="mt-1 flex flex-col gap-2">
                            <textarea
                              value={editedCommentContent}
                              onChange={(e) => setEditedCommentContent(e.target.value)}
                              className="w-full resize-none rounded-lg border border-white/10 bg-surface-container-high p-2 text-sm text-on-surface outline-none focus:border-secondary"
                              rows={2}
                            />
                            <div className="flex gap-2 justify-end">
                              <button 
                                onClick={() => { setEditingCommentId(null); setEditedCommentContent(""); }}
                                className="rounded-lg px-3 py-1 text-[10px] font-bold text-on-surface-variant hover:bg-white/5 transition-colors"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => handleEditComment(comment.id)}
                                className="rounded-lg bg-secondary/20 px-3 py-1 text-[10px] font-black text-secondary hover:bg-secondary/30 transition-colors"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 pr-8">
                            <p className="text-sm text-on-surface mt-0.5">{comment.content}</p>
                            <div className="flex items-center gap-4 mt-1">
                              <button 
                                onClick={() => handleToggleCommentLike(comment)}
                                className={cn("flex items-center gap-1.5 text-[10px] font-bold transition-colors", 
                                  comment.likedBy?.includes(currentUserId) ? "text-primary" : "text-on-surface-variant hover:text-white"
                                )}
                              >
                                <Heart size={12} className={cn(comment.likedBy?.includes(currentUserId) && "fill-current")} />
                                <span>{comment.likesCount || 0}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {commentsList.length === 0 && (
                  <div className="text-center text-sm text-on-surface-variant/60 py-4">No comments yet. Be the first!</div>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <input 
                  type="text" 
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  placeholder="Add a comment..." 
                  className="flex-1 rounded-xl border border-white/10 bg-surface-container-high px-4 py-2 text-sm text-on-surface outline-none focus:border-secondary"
                />
                <button 
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                  className="rounded-xl bg-secondary px-4 py-2 text-sm font-black text-on-secondary hover:bg-secondary/80 disabled:opacity-50 transition-colors"
                >
                  Post
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
};

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
}

const CreatePostModal = ({ isOpen, onClose, profile }: CreatePostModalProps) => {
  const { updateBadgeStats } = useUser();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setContent("");
      setTitle("");
      setImage("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!content.trim() || !title.trim() || !profile?.id) return;
    setIsSubmitting(true);
    try {
      const postData: any = {
        userId: profile?.id,
        userDisplayName: profile?.displayName || "Unknown Diver",
        userPhotoURL: profile?.photoURL,
        content: content.trim(),
        location: profile?.homeBase || "Ocean Explorer",
        timestamp: serverTimestamp(),
        likesCount: 0,
        likedBy: [],
        commentsCount: 0,
        tags: ["Community Post"],
        reportsCount: 0,
        reportedBy: []
      };
      
      if (title.trim()) postData.title = title.trim();
      if (image.trim()) postData.image = image.trim();

      await addDoc(collection(db, "posts"), postData);

      onClose();
    } catch (error) {
      console.error("Error creating post:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File must be smaller than 10MB to fit within database limits");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (file.type.startsWith('video/')) {
        setImage(event.target?.result as string);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIM = 800;

        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setImage(compressedDataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-4"
          >
            <div className="flex flex-col overflow-hidden rounded-3xl bg-surface-container border border-white/10 shadow-2xl max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-white/5 p-6 bg-surface-container-high/50 shrink-0">
                <h3 className="text-xl font-black tracking-tight text-on-surface">Create Post</h3>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-colors"
                >
                  <CloseIcon size={20} />
                </button>
              </div>
              <div className="flex flex-col gap-6 p-6 overflow-y-auto">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
                    Headline <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="E.g., Amazing dive at the Blue Hole!"
                    className="w-full rounded-2xl border-none bg-surface-container-highest/50 p-4 text-on-surface placeholder:text-outline/50 focus:ring-1 focus:ring-secondary/50 transition-all font-bold"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                    <MessageSquare size={14} />
                    What's on your mind?
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Share your diving stories, ask questions..."
                    className="w-full rounded-2xl border-none bg-surface-container-highest/50 p-4 text-on-surface placeholder:text-outline/50 focus:ring-1 focus:ring-secondary/50 transition-all resize-none min-h-[120px]"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
                    Photo or Video (Optional)
                  </label>
                  <label className="group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-surface-container-highest/50 p-6 text-on-surface-variant transition-colors hover:border-secondary hover:bg-white/5 hover:text-secondary">
                    <input 
                      type="file" 
                      accept="image/*,video/*" 
                      onChange={handleImageUpload} 
                      className="hidden" 
                    />
                    {image ? (
                      <div className="absolute inset-0 overflow-hidden rounded-2xl">
                        {image.startsWith('data:video') ? (
                          <video src={image} className="h-full w-full object-cover opacity-50 transition-opacity group-hover:opacity-30" autoPlay muted loop />
                        ) : (
                          <img src={image} alt="Preview" className="h-full w-full object-cover opacity-50 transition-opacity group-hover:opacity-30" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="font-bold text-white tracking-widest text-xs uppercase uppercase">Change Media</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-2 rounded-full bg-surface-container p-3 text-on-surface-variant group-hover:bg-secondary/20 group-hover:text-secondary transition-colors">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                        </div>
                        <span className="text-xs font-bold text-on-surface">Click to upload media</span>
                        <span className="mt-1 text-[10px] text-on-surface-variant/60">Max 700KB</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-white/5 p-6 bg-surface-container-high/50 shrink-0">
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !content.trim() || !title.trim()}
                  className="flex items-center gap-2 rounded-2xl bg-secondary px-8 py-3 text-[10px] font-black uppercase tracking-widest text-on-secondary shadow-[0_4px_15px_rgba(76,214,251,0.3)] transition-all hover:bg-secondary-container hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-on-secondary border-t-transparent" />
                  ) : (
                    "Post"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
