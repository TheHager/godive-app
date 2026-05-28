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

          // We intentionally skip querying the "comments" subcollection for every post 
          // because it causes thousands of database reads (e.g. 1.1 million reads leak).
          // We rely only on post likes and pre-calculated ranking points.
        });

        await Promise.all(commentPromises);

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
        <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between pb-4 gap-4 sm:gap-2">
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
                      "group flex items-center gap-2 sm:gap-6 rounded-3xl p-2 sm:p-4 transition-all bg-white shadow-sm hover:shadow-md cursor-pointer overflow-hidden mb-2",
                      rankPos === 1 ? "border-2 border-[#0055ff] scale-[1.02] shadow-[0_8px_30px_rgba(0,85,255,0.25)] z-10" : "border border-slate-100"
                    )}
                  >
                    <div className={cn(
                      "flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-2xl font-black italic text-lg sm:text-xl shrink-0 border border-slate-100",
                      rankPos === 1 ? "bg-[#0055ff] text-white border-transparent" :
                        rankPos === 2 ? "bg-slate-50 text-[#0b2240]" :
                          rankPos === 3 ? "bg-slate-50 text-[#475569]" :
                            "bg-slate-50 text-[#475569]"
                    )}>
                      {rankPos}
                    </div>
                    <div className="relative shrink-0">
                      {rank.photo ? (
                        <img src={rank.photo} alt={rank.name} className={cn(
                          "h-10 w-10 sm:h-16 sm:w-16 rounded-full object-cover shadow-sm",
                          rankPos === 1 ? "border-2 border-[#0055ff] shadow-md" : "border-2 border-slate-100"
                        )} />
                      ) : (
                        <div className={cn(
                          "h-10 w-10 sm:h-16 sm:w-16 rounded-full flex items-center justify-center bg-slate-50 shadow-sm overflow-hidden",
                          rankPos === 1 ? "border-2 border-[#0055ff] shadow-md" : "border-2 border-slate-100"
                        )}>
                          <UserIcon size={32} className="text-[#0055ff]" />
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
                        "mt-1 w-fit rounded-lg px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest border border-slate-100 bg-slate-50",
                        rankPos === 1 ? "bg-[#0055ff]/10 border-[#0055ff]/20 text-[#0055ff] shadow-sm" : "text-[#475569]"
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
                )
              })}
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
            className="group relative flex items-center gap-2 sm:gap-6 overflow-hidden rounded-3xl bg-[#F4F8FF] p-2 sm:p-4 border-2 border-[#0055ff]/30 shadow-md cursor-pointer mt-2"
          >
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
                <span className="mt-1 w-fit rounded-lg px-2 sm:px-2.5 py-0.5 text-[8px] sm:text-[9px] font-black uppercase tracking-widest border border-[#0055ff]/20 bg-[#0055ff]/10 text-[#0055ff] shadow-sm">
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
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-6 shrink-0">
              <h3 className="text-xl font-black italic tracking-tighter text-[#0b2240]">Explorer Profile</h3>
              <button onClick={onClose} className="rounded-full bg-slate-100/80 hover:bg-slate-200 p-2 text-[#475569] transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto no-scrollbar p-6 flex-1">
              <div className="flex flex-col gap-6">
                <div className="flex items-center gap-6 p-6 rounded-3xl bg-white border border-slate-100 shadow-sm">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="h-24 w-24 rounded-full object-cover shadow-md border-2 border-slate-100" />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-50 border-2 border-slate-100 shadow-sm">
                      <UserIcon size={40} className="text-[#0055ff]" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1 min-w-0">
                    <h3 className="text-2xl font-black tracking-tight text-[#0b2240] truncate">{user.displayName || "Unknown Explorer"}</h3>
                    <div className="text-xs font-bold uppercase tracking-widest text-[#0055ff] flex items-center gap-2">
                      {getRankInfo(calculateLevel((user.points || 0) + (user.rankingPoints || 0))).title}
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


                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-1 text-center shadow-sm">
                    <div className="text-[9px] font-black uppercase tracking-widest text-[#475569]">Total Dives</div>
                    <div className="text-xl font-black text-[#0b2240] italic">{user.divesCount || 0}</div>
                  </div>
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 space-y-1 text-center shadow-sm">
                    <div className="text-[9px] font-black uppercase tracking-widest text-[#475569]">Exp. Points</div>
                    <div className="text-xl font-black text-[#0055ff] italic">{(user.points || 0) + (user.rankingPoints || 0)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#0b2240] mb-2 pt-4">
                  <Award size={12} className="text-[#475569]" />
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
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#0b2240] mb-2 pt-4">
                          <Trophy size={12} className="text-[#475569]" />
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

                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#0b2240] mb-2 pt-4">
                  <UserIcon size={12} className="text-[#475569]" />
                  Bio
                </div>
                <div>
                  <p className="text-sm font-medium leading-relaxed text-[#475569] bg-white rounded-2xl p-5 border border-slate-100 shadow-sm min-h-[80px]">
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
