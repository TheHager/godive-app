import React, { useState, useEffect } from "react";
import { Search, Users, Trophy, UserPlus, UserCheck, X, Loader2, Trash2, HeartPulse, Ship, Phone, Award, User as UserIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove, limit, getDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { View, UserProfile, UserPrivateInfo } from "../types";
import { ActionMenu } from "./ActionMenu";
import { calculateLevel, getRankInfo } from "../constants/ranks";
import { LeaderboardView } from "./LeaderboardView";

import { computeBadgesWithStats, BADGE_SCHEMA } from "../constants/badges";

export const FriendsView = ({ setView }: { setView: (v: View) => void }) => {
  const { profile, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [buddies, setBuddies] = useState<UserProfile[]>([]);
  const [isLoadingBuddies, setIsLoadingBuddies] = useState(true);
  const [selectedBuddyForProfile, setSelectedBuddyForProfile] = useState<UserProfile | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    const fetchBuddies = async () => {
      if (!profile?.friends || profile.friends.length === 0) {
        setBuddies([]);
        setIsLoadingBuddies(false);
        return;
      }

      try {
        const chunks = [];
        for (let i = 0; i < profile.friends.length; i += 10) {
          chunks.push(profile.friends.slice(i, i + 10));
        }

        const buddyPromises = chunks.map(chunk => 
          getDocs(query(collection(db, "users"), where("id", "in", chunk), limit(10)))
        );

        const snapshots = await Promise.all(buddyPromises);
        const buddyData = snapshots.flatMap(snap => snap.docs.map(doc => doc.data() as UserProfile));
        setBuddies(buddyData);
      } catch (err) {
        console.error("Error fetching buddies:", err);
      } finally {
        setIsLoadingBuddies(false);
      }
    };

    fetchBuddies();
  }, [profile?.friends]);

  const executeSearch = async (queryStr: string) => {
    if (!queryStr.trim()) return;

    setIsSearching(true);
    const q = queryStr.trim();
    const endRange = q + '\uf8ff';

    try {
      const queries = [
        query(collection(db, "users"), where("displayName", ">=", q), where("displayName", "<=", endRange), limit(10)),
        query(collection(db, "users"), where("email", ">=", q), where("email", "<=", endRange), limit(10)),
        query(collection(db, "users"), where("phoneNumber", ">=", q), where("phoneNumber", "<=", endRange), limit(10))
      ];
      
      const snapshots = await Promise.all(queries.map(getDocs));
      
      const resultsMap = new Map<string, UserProfile>();
      snapshots.forEach(snap => {
        snap.docs.forEach(doc => {
          const data = doc.data() as UserProfile;
          if (data.id !== profile?.id) {
            resultsMap.set(data.id, data);
          }
        });
      });
      
      setSearchResults(Array.from(resultsMap.values()));
    } catch (err) {
      console.error("Error searching users:", err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!showSearchModal) return;
    
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length >= 3) {
        executeSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, showSearchModal]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(searchQuery);
  };

  const toggleBuddy = async (targetUserId: string, isBuddy: boolean) => {
    if (!profile?.id) return;

    try {
      const userRef = doc(db, "users", profile.id);
      if (isBuddy) {
        await updateDoc(userRef, {
          friends: arrayRemove(targetUserId)
        });
      } else {
        await updateDoc(userRef, {
          friends: arrayUnion(targetUserId)
        });
      }
    } catch (err) {
      console.error("Error toggling buddy:", err);
    }
  };

  const handleRemoveBuddy = async (targetUserId: string) => {
    if (!profile?.id) return;
    
    setBuddies(prev => prev.filter(b => b.id !== targetUserId));

    try {
      const userRef = doc(db, "users", profile.id);
      await updateDoc(userRef, {
        friends: arrayRemove(targetUserId)
      });
    } catch (err) {
      console.error("Error removing buddy:", err);
    }
  };

  return (
    <div className="flex flex-col gap-12 p-6 w-full max-w-4xl mx-auto min-w-0 pb-32">
      <section>
        <h2 className="mb-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0b2240] whitespace-nowrap">Friends & Rankings</h2>
        <p className="text-lg font-medium text-[#475569] opacity-70">Connect with divers and see who is leading.</p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <button 
          onClick={() => setShowSearchModal(true)}
          className="flex-1 flex items-center justify-center gap-3 rounded-2xl bg-[#0055ff] py-4 px-6 font-black uppercase tracking-widest text-white shadow-[0_4px_14px_rgba(0,85,255,0.3)] transition-all hover:opacity-90 active:scale-95 group"
        >
          <Search size={20} className="text-white transition-transform group-hover:scale-110" />
          Find Buddies
        </button>
        <button 
          onClick={() => setShowLeaderboard(true)}
          className="flex-1 flex items-center justify-center gap-3 rounded-2xl bg-white py-4 px-6 font-black uppercase tracking-widest text-[#0055ff] shadow-sm hover:shadow-md transition-all active:scale-95 group"
        >
          <Trophy size={20} className="text-[#0055ff] transition-transform group-hover:scale-110" />
          Rankings
        </button>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-[#475569] mb-2">My Buddies ({buddies.length})</h3>
        
        {isLoadingBuddies ? (
          <div className="flex h-16 w-full items-center justify-center">
            <Loader2 size={24} className="animate-spin text-secondary" />
          </div>
        ) : buddies.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {buddies.map(buddy => (
              <div 
                key={buddy.id} 
                className="flex flex-col items-center gap-3 p-4 bg-white shadow-sm hover:shadow-md rounded-2xl cursor-pointer transition-all group"
                onClick={() => setSelectedBuddyForProfile(buddy)}
              >
                <div className="relative">
                  {buddy.photoURL ? (
                    <img 
                      src={buddy.photoURL} 
                      className="h-20 w-20 rounded-full border-2 border-secondary/20 object-cover shadow-xl transition-transform group-hover:scale-105" 
                      alt={buddy.displayName}
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-secondary/20 bg-surface/50 text-secondary shadow-xl transition-transform group-hover:scale-105">
                      <UserIcon size={40} />
                    </div>
                  )}
                </div>
                <div className="text-center w-full min-w-0 flex flex-col items-center gap-1">
                  <span className="text-xs font-black uppercase tracking-widest text-[#0b2240] truncate w-full">{buddy.displayName}</span>
                  <span className="text-[9px] font-bold text-[#475569] uppercase premium-glass px-2 py-0.5 rounded-full truncate w-full">
                    {getRankInfo(calculateLevel((buddy.points || 0) + (buddy.rankingPoints || 0))).title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center premium-glass rounded-[40px] border ">
            <Users size={48} className="text-[#083344] mb-4" />
            <h4 className="text-[#0b2240] font-black italic text-xl">No Buddies Yet</h4>
            <p className="text-[#083344] text-xs font-bold uppercase tracking-widest mt-2">Find divers and connect</p>
          </div>
        )}
      </section>

      <LeaderboardModal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} profile={profile} />

      <UserSearchModal 
        isOpen={showSearchModal} 
        onClose={() => {
          setShowSearchModal(false);
          setSearchResults([]);
          setIsSearching(false);
        }}
        results={searchResults}
        isSearching={isSearching}
        onToggleBuddy={toggleBuddy}
        friends={profile?.friends || []}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearch={handleSearch}
        onSelectUser={(user: UserProfile) => setSelectedBuddyForProfile(user)}
      />

      <UserProfileModal
        isOpen={!!selectedBuddyForProfile}
        onClose={() => setSelectedBuddyForProfile(null)}
        user={selectedBuddyForProfile}
        isBuddy={profile?.friends?.includes(selectedBuddyForProfile?.id || "") || false}
        onRemoveBuddy={handleRemoveBuddy}
      />
    </div>
  );
};

const LeaderboardModal = ({ isOpen, onClose, profile }: any) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-4xl h-full max-h-[90vh] rounded-[2.5rem] bg-white shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="absolute right-4 top-4 z-50">
              <button onClick={onClose} className="rounded-full bg-slate-100/80 hover:bg-slate-200 p-2 text-[#475569] transition-colors shadow-sm">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto w-full no-scrollbar">
               <LeaderboardView />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Reuse the modal components from BuddyView.tsx
const UserSearchModal = ({ isOpen, onClose, results, isSearching, onToggleBuddy, friends, searchQuery, setSearchQuery, onSearch, onSelectUser }: any) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg rounded-[2.5rem] bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 shrink-0">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-black italic tracking-tight text-[#0b2240]">Find Buddies</h3>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#475569]">Community Discovery</p>
                </div>
                <button onClick={onClose} className="rounded-full bg-slate-100/80 hover:bg-slate-200 p-2 text-[#475569] transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={onSearch} className="flex gap-2 rounded-2xl bg-white p-2 border border-slate-200 focus-within:ring-2 focus-within:ring-[#0055ff]/20 focus-within:border-[#0055ff] transition-all shadow-sm">
                <div className="flex flex-1 items-center gap-3 px-3 min-w-0">
                  <Search size={18} className="text-[#0055ff] shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, email, phone..."
                    className="premium-input w-full bg-transparent -none p-0 text-sm font-medium text-[#0b2240] placeholder:text-[#083344] -0 min-w-0 flex-1"
                  />
                </div>
                <button 
                  type="submit"
                  className="rounded-xl bg-[#0055ff] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_4px_14px_rgba(0,85,255,0.3)] transition-transform active:scale-95 disabled:opacity-50"
                  disabled={isSearching}
                >
                  {isSearching ? <Loader2 size={12} className="animate-spin" /> : "Search"}
                </button>
              </form>
            </div>

            <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="relative">
                     <Loader2 size={48} className="animate-spin text-[#0055ff]" />
                     <div className="absolute inset-0 blur-xl bg-[#0055ff]/20" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-[#0055ff] animate-pulse px-4 py-2 bg-[#0055ff]/10 rounded-full">Scanning Depths...</span>
                </div>
              ) : results.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#083344]">Possible Matches</span>
                    <span className="text-[10px] font-black text-secondary uppercase bg-secondary/10 px-2 py-0.5 rounded-full border border-secondary/20">{results.length} Found</span>
                  </div>
                  {results.map((user: UserProfile, index: number) => {
                    const isBuddy = friends.includes(user.id);
                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        key={user.id} 
                        onClick={() => onSelectUser && onSelectUser(user)}
                        className="flex items-center justify-between p-3 rounded-[2rem] bg-white border border-slate-100 shadow-sm group hover:shadow-md transition-all duration-300 mb-2 cursor-pointer"
                      >
                        <div className="flex items-center gap-4 ml-1 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            {user.photoURL ? (
                              <img 
                                src={user.photoURL} 
                                className="h-14 w-14 rounded-2xl border-2  shadow-2xl object-cover transition-transform group-hover:scale-105 duration-500" 
                                alt={user.displayName}
                              />
                            ) : (
                              <div className="flex h-14 w-14 rounded-2xl border-2  bg-surface/50 text-[#0055ff] shadow-2xl items-center justify-center transition-transform group-hover:scale-105 duration-500">
                                <UserIcon size={28} />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1 pr-2">
                            <span className="font-extrabold text-[#0b2240] group-hover:text-[#0055ff] transition-colors italic tracking-tight text-lg truncate pr-2 leading-tight">{user.displayName}</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#475569] truncate">
                              {getRankInfo(calculateLevel((user.points || 0) + (user.rankingPoints || 0))).title}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleBuddy(user.id, isBuddy);
                          }}
                          className={cn(
                            "flex items-center gap-2 rounded-full px-6 py-3 transition-all duration-300 font-black uppercase tracking-[0.2em] text-[9px] shrink-0 active:scale-95",
                            isBuddy 
                              ? "bg-[#0055ff]/10 text-[#0055ff] hover:bg-[#0055ff]/20" 
                              : "bg-[#0055ff] text-white shadow-[0_4px_14px_rgba(0,85,255,0.3)] hover:opacity-90"
                          )}
                        >
                          {isBuddy ? (
                            <>
                              <UserCheck size={14} className="text-[#0055ff]" />
                              <span className="hidden sm:inline">Buddy</span>
                              <span className="sm:hidden">OK</span>
                            </>
                          ) : (
                            <>
                              <UserPlus size={14} className="text-white" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                  <div className="rounded-full bg-[#0055ff]/10 p-6 text-[#0055ff]">
                    <Users size={48} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-[#0b2240]">No Divers Found</h4>
                    <p className="text-xs font-medium text-[#475569] mt-1 max-w-[200px] mx-auto opacity-60">Try searching for a different username, email, or phone number.</p>
                  </div>
                </div>
              )}
            </div>


          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const UserProfileModal = ({ isOpen, onClose, user, isBuddy, onRemoveBuddy }: { isOpen: boolean, onClose: () => void, user: UserProfile | null, isBuddy?: boolean, onRemoveBuddy?: (id: string) => void }) => {
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { profile: currentUser } = useAuth();
  const canViewPrivate = currentUser?.id === user?.id;

  useEffect(() => {
    const fetchPrivateInfo = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      try {
        const privateRef = doc(db, "users", user.id, "private", "info");
        const docSnap = await getDoc(privateRef);
        
        if (docSnap.exists()) {
          setPrivateInfo(docSnap.data() as UserPrivateInfo);
        } else {
          setPrivateInfo(null);
        }
      } catch (err) {
        console.error("Error fetching private info:", err);
        handleFirestoreError(err, OperationType.GET, `users/${user.id}/private/info`);
        setPrivateInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && user) {
      fetchPrivateInfo();
    }
  }, [isOpen, user]);

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm rounded-[2.5rem] bg-white shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
          >
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              <ActionMenu 
                items={[
                  ...(isBuddy && onRemoveBuddy ? [{ 
                    label: "Remove Friend", 
                    icon: <Trash2 size={16} />, 
                    onClick: () => { onRemoveBuddy(user.id); onClose(); }, 
                    destructive: true 
                  }] : [])
                ]}
              />
              <button 
                onClick={onClose} 
                className="p-2 rounded-full bg-slate-100/80 hover:bg-slate-200 text-[#475569] transition-colors"
              >
                <X size={16} className="text-[#0b2240]" />
              </button>
            </div>
            <div className="p-8 text-center flex flex-col items-center bg-gradient-to-b from-slate-50 to-white shrink-0">
              <div className="relative mb-4">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    className="h-24 w-24 rounded-3xl border-4 border-secondary/20 object-cover shadow-2xl" 
                  />
                ) : (
                  <div className="flex h-24 w-24 rounded-3xl border-4 border-secondary/20 bg-surface/50 text-secondary shadow-2xl items-center justify-center">
                    <UserIcon size={48} />
                  </div>
                )}
              </div>

              {((user.pinnedBadgeId && user.badgeStats) && (() => {
                  const b = computeBadgesWithStats(user.badgeStats!).find((bx: any) => bx.id === user.pinnedBadgeId);
                  if (b && b.earned) {
                    const BIcon = b.icon;
                    return (
                      <div className="flex items-center justify-center gap-2 mb-2 premium-glass pr-3 pl-1 py-1 rounded-full border ">
                        <div className="bg-[#0055ff]/20 text-[#0055ff] p-1.5 rounded-full">
                          <BIcon size={14} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#0055ff]">{b.label}</span>
                      </div>
                    );
                  }
                  return null;
              })())}

              <h3 className="text-2xl font-black italic tracking-tighter text-[#0b2240]">{user.displayName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#0055ff]">
                  {getRankInfo(calculateLevel((user.points || 0) + (user.rankingPoints || 0))).title}
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span className="text-[10px] font-bold text-[#475569] uppercase tracking-widest">
                  LVL {calculateLevel((user.points || 0) + (user.rankingPoints || 0))}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              <div className="space-y-4">
                {user.bio && (
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-1 mb-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-[#0b2240]">Bio</div>
                    <div className="text-xs font-medium text-[#475569] leading-relaxed italic">"{user.bio}"</div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#0b2240] mb-2">
                  <Ship size={12} />
                  Dive Stats
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-1 text-center">
                     <div className="text-[9px] font-black uppercase tracking-widest text-[#475569]">Total Dives</div>
                     <div className="text-xl font-black text-[#0b2240] italic">{user.divesCount || 0}</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-1 text-center">
                     <div className="text-[9px] font-black uppercase tracking-widest text-[#475569]">Exp. Points</div>
                     <div className="text-xl font-black text-[#0055ff] italic">{(user.points || 0) + (user.rankingPoints || 0)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#0b2240] mb-2 pt-2 border-t border-slate-100">
                  <Award size={12} />
                  Diving Certifications
                </div>
                <div className="flex flex-wrap gap-2">
                  {(user.certificates || []).length > 0 ? (
                    (user.certificates || []).map((cert: string) => (
                      <span key={cert} className="rounded-xl border border-[#0055ff]/20 bg-[#0055ff]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#0055ff] shadow-sm">
                        {cert}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs italic text-[#083344]">No certifications recorded</span>
                  )}
                </div>

                {user.badgeStats && (() => {
                  const earnedBadges = computeBadgesWithStats(user.badgeStats).filter((b: any) => b.earned);
                  if (earnedBadges.length > 0) {
                    return (
                      <>
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#0b2240] mb-2 pt-2 border-t border-slate-100">
                          <Trophy size={12} />
                          Earned Badges
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {earnedBadges.map((b: any) => {
                            const BIcon = b.icon;
                            return (
                              <div key={b.id} className="flex items-center gap-2 bg-white shadow-sm border border-slate-100 rounded-xl px-2.5 py-1.5" title={b.label}>
                                <BIcon size={14} className="text-[#0055ff]" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569]">{b.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  }
                  return null;
                })()}

                {canViewPrivate && (
                  <>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#0b2240] mb-2 pt-2 border-t border-slate-100">
                      <Phone size={12} />
                      Contact Info
                    </div>
                    <div className="space-y-3">

                      {isLoading ? (
                        <div className="h-10 flex items-center justify-center">
                          <Loader2 size={24} className="animate-spin text-[#0055ff]" />
                        </div>
                      ) : privateInfo?.phoneNumber && (
                        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-1">
                           <div className="text-[9px] font-black uppercase tracking-widest text-[#475569]">Phone Number</div>
                           <div className="text-sm font-bold text-[#0b2240]">{privateInfo.phoneNumber}</div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
