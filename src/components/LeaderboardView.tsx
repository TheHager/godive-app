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

const WEEKLY_CHALLENGES = [
  {
    title: "Upload a Manta Ray",
    description: "Capture the elegance of the wings of the ocean. Snap a verified photo of a Manta Ray to complete the challenge. Top 3 entries get a badge and extra points! Others earn points based on upvotes.",
    points: 1000,
    badge: "Manta Master Badge",
    image: "https://placehold.co/1200x800/0ea5e9/ffffff?text=Manta+Ray"
  },
  {
    title: "Upload a Whale Shark",
    description: "Document the gentle giants of the deep. Successful verification of a Rhincodon typus grants exclusive badges and a 1000pt multiplier for the top 3.",
    points: 1000,
    badge: "Ocean Giant Badge",
    image: "https://placehold.co/1200x800/0369a1/ffffff?text=Whale+Shark"
  },
  {
    title: "Upload a Great White Shark",
    description: "Encounter the apex predator of the ocean. Prove your bravery with a Great White sighting to earn a massive point reward.",
    points: 1500,
    badge: "Apex Predator Badge",
    image: "https://placehold.co/1200x800/075985/ffffff?text=Great+White+Shark"
  },
  {
    title: "Upload a Green Sea Turtle",
    description: "Spot a grazing Green Sea Turtle during your dive. Ensure location tracking is on to help conservation efforts.",
    points: 1000,
    badge: "Turtle Tracker Badge",
    image: "https://placehold.co/1200x800/0f766e/ffffff?text=Green+Sea+Turtle"
  },
  {
    title: "Upload an Octopus",
    description: "Find the masters of camouflage. Spotting a wild Octopus hidden among the rocks grants you 1000pts for the top 3.",
    points: 1000,
    badge: "Ninja of the Sea",
    image: "https://placehold.co/1200x800/6d28d9/ffffff?text=Octopus"
  },
  {
    title: "Upload a Nudibranch",
    description: "Macro-photography time! Find one of these colorful sea slugs and share a crisp picture.",
    points: 1000,
    badge: "Macro Explorer Badge",
    image: "https://placehold.co/1200x800/be185d/ffffff?text=Nudibranch"
  },
  {
    title: "Upload a Humpback Whale",
    description: "A breathtaking encounter. Documenting a Humpback Whale will earn you 1500pts and legendary status.",
    points: 1500,
    badge: "Song of the Sea",
    image: "https://placehold.co/1200x800/1d4ed8/ffffff?text=Humpback+Whale"
  },
  {
    title: "Upload a Seahorse",
    description: "Spot the tiny, graceful seahorse clinging to seagrass or coral. Extra points for pinpoint accuracy.",
    points: 1000,
    badge: "Equestrian of the Deep",
    image: "https://placehold.co/1200x800/b45309/ffffff?text=Seahorse"
  },
  {
    title: "Upload a Hammerhead Shark",
    description: "Join the elite by logging a Hammerhead Shark sighting. Highly prized verification data for researchers.",
    points: 1500,
    badge: "Hammer Time Badge",
    image: "https://placehold.co/1200x800/374151/ffffff?text=Hammerhead+Shark"
  },
  {
    title: "Upload a Clownfish",
    description: "Find Nemo! Spot a Clownfish in its anemone home to secure a quick point boost for the community event.",
    points: 1000,
    badge: "Anemone Friend",
    image: "https://placehold.co/1200x800/c2410c/ffffff?text=Clownfish"
  }
];

