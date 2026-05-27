import React, { useState, useEffect } from "react";
import { Trophy, Star, User as UserIcon, Award, Upload, Image as ImageIcon, X, Heart, Medal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { useUser } from "../contexts/UserContext";
import { computeBadgesWithStats } from "../constants/badges";
import { RANKS, calculateLevel, getRankInfo } from "../constants/ranks";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "../lib/firebase";

interface LeaderboardViewProps {
  onParticipate?: () => void;
}

export const LeaderboardView = ({ onParticipate }: LeaderboardViewProps) => {
  const [viewMode, setViewMode] = useState<"global" | "friends">("global");
  const [rankings, setRankings] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const { profile } = useAuth();
  const { pinnedBadgeId, badgeStats } = useUser();
  const allBadges = computeBadgesWithStats(badgeStats);
  const pinnedBadge = pinnedBadgeId ? allBadges.find(b => b.id === pinnedBadgeId) : null;

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        const usersSnapshot = await getDocs(query(collection(db, "users"), limit(100)));
        const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

        const postsSnapshot = await getDocs(query(collection(db, "posts"), limit(1000)));
        const postsData = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

        const likesPerUser: Record<string, number> = {};
        
        const commentPromises = postsData.map(async (post) => {
          if (!likesPerUser[post.userId]) likesPerUser[post.userId] = 0;
          likesPerUser[post.userId] += (post.likesCount || 0);

          try {
            const commentsSnapshot = await getDocs(collection(db, "posts", post.id, "comments"));
            return { postId: post.id, snapshot: commentsSnapshot };
          } catch (e) {
            console.error("Error fetching comments for post", post.id, e);
            return null;
          }
        });

        const commentsResults = await Promise.all(commentPromises);

        for (const result of commentsResults) {
          if (!result || !result.snapshot) continue;

          result.snapshot.forEach(commentDoc => {
             const cData = commentDoc.data();
             if (!likesPerUser[cData.userId]) likesPerUser[cData.userId] = 0;
             likesPerUser[cData.userId] += (cData.likesCount || 0);
          });
        }

        const calculatedRankings = usersData.map(u => {
           const xp = u.points || 0;
           const likes = likesPerUser[u.id] || 0;
           const rankingPoints = u.rankingPoints || 0;
           const totalPoints = xp + likes + rankingPoints;
           
           const level = calculateLevel(totalPoints);
           const rankInfo = getRankInfo(level);
           
           return {
             userId: u.id,
             name: u.displayName || "Explorer",
             points: totalPoints,
             badge: rankInfo.title,
             photo: u.photoURL || null,
             hasPinnedBadge: false,
             userDocument: u
           };
        });

        calculatedRankings.sort((a, b) => b.points - a.points);

        setRankings(calculatedRankings);
      } catch (err) {
        console.error("Error fetching rankings:", err);
      }
    };
    fetchRankings();
  }, []);

  return (
    <div className="flex flex-col gap-6 sm:gap-10 p-4 sm:p-6 pt-16 sm:pt-6 max-w-4xl mx-auto">
      <section className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between border-b  pb-4 gap-4 sm:gap-2">
          <div>
            <h3 className="text-2xl font-extrabold tracking-tight text-[#0b2240]">{viewMode === "global" ? "Global Rankings" : "Friends Rankings"}</h3>
            <p className="text-xs font-medium text-[#475569] uppercase tracking-widest mt-1">Top Deep Divers</p>
          </div>
          <div className="flex gap-1 rounded-full premium-glass p-1 border   self-stretch sm:self-auto">
            <button 
              onClick={() => setViewMode("friends")}
              className={cn("flex-1 sm:flex-none rounded-full px-5 py-2 text-xs font-bold transition-colors", viewMode === "friends" ? "bg-[#0055ff]/20 text-[#0055ff] border border-[#0055ff]/30 shadow-lg" : "text-[#475569] hover:text-[#0b2240] hover:premium-glass")}
            >
              Friends
            </button>
            <button 
              onClick={() => setViewMode("global")}
              className={cn("flex-1 sm:flex-none rounded-full px-6 py-2 text-xs font-black shadow-lg", viewMode === "global" ? "bg-[#0055ff]/20 text-[#0055ff] border border-[#0055ff]/30" : "text-[#475569] hover:text-[#0b2240] hover:premium-glass border border-transparent")}
            >
              Global
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="relative">
            <div className="absolute left-10 sm:left-12 top-10 bottom-10 w-px premium-glass -z-10 hidden sm:block" />
            <div className="flex flex-col gap-3">
              {(viewMode === "global" ? rankings : rankings.filter(r => r.userId === profile?.id || profile?.friends?.includes(r.userId))).map((rank, index) => {
                const rankPos = index + 1;
                return (
                <motion.div 
                  key={rank.userId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setSelectedUser(rank)}
                  className={cn(
                    "group flex items-center gap-2 sm:gap-6 rounded-3xl p-2 sm:p-4 transition-all border shadow-lg  cursor-pointer overflow-hidden",
                    rankPos === 1 ? "bg-tertiary/10 border-tertiary/30 hover:border-tertiary/50" : 
                    rankPos === 2 ? "premium-glass  hover:" :
                    rankPos === 3 ? "premium-glass  hover:" :
                    "premium-glass-low/30 border-transparent hover:premium-glass hover:"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-2xl font-black italic text-lg sm:text-xl shadow-inner shrink-0",
                    rankPos === 1 ? "bg-tertiary text-on-tertiary shadow-[inset_0_0_20px_rgba(255,255,255,0.5)]" : 
                    rankPos === 2 ? "premium-glass text-[#0b2240] shadow-[inset_0_0_10px_rgba(255,255,255,0.1)]" :
                    rankPos === 3 ? "premium-glass-highest text-[#475569]" :
                    "text-[#083344]"
                  )}>
                    {rankPos}
                  </div>
                  <div className="relative shrink-0">
                    {rank.photo ? (
                      <img src={rank.photo} alt={rank.name} className={cn(
                        "h-10 w-10 sm:h-16 sm:w-16 rounded-full object-cover shadow-xl",
                        rankPos === 1 ? "border-4 border-tertiary shadow-tertiary/20" : "border-2 "
                      )} />
                    ) : (
                      <div className={cn(
                        "h-10 w-10 sm:h-16 sm:w-16 rounded-full flex items-center justify-center premium-glass shadow-xl overflow-hidden",
                        rankPos === 1 ? "border-4 border-tertiary shadow-tertiary/20" : "border-2 "
                      )}>
                        <UserIcon size={32} className="text-secondary" />
                      </div>
                    )}
                    {rankPos === 1 && (
                      <div className="absolute -bottom-2 -right-2 rounded-full bg-tertiary p-1.5 shadow-lg border-2 border-background">
                        <Trophy size={14} className="text-on-tertiary" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col min-w-0">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="font-black tracking-tight text-[#0b2240] text-base sm:text-lg group-hover:text-[#0055ff] transition-colors truncate">{rank.name}</span>
                      {rank.hasPinnedBadge && pinnedBadge && (
                        <div 
                          className={cn("flex items-center justify-center p-1 rounded-full", `bg-${pinnedBadge.color}/20 text-${pinnedBadge.color}`)} 
                          title={`Pinned Badge: ${pinnedBadge.label}`}
                        >
                          <pinnedBadge.icon size={12} className="text-[#0055ff]" />
                        </div>
                      )}
                    </div>
                    <span className={cn(
                      "mt-1 w-fit rounded-lg px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest border",
                      rankPos === 1 ? "bg-tertiary border-tertiary text-on-tertiary shadow-lg shadow-tertiary/20" : " premium-glass text-[#475569]"
                    )}>
                      {rank.badge}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn(
                      "block text-lg sm:text-2xl font-black italic leading-none drop-shadow-md",
                      rankPos === 1 ? "text-tertiary" : "text-[#0055ff]"
                    )}>
                      {rank.points.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-[#475569] tracking-widest">points</span>
                  </div>
                </motion.div>
              )})}
            </div>
          </div>
          
          <div className="my-2 flex justify-center opacity-20">
            <Star size={12} className="fill-current" />
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.02 }}
            className="group relative flex items-center gap-2 sm:gap-6 overflow-hidden rounded-3xl bg-gradient-to-r from-secondary/20 via-background to-secondary/5 p-2 sm:p-4 border border-secondary/30 shadow-[0_0_30px_rgba(76,214,251,0.15)]  cursor-pointer mt-2"
          >
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-secondary shadow-[0_0_15px_rgba(76,214,251,0.5)]" />
            <div className="flex flex-1 items-center gap-2 sm:gap-6 ml-1 sm:ml-2">
              <div className="flex h-8 w-8 sm:h-12 sm:w-12 shrink-0 items-center justify-center font-black italic text-lg sm:text-xl text-secondary">
                {profile ? (rankings.findIndex(r => r.userId === profile.id) >= 0 ? rankings.findIndex(r => r.userId === profile.id) + 1 : "--") : "--"}
              </div>
              <div className="relative shrink-0">
                <div className="h-10 w-10 sm:h-16 sm:w-16 rounded-full border-4 border-secondary premium-glass flex items-center justify-center overflow-hidden shadow-xl shadow-secondary/20">
                  {profile?.photoURL ? (
                    <img src={profile.photoURL} alt={profile.displayName || ""} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={20} className="text-secondary" />
                  )}
                </div>
              </div>
              <div className="flex flex-1 flex-col min-w-0">
                <span className="font-black tracking-tight text-secondary text-base sm:text-lg truncate">{profile?.displayName || "Explorer"}</span>
                <span className="mt-1 w-fit rounded-lg px-2 sm:px-2.5 py-0.5 text-[8px] sm:text-[9px] font-black uppercase tracking-widest border border-secondary bg-secondary text-on-secondary shadow-lg">
                  {profile ? (rankings.find(r => r.userId === profile.id)?.badge || "Common Log") : "Common Log"}
                </span>
              </div>
              <div className="text-right pr-2 shrink-0">
                <span className="block text-lg sm:text-2xl font-black italic leading-none text-secondary drop-shadow-md">
                  {(profile ? (rankings.find(r => r.userId === profile.id)?.points || profile.points || 0) : 0).toLocaleString()}
                </span>
                <span className="text-[10px] font-bold uppercase text-[#083344] tracking-widest">points</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <PublicProfileModal 
        isOpen={!!selectedUser} 
        onClose={() => setSelectedUser(null)} 
        user={selectedUser?.userDocument} 
      />

    </div>
  );
};

const PublicProfileModal = ({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: any }) => {
  return (
    <AnimatePresence>
      {isOpen && user && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 "
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg overflow-hidden rounded-[2rem] premium-glass shadow-2xl border  flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between border-b  p-6 premium-glass-highest shrink-0">
              <h3 className="text-xl font-black italic tracking-tighter text-[#0b2240]">Explorer Profile</h3>
              <button onClick={onClose} className="rounded-full p-2 text-[#0b2240] hover:premium-glass transition-colors premium-glass border  shadow-md">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto no-scrollbar p-6 flex-1">
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-6 p-6 rounded-3xl premium-glass border  shadow-inner">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="h-24 w-24 rounded-full object-cover shadow-2xl border-4 border-surface-container ring-2 ring-white/10" />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full premium-glass-low shadow-inner border-2  ring-1 ring-white/10">
                      <UserIcon size={40} className="text-secondary" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1 min-w-0">
                    <h3 className="text-2xl font-black tracking-tight text-[#0b2240] truncate">{user.displayName || "Unknown Explorer"}</h3>
                    <div className="text-xs font-bold uppercase tracking-widest text-[#0055ff] flex items-center gap-2">
                       {user.rank || "Apprentice Diver"}
                    </div>
                    {((user.pinnedBadgeId && user.badgeStats) && (() => {
                        const b = computeBadgesWithStats(user.badgeStats!).find((bx: any) => bx.id === user.pinnedBadgeId);
                        if (b && b.earned) {
                          const BIcon = b.icon;
                          return (
                            <div className="mt-2 text-[#0055ff] flex items-center gap-2">
                              <BIcon size={14} className="text-secondary" />
                              <span className="text-[10px] font-black uppercase tracking-wider">{b.label}</span>
                            </div>
                          );
                        }
                        return null;
                    })())}
                  </div>
                </div>
                
                {user.bio && (
                  <div className="premium-glass rounded-2xl p-4 border  shadow-sm">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#475569] mb-2 flex items-center gap-2"><UserIcon size={12}/> Biography</h4>
                    <p className="text-sm font-medium text-[#0b2240] whitespace-pre-wrap">{user.bio}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="premium-glass rounded-2xl p-4 border  space-y-1 text-center shadow-sm">
                     <div className="text-[9px] font-black uppercase tracking-widest text-[#083344]">Total Dives</div>
                     <div className="text-xl font-black text-[#0b2240] italic">{user.divesCount || 0}</div>
                  </div>
                  <div className="premium-glass rounded-2xl p-4 border  space-y-1 text-center shadow-sm">
                     <div className="text-[9px] font-black uppercase tracking-widest text-[#083344]">Exp. Points</div>
                     <div className="text-xl font-black text-secondary italic">{(user.points || 0) + (user.rankingPoints || 0)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#083344] mb-2 pt-2 border-t ">
                  <Award size={12} />
                  Diving Certifications
                </div>
                <div className="flex flex-wrap gap-2">
                  {(user.certificates || user.certifications || []).length > 0 ? (
                    (user.certificates || user.certifications).map((cert: string) => (
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
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#083344] mb-2 pt-2 border-t ">
                          <Trophy size={12} />
                          Earned Badges
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {earnedBadges.map((b: any) => {
                            const BIcon = b.icon;
                            return (
                              <div key={b.id} className="flex items-center gap-2 premium-glass border  rounded-xl px-2.5 py-1.5" title={b.label}>
                                <BIcon size={14} className="text-secondary" />
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

                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#083344] mb-2 pt-2 border-t ">
                   <UserIcon size={12} />
                   Bio
                </div>
                <div>
                   <p className="text-sm font-medium leading-relaxed text-[#475569] premium-glass rounded-2xl p-5 border  shadow-inner min-h-[80px]">
                     {user.bio || "This explorer is a person of few words, letting their dives speak for themselves."}
                   </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
