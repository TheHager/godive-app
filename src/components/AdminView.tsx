import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { collection, query, where, getDocs, doc, updateDoc, collectionGroup, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ShieldAlert, Search, RefreshCw, UserCheck, ArrowLeft, Trash2, XCircle, Flag, Eye, X } from "lucide-react";
import { UserProfile, View } from "../types";
import { cn } from "../lib/utils";

export interface ReportedItem {
  id: string;
  type: "Post" | "Event" | "Comment";
  reason: string;
  reportsCount: number;
  reportedBy: string[];
  contentPreview: string;
  path: string; // Used to delete the correct document
  authorId: string;
  originalData?: any;
}




export const ReportedContentDetailModal = ({ item, onClose }: { item: ReportedItem, onClose: () => void }) => {
  const [reporterNames, setReporterNames] = useState<Record<string, string>>({});
  const [likedByNames, setLikedByNames] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<any[]>([]);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchLikedByNames = async () => {
      if (!item.originalData?.likedBy || !Array.isArray(item.originalData.likedBy) || item.originalData.likedBy.length === 0) return;

      const names: Record<string, string> = {};
      await Promise.all(
        item.originalData.likedBy.map(async (uid: string) => {
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
      setLikedByNames(names);
    };

    fetchLikedByNames();
  }, [item.originalData?.likedBy]);

  useEffect(() => {
    const fetchComments = async () => {
      if (!item.id || !item.type) return;

      try {
        let collectionName = "";
        if (item.type === "Post") collectionName = "posts";
        else if (item.type === "Event") collectionName = "events";

        if (collectionName) {
           const commentsQ = query(collection(db, collectionName, item.id, "comments"));
           const commentsSnap = await getDocs(commentsQ);
           const fetchedComments = commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
           // Sort by timestamp descending
           fetchedComments.sort((a: any, b: any) => {
             const timeA = a.timestamp?.seconds || 0;
             const timeB = b.timestamp?.seconds || 0;
             return timeB - timeA;
           });
           setComments(fetchedComments);
        }
      } catch (e) {
        console.error("Error fetching comments for reported item", e);
      }
    };

    fetchComments();
  }, [item.id, item.type]);

  const renderValue = (key: string, value: any): React.ReactNode => {
    if (value === null || value === undefined) return <span className="text-[#475569] italic">Not provided</span>;
    if (typeof value === 'boolean') return value ? "Yes" : "No";

    // Handle Profile Images (userPhotoUrl, photoURL)
    const lowerKey = key.toLowerCase();
    const isProfilePic = lowerKey === 'userphotourl' || lowerKey === 'photourl';
    if (typeof value === 'string' && value.startsWith('http') && isProfilePic) {
        return <img src={value} alt="User Profile" onClick={() => setEnlargedImage(value)} className="w-12 h-12 rounded-full object-cover border  cursor-pointer hover:opacity-80 transition-opacity" title="Click to enlarge" />;
    }

    // Handle Images
    const isImageKey = lowerKey.includes('image') || lowerKey.includes('photo');
    if (typeof value === 'string' && (value.startsWith('data:image/') || (value.startsWith('http') && isImageKey))) {
        return <img src={value} alt="Reported content" onClick={() => setEnlargedImage(value)} className="w-full max-h-64 object-contain rounded-md mt-2 premium-glass cursor-pointer hover:opacity-90 transition-opacity" title="Click to enlarge" />;
    }

    // Handle Clickable Links
    if (typeof value === 'string' && value.startsWith('http')) {
        return <a href={value} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline break-all">{value}</a>;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return <span className="text-[#0b2240] break-words">{value}</span>;
    }

    // Handle Arrays (Chips)
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-[#475569] italic">None</span>;

      // Special handling for likedBy
      if (key === 'likedBy') {
        return (
          <div className="flex flex-wrap gap-2 mt-1">
            {value.map((uid, i) => (
              <span key={i} className="px-2 py-1 premium-glass border  rounded-md text-xs font-mono break-all" title={String(uid)}>
                {likedByNames[String(uid)] || String(uid)}
              </span>
            ))}
          </div>
        );
      }

      return (
        <div className="flex flex-wrap gap-2 mt-1">
          {value.map((v, i) => (
            <span key={i} className="px-2 py-1 premium-glass border  rounded-md text-xs font-mono break-all">
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
      return <pre className="text-xs font-mono text-[#475569] premium-glass p-2 rounded-lg mt-1 overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>;
    }
    return String(value);
  };

  const getFilteredData = () => {
    if (!item.originalData) return null;
    // Ensure we exclude eventId as requested, along with authorId and path which are in original data sometimes
    const { id, userId, hostId, reported, reportsCount, reportedBy, authorId, eventId, documentPath, reportDetails, ...rest } = item.originalData;
    return rest;
  };

  const filteredData = getFilteredData();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm ">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col premium-glass rounded-[2rem] border  shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b  premium-glass">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#0b2240]">Reported Content Details</h2>
            <div className="flex gap-2 mt-1">
              <span className="text-xs font-bold uppercase tracking-widest text-error bg-error/10 border border-error/20 px-2 py-0.5 rounded-md">
                {item.type}
              </span>
              <span className="text-xs font-medium text-[#475569] flex items-center gap-1">
                <Flag size={12} className="text-error" /> {item.reportsCount} report(s)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full premium-glass hover:premium-glass text-[#475569] hover:text-[#0b2240] transition-colors border "
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#475569]">Reported By</h3>
              <div className="premium-glass p-3 rounded-xl border ">
                {item.reportedBy && item.reportedBy.length > 0 ? (
                  <ul className="list-disc pl-5 text-sm space-y-1 text-[#0b2240]">
                    {item.reportedBy.map((userId, idx) => (
                      <li key={idx} className="break-all flex flex-col mb-2">
                        <span className="font-bold">{reporterNames[userId] || userId}</span>
                        {item.originalData?.reportDetails?.find((r: any) => r.uid === userId)?.reason && (
                          <span className="text-xs text-[#475569] italic mt-0.5 border-l-2  pl-2">
                            "{item.originalData.reportDetails.find((r: any) => r.uid === userId).reason}"
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-sm text-[#475569] italic">No reporters recorded</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#475569]">Content Data</h3>
              <div className="premium-glass p-4 rounded-xl border ">
                {!filteredData || Object.keys(filteredData).length === 0 ? (
                   <div className="text-sm text-[#475569] italic">No content available</div>
                ) : (
                   <div className="flex flex-col gap-4">
                     {Object.entries(filteredData).map(([key, value]) => (
                       <div key={key} className="flex flex-col gap-1 border-b  pb-3 last:border-0 last:pb-0">

                         {/* Display actual comments above commentsCount */}
                         {key === 'commentsCount' && comments.length > 0 && (
                           <div className="mb-4 space-y-2">
                             <span className="text-[10px] font-bold uppercase tracking-widest text-[#475569]">Actual Comments ({comments.length})</span>
                             <div className="mt-2 pl-3 border-l-2  space-y-2">
                               {comments.map((comment) => (
                                 <div key={comment.id} className="premium-glass p-2 rounded-lg text-xs">
                                   <div className="flex items-center gap-2 mb-1">
                                     {comment.userPhotoURL ? (
                                        <img src={comment.userPhotoURL} alt="" className="w-4 h-4 rounded-full object-cover cursor-pointer" onClick={() => setEnlargedImage(comment.userPhotoURL)} />
                                     ) : (
                                        <div className="w-4 h-4 rounded-full premium-glass flex items-center justify-center"><UserCheck size={8} /></div>
                                     )}
                                     <span className="font-bold">{comment.userDisplayName || 'Unknown'}</span>
                                     {comment.timestamp && <span className="text-[9px] text-[#475569]">{new Date(comment.timestamp.seconds * 1000).toLocaleString()}</span>}
                                   </div>
                                   <p className="text-[#0b2240]">{comment.content}</p>
                                 </div>
                               ))}
                             </div>
                           </div>
                         )}

                         <span className="text-[10px] font-bold uppercase tracking-widest text-[#475569]">{key}</span>
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

      {enlargedImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm  cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-5xl max-h-screen">
            <button
              className="absolute -top-12 right-0 p-2 text-[#083344] hover:text-[#083344] transition-colors premium-glass rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                setEnlargedImage(null);
              }}
            >
              <X size={24} />
            </button>
            <img
              src={enlargedImage}
              alt="Enlarged view"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminView = ({ setView }: { setView?: (v: View) => void }) => {
  const { user, profile } = useAuth();
  const [emailSearch, setEmailSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [pendingSites, setPendingSites] = useState<any[]>([]);
  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [reportedItems, setReportedItems] = useState<ReportedItem[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [selectedReportedItem, setSelectedReportedItem] = useState<ReportedItem | null>(null);

  const isAdmin = user?.email?.toLowerCase() === "tobias.h.jensen@gmail.com" || user?.email?.toLowerCase() === "tobiashagerjensen1992@gmail.com";
  const hasAccess = isAdmin || profile?.role === "superadmin" || profile?.role === "moderator";
  if (!hasAccess) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-[#0b2240] p-6 text-center">
        <ShieldAlert size={64} className="text-error mb-4" />
        <h1 className="text-3xl font-black uppercase tracking-widest">Access Denied</h1>
        <p className="mt-2 text-[#475569] font-medium">You do not have permission to view this page.</p>
      </div>
    );
  }

  const fetchReports = async () => {
    setIsLoadingReports(true);
    try {
      const items: ReportedItem[] = [];

      // Fetch reported posts
      const postsQ = query(collection(db, "posts"), where("reported", "==", true));
      const postsSnap = await getDocs(postsQ);
      postsSnap.forEach(doc => {
        const data = doc.data();
        items.push({
          id: doc.id,
          type: "Post",
          reason: "User reports",
          reportsCount: data.reportsCount || 0,
          reportedBy: data.reportedBy || [],
          contentPreview: data.content || "(No content)",
          path: `posts/${doc.id}`,
          authorId: data.userId || "",
          originalData: data
        });
      });

      // Fetch reported events
      const eventsQ = query(collection(db, "events"), where("reported", "==", true));
      const eventsSnap = await getDocs(eventsQ);
      eventsSnap.forEach(doc => {
        const data = doc.data();
        items.push({
          id: doc.id,
          type: "Event",
          reason: "User reports",
          reportsCount: data.reportsCount || 0,
          reportedBy: data.reportedBy || [],
          contentPreview: data.title || "(No title)",
          path: `events/${doc.id}`,
          authorId: data.hostId || "",
          originalData: data
        });
      });

      // Fetch reported comments using collectionGroup
      try {
        const commentsQ = query(collectionGroup(db, "comments"), where("reported", "==", true));
        const commentsSnap = await getDocs(commentsQ);
        commentsSnap.forEach(docSnap => {
          const data = docSnap.data();
          items.push({
            id: docSnap.id,
            type: "Comment",
            reason: "User reports",
            reportsCount: data.reportsCount || 0,
            reportedBy: data.reportedBy || [],
            contentPreview: data.content || "(No content)",
            path: docSnap.ref.path, // e.g. posts/123/comments/456
            authorId: data.userId || "",
            originalData: data
          });
        });
      } catch (e) {
        console.warn("Could not fetch reported comments via collectionGroup (likely missing index or permissions).", e);
      }

      setReportedItems(items.sort((a, b) => b.reportsCount - a.reportsCount));
    } catch (e) {
      console.error("Error fetching reports", e);
    } finally {
      setIsLoadingReports(false);
    }
  };

  React.useEffect(() => {
    if (hasAccess) {
      fetchPendingSites();
      fetchReports();
    }
  }, [hasAccess]);

  const fetchPendingSites = async () => {
    setIsLoadingSites(true);
    try {
      const q = query(collection(db, "dive_sites"), where("status", "==", "unverified"));
      const snapshot = await getDocs(q);
      const sites = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPendingSites(sites);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSites(false);
    }
  };

  const handleUpdateSiteStatus = async (siteId: string, status: "verified" | "rejected") => {
    try {
      if (status === "rejected") {
        await updateDoc(doc(db, "dive_sites", siteId), { status: "rejected" });
      } else {
        await updateDoc(doc(db, "dive_sites", siteId), { status: "verified" });
      }
      setPendingSites(prev => prev.filter(s => s.id !== siteId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDismissReport = async (item: ReportedItem) => {
    try {
      await updateDoc(doc(db, item.path), {
        reported: false,
        reportsCount: 0,
        reportedBy: []
      });
      setReportedItems(prev => prev.filter(i => i.path !== item.path));
      setMessage({ type: 'success', text: `Dismissed report for ${item.type}.` });
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: "Failed to dismiss report." });
    }
  };

  const handleDeleteReportedContent = async (item: ReportedItem) => {
    if (!confirm(`Are you sure you want to delete this ${item.type}? This action cannot be undone.`)) return;

    try {
      await deleteDoc(doc(db, item.path));
      setReportedItems(prev => prev.filter(i => i.path !== item.path));
      setMessage({ type: 'success', text: `Deleted ${item.type} successfully.` });
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: "Failed to delete content." });
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSearch.trim()) return;

    setIsSearching(true);
    setMessage(null);
    setFoundUser(null);

    try {
      const q = query(collection(db, "users"), where("email", "==", emailSearch.trim().toLowerCase()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setMessage({ type: 'error', text: "No user found with that email address." });
      } else {
        const userData = snap.docs[0].data() as UserProfile;
        setFoundUser(userData);
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: "An error occurred while searching." });
    } finally {
      setIsSearching(false);
    }
  };

  const handleUpdateRole = async (role: "user" | "moderator") => {
    if (!foundUser) return;
    setIsUpdating(true);
    setMessage(null);

    try {
      const userRef = doc(db, "users", foundUser.id);
      await updateDoc(userRef, {
        role: role
      });
      setFoundUser(prev => prev ? { ...prev, role } as any : null);
      setMessage({ type: 'success', text: `Successfully updated ${foundUser.email} to ${role.toUpperCase()}.` });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: "Failed to update user's role. Check permissions." });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateTier = async (tier: "free" | "premium" | "vip") => {
    if (!foundUser) return;
    setIsUpdating(true);
    setMessage(null);

    try {
      const userRef = doc(db, "users", foundUser.id);
      await updateDoc(userRef, {
        subscriptionTier: tier
      });
      setFoundUser(prev => prev ? { ...prev, subscriptionTier: tier } as UserProfile : null);
      setMessage({ type: 'success', text: `Successfully updated ${foundUser.email} to ${tier.toUpperCase()} tier.` });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: "Failed to update user's subscription tier. Check permissions." });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
    <div className="mx-auto max-w-4xl p-6 relative">
      {setView && (
        <button 
          onClick={() => setView('profile')}
          className="absolute left-6 top-6 flex items-center justify-center p-3 rounded-2xl premium-glass hover:premium-glass transition-colors z-10"
        >
          <ArrowLeft size={20} className="text-[#0b2240]" />
        </button>
      )}

      <div className="mb-10 text-center mt-4">
        <h2 className="text-4xl font-black italic tracking-tighter text-[#0b2240]">Admin <span className="text-secondary">Dashboard</span></h2>
        <p className="font-bold text-xs uppercase tracking-widest text-[#083344] mt-2">Manage User Subscriptions</p>
      </div>

      <div className="rounded-[40px] premium-glass border  p-8 shadow-xl">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-secondary" size={20} />
            <input 
              type="text" 
              placeholder="Search user by email address..."
              value={emailSearch}
              onChange={(e) => setEmailSearch(e.target.value)}
              className="premium-input w-full rounded-2xl   -white/10 px-6 py-4 pl-14 text-sm font-bold text-[#0b2240]  focus:-secondary -1  placeholder:text-[#083344]"
            />
          </div>
          <button 
            type="submit" 
            disabled={isSearching || !emailSearch.trim()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-secondary px-8 py-4 text-xs font-black uppercase tracking-widest text-on-secondary hover:bg-secondary-container disabled:opacity-50 transition-all font-bold"
          >
            {isSearching ? <RefreshCw size={18} className="animate-spin" /> : <span>Find User</span>}
          </button>
        </form>

        {message && (
          <div className={cn("mb-8 p-4 rounded-2xl border text-sm font-bold text-center", message.type === 'error' ? "bg-error/10 border-error/20 text-error" : "bg-[#0055ff]/10 border-[#0055ff]/20 text-[#0055ff]")}>
            {message.text}
          </div>
        )}

        {foundUser && (
          <div className="rounded-3xl premium-glass border  p-6 flex flex-col md:flex-row items-center gap-8">
            <div className="flex items-center gap-4 flex-1">
              {foundUser.photoURL ? (
                <img src={foundUser.photoURL} alt="" className="w-16 h-16 rounded-2xl border-2  object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-2xl premium-glass flex items-center justify-center text-[#475569]">
                  <UserCheck size={32} />
                </div>
              )}
              <div>
                <h3 className="text-xl font-black text-[#0b2240]">{foundUser.displayName || 'Unnamed User'}</h3>
                <p className="text-sm font-medium text-[#475569]">{foundUser.email}</p>
                <div className="mt-2 text-xs font-bold uppercase tracking-widest px-3 py-1 premium-glass rounded-lg border  inline-block text-secondary">
                  Current Tier: {foundUser.subscriptionTier || 'Free'}
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              {(["free", "premium", "vip"] as const).map(tier => (
                <button
                  key={tier}
                  onClick={() => handleUpdateTier(tier)}
                  disabled={isUpdating || foundUser.subscriptionTier === tier || (!foundUser.subscriptionTier && tier === 'free')}
                  className="rounded-2xl premium-glass border  px-6 py-3 text-xs font-black uppercase tracking-widest text-[#0b2240] hover:premium-glass hover:border-secondary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Set to {tier}
                </button>
              ))}
            </div>

            {isAdmin && (
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto mt-4 pt-4 border-t ">
                {(["user", "moderator"] as const).map(role => (
                  <button
                    key={role}
                    onClick={() => handleUpdateRole(role)}
                    disabled={isUpdating || (foundUser as any).role === role || (!(foundUser as any).role && role === 'user')}
                    className="rounded-2xl premium-glass border  px-6 py-3 text-xs font-black uppercase tracking-widest text-[#0b2240] hover:premium-glass hover:border-tertiary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Make {role}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>


          <div className="mt-12 max-w-xl mx-auto w-full mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold tracking-tight">Reported Content</h2>
              <button
                onClick={fetchReports}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full premium-glass hover:premium-glass transition-colors text-xs font-medium"
              >
                <RefreshCw size={14} className={cn(isLoadingReports && "animate-spin")} />
                Refresh
              </button>
            </div>

            {reportedItems.length === 0 ? (
              <div className="p-8 text-center text-[#475569] premium-glass rounded-3xl border ">
                No reported content. Good job!
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {reportedItems.map(item => (
                  <div key={item.path} className="premium-glass p-4 rounded-2xl border border-error/20 flex flex-col gap-4">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-error/10 text-error rounded text-[10px] font-bold uppercase tracking-widest border border-error/20">
                            {item.type}
                          </span>
                          <span className="text-xs text-[#475569] flex items-center gap-1">
                            <Flag size={12} className="text-error" /> {item.reportsCount} report(s)
                          </span>
                        </div>
                        <p className="text-sm text-[#0b2240] mt-2 font-medium line-clamp-3">"{item.contentPreview}"</p>
                        <div className="text-[10px] text-[#475569] mt-2 uppercase tracking-widest font-bold">
                          Author ID: {item.authorId}
                        </div>
                      </div>
                    </div>
                                        <div className="flex gap-2 pt-3 border-t  justify-end mt-auto flex-wrap">
                      <button
                        onClick={() => { console.log('Button clicked', item); setSelectedReportedItem(item); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-secondary/10 text-secondary border border-secondary/20 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-secondary/20 transition-colors"
                      >
                        <Eye size={14} />
                        View Details
                      </button>
                      <button
                        onClick={() => handleDismissReport(item)}
                        className="flex items-center gap-1.5 px-4 py-2 premium-glass hover:premium-glass text-[#0b2240] border  rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
                      >
                        <XCircle size={14} />
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleDeleteReportedContent(item)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-error/20 text-error border border-error/30 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-error/30 transition-colors"
                      >
                        <Trash2 size={14} />
                        Delete Content
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-12 max-w-xl mx-auto w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold tracking-tight">Pending Dive Sites</h2>
              <button
                onClick={fetchPendingSites}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full premium-glass hover:premium-glass transition-colors text-xs font-medium"
              >
                <RefreshCw size={14} className={cn(isLoadingSites && "animate-spin")} />
                Refresh
              </button>
            </div>

            {pendingSites.length === 0 ? (
              <div className="p-8 text-center text-[#475569] premium-glass rounded-3xl border ">
                No pending dive sites to moderate.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {pendingSites.map(site => (
                  <div key={site.id} className="premium-glass p-4 rounded-2xl border  flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="font-bold">{site.name}</div>
                      <div className="text-xs text-[#475569] flex gap-2 mt-1">
                        <span>Lat: {site.lat}</span>
                        <span>Lng: {site.lng}</span>
                        <span>By: {site.userId}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleUpdateSiteStatus(site.id, "verified")}
                        className="px-4 py-2 bg-[#0055ff]/20 text-[#0055ff] border border-[#0055ff]/30 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#0055ff]/30"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleUpdateSiteStatus(site.id, "rejected")}
                        className="px-4 py-2 bg-error/20 text-error border border-error/30 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-error/30"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>


        </div>
    {selectedReportedItem && (
      <ReportedContentDetailModal
        item={selectedReportedItem}
        onClose={() => setSelectedReportedItem(null)}
      />
    )}
    </>
  );
};
