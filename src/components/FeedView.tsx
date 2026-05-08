import React, { useEffect, useState, useRef } from "react";
import { Heart, MessageSquare, MoreVertical, MapPin, Tag, Trophy, X as CloseIcon, Edit2, Trash2, Flag, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";
import { computeBadgesWithStats } from "../constants/badges";
import { useUser } from "../contexts/UserContext";
import { useAuth } from "../contexts/AuthContext";
import { collection, onSnapshot, query, orderBy, limit, doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, increment, serverTimestamp, addDoc, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { LeaderboardView } from "./LeaderboardView";

export const FeedView = ({ setView, onNavigateToEvent }: { setView: (v: any) => void, onNavigateToEvent: (id: string) => void }) => {
  const { pinnedBadgeId, badgeStats } = useUser();
  const { profile } = useAuth();
  const allBadges = computeBadgesWithStats(badgeStats);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "expeditions">("all");

  useEffect(() => {
    const q = query(
      collection(db, "posts"),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
        avatar: (doc.data() as any).userPhotoURL || `https://i.pravatar.cc/150?u=${doc.id}`,
        isCurrentUser: (doc.data() as any).userId === profile?.id
      }));
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, "posts");
    });

    return () => unsubscribe();
  }, [profile?.id]);

  const filteredPosts = activeFilter === "all" ? posts : posts.filter(p => p.eventId);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-secondary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 p-6 max-w-2xl mx-auto min-h-screen pb-32">
      <section className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="mb-1 text-4xl font-extrabold tracking-tight text-on-background whitespace-nowrap">Community Feed</h2>
            <p className="text-xs font-medium text-on-surface-variant/60">To post on the community feed, register a dive.</p>
          </div>
          <button 
            onClick={() => setShowLeaderboard(true)}
            className="fixed bottom-24 right-6 z-40 flex items-center gap-2 rounded-2xl bg-secondary px-5 py-4 text-on-secondary transition-all hover:bg-secondary/80 shadow-2xl shrink-0"
          >
            <Trophy size={20} className="fill-on-secondary/20" />
            <span className="font-black uppercase tracking-widest text-xs">Rankings</span>
          </button>
        </div>

        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-surface-container-high/20 border border-white/5 self-start">
          <button
            onClick={() => setActiveFilter("all")}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeFilter === "all" ? "bg-secondary text-on-secondary shadow-lg shadow-secondary/20" : "text-on-surface-variant/40 hover:text-on-surface hover:bg-white/5"
            )}
          >
            All Posts
          </button>
          <button
            onClick={() => setActiveFilter("expeditions")}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeFilter === "expeditions" ? "bg-secondary text-on-secondary shadow-lg shadow-secondary/20" : "text-on-surface-variant/40 hover:text-on-surface hover:bg-white/5"
            )}
          >
            Expeditions
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-12">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <p className="text-xl font-bold">No {activeFilter === "expeditions" ? "expeditions" : "posts"} shared yet.</p>
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


      <AnimatePresence>
        {showLeaderboard && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/90 backdrop-blur-md"
              onClick={() => setShowLeaderboard(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[2.5rem] bg-surface-container shadow-2xl border border-white/5 overflow-hidden"
            >
              <button 
                onClick={() => setShowLeaderboard(false)}
                className="absolute top-4 right-4 z-[60] flex items-center justify-center rounded-full bg-surface-container-highest p-3 text-on-surface hover:bg-white/10 transition-all border border-white/10 shadow-lg backdrop-blur-md hover:scale-110 active:scale-95"
              >
                <CloseIcon size={24} />
              </button>
              <div className="overflow-y-auto no-scrollbar pb-10">
                <LeaderboardView onParticipate={() => setShowLeaderboard(false)} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PostCard = ({ id, user, userId, location, content, image, avatar, likesCount, comments, tags, pinnedBadge, isCurrentUser, currentUserId, likedBy, reportsCount, reportedBy, timestamp, updatedAt, eventId, setView, onNavigateToEvent }: any) => {
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
        userPhotoURL: profile.photoURL || `https://i.pravatar.cc/150?u=${profile.id}`,
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

  const handleReportComment = async (comment: any) => {
    if (!currentUserId) return;
    try {
      const commentRef = doc(db, "posts", id, "comments", comment.id);
      const hasReportedComment = comment.reportedBy?.includes(currentUserId);
      
      if (hasReportedComment) {
        await updateDoc(commentRef, {
          reportedBy: arrayRemove(currentUserId),
          reportsCount: increment(-1)
        });
      } else {
        const newReportsCount = (comment.reportsCount || 0) + 1;
        
        if (newReportsCount >= 10) {
          await deleteDoc(commentRef);
          await updateDoc(doc(db, "posts", id), {
            commentsCount: increment(-1)
          });
        } else {
          await updateDoc(commentRef, {
            reportedBy: arrayUnion(currentUserId),
            reportsCount: increment(1)
          });
        }
      }
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

  const handleReport = async () => {
    if (!currentUserId) return;
    try {
      const postRef = doc(db, "posts", id);
      
      if (hasReported) {
        await updateDoc(postRef, {
          reportedBy: arrayRemove(currentUserId),
          reportsCount: increment(-1)
        });
      } else {
        const newReportsCount = (reportsCount || 0) + 1;
        
        if (newReportsCount >= 10) {
          await deleteDoc(postRef);
        } else {
          await updateDoc(postRef, {
            reportedBy: arrayUnion(currentUserId),
            reportsCount: increment(1)
          });
        }
      }
    } catch (error) {
      console.error("Error reporting post:", error);
    }
  };

  const formatDate = (time: any) => {
    if (!time) return "";
    try {
      const date = time?.toDate ? time.toDate() : new Date(time);
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    } catch {
      return "";
    }
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl bg-surface-container-high/20 backdrop-blur-3xl border border-white/5 shadow-2xl relative">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <img src={avatar} alt={user} className="h-12 w-12 rounded-full border border-white/10 object-cover shadow-lg" />
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
        
        <div className="relative" ref={optionsRef}>
          <button 
            onClick={() => setShowOptions(!showOptions)}
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-white/5"
          >
            <MoreVertical size={20} />
          </button>
          <AnimatePresence>
            {showOptions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                className="absolute right-0 top-full mt-2 w-32 rounded-2xl border border-white/10 bg-surface-container-highest p-2 shadow-xl backdrop-blur-xl z-10"
              >
                {isCurrentUser ? (
                  <>
                    <button 
                      onClick={() => { setIsEditing(true); setShowOptions(false); }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-white/5"
                    >
                      <Edit2 size={14} />
                      Edit
                    </button>
                    <button 
                      onClick={() => { handleDelete(); setShowOptions(false); }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-error transition-colors hover:bg-error/10"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => { handleReport(); setShowOptions(false); }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-error transition-colors hover:bg-error/10"
                  >
                    <Flag size={14} className={cn(hasReported && "fill-current")} />
                    {hasReported ? "Remove Report" : "Report"}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div 
        className="relative aspect-[4/3] w-full overflow-hidden bg-surface-container cursor-pointer"
        onClick={() => setShowFullImage(true)}
      >
        <img src={image} alt="Post" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
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
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={image} 
              alt="Full view" 
              className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl" 
            />
            <button 
              className="absolute top-6 right-6 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition-colors hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); setShowFullImage(false); }}
            >
              <CloseIcon size={24} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
                      <img src={comment.userPhotoURL} alt={comment.userDisplayName} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                      <div className="flex w-full flex-col">
                        <div className="flex justify-between items-start">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-black text-primary">{comment.userDisplayName}</span>
                            {comment.timestamp && (
                              <span className="text-[10px] text-on-surface-variant/60">{formatDate(comment.timestamp)}</span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                            {isCommentOwner ? (
                              <>
                                <button 
                                  onClick={() => { setEditingCommentId(comment.id); setEditedCommentContent(comment.content); }}
                                  className="p-1 text-on-surface-variant hover:text-secondary transition-colors"
                                  title="Edit comment"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="p-1 text-on-surface-variant hover:text-red-400 transition-colors"
                                  title="Delete comment"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            ) : (
                              <>
                                {isPostOwner && (
                                  <button 
                                    onClick={() => handleDeleteComment(comment.id)}
                                    className="p-1 text-on-surface-variant hover:text-red-400 transition-colors"
                                    title="Delete comment"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleReportComment(comment)}
                                  className={cn("p-1 transition-colors", hasReportedComment ? "text-red-500 hover:text-red-400" : "text-on-surface-variant hover:text-red-400")}
                                  title={hasReportedComment ? "Remove report" : "Report comment"}
                                >
                                  <Flag size={12} className={cn(hasReportedComment && "fill-current")} />
                                </button>
                              </>
                            )}
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