export const LeaderboardView = ({ onParticipate }: LeaderboardViewProps) => {
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [viewMode, setViewMode] = useState<"global" | "friends">("global");
  const [rankings, setRankings] = useState<any[]>([]);
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
        
        for (const post of postsData) {
          if (!likesPerUser[post.userId]) likesPerUser[post.userId] = 0;
          likesPerUser[post.userId] += (post.likesCount || 0);

          try {
            const commentsSnapshot = await getDocs(collection(db, "posts", post.id, "comments"));
            commentsSnapshot.forEach(commentDoc => {
               const cData = commentDoc.data();
               if (!likesPerUser[cData.userId]) likesPerUser[cData.userId] = 0;
               likesPerUser[cData.userId] += (cData.likesCount || 0);
            });
          } catch (e) {
            console.error("Error fetching comments for post", post.id, e);
          }
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
             hasPinnedBadge: false
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

  // We can use a weekly index to cycle through the challenges, defaulting to 0 for the preview
  const currentChallenge = WEEKLY_CHALLENGES[0];

  return (
    <div className="flex flex-col gap-6 sm:gap-10 p-4 sm:p-6 pt-16 sm:pt-6 max-w-4xl mx-auto">
      {/* Weekly Challenge Section */}
      <section className="flex flex-col gap-4">
        <div className="group relative min-h-[460px] overflow-hidden rounded-3xl border border-white/5 shadow-2xl transition-all hover:scale-[1.01]">
          <div className="absolute top-6 right-6 z-20 flex flex-col items-end gap-2">
            <span className="rounded-full bg-background/80 border border-secondary/30 px-4 py-2 text-xs font-bold text-secondary backdrop-blur-md shadow-lg">Ends in 6d 12h</span>
          </div>
          <img 
            src={currentChallenge.image} 
            alt="" 
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-black/30 pointer-events-none" />
          
          <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-8 gap-4 mt-20">
            <h3 className="text-4xl sm:text-5xl font-black italic tracking-tighter text-primary drop-shadow-lg">{currentChallenge.title}</h3>
            <p className="max-w-xl text-md sm:text-lg font-medium text-on-surface-variant leading-relaxed">
              {currentChallenge.description}
            </p>
            
            <div className="flex flex-wrap gap-3 mt-2">
              <div className="flex bg-surface-container-high/80 backdrop-blur-md rounded-xl px-4 py-2 gap-2 text-primary items-center border border-primary/20 shadow-lg">
                <Medal size={18} />
                <span className="font-black">Top 3: {currentChallenge.badge} + {currentChallenge.points} pts</span>
              </div>
              <div className="flex bg-surface-container-high/80 backdrop-blur-md rounded-xl px-4 py-2 gap-2 text-tertiary items-center border border-tertiary/20 shadow-lg">
                <Heart size={18} className="fill-tertiary" />
                <span className="font-bold">Others: 10 pts per upvote</span>
              </div>
            </div>

            <button 
              onClick={() => setShowChallengeModal(true)}
              className="mt-4 w-fit rounded-xl bg-gradient-to-r from-secondary to-primary px-8 py-3.5 font-black uppercase tracking-widest text-on-primary shadow-xl shadow-secondary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Participate Now
            </button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center items-start justify-between border-b border-white/5 pb-4 gap-4 sm:gap-2">
          <div>
            <h3 className="text-2xl font-extrabold tracking-tight text-on-surface">{viewMode === "global" ? "Global Rankings" : "Friends Rankings"}</h3>
            <p className="text-xs font-medium text-on-surface-variant uppercase tracking-widest mt-1">Top Deep Divers</p>
          </div>
          <div className="flex gap-1 rounded-full bg-surface-container-high/50 p-1 border border-white/5 backdrop-blur-sm self-stretch sm:self-auto">
            <button 
              onClick={() => setViewMode("friends")}
              className={cn("flex-1 sm:flex-none rounded-full px-5 py-2 text-xs font-bold transition-colors", viewMode === "friends" ? "bg-primary/20 text-primary border border-primary/30 shadow-lg" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5")}
            >
              Friends
            </button>
            <button 
              onClick={() => setViewMode("global")}
              className={cn("flex-1 sm:flex-none rounded-full px-6 py-2 text-xs font-black shadow-lg", viewMode === "global" ? "bg-primary/20 text-primary border border-primary/30" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5 border border-transparent")}
            >
              Global
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="relative">
            <div className="absolute left-10 sm:left-12 top-10 bottom-10 w-px bg-white/5 -z-10 hidden sm:block" />
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
                  className={cn(
                    "group flex items-center gap-2 sm:gap-6 rounded-3xl p-2 sm:p-4 transition-all border shadow-lg backdrop-blur-sm cursor-default overflow-hidden",
                    rankPos === 1 ? "bg-tertiary/10 border-tertiary/30 hover:border-tertiary/50" : 
                    rankPos === 2 ? "bg-surface-container/80 border-white/10 hover:border-white/30" :
                    rankPos === 3 ? "bg-surface-container/50 border-white/5 hover:border-white/20" :
                    "bg-surface-container-low/30 border-transparent hover:bg-surface-container/50 hover:border-white/10"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-2xl font-black italic text-lg sm:text-xl shadow-inner shrink-0",
                    rankPos === 1 ? "bg-tertiary text-on-tertiary shadow-[inset_0_0_20px_rgba(255,255,255,0.5)]" : 
                    rankPos === 2 ? "bg-surface-container-high text-on-surface shadow-[inset_0_0_10px_rgba(255,255,255,0.1)]" :
                    rankPos === 3 ? "bg-surface-container-highest text-on-surface-variant" :
                    "text-on-surface-variant/50"
                  )}>
                    {rankPos}
                  </div>
                  <div className="relative shrink-0">
                    {rank.photo ? (
                      <img src={rank.photo} alt={rank.name} className={cn(
                        "h-10 w-10 sm:h-16 sm:w-16 rounded-full object-cover shadow-xl",
                        rankPos === 1 ? "border-4 border-tertiary shadow-tertiary/20" : "border-2 border-white/10"
                      )} />
                    ) : (
                      <div className={cn(
                        "h-10 w-10 sm:h-16 sm:w-16 rounded-full flex items-center justify-center bg-surface-container bg-surface-container shadow-xl overflow-hidden",
                        rankPos === 1 ? "border-4 border-tertiary shadow-tertiary/20" : "border-2 border-white/10"
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
                      <span className="font-black tracking-tight text-on-surface text-base sm:text-lg group-hover:text-primary transition-colors truncate">{rank.name}</span>
                      {rank.hasPinnedBadge && pinnedBadge && (
                        <div 
                          className={cn("flex items-center justify-center p-1 rounded-full", `bg-${pinnedBadge.color}/20 text-${pinnedBadge.color}`)} 
                          title={`Pinned Badge: ${pinnedBadge.label}`}
                        >
                          <pinnedBadge.icon size={12} className="text-primary" />
                        </div>
                      )}
                    </div>
                    <span className={cn(
                      "mt-1 w-fit rounded-lg px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest border",
                      rankPos === 1 ? "bg-tertiary border-tertiary text-on-tertiary shadow-lg shadow-tertiary/20" : "border-white/10 bg-white/5 text-on-surface-variant"
                    )}>
                      {rank.badge}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn(
                      "block text-lg sm:text-2xl font-black italic leading-none drop-shadow-md",
                      rankPos === 1 ? "text-tertiary" : "text-primary"
                    )}>
                      {rank.points.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-on-surface-variant tracking-widest">points</span>
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
            className="group relative flex items-center gap-2 sm:gap-6 overflow-hidden rounded-3xl bg-gradient-to-r from-secondary/20 via-background to-secondary/5 p-2 sm:p-4 border border-secondary/30 shadow-[0_0_30px_rgba(76,214,251,0.15)] backdrop-blur-md cursor-pointer mt-2"
          >
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-secondary shadow-[0_0_15px_rgba(76,214,251,0.5)]" />
            <div className="flex flex-1 items-center gap-2 sm:gap-6 ml-1 sm:ml-2">
              <div className="flex h-8 w-8 sm:h-12 sm:w-12 shrink-0 items-center justify-center font-black italic text-lg sm:text-xl text-secondary">
                {profile ? (rankings.findIndex(r => r.userId === profile.id) >= 0 ? rankings.findIndex(r => r.userId === profile.id) + 1 : "--") : "--"}
              </div>
              <div className="relative shrink-0">
                <div className="h-10 w-10 sm:h-16 sm:w-16 rounded-full border-4 border-secondary bg-surface-container flex items-center justify-center overflow-hidden shadow-xl shadow-secondary/20">
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
                <span className="text-[10px] font-bold uppercase text-secondary/70 tracking-widest">points</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <AnimatePresence>
        {showChallengeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowChallengeModal(false)} />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-[2rem] shadow-2xl border border-white/10 bg-surface-container-highest overflow-hidden"
            >
              <div className="flex items-start justify-between p-6 sm:p-8 pb-4 shrink-0 bg-surface-container-highest z-10 border-b border-white/5">
                <div>
                  <h2 className="text-3xl font-black italic tracking-tighter text-on-surface">Submit Entry</h2>
                  <p className="text-sm font-medium text-on-surface-variant mt-1">Upload a photo to join the Weekly Challenge</p>
                </div>
                <button onClick={() => setShowChallengeModal(false)} className="rounded-full bg-surface-container-high p-2 text-on-surface hover:bg-white/10 transition-colors border border-white/10 shrink-0">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 sm:p-8 pt-4 flex flex-col gap-6 overflow-y-auto no-scrollbar">
                <div className="bg-surface-container-high/50 p-2 rounded-3xl border border-white/5">
                  <div className="group cursor-pointer border-2 border-dashed border-white/10 rounded-2xl overflow-hidden bg-surface-container-low/50 flex flex-col items-center justify-center h-56 transition-all hover:border-primary/50 hover:bg-surface-container-high/50 relative">
                    <div className="text-center flex flex-col items-center justify-center gap-3 relative z-10 pointer-events-none">
                      <div className="rounded-full bg-primary/10 p-4 text-primary group-hover:scale-110 transition-transform">
                        <ImageIcon size={32} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-on-surface">Tap to upload picture</span>
                        <span className="text-xs font-medium text-on-surface-variant">JPG, PNG, HEIC up to 10MB</span>
                      </div>
                    </div>
                    <input type="file" className="absolute inset-0 z-20 opacity-0 cursor-pointer" accept="image/*" />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Dive Description / Species</label>
                  <input type="text" placeholder="What marine life did you spot?" className="w-full rounded-xl border border-white/10 bg-surface-container-high p-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary" />
                </div>

                <button 
                  onClick={() => {
                    alert("Entry sumitted successfully!");
                    setShowChallengeModal(false);
                  }}
                  className="mt-2 w-full rounded-2xl bg-secondary py-4 font-black uppercase tracking-widest text-on-secondary hover:bg-secondary-container transition-colors shadow-lg active:scale-[0.98]"
                >
                  Submit for Challenge
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
