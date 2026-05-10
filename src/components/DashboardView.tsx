import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { 
  Waves, 
  Moon, 
  Anchor, 
  Camera, 
  ChevronRight, 
  Navigation,
  Fish,
  X,
  MapPin,
  Calendar,
  Search,
  ArrowDown,
  ArrowLeft,
  Compass, Map as LucideMap, Trophy, HeartPulse, Zap, 
  Image as ImageIcon, Video, Star, Award, Globe, History, Box, Eye, CheckCircle2, Lock,
  Share2, Upload, Crosshair, HelpCircle, Pin, Trash2, User as UserIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "../lib/utils";
import { ActionMenu } from "./ActionMenu";
import { computeBadgesWithStats } from "../constants/badges";
import { RANKS, calculateLevel, getRankInfo } from "../constants/ranks";
import { useUser } from "../contexts/UserContext";
import { APIProvider, Map, AdvancedMarker, Pin as GooglePin, MapMouseEvent, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapErrorBoundary } from "./MapErrorBoundary";
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit, doc, updateDoc, increment, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { MARINE_LIFE_DATABASE, getSpeciesXP, getSpeciesRarity } from "../constants/marineLife";
import { filterProfanity } from "../lib/profanity";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export const DashboardView = ({ onNavigateToEvent, onNavigateToProfile }: { onNavigateToEvent?: (id: string) => void, onNavigateToProfile?: () => void }) => {
  const { profile } = useAuth();
  const { badgeStats: contextBadgeStats, updateBadgeStats } = useUser();
  const [activeHistory, setActiveHistory] = useState<'dives' | 'sightings' | null>(null);
  const [showBadges, setShowBadges] = useState(false);
  const [showRanks, setShowRanks] = useState(false);
  const [isLoggingDive, setIsLoggingDive] = useState(false);
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);

  const [allDives, setAllDives] = useState<any[]>([]);
  const [allSightings, setAllSightings] = useState<any[]>([]);
  const [myEvents, setMyEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.id) return;
    
    const qD = query(collection(db, "dives"), where("userId", "==", profile.id), orderBy("timestamp", "desc"));
    const qS = query(collection(db, "sightings"), where("userId", "==", profile.id), orderBy("timestamp", "desc"));
    const qE = query(collection(db, "events"), where("participants", "array-contains", profile.id));

    const unsubscribeD = onSnapshot(qD, (snapshot) => {
      setAllDives(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "dives");
    });

    const unsubscribeS = onSnapshot(qS, (snapshot) => {
      setAllSightings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "sightings");
    });

    const unsubscribeE = onSnapshot(qE, (snapshot) => {
      // sort events by date locally as we can't sort by timestamp and use array-contains on another field unless index is built
      const evs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      evs.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time || "00:00"}`).getTime();
        const dateB = new Date(`${b.date}T${b.time || "00:00"}`).getTime();
        return dateA - dateB;
      });
      setMyEvents(evs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "events");
    });

    return () => {
      unsubscribeD();
      unsubscribeS();
      unsubscribeE();
    };
  }, [profile?.id]);

  const discoveredSpecies = useMemo(() => {
    const speciesSet = new Set<string>();
    allSightings.forEach(item => {
      if (item.species) speciesSet.add(item.species);
      if (item.label) speciesSet.add(item.label);
    });
    allDives.forEach(item => {
      if (item.fishSpotted && Array.isArray(item.fishSpotted)) {
        item.fishSpotted.forEach((f: string) => speciesSet.add(f));
      }
    });
    return speciesSet;
  }, [allSightings, allDives]);

  const badgeStats = useMemo(() => {
    const stats: Record<string, number> = {
      recreational: 0, deep: 0, wreck: 0, night: 0, cave: 0, 
      drift: 0, photography: 0, navigation: 0, rescue: 0, training: 0
    };

    allDives.forEach(dive => {
      const type = (dive.diveType || 'Recreational').toLowerCase();
      if (stats[type] !== undefined) stats[type]++;
      else stats.recreational++;

      if (dive.depth > 30) stats.deep++;
    });

    return stats;
  }, [allDives]);

  const dives = allDives.length;
  const fish = discoveredSpecies.size;
  
  const [totalXp, setTotalXp] = useState<number>((profile?.points ?? 0) > 0 ? profile!.points! : (dives * 250 + fish * 15));

  useEffect(() => {
    let isMounted = true;
    const fetchPoints = async () => {
      if (!profile?.id) return;
      try {
        const { query, collection, limit, getDocs } = await import('firebase/firestore');
        const xp = profile?.points || 0;
        const rankingPoints = profile?.rankingPoints || 0;
        let likes = 0;

        const postsSnapshot = await getDocs(query(collection(db, "posts"), limit(1000)));
        const postPromises = postsSnapshot.docs.map(async (docSnap) => {
           const pData = docSnap.data();
           if (pData.userId === profile.id) {
             likes += (pData.likesCount || 0);
           }
           try {
             const commentsSnapshot = await getDocs(query(collection(db, "posts", docSnap.id, "comments")));
             commentsSnapshot.forEach(c => {
               const cData = c.data();
               if (cData.userId === profile.id) {
                 likes += (cData.likesCount || 0);
               }
             });
           } catch (e) {
             console.error("Error fetching comments for points calculation", e);
           }
        });
        await Promise.all(postPromises);
        
        if (isMounted) {
          setTotalXp(xp + rankingPoints + likes);
        }
      } catch (e) {
        console.error("Error calculating total points:", e);
      }
    };
    fetchPoints();
    return () => { isMounted = false; };
  }, [profile?.points, profile?.rankingPoints, profile?.id, profile]);

  const validTotalXp = Math.max(0, totalXp || 0);
  const level = calculateLevel(validTotalXp);
  const currentLevelXp = Math.pow(level - 1, 2) * 100;
  const nextLevelXp = Math.pow(level, 2) * 100;
  const xpProgress = isNaN(validTotalXp) ? 0 : Math.max(0, Math.min(100, ((validTotalXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100));

  const rankInfo = getRankInfo(level);

  useEffect(() => {
    if (profile?.id && rankInfo.title && profile.rank !== rankInfo.title) {
      const userRef = doc(db, "users", profile.id);
      updateDoc(userRef, {
        rank: rankInfo.title
      }).catch(err => {
        console.error("Error syncing rank to profile:", err);
      });
    }
  }, [profile?.id, rankInfo.title, profile?.rank]);

  const allBadges = computeBadgesWithStats(badgeStats);
  const earnedBadges = allBadges.filter(b => b.earned);

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-background text-on-background selection:bg-secondary/30">
      {/* Immersive Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#0ea5e925_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,#0c4a6e20_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,#07598515_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-1 md:px-8 md:pt-4">
        <header className="mb-2 flex items-center justify-between md:mb-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-4xl font-black uppercase tracking-tighter text-white sm:text-5xl md:text-7xl">
              GO<span className="text-secondary">DIVE</span>
            </h1>
          </motion.div>
          
          <motion.button 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => onNavigateToProfile?.()}
            className="h-14 w-14 md:h-16 md:w-16 rounded-full overflow-hidden border-2 border-white/10 hover:border-secondary transition-colors shrink-0"
          >
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-surface-container flex items-center justify-center">
                <UserIcon size={28} className="text-on-surface-variant" />
              </div>
            )}
          </motion.button>
        </header>

        <section 
          onClick={() => setShowRanks(true)}
          className="mb-6 rounded-[2rem] bg-surface-container-high/40 backdrop-blur-2xl border border-white/5 shadow-2xl overflow-hidden relative group md:mb-8 md:rounded-[2.5rem] cursor-pointer hover:bg-white/[0.02] transition-colors"
        >
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-secondary/5 blur-[100px] group-hover:bg-secondary/10 transition-colors" />
          
          <div className="p-6 md:p-8 relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-6">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50 md:text-xs">Current Rank</p>
                  <h3 className="text-2xl font-black text-secondary leading-tight italic md:text-4xl whitespace-nowrap">{rankInfo.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest md:text-sm">LVL {level}</span>
                    <span className="h-1 w-1 rounded-full bg-white/20" />
                    <span className="text-[10px] font-bold text-secondary uppercase tracking-widest md:text-sm">{rankInfo.status}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start md:items-end w-full md:w-auto">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white tracking-tighter md:text-4xl">{validTotalXp.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest md:text-sm">XP / {nextLevelXp.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Level Bar (Video Game Style) */}
            <div className="relative h-3 w-full rounded-full bg-white/5 border border-white/10 p-[2px] shadow-[0_0_10px_rgba(0,0,0,0.5)_inset]">
              <div className="relative h-full w-full rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress}%` }}
                  transition={{ duration: 1.5, ease: "backOut" }}
                  className="h-full bg-gradient-to-r from-secondary to-primary relative shadow-[0_0_15px_rgba(76,214,251,0.3)]"
                >
                  {/* Sheen/Highlight */}
                  <div className="absolute inset-x-0 top-0 h-[40%] bg-white/20" />
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8 md:mb-12"
        >
          <motion.button 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsLoggingDive(true)}
            className="w-full flex h-16 items-center justify-center gap-4 rounded-[2rem] bg-secondary font-black uppercase tracking-[0.25em] text-on-secondary shadow-[0_20px_50px_rgba(76,214,251,0.3)] transition-all hover:bg-secondary-container md:h-24 md:text-xl group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 group-hover:rotate-12 transition-transform md:h-12 md:w-12">
              <Navigation size={24} className="animate-pulse" />
            </div>
            Log New Dive
          </motion.button>
        </motion.div>

        <div className="grid grid-cols-2 gap-4 mb-8 md:gap-6 md:mb-12">
          <StatsCard 
            title="Dives" 
            value={dives} 
            unit="LOGS" 
            icon={Waves} 
            color="primary" 
            onClick={() => setActiveHistory('dives')}
          />
          <StatsCard 
            title="Marine Life" 
            value={fish} 
            unit="SPECIES" 
            icon={Fish} 
            color="secondary" 
            onClick={() => setActiveHistory('sightings')}
          />
        </div>

        {myEvents.length > 0 && (
          <section className="w-full min-w-0 pb-10">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight text-on-surface">Your Events</h3>
            </div>
            <div className="no-scrollbar flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-8 md:px-8 snap-x snap-mandatory">
              {myEvents.map((e) => {
                const isHost = e.hostId === profile?.id;
                return (
                  <div 
                    key={e.id} 
                    onClick={() => onNavigateToEvent?.(e.id)}
                    className="snap-start shrink-0 w-64 p-5 rounded-3xl bg-surface-container-high/40 border border-white/5 shadow-lg relative overflow-hidden group cursor-pointer hover:bg-white/5 transition-colors"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Calendar size={64} />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[9px] font-black uppercase tracking-widest text-secondary bg-secondary/10 px-2 py-0.5 rounded-full border border-secondary/20">
                          {isHost ? 'Hosting' : 'Joined'}
                        </span>
                        <span className="text-xs font-bold text-on-surface-variant/80">{e.date}</span>
                      </div>
                      <h4 className="font-black italic text-lg text-on-surface mb-1 truncate">{e.title}</h4>
                      <div className="flex items-center text-xs font-medium text-on-surface-variant mb-4 truncate">
                        <MapPin size={12} className="mr-1 inline text-primary"/>{e.location}
                      </div>

                      <div className="flex -space-x-2">
                        {e.participants?.slice(0, 5).map((p: string, i: number) => (
                           <div key={i} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-container bg-surface/50 text-secondary pointer-events-none overflow-hidden">
                             <UserIcon size={12} />
                           </div>
                        ))}
                        {(e.participants?.length || 0) > 5 && (
                          <div className="h-6 w-6 rounded-full border-2 border-surface-container bg-surface flex items-center justify-center pointer-events-none">
                            <span className="text-[8px] font-bold text-on-surface">+{e.participants.length - 5}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="w-full min-w-0 pb-10">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-2xl font-bold tracking-tight text-on-surface">Dive Badges</h3>
            <button 
              onClick={() => setShowBadges(true)}
              className="flex items-center gap-1 text-sm font-bold text-secondary transition-colors hover:text-primary"
            >
              All Badges <ChevronRight size={16} />
            </button>
          </div>
          
          {earnedBadges.length > 0 ? (
            <div className="no-scrollbar flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-8 md:px-8 snap-x snap-mandatory">
              {earnedBadges.map((badge, idx) => (
                <div key={`badge-${badge.id}-${idx}`} className="snap-start shrink-0 cursor-pointer" onClick={() => setActiveBadgeId(badge.id)}>
                  <BadgeCard {...badge} id={badge.id} />
                </div>
              ))}
            </div>
          ) : (
            <div 
              onClick={() => setShowBadges(true)}
              className="flex flex-col items-center justify-center py-10 px-6 rounded-[2rem] bg-white/5 border border-dashed border-white/10 cursor-pointer hover:bg-white/10 transition-colors group"
            >
              <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                < Award size={24} className="text-white/20" />
              </div>
              <p className="text-sm font-medium text-white/40">No badges earned yet</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mt-1">Tap to see all available</p>
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {activeHistory && (
          <HistoryModal 
            type={activeHistory} 
            onClose={() => setActiveHistory(null)} 
            allDives={allDives}
            allSightings={allSightings}
            discoveredSpecies={discoveredSpecies}
          />
        )}
        {showRanks && (
          <RanksModal 
            ranks={RANKS} 
            activeLevel={level} 
            onClose={() => setShowRanks(false)} 
          />
        )}
        {showBadges && (
          <BadgesModal 
            badges={allBadges} 
            onClose={() => setShowBadges(false)} 
            onBadgeClick={(id) => setActiveBadgeId(id)}
          />
        )}
        {isLoggingDive && (
          <StartDiveModal 
            onClose={() => setIsLoggingDive(false)} 
          />
        )}
        {activeBadgeId && (
          <BadgeDetailModal
            badgeId={activeBadgeId}
            onClose={() => setActiveBadgeId(null)}
            onAction={() => {
              setActiveBadgeId(null);
              setShowBadges(false);
              setIsLoggingDive(true);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const RanksModal = ({ ranks, activeLevel, onClose }: { ranks: any[], activeLevel: number, onClose: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: 50, scale: 0.95, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 30, scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] rounded-[2.5rem] bg-surface-container-high border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-surface-container-high/50 backdrop-blur-md md:p-8">
          <div>
            <h3 className="text-2xl font-black tracking-tighter text-white uppercase italic md:text-3xl">
              Explorer Rankings
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mt-1 md:text-xs">
              Ascend through the echelons of the deep
            </p>
          </div>
          <motion.button 
            whileHover={{ rotate: 90, scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 text-on-surface-variant hover:text-white transition-colors border border-white/5 md:p-3"
          >
            <X size={20} className="md:size-6" />
          </motion.button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 font-sans no-scrollbar">
          <div className="space-y-4">
            {ranks.map((rank, index) => {
              const isUnlocked = activeLevel >= rank.min;
              const isCurrent = activeLevel >= rank.min && (index === ranks.length - 1 || activeLevel < ranks[index + 1].min);
              
              return (
                <div 
                  key={rank.title}
                  className={cn(
                    "relative overflow-hidden p-6 rounded-3xl border transition-all duration-500",
                    isCurrent 
                      ? "bg-secondary/10 border-secondary/30 ring-1 ring-secondary/20 shadow-[0_0_40px_-12px_rgba(76,214,251,0.2)]" 
                      : isUnlocked 
                        ? "bg-white/5 border-white/10 opacity-70" 
                        : "bg-black/20 border-white/5 opacity-40 grayscale"
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 transform transition-transform group-hover:scale-110",
                        isUnlocked ? "border-secondary/50 bg-secondary/5 text-secondary shadow-lg shadow-secondary/10" : "border-white/5 bg-white/5 text-on-surface-variant/20"
                      )}>
                        <Trophy size={28} className={!isUnlocked ? "opacity-20" : ""} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={cn("text-xl font-black italic tracking-tight", isUnlocked ? "text-white" : "text-white/40")}>
                            {rank.title}
                          </h4>
                          {isCurrent && (
                            <span className="text-[8px] font-black uppercase tracking-widest bg-secondary text-on-secondary px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary/60">
                          {rank.status} • LVL {rank.min}+
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:items-end">
                      <span className={cn("text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border", isUnlocked ? "bg-white/5 border-white/10 text-on-surface-variant" : "bg-black/20 border-white/5 text-on-surface-variant/20")}>
                        {rank.cert}
                      </span>
                    </div>
                  </div>
                  
                  {isUnlocked && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <p className="text-xs text-on-surface-variant/60 leading-relaxed font-medium italic">
                        "{rank.desc}"
                      </p>
                    </div>
                  )}
                  
                  {!isUnlocked && (
                    <div className="absolute top-4 right-4 group-hover:scale-110 transition-transform">
                      <Lock size={16} className="text-on-surface-variant/20" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>


      </motion.div>
    </motion.div>
  );
};

const StatsCard = ({ title, value, unit, icon: Icon, color, onClick }: any) => {
  return (
    <motion.div 
      whileHover={{ y: -5, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] p-5 backdrop-blur-2xl border border-white/10 shadow-2xl group cursor-pointer transition-all duration-500 md:rounded-[2.5rem] md:p-8",
        color === "primary" ? "bg-primary/5 hover:bg-primary/10" : "bg-secondary/5 hover:bg-secondary/10"
      )}
    >
      <div className={cn(
        "absolute -right-4 -top-4 opacity-5 transition-all duration-700 group-hover:scale-150 group-hover:rotate-12 group-hover:opacity-10 md:-right-6 md:-top-6", 
        color === "primary" ? "text-primary" : "text-secondary"
      )}>
        <Icon size={140} strokeWidth={1.5} className="md:size-[180px]" />
      </div>
      
      <div className="relative z-10">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 group-hover:border-white/20 transition-colors md:mb-4 md:h-12 md:w-12 md:rounded-2xl">
          <Icon size={20} className={cn(color === "primary" ? "text-primary" : "text-secondary", "md:size-6")} />
        </div>
        <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 md:mb-1 md:text-xs">{title}</p>
        <div className="flex items-baseline gap-1.5 md:gap-2">
          <span className="text-3xl font-black tracking-tighter text-white tabular-nums md:text-5xl">{value}</span>
          <span className="text-[10px] font-black text-on-surface-variant/30 uppercase tracking-widest md:text-sm">{unit}</span>
        </div>
      </div>

      <div className={cn(
        "absolute bottom-0 left-0 h-1 w-0 transition-all duration-700 ease-out group-hover:w-full",
        color === "primary" ? "bg-primary" : "bg-secondary"
      )} />
    </motion.div>
  );
};

const HistoryModal = ({ 
  type, 
  onClose,
  allDives,
  allSightings,
  discoveredSpecies 
}: { 
  type: 'dives' | 'sightings', 
  onClose: () => void,
  allDives: any[],
  allSightings: any[],
  discoveredSpecies: Set<string>
}) => {
  const isDives = type === 'dives';
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'log' | 'collection'>(isDives ? 'log' : 'collection');
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'spotted' | 'unspotted'>('all');
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);

  const speciesLogMap = React.useMemo(() => {
    const map = new window.Map<string, { count: number, appearances: any[] }>();
    
    const addSighting = (species: string, item: any, source: string) => {
      const sp = species.trim();
      if (!sp) return;
      const key = MARINE_LIFE_DATABASE.find(s => s.toLowerCase() === sp.toLowerCase()) || sp;
      if (!map.has(key)) map.set(key, { count: 0, appearances: [] });
      const entry = map.get(key)!;
      entry.count += 1;
      entry.appearances.push({...item, source});
    };

    allSightings.forEach(item => {
      const s = item.species || item.label;
      if (s) addSighting(s, item, 'sighting');
    });
    
    allDives.forEach(item => {
      if (item.fishSpotted && Array.isArray(item.fishSpotted)) {
        item.fishSpotted.forEach((f: string) => addSighting(f, item, 'dive'));
      }
    });

    map.forEach(value => {
      value.appearances.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        if (timeA !== timeB) return timeB - timeA;
        
        const dateA = a.date || "";
        const dateB = b.date || "";
        return dateB.localeCompare(dateA);
      });
    });
    
    return map;
  }, [allSightings, allDives]);

  const items = isDives ? allDives : allSightings;
  const loading = false; // Data is already loaded by parent
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: 50, scale: 0.95, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 30, scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] rounded-[3rem] bg-surface-container-high border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/5 bg-surface-container-high/50 backdrop-blur-md md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-black tracking-tighter text-white uppercase italic md:text-3xl">
                {isDives ? "Dive Journal" : "Sighting Log"}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative group hidden md:block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-secondary transition-colors" size={16} />
                <input 
                  type="text"
                  placeholder="Search species..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black/40 border border-white/5 rounded-full py-2 pl-11 pr-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-secondary/40 w-48 transition-all focus:w-64"
                />
              </div>
              <motion.button 
                whileHover={{ rotate: 90, scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2 rounded-full bg-white/5 text-on-surface-variant hover:text-white transition-colors border border-white/5 md:p-3"
              >
                <X size={20} className="md:size-6" />
              </motion.button>
            </div>
          </div>

          <div className="md:hidden mb-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-secondary transition-colors" size={16} />
              <input 
                type="text"
                placeholder="Search species..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-black/40 border border-white/5 rounded-full py-3 pl-11 pr-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-secondary/40 w-full transition-all"
              />
            </div>
          </div>

          {!isDives && (
            <div className="space-y-4">
              <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
                {(['all', 'spotted', 'unspotted'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={cn(
                      "flex-1 py-1.5 px-2 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all",
                      statusFilter === filter 
                        ? "bg-white/10 text-white border border-white/10" 
                        : "text-white/20 hover:text-white/40 hover:bg-white/5"
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar bg-gradient-to-b from-transparent to-black/20">
          {selectedSpecies ? (
            <div className="flex flex-col h-full w-full">
              <div className="flex items-center gap-3 mb-6">
                <button 
                  onClick={() => setSelectedSpecies(null)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
                <h4 className="text-xl font-black italic uppercase tracking-tighter text-white">
                  {selectedSpecies} Sightings
                </h4>
              </div>
              <div className="flex flex-col gap-4 pb-8">
                {speciesLogMap.get(selectedSpecies)?.appearances.map((item: any, i: number) => {
                  const isDive = item.source === 'dive';
                  return (
                  <motion.div 
                    key={`${selectedSpecies}-${i}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="group relative overflow-hidden p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 hover:border-white/20 hover:bg-white/[0.06] transition-all duration-300"
                  >
                    <div className="flex justify-between items-center gap-4">
                      <h4 className={cn("text-lg font-black tracking-tight leading-tight md:text-xl", isDive ? "text-primary" : "text-secondary")}>
                        {item.location || "Unknown Location"}
                      </h4>
                      <span className="flex shrink-0 items-center gap-1 text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 px-2 py-1 rounded-lg bg-white/5 border border-white/5 whitespace-nowrap md:gap-1.5 md:text-[10px] md:px-3 md:py-1.5">
                        <Calendar size={10} className="text-secondary md:size-3" /> {formatDate(item.date || (item.timestamp?.seconds ? item.timestamp.seconds * 1000 : item.timestamp)) || "Observed"}
                      </span>
                    </div>
                  </motion.div>
                )})}
              </div>
            </div>
          ) : activeTab === 'collection' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-8">
              {MARINE_LIFE_DATABASE
                .filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
                .filter(s => {
                  if (statusFilter === 'all') return true;
                  const isDiscovered = discoveredSpecies.has(s);
                  return statusFilter === 'spotted' ? isDiscovered : !isDiscovered;
                })
                .map(species => {
                const isDiscovered = discoveredSpecies.has(species);
                const rarity = getSpeciesRarity(species);
                const details = speciesLogMap.get(species);
                const count = details?.count || 0;
                
                return (
                  <div 
                    key={species}
                    onClick={() => {
                      if (isDiscovered) {
                        setSelectedSpecies(species);
                      }
                    }}
                    className={cn(
                      "p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center text-center gap-2",
                      isDiscovered 
                        ? "bg-secondary/10 border-secondary/30 shadow-lg shadow-secondary/5 cursor-pointer hover:bg-secondary/20" 
                        : "bg-white/5 border-white/5 grayscale opacity-40 hover:opacity-100 transition-opacity"
                    )}
                  >
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center border",
                      isDiscovered ? "bg-secondary/20 border-secondary/20 text-secondary" : "bg-white/5 border-white/10 text-white/20"
                    )}>
                      <Fish size={20} />
                    </div>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-tight leading-tight",
                      isDiscovered ? "text-white" : "text-white/20"
                    )}>
                      {species}
                    </span>
                    {isDiscovered && (
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn(
                          "text-[7px] font-black uppercase px-2 py-0.5 rounded-full",
                          rarity === 'rare' ? "bg-amber-500/20 text-amber-500" : 
                          rarity === 'uncommon' ? "bg-secondary/20 text-secondary" : 
                          "bg-white/10 text-white/40"
                        )}>
                          {rarity}
                        </span>
                        {count > 0 && (
                          <span className="text-[10px] font-black uppercase text-secondary/80 tracking-widest mt-0.5">
                            {count} {count === 1 ? 'Sighting' : 'Sightings'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-20 gap-4">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-secondary border-t-transparent" />
                  <p className="text-xs font-black uppercase tracking-widest text-secondary/60 animate-pulse">Retrieving Logs...</p>
                </div>
              ) : items.filter(item => {
                  const name = (item.species || item.label || item.location || "").toLowerCase();
                  return name.includes(searchQuery.toLowerCase());
                }).length === 0 ? (
                <div className="text-center p-20 flex flex-col items-center gap-4">
                  <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center text-on-surface-variant/20">
                    <Search size={40} />
                  </div>
                  <div>
                    <p className="text-xl font-black text-white italic tracking-tight">No Results Found</p>
                    <p className="text-sm font-medium text-on-surface-variant/50 mt-1">Try adjusting your search query.</p>
                  </div>
                </div>
              ) : (
                items
                  .filter(item => {
                    const name = (item.species || item.label || item.location || "").toLowerCase();
                    return name.includes(searchQuery.toLowerCase());
                  })
                  .map((item, index) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="group relative overflow-hidden p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 hover:border-white/20 hover:bg-white/[0.06] transition-all duration-300"
                  >
                    <div className="flex justify-between items-start mb-3 md:mb-4">
                      <div className="flex flex-col gap-1">
                        <h4 className={cn("text-lg font-black tracking-tight transition-colors leading-tight md:text-xl", isDives ? "text-primary group-hover:text-secondary" : "text-secondary group-hover:text-primary")}>
                          {isDives ? item.location : (item.species || item.label)}
                        </h4>
                        {isDives && item.diveType && (
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-secondary bg-secondary/10 px-2 py-0.5 rounded-lg border border-secondary/20 md:text-[10px] md:px-2.5 md:py-1">
                              {item.diveType}
                            </span>
                          </div>
                        )}
                        {!isDives && (
                           <div className="flex items-center gap-2">
                             <span className={cn(
                               "text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-lg border",
                               getSpeciesRarity(item.species || item.label) === 'rare' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                               getSpeciesRarity(item.species || item.label) === 'uncommon' ? "bg-secondary/10 text-secondary border-secondary/20" :
                               "bg-white/5 text-white/40 border-white/10"
                             )}>
                               {getSpeciesRarity(item.species || item.label)}
                             </span>
                           </div>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-on-surface-variant/40 px-2 py-1 rounded-lg bg-white/5 border border-white/5 whitespace-nowrap md:gap-1.5 md:text-[10px] md:px-3 md:py-1.5">
                        <Calendar size={10} className="text-secondary md:size-3" /> {formatDate(item.date || (item.timestamp?.seconds ? item.timestamp.seconds * 1000 : item.timestamp)) || "Observed"}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-bold text-on-surface-variant/60 mb-3 bg-black/20 p-2.5 rounded-xl border border-white/5 md:gap-6 md:text-sm md:mb-4 md:p-3 md:rounded-2xl">
                      {isDives ? (
                        <>
                          <div className="flex flex-col">
                            <span className="text-[7px] uppercase tracking-widest opacity-30 mb-0.5 md:text-[8px]">Depth</span>
                            <span className="flex items-center gap-1 text-white">
                              <ArrowDown size={12} className="text-secondary md:size-14" /> {item.depth}m
                            </span>
                          </div>
                          <div className="h-5 w-px bg-white/10 md:h-6" />
                          <div className="flex flex-col">
                            <span className="text-[7px] uppercase tracking-widest opacity-30 mb-0.5 md:text-[8px]">Duration</span>
                            <span className="flex items-center gap-1 text-white">
                              <Waves size={12} className="text-tertiary md:size-14" /> {item.duration}m
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-[7px] uppercase tracking-widest opacity-30 mb-0.5 md:text-[8px]">Location</span>
                          <span className="flex items-center gap-2 text-white">
                            <MapPin size={12} className="text-secondary md:size-14" /> {item.location || "Ocean Deep"}
                          </span>
                        </div>
                      )}
                    </div>

                    {isDives && item.fishSpotted && item.fishSpotted.length > 0 && (
                      <div className="mb-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/30 mb-2.5 flex items-center gap-2">
                          <Fish size={10} className="text-secondary" /> Marine Life Spotted
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {item.fishSpotted.map((fish: string, fIdx: number) => (
                            <span key={`history-fish-${item.id}-${fIdx}`} className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-white/5 text-on-surface hover:bg-secondary/20 hover:text-secondary transition-colors border border-white/5 group-hover:border-secondary/20">
                              {fish}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {isDives && item.notes && (
                      <div className="mb-4 p-4 rounded-2xl bg-black/40 border border-white/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-5">
                          <ImageIcon size={40} />
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/30 mb-2">Observations</p>
                        <p className="text-xs text-on-surface-variant/80 italic leading-relaxed font-medium">"{item.notes}"</p>
                      </div>
                    )}

                    {item.photos && item.photos.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant/30 mb-3">Expedition Media</p>
                        <div className="grid grid-cols-4 gap-3">
                          {item.photos.map((p: string, pIdx: number) => (
                            <motion.div 
                              key={`history-photo-${item.id}-${pIdx}`} 
                              whileHover={{ scale: 1.05, y: -2 }}
                              onClick={() => setSelectedImage(p)}
                              className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-secondary transition-all shadow-xl"
                            >
                              <img src={p} className="h-full w-full object-cover" alt="" />
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>

      </motion.div>      {/* Full Image Box */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(null);
            }}
          >
            <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={4}
                centerOnInit={true}
              >
                <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                  <img 
                    src={selectedImage} 
                    className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain border border-white/10 cursor-grab active:cursor-grabbing" 
                    alt="Dive Preview"
                  />
                </TransformComponent>
              </TransformWrapper>
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute top-6 right-6 p-3 rounded-full bg-surface-container-highest text-on-surface border border-white/10 shadow-xl z-10"
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const getTierColor = (tier: string) => {
  switch (tier.toLowerCase()) {
    case 'bronze': return 'bg-amber-700/20 text-amber-600 border-amber-700/30';
    case 'silver': return 'bg-slate-400/20 text-slate-300 border-slate-400/30';
    case 'gold': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
    case 'platinum': return 'bg-cyan-300/20 text-cyan-200 border-cyan-300/30';
    case 'diamond': return 'bg-purple-400/20 text-purple-300 border-purple-400/30';
    default: return 'bg-surface-variant/30 text-on-surface-variant border-outline/20';
  }
};

const getTierSolidColor = (tier: string) => {
  switch (tier.toLowerCase()) {
    case 'bronze': return 'bg-amber-600';
    case 'silver': return 'bg-slate-300';
    case 'gold': return 'bg-yellow-500';
    case 'platinum': return 'bg-cyan-300';
    case 'diamond': return 'bg-purple-400';
    default: return 'bg-outline';
  }
};

const BadgesModal = ({ badges, onClose, onBadgeClick }: { badges: any[], onClose: () => void, onBadgeClick: (id: string) => void }) => {
  const earned = badges.filter(b => b.earned);
  const locked = badges.filter(b => !b.earned);
  const { pinnedBadgeId, setPinnedBadgeId } = useUser();

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="relative w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] rounded-[32px] bg-surface-container-high border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center p-6 border-b border-white/5 relative">
          <h3 className="text-2xl font-black italic tracking-tight text-on-surface">
            All Badges
          </h3>
          <button 
            onClick={onClose}
            className="absolute right-6 p-2 rounded-full text-on-surface-variant hover:bg-white/5 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 no-scrollbar flex flex-col gap-10">
          <div>
            <h4 className="text-xl font-black italic text-on-surface mb-6 flex justify-center items-center gap-2">
              <Award className="text-secondary" /> Earned ({earned.length})
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {earned.map(b => (
                <div key={b.id} className="relative flex flex-col items-center justify-center gap-2 p-4 rounded-3xl bg-surface-container/50 border border-white/5 hover:bg-surface-container transition-colors group cursor-pointer" onClick={() => onBadgeClick(b.id)}>
                  <span className="absolute top-2 right-3 text-[9px] font-black uppercase tracking-widest text-on-surface-variant/50">{b.tier}</span>
                  
                  <button 
                    onClick={() => setPinnedBadgeId(pinnedBadgeId === b.id ? null : b.id)}
                    className={cn(
                      "absolute top-2 left-3 p-1.5 rounded-full transition-all border",
                      pinnedBadgeId === b.id ? "bg-primary/20 text-primary border-primary/30" : "bg-black/20 text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-primary hover:bg-primary/10 border-transparent hover:border-primary/20"
                    )}
                    title={pinnedBadgeId === b.id ? "Unpin Badge" : "Pin to Profile"}
                  >
                    <Pin size={12} className={cn({ "fill-current": pinnedBadgeId === b.id })} />
                  </button>

                  <div className={cn("flex h-14 w-14 items-center justify-center rounded-full border-2 p-3 mt-4", getTierColor(b.tier))}>
                    <b.icon size={24} />
                  </div>
                  <span className="text-[11px] font-bold text-on-surface text-center leading-tight uppercase tracking-wider">{b.label}</span>
                  <p className="text-[10px] font-medium text-on-surface-variant text-center px-1 line-clamp-2">{b.desc}</p>
                  
                  <div className="w-full mt-2">
                    <div className="flex justify-center items-end mb-1">
                      <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest">{b.currentValue}/{b.nextTierRequirement} {b.unit}</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-surface-variant/30 overflow-hidden">
                      <div style={{ width: `${b.progressRatio * 100}%` }} className={cn("h-full", getTierSolidColor(b.tier))} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xl font-black italic text-on-surface-variant/60 mb-6 flex justify-center items-center gap-2">
              <Lock size={20} /> Locked ({locked.length})
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
              {locked.map(b => (
                <div key={b.id} className="relative flex flex-col items-center justify-center gap-2 p-4 rounded-3xl bg-surface-container-lowest/50 border border-transparent cursor-pointer" onClick={() => onBadgeClick(b.id)}>
                  <span className="absolute top-2 right-3 text-[9px] font-black uppercase tracking-widest text-on-surface-variant/30">{b.tier}</span>
                  <div className={cn("flex h-14 w-14 items-center justify-center rounded-full border-2 p-3 bg-surface-variant/30 text-outline border-outline/20 mt-4", getTierColor(b.tier))}>
                    <b.icon size={24} />
                  </div>
                  <span className="text-[11px] font-bold text-on-surface-variant text-center leading-tight uppercase tracking-wider">{b.label}</span>
                  <p className="text-[10px] font-medium text-on-surface-variant/50 text-center px-1 line-clamp-2">{b.desc}</p>
                  
                  <div className="w-full mt-2 opacity-50">
                    <div className="flex justify-center items-end mb-1">
                      <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest">{b.currentValue}/{b.nextTierRequirement} {b.unit}</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-surface-variant/30 overflow-hidden">
                      <div style={{ width: `${b.progressRatio * 100}%` }} className="h-full bg-outline/50" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const BadgeCard = ({ id, label, icon: Icon, color, tier, progressRatio, currentValue, nextTierRequirement, isMaxed, unit }: any) => {
  const { pinnedBadgeId, setPinnedBadgeId } = useUser();

  const colors: any = {
    primary: "bg-primary/20 text-primary border-primary/20 ring-primary/10",
    secondary: "bg-secondary/20 text-secondary border-secondary/20 ring-secondary/10",
    tertiary: "bg-tertiary/20 text-tertiary border-tertiary/20 ring-tertiary/10"
  };
  
  return (
    <div className="group relative flex min-w-[140px] flex-col items-center justify-center gap-4 rounded-3xl bg-surface-container-high/40 p-6 backdrop-blur-xl border border-white/5 transition-all hover:border-white/20">
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setPinnedBadgeId(pinnedBadgeId === id ? null : id);
        }}
        className={cn(
          "absolute top-3 right-3 p-1.5 rounded-full transition-all border",
          pinnedBadgeId === id ? "bg-primary/20 text-primary border-primary/30" : "bg-black/20 text-on-surface-variant opacity-0 hover:opacity-100 group-hover:opacity-100 hover:text-primary hover:bg-primary/10 border-transparent hover:border-primary/20",
          tier === 'Locked' && "hidden"
        )}
        title={pinnedBadgeId === id ? "Unpin Badge" : "Pin to Profile"}
      >
        <Pin size={12} className={cn({ "fill-current": pinnedBadgeId === id })} />
      </button>

      {tier !== 'Locked' && <span className="absolute top-3 left-4 text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">{tier}</span>}
      <div className={cn("flex h-20 w-20 items-center justify-center rounded-full border-2 p-4 transition-transform group-hover:scale-110 mt-1", tier !== 'Locked' ? getTierColor(tier) : 'bg-surface-variant/30 text-outline border-outline/20')}>
        <Icon size={32} />
      </div>
      <span className="text-sm font-bold tracking-tight text-on-surface text-center leading-tight">{label}</span>
      <div className={cn("absolute inset-0 -z-10 rounded-3xl blur-xl transition-opacity opacity-0 group-hover:opacity-30", tier !== 'Locked' ? getTierColor(tier) : colors[color])} />
      
      <div className="w-full mt-2">
        <div className="flex justify-center items-end mb-1">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{currentValue} / {nextTierRequirement} {unit}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-surface-variant/30 overflow-hidden border border-white/5">
          <div style={{ width: `${progressRatio * 100}%` }} className={cn("h-full", tier !== 'Locked' ? getTierSolidColor(tier) : 'bg-outline/50')} />
        </div>
      </div>
    </div>
  );
};

// The local definition is no longer needed since we import it from constants/marineLife.ts
// Removing it to keep the file clean.


const BadgeDetailModal = ({ badgeId, onClose, onAction }: { badgeId: string, onClose: () => void, onAction: () => void }) => {
  const { badgeStats } = useUser();
  const allBadges = computeBadgesWithStats(badgeStats);
  const badge = allBadges.find(b => b.id === badgeId);
  const { pinnedBadgeId, setPinnedBadgeId } = useUser();

  if (!badge) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 20, opacity: 0 }}
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-[3rem] bg-surface-container-high shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-6 right-6 z-10 flex gap-3">
          <motion.button 
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose} 
            className="rounded-full bg-black/40 p-2.5 text-on-surface-variant transition-colors hover:bg-white/10 hover:text-white border border-white/10 shadow-lg"
          >
            <X size={18} />
          </motion.button>
        </div>

        <div className="flex flex-col items-center p-6 text-center pt-12 bg-gradient-to-b from-surface-container-high to-black/40 md:p-10 md:pt-16">
          <div className="relative group mb-6 md:mb-8">
            <div className={cn("absolute inset-0 blur-3xl opacity-20 rounded-full transition-opacity group-hover:opacity-40 animate-pulse", getTierSolidColor(badge.tier))} />
            <div className={cn("relative flex h-24 w-24 md:h-32 md:w-32 items-center justify-center rounded-full border-4 p-5 md:p-7 shadow-2xl transition-transform duration-500 group-hover:scale-110", badge.tier !== 'Locked' ? getTierColor(badge.tier) : 'bg-surface-variant/30 text-outline border-outline/20')}>
              <badge.icon size={48} className={cn("md:size-[64px]", badge.tier === 'Locked' ? 'opacity-30 p-2' : '')} />
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-2 mb-6 md:gap-3 md:mb-8">
            {badge.tier !== 'Locked' && (
              <span className={cn("rounded-full border px-3 py-1 text-[8px] font-black uppercase tracking-[0.25em] shadow-sm md:px-4 md:py-1.5 md:text-[10px]", getTierColor(badge.tier))}>
                {badge.tier}
              </span>
            )}
            <h3 className="text-3xl font-black uppercase tracking-tighter text-white italic md:text-4xl">{badge.label}</h3>
            <p className="text-xs font-medium text-on-surface-variant/60 leading-relaxed max-w-[200px] md:text-sm md:max-w-[240px]">{badge.desc}</p>
          </div>
          
          <div className="w-full rounded-[1.5rem] bg-black/40 p-6 mb-6 border border-white/5 relative overflow-hidden group/card md:rounded-[2rem] md:p-8 md:mb-8">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-secondary/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
            <div className="flex justify-between items-end mb-2 md:mb-3">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-on-surface-variant/30 md:text-[10px]">Mastery Progress</span>
              <span className="text-lg font-black text-white tabular-nums md:text-xl">
                {badge.currentValue} 
                <span className="text-[9px] text-on-surface-variant/40 font-black uppercase tracking-widest ml-1 md:text-[10px]">/ {badge.nextTierRequirement} {badge.unit}</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5 p-[1px] border border-white/5 md:h-2.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${badge.progressRatio * 100}%` }}
                transition={{ duration: 1.2, ease: "circOut" }}
                className={cn("h-full rounded-full relative", badge.tier !== 'Locked' ? getTierSolidColor(badge.tier) : 'bg-white/20')} 
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              </motion.div>
            </div>
            
            {!badge.isMaxed && (
              <p className="mt-4 text-[10px] font-bold text-on-surface-variant/50 tracking-tight flex items-center justify-center gap-1.5 md:mt-5 md:text-[11px]">
                Next: <span className={cn("px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest md:text-[9px]", getTierColor(badge.nextTierName))}>{badge.nextTierName}</span>
              </p>
            )}
            {badge.isMaxed && (
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-secondary flex items-center justify-center gap-2 md:mt-5 md:text-[11px]">
                <CheckCircle2 size={12} /> Legend Achieved
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const MapSelectionModal = ({ 
  onClose, 
  onSelect 
}: { 
  onClose: () => void, 
  onSelect: (location: string, coords?: {lat: number, lng: number}) => void 
}) => {
  const [selectedPos, setSelectedPos] = useState<{lat: number, lng: number} | null>(null);
  const markerLib = useMapsLibrary('marker');

  if (!hasValidKey) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={onClose} />
        <div className="relative w-full max-w-md rounded-3xl bg-surface-container p-8 shadow-2xl border border-white/10 text-center">
          <h2 className="mb-4 text-xl font-black uppercase text-secondary">Google Maps Key Required</h2>
          <p className="mb-6 text-sm text-on-surface-variant">Please configure your Google Maps API key in secrets to use the map selection feature.</p>
          <button onClick={onClose} className="w-full rounded-full bg-surface-container-high py-3 font-bold text-on-surface">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" onClick={onClose} />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-2xl h-[70vh] flex flex-col overflow-hidden rounded-[2.5rem] bg-surface-container shadow-2xl border border-white/10"
      >
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <h2 className="text-xl font-black text-on-surface tracking-tight">Select Dive Location</h2>
          <button onClick={onClose} className="p-2 text-on-surface-variant hover:text-on-surface transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 relative">
            <Map
              defaultCenter={{ lat: 17.3160, lng: -87.5351 }}
              defaultZoom={12}
              mapId="DIVE_MAP_ID"
              className="w-full h-full"
              gestureHandling={'greedy'}
              disableDefaultUI={true}
              onClick={(e: MapMouseEvent) => {
                const latLng = e.detail.latLng;
                if (latLng && typeof latLng.lat === 'number' && typeof latLng.lng === 'number' && !isNaN(latLng.lat) && !isNaN(latLng.lng)) {
                  setSelectedPos(latLng);
                }
              }}
            >
              {markerLib && selectedPos && typeof selectedPos.lat === 'number' && typeof selectedPos.lng === 'number' && !isNaN(selectedPos.lat) && !isNaN(selectedPos.lng) && (
                <MapErrorBoundary>
                  <AdvancedMarker position={selectedPos}>
                    <div className="text-secondary">
                      <MapPin size={32} className="fill-secondary/20" />
                    </div>
                  </AdvancedMarker>
                </MapErrorBoundary>
              )}
            </Map>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xs px-6 pointer-events-none">
            <div className="bg-surface-container-high/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/10 text-center flex flex-col gap-3 pointer-events-auto">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                {selectedPos ? `Selected: ${selectedPos.lat.toFixed(4)}, ${selectedPos.lng.toFixed(4)}` : "Tap map to pick a site"}
              </p>
              <button
                disabled={!selectedPos}
                onClick={() => {
                  if (selectedPos) {
                    onSelect(`Dive Site (${selectedPos.lat.toFixed(4)}, ${selectedPos.lng.toFixed(4)})`, selectedPos);
                    onClose();
                  }
                }}
                className="w-full rounded-xl bg-secondary py-3 text-sm font-black uppercase tracking-widest text-on-secondary shadow-lg disabled:opacity-50 transition-all active:scale-95"
              >
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const StartDiveModal = ({ onClose }: { onClose: () => void }) => {
  const { updateBadgeStats } = useUser();
  const { profile } = useAuth();
  const [gpsLoading, setGpsLoading] = useState(true);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showDiveTypePicker, setShowDiveTypePicker] = useState(false);
  
  const [diveData, setDiveData] = useState({
    location: "Getting GPS location...",
    date: new Date().toISOString().split('T')[0],
    diveType: "Drift Dive", // Default to one of the new options
    depth: "",
    duration: "",
    fishSpotted: [] as string[],
    photos: [] as string[],
    notes: "",
    shareToFeed: true,
    feedDescription: "",
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Limit to 4 photos to be safe with document limits
    const remainingSlots = 4 - diveData.photos.length;
    if (remainingSlots <= 0) {
      alert("Maximum 4 photos per dive log.");
      return;
    }

    Array.from(files).slice(0, remainingSlots).forEach((file: any) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          // Compress using canvas
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_DIM = 800; // Resize to max 800px

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
          
          // Use JPEG compression at 0.7 quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          setDiveData(prev => ({
            ...prev,
            photos: [...prev.photos, compressedDataUrl]
          }));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const [fishSearch, setFishSearch] = useState("");
  const [showFishDropdown, setShowFishDropdown] = useState(false);

  const filteredFish = MARINE_LIFE_DATABASE.filter(f => 
    f.toLowerCase().includes(fishSearch.toLowerCase()) && 
    !diveData.fishSpotted.includes(f)
  );

  const handleAddFish = (fish: string) => {
    setDiveData(prev => ({ ...prev, fishSpotted: [...prev.fishSpotted, fish] }));
    setFishSearch("");
    setShowFishDropdown(false);
  };

  const handleRemoveFish = (fish: string) => {
    setDiveData(prev => ({ ...prev, fishSpotted: prev.fishSpotted.filter(f => f !== fish) }));
  };

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDiveData(prev => ({ ...prev, location: "Great Blue Hole, Belize (GPS)" }));
      setGpsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDiveData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[2rem] bg-surface-container p-6 sm:p-8 shadow-2xl border border-white/10 no-scrollbar"
      >
        <button 
          onClick={onClose}
          className="sticky float-right top-0 right-0 text-on-surface-variant hover:text-on-surface transition-colors z-20"
        >
          <X size={24} />
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-[1.25rem] bg-secondary/10 text-secondary border border-secondary/20 shadow-[0_0_20px_rgba(76,214,251,0.1)]">
              <Navigation size={32} />
            </div>
            <div>
              <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                Dive Log
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary/60">New entry in progress</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-6">
            <div className="group">
              <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-3 ml-1 group-focus-within:text-secondary transition-colors italic">Expedition Location</label>
              <div className="relative">
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setShowMapPicker(true)}
                  className="absolute left-1.5 top-1.5 h-[48px] w-[48px] flex items-center justify-center text-secondary hover:text-white transition-all z-10 bg-secondary/5 hover:bg-secondary/15 rounded-2xl border border-secondary/10"
                  title="Pick on map"
                >
                  <MapPin size={22} className="fill-secondary/5" />
                </motion.button>
                <input 
                  type="text" 
                  name="location"
                  placeholder="Enter location or pick on map..."
                  value={diveData.location}
                  onChange={handleChange}
                  className={cn(
                    "w-full rounded-[1.75rem] bg-black/40 py-5 pl-16 pr-12 text-base font-bold text-white placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-2 focus:ring-secondary/40 border border-white/5 transition-all hover:border-white/10 hover:bg-black/60",
                    gpsLoading && "animate-pulse text-on-surface-variant/60"
                  )}
                />
                {gpsLoading && (
                  <Crosshair className="absolute right-5 top-1/2 -translate-y-1/2 text-secondary animate-spin" size={20} />
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-3 ml-1 group-focus-within:text-secondary transition-colors">Date</label>
                <div className="relative">
                  <input 
                    type="date" 
                    name="date"
                    value={diveData.date}
                    onChange={handleChange}
                    onClick={(e) => {
                      if ('showPicker' in e.currentTarget) {
                        try {
                          e.currentTarget.showPicker();
                        } catch (err) {}
                      }
                    }}
                    className="w-full rounded-2xl bg-black/40 py-4 px-6 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-secondary/40 border border-white/5 transition-all hover:border-white/20 hover:bg-black/60 [color-scheme:dark] cursor-pointer"
                  />
                </div>
              </div>
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-3 ml-1 group-focus-within:text-primary transition-colors italic">Expedition Type</label>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary transition-colors pointer-events-none z-10">
                    <Compass size={20} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDiveTypePicker(true)}
                    className="w-full text-left rounded-2xl bg-black/40 py-4 pl-12 pr-10 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary/40 border border-white/5 transition-all hover:border-white/10 hover:bg-black/60 cursor-pointer overflow-hidden whitespace-nowrap text-ellipsis"
                  >
                    {diveData.diveType}
                  </button>
                  <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 rotate-90" />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-3 ml-1 group-focus-within:text-secondary transition-colors text-left">Max Depth (m)</label>
                <div className="relative">
                  <ArrowDown className="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-secondary transition-colors transition-all" size={20} />
                  <input 
                    type="number" 
                    name="depth"
                    placeholder="Depth"
                    value={diveData.depth}
                    onChange={handleChange}
                    className="w-full rounded-2xl bg-black/40 py-4 pl-12 pr-4 text-sm font-bold text-white placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-2 focus:ring-secondary/40 border border-white/5 transition-all hover:border-white/20 hover:bg-black/60"
                  />
                </div>
              </div>
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-3 ml-1 group-focus-within:text-tertiary transition-colors text-left">Duration (min)</label>
                <div className="relative">
                  <Waves className="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-tertiary transition-colors transition-all" size={20} />
                  <input 
                    type="number" 
                    name="duration"
                    placeholder="Time"
                    value={diveData.duration}
                    onChange={handleChange}
                    className="w-full rounded-2xl bg-black/40 py-4 pl-12 pr-4 text-sm font-bold text-white placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-2 focus:ring-tertiary/40 border border-white/5 transition-all hover:border-white/20 hover:bg-black/60"
                  />
                </div>
              </div>
            </div>

            <div className="group">
              <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-3 ml-1 group-focus-within:text-secondary transition-colors">Ecosystem Observations</label>
              <div className="relative mb-4" onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setShowFishDropdown(false);
                }
              }}>
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/20 z-10">
                  <Fish size={22} />
                </div>
                <input 
                  type="text"
                  placeholder="Search species..."
                  value={fishSearch}
                  onChange={(e) => {
                    setFishSearch(e.target.value);
                    setShowFishDropdown(true);
                  }}
                  onFocus={() => setShowFishDropdown(true)}
                  className="w-full rounded-2xl bg-black/40 py-4 pl-12 pr-4 text-sm font-bold text-white placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-2 focus:ring-secondary/40 border border-white/5 transition-all hover:border-white/20 hover:bg-black/60"
                />
                
                <AnimatePresence>
                  {showFishDropdown && (fishSearch || filteredFish.length > 0) && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      className="absolute top-full left-0 right-0 mt-3 max-h-56 overflow-y-auto rounded-3xl border border-white/10 bg-surface-container-highest shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)] z-50 no-scrollbar py-3 backdrop-blur-xl"
                    >
                      {filteredFish.length === 0 && fishSearch ? (
                        <div className="text-center p-6">
                          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 mb-3 ml-1 uppercase mb-4">Species Not Found</p>
                          <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="button"
                            onClick={() => handleAddFish(fishSearch)} 
                            className="w-full bg-secondary/10 hover:bg-secondary/20 text-secondary py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-secondary/20">
                            Force Add "{fishSearch}"
                          </motion.button>
                        </div>
                      ) : (
                        filteredFish.map((fish, idx) => (
                          <button
                            key={`${fish}-${idx}`}
                            type="button"
                            onClick={() => handleAddFish(fish)}
                            className="w-full text-left px-5 py-3 text-sm font-bold text-white/80 hover:text-white hover:bg-white/5 transition-all flex items-center gap-3 group/item border-b border-white/5 last:border-0"
                          >
                            <div className="w-2 h-2 rounded-full bg-secondary/30 group-hover/item:bg-secondary transition-colors" />
                            {fish}
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {diveData.fishSpotted.length > 0 && (
                <div className="flex flex-wrap gap-2.5 mb-2">
                  <AnimatePresence>
                    {diveData.fishSpotted.map((fish, fIdx) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8, x: -10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        key={`new-dive-fish-${fish}-${fIdx}`} 
                        className="flex items-center gap-2.5 rounded-xl bg-secondary/5 border border-secondary/20 py-2 pl-4 pr-2 group/tag hover:bg-secondary/10 transition-colors"
                      >
                        <span className="text-[11px] font-black uppercase tracking-wider text-secondary/80 group-hover/tag:text-secondary">{fish}</span>
                        <motion.button 
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleRemoveFish(fish)}
                          className="rounded-lg p-1 text-secondary/40 hover:text-secondary hover:bg-secondary/20 transition-colors"
                        >
                          <X size={14} />
                        </motion.button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div className="group">
              <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-3 ml-1 group-focus-within:text-white transition-colors">Visual Evidence</label>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handlePhotoUpload} 
                className="hidden" 
                multiple 
                accept="image/*" 
              />
              <motion.div 
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => fileInputRef.current?.click()}
                className="flex h-36 w-full cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-white/5 hover:border-white/20 bg-black/20 hover:bg-white/5 transition-all hover:shadow-[0_0_50px_-10px_rgba(76,214,251,0.05)] group/upload"
              >
                <div className="p-4 rounded-full bg-white/5 mb-3 group-hover/upload:bg-secondary/10 group-hover/upload:text-secondary transition-all">
                  <Camera className="text-white/20 group-hover/upload:text-secondary" size={32} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 group-hover/upload:text-secondary/60">Capture your discoveries</span>
              </motion.div>
              
              {diveData.photos.length > 0 && (
                <div className="mt-6 grid grid-cols-4 gap-3">
                  <AnimatePresence>
                    {diveData.photos.map((photo, i) => (
                      <motion.div 
                        key={`new-dive-photo-${photo}-${i}`}
                        initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="relative aspect-square overflow-hidden rounded-2xl border border-white/10"
                      >
                        <img src={photo} alt="" className="h-full w-full object-cover transition-transform duration-700 hover:scale-110" />
                        <div className="absolute top-2 right-2 z-10 bg-black/40 backdrop-blur-md rounded-full">
                          <ActionMenu 
                            items={[
                              { 
                                label: "Remove Photo", 
                                icon: <Trash2 size={16} />, 
                                onClick: () => setDiveData(prev => ({ ...prev, photos: prev.photos.filter((_, idx) => idx !== i) })),
                                destructive: true
                              }
                            ]}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-6 rounded-[2.5rem] bg-black/40 p-8 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-secondary/10 text-secondary border border-secondary/10">
                    <Share2 size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-tight italic">Share to Feed</h4>
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">Inspire the community</p>
                  </div>
                </div>
                <button 
                  onClick={() => setDiveData(prev => ({ ...prev, shareToFeed: !prev.shareToFeed }))}
                  className={cn(
                    "relative h-7 w-12 rounded-full transition-all duration-500 flex items-center px-1",
                    diveData.shareToFeed ? "bg-secondary" : "bg-white/10"
                  )}
                >
                  <motion.span 
                    animate={{ x: diveData.shareToFeed ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="h-5 w-5 rounded-full bg-white shadow-lg"
                  />
                </button>
              </div>

              <AnimatePresence>
                {diveData.shareToFeed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-1 ml-1 italic">Dive Narrative</label>
                      <textarea 
                        name="feedDescription"
                        placeholder="Tell the community about your discovery..."
                        value={diveData.feedDescription}
                        onChange={handleChange}
                        rows={3}
                        className="w-full rounded-2xl bg-white/5 py-5 px-6 text-sm font-bold text-white placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-2 focus:ring-secondary/40 border border-white/5 transition-all hover:bg-white/10 resize-none no-scrollbar font-medium italic"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <motion.button 
            whileHover={{ 
              scale: 1.02, 
              boxShadow: "0 20px 40px -12px rgba(76,214,251,0.5)"
            }}
            whileTap={{ scale: 0.98 }}
            onClick={async (e) => {
              if (!profile) return;
              const btn = e.currentTarget;
              const originalContent = btn.innerHTML;
              btn.innerHTML = `<span class="flex items-center gap-2 italic"><div class="h-4 w-4 animate-spin rounded-full border-2 border-on-secondary/30 border-t-white"></div> Analyzing Badges...</span>`;
              btn.disabled = true;

              try {
                // 1. Save to dives collection
                await addDoc(collection(db, "dives"), {
                  userId: profile.id,
                  userDisplayName: profile.displayName,
                  userPhotoURL: profile.photoURL,
                  location: filterProfanity(diveData.location),
                  date: diveData.date,
                  diveType: diveData.diveType,
                  depth: parseFloat(diveData.depth) || 0,
                  duration: parseInt(diveData.duration) || 0,
                  fishSpotted: diveData.fishSpotted.map(f => filterProfanity(f)),
                  photos: diveData.photos,
                  notes: filterProfanity(diveData.notes),
                  timestamp: serverTimestamp()
                });

                // 2. Share to feed if enabled
                if (diveData.shareToFeed) {
                  await addDoc(collection(db, "posts"), {
                    userId: profile.id,
                    userDisplayName: profile.displayName || "Unknown Diver",
                    userPhotoURL: profile.photoURL || "",
                    location: filterProfanity(diveData.location),
                    content: filterProfanity(diveData.feedDescription || `Logged a ${diveData.diveType} dive at ${diveData.location}!`),
                    image: diveData.photos[0] || "",
                    likesCount: 0,
                    commentsCount: 0,
                    likedBy: [],
                    reportsCount: 0,
                    reportedBy: [],
                    tags: [diveData.diveType, ...diveData.fishSpotted.slice(0, 2)].map(t => filterProfanity(t)),
                    timestamp: serverTimestamp()
                  });
                }

                // 3. Update User Profile
                const userRef = doc(db, "users", profile.id);
                
                // Calculate XP
                const baseXP = 100;
                
                const multiplier = 1.0;
                const depthValue = parseFloat(diveData.depth) || 0;
                const depthBonus = Math.floor(depthValue / 10) * 25; // 25 XP per 10m
                const photoBonus = diveData.photos.length * 50; // 50 XP per photo
                const shareBonus = diveData.shareToFeed ? 150 : 0; // 150 XP for community sharing
                
                // Calculate Species Discovery XP
                const fishBonus = diveData.fishSpotted.reduce((acc, species) => acc + getSpeciesXP(species), 0);
                
                const calculatedXP = Math.floor(baseXP * multiplier + depthBonus + photoBonus + shareBonus + fishBonus);

                await updateDoc(userRef, {
                  divesCount: increment(1),
                  points: increment(calculatedXP)
                });

                // 4. Calculate badge updates
                const statsToUpdate: Partial<Record<string, number>> = {};
                
                if (diveData.diveType) {
                  statsToUpdate[diveData.diveType] = 1;
                }
                
                if (!isNaN(depthValue) && depthValue > 30) {
                  // We can either keep giving them the old 'deep' badge or log their Deep Dive specifically
                  // Let's increment 'Deep Dive' anyway if depth is > 30 besides the selected dive type
                  if (diveData.diveType !== 'Deep Dive') {
                    statsToUpdate['Deep Dive'] = 1;
                  }
                }

                updateBadgeStats(statsToUpdate);

                btn.innerHTML = `<span class="flex items-center gap-2"><div class="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center"><svg size="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg></div> Expedition Saved!</span>`;
                btn.classList.add("bg-secondary", "text-on-secondary");
                
                setTimeout(() => {
                  onClose();
                }, 1200);
              } catch (err) {
                console.error("Failed to save dive:", err);
                btn.innerHTML = `<span class="flex items-center gap-2">⚠️ Save Failed</span>`;
                btn.classList.add("bg-error", "text-on-error");
                btn.disabled = false;
                setTimeout(() => {
                  btn.innerHTML = originalContent;
                  btn.classList.remove("bg-error", "text-on-error");
                }, 2000);
              }
            }}
            className="w-full flex justify-center items-center gap-3 rounded-[1.5rem] bg-secondary py-5 font-black uppercase tracking-[0.25em] text-on-secondary shadow-[0_12px_24px_-8px_rgba(76,214,251,0.4)] transition-all z-10"
          >
            Finalize Entry
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showMapPicker && (
          <MapSelectionModal 
            onClose={() => setShowMapPicker(false)}
            onSelect={(location) => {
              setDiveData(prev => ({ ...prev, location }));
            }}
          />
        )}
        {showDiveTypePicker && (
          <DiveTypePickerModal 
            isOpen={showDiveTypePicker}
            onClose={() => setShowDiveTypePicker(false)}
            onSelect={(type) => {
              setDiveData(prev => ({ ...prev, diveType: type }));
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const EXPEDITION_TYPES: Record<string, string[]> = {
  "Recreational Diving": ["Drift Dive", "Enriched Dive (nitrox)", "Deep Dive", "Night Dive", "Wreck Dive", "Ice Dive", "Altitude Dive"],
  "Technical Diving": ["Cave Dive", "Rebreather Diving", "Deep Sea/Trimix Diving"],
  "Freediving": ["Constant Weight (CWT)", "Constant No Fins (CNF)", "Free Immersion (FIM)", "Variable Weight (VWT)", "No Limits (NLT)"],
  "Pool Disciplines": ["Static Apnea (STA)", "Dynamic Apnea (DYN)"],
  "Professional & Scientific Diving": ["Commercial Diving", "Scientific Diving", "Public Safety Diving"]
};

const DiveTypePickerModal = ({ isOpen, onClose, onSelect }: { isOpen: boolean, onClose: () => void, onSelect: (val: string) => void }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) setSelectedCategory(null);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-[2rem] bg-surface-container-high border border-white/10 shadow-2xl p-6 no-scrollbar"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {selectedCategory && (
              <button 
                onClick={() => setSelectedCategory(null)}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/5"
                title="Go Back"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <h3 className="text-xl font-black italic tracking-tighter text-white">Select Expedition</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 text-on-surface-variant hover:text-white transition-colors border border-white/5">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {!selectedCategory ? (
            Object.keys(EXPEDITION_TYPES).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="flex items-center justify-between w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-left"
              >
                <span className="text-sm font-bold text-white">{cat}</span>
                <ChevronRight size={16} className="text-white/40" />
              </button>
            ))
          ) : (
            EXPEDITION_TYPES[selectedCategory].map(type => (
              <button
                key={type}
                onClick={() => { onSelect(type); onClose(); }}
                className="w-full p-4 rounded-xl bg-secondary/10 hover:bg-secondary/20 border border-secondary/20 text-secondary text-sm font-bold transition-all text-left"
              >
                {type}
              </button>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};


