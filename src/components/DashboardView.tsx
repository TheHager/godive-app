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
  Image as ImageIcon, Video, Star, Award, Globe, History, Box, Eye, CheckCircle2, Lock, ArrowUpRight, MessageSquare,
  Share2, Upload, Crosshair, HelpCircle, Pin, Trash2, User as UserIcon, AlertTriangle, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "../lib/utils";
import { ActionMenu } from "./ActionMenu";
import { NotificationCenter } from "./NotificationCenter";
import { NotificationService } from "../lib/NotificationService";
import { computeBadgesWithStats } from "../constants/badges";
import { RANKS, calculateLevel, getRankInfo, type Rank } from "../constants/ranks";
import { useUser } from "../contexts/UserContext";
import { APIProvider, Map, AdvancedMarker, Pin as GooglePin, MapMouseEvent, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapErrorBoundary } from "./MapErrorBoundary";
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit, doc, updateDoc, increment, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { View, Equipment } from "../types";
import { MARINE_LIFE_DATABASE, getSpeciesXP, getSpeciesRarity, MARINE_LIFE_LOWER_MAP } from "../constants/marineLife";
import { filterProfanity } from "../lib/profanity";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { WEEKLY_CHALLENGES } from "../constants/challenges";

const API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface SpeciesAppearance {
  source: 'dive' | 'sighting';
  location?: string;
  date?: string;
  timestamp?: any;
  [key: string]: any;
}

export const DashboardView = ({ onNavigateToEvent, onNavigateToProfile, onNavigateToDiveTimer }: { onNavigateToEvent?: (id: string) => void, onNavigateToProfile?: () => void, onNavigateToDiveTimer?: () => void }) => {
  const { profile } = useAuth();
  const { badgeStats: contextBadgeStats, updateBadgeStats } = useUser();
  const [activeHistory, setActiveHistory] = useState<'dives' | 'sightings' | null>(null);
  const [showBadges, setShowBadges] = useState(false);
  const [showRanks, setShowRanks] = useState(false);
  const [isLoggingDive, setIsLoggingDive] = useState(false);
  const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);
  const [showChallengeDetail, setShowChallengeDetail] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const notifService = NotificationService.getInstance();
    const handleNotifUpdate = () => {
      setUnreadNotifications(notifService.getUnreadCount());
    };
    notifService.addListener(handleNotifUpdate);
    return () => notifService.removeListener(handleNotifUpdate);
  }, []);

  const [allDives, setAllDives] = useState<any[]>([]);
  const [allSightings, setAllSightings] = useState<any[]>([]);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.id) return;
    
    const qD = query(collection(db, "dives"), where("userId", "==", profile.id), orderBy("timestamp", "desc"));
    const qS = query(collection(db, "sightings"), where("userId", "==", profile.id), orderBy("timestamp", "desc"));
    const qE = query(collection(db, "events"), where("participants", "array-contains", profile.id));
    const qEq = query(collection(db, "equipment"), where("userId", "==", profile.id));

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
      setMyEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "events");
    });

    const unsubscribeEq = onSnapshot(qEq, (snapshot) => {
      setEquipmentList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "equipment");
    });

    return () => {
      unsubscribeD();
      unsubscribeS();
      unsubscribeE();
      unsubscribeEq();
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

  const [dynamicStats, setDynamicStats] = useState<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;
    const fetchDynamicStats = async () => {
      if (!profile?.id) return;
      try {
        
        const mySitesSnap = await getDocs(query(collection(db, "dive_sites"), where("userId", "==", profile.id), where("status", "==", "verified")));
        const verifiedSitesCount = mySitesSnap.size;

        const myEventsSnap = await getDocs(query(collection(db, "events"), where("hostId", "==", profile.id)));
        const eventsCount = myEventsSnap.size;

        const myPostsSnap = await getDocs(query(collection(db, "posts"), where("userId", "==", profile.id)));
        const postsCount = myPostsSnap.size;

        if (isMounted) {
          setDynamicStats({
            'Reef Mapper': verifiedSitesCount,
            'Charter Captain': eventsCount,
            'Social Puffer': postsCount,
          });
        }
      } catch (e) {
        console.error("Error fetching dynamic stats", e);
      }
    };
    fetchDynamicStats();
    return () => { isMounted = false; };
  }, [profile?.id]);

  const badgeStats = useMemo(() => {
    const stats: Record<string, number> = {
      recreational: 0, deep: 0, wreck: 0, night: 0, cave: 0, 
      drift: 0, photography: 0, navigation: 0, rescue: 0, training: 0,
      ...contextBadgeStats,
      ...dynamicStats
    };

    const speciesWithPhoto = new Set<string>();

    allDives.forEach(dive => {
      const type = (dive.diveType || 'Recreational').toLowerCase();
      if (stats[type] !== undefined) stats[type]++;
      else stats.recreational++;

      if (dive.depth > 30) stats.deep++;

      if (dive.photos && dive.photos.length > 0 && dive.fishSpotted) {
        dive.fishSpotted.forEach((species: string) => speciesWithPhoto.add(species));
      }
    });

    stats['Species Sage'] = speciesWithPhoto.size;

    const now = Date.now();
    myEvents?.forEach((e) => {
      if (e.participants?.includes(profile?.id)) {
        const eventTime = new Date(`${e.date}T${e.time || "00:00"}`).getTime();
        if (eventTime < now) {
          if (e.type === 'Eco-Cleanup') stats['Reef Guardian'] = (stats['Reef Guardian'] || 0) + 1;
          if (e.type === 'Species Hunt') stats['Species Sage'] = (stats['Species Sage'] || 0) + 1;
          if (e.type === 'After-Dive Social') stats['Social Puffer'] = (stats['Social Puffer'] || 0) + 1;
          if (e.type === 'Drift / Current') stats['Drift Dive'] = (stats['Drift Dive'] || 0) + 1;
          if (e.type === 'Liveaboard / Full Day' || e.type === 'Exploration') stats['Expedition Leader'] = (stats['Expedition Leader'] || 0) + 1;
          if (e.type === 'Photography / Macro') stats['Photography'] = (stats['Photography'] || 0) + 1;
          if (e.type === 'Training / Skills') stats['Training'] = (stats['Training'] || 0) + 1;
          if (e.type === 'Shore Dive') stats['Local Legend'] = (stats['Local Legend'] || 0) + 1;
        }
      }
    });

    return stats;
  }, [allDives, contextBadgeStats, dynamicStats, myEvents, profile?.id]);

  const dives = allDives.length;
  const fish = discoveredSpecies.size;
  
  const [totalXp, setTotalXp] = useState<number>((profile?.points ?? 0) > 0 ? profile!.points! : (dives * 250 + fish * 15));

  const { pinnedBadgeId } = useUser();

  useEffect(() => {
    let isMounted = true;
    const syncProfileStats = async () => {
      if (!profile?.id) return;
      try {
        const userRef = doc(db, "users", profile.id);
        await updateDoc(userRef, {
          badgeStats,
          pinnedBadgeId: pinnedBadgeId || null
        });
      } catch (err) {
        console.error("Error syncing stats:", err);
      }
    };
    syncProfileStats();
    return () => { isMounted = false; };
  }, [badgeStats, pinnedBadgeId, profile?.id]);

  useEffect(() => {
    let isMounted = true;
    const fetchPoints = async () => {
      if (!profile?.id) return;
      try {
        const xp = profile?.points || 0;
        const rankingPoints = profile?.rankingPoints || 0;
        let likes = 0;

        const postsSnapshot = await getDocs(query(collection(db, "posts"), where("userId", "==", profile.id), limit(100)));
        const postPromises = postsSnapshot.docs.map(async (docSnap) => {
           const pData = docSnap.data();
           likes += (pData.likesCount || 0);
           try {
             const commentsSnapshot = await getDocs(query(collection(db, "posts", docSnap.id, "comments"), where("userId", "==", profile.id)));
             commentsSnapshot.forEach(c => {
               likes += (c.data().likesCount || 0);
             });
           } catch (e) {
             console.error("Error fetching comments for points calculation", e);
           }
        });
        await Promise.all(postPromises);
        
        let eventsXp = 0;
        const now = Date.now();
        myEvents?.forEach((e) => {
          if (e.participants?.includes(profile?.id)) {
            const eventTime = new Date(`${e.date}T${e.time || "00:00"}`).getTime();
            if (eventTime < now) {
              eventsXp += 150;
            }
          }
        });

        if (isMounted) {
          setTotalXp(xp + rankingPoints + likes + eventsXp);
        }
      } catch (e) {
        console.error("Error calculating total points:", e);
      }
    };
    fetchPoints();
    return () => { isMounted = false; };
  }, [profile?.points, profile?.rankingPoints, profile?.id, profile, myEvents]);

  const validTotalXp = Math.max(0, totalXp || 0);
  const level = calculateLevel(validTotalXp);
  const currentLevelXp = Math.pow(level - 1, 2) * 100;
  const nextLevelXp = Math.pow(level, 2) * 100;
  const xpProgress = isNaN(validTotalXp) ? 0 : Math.max(0, Math.min(100, ((validTotalXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100));

  const rankInfo = getRankInfo(level);

  const allBadges = computeBadgesWithStats(badgeStats);
  const earnedBadges = allBadges.filter(b => b.earned);

  const now = new Date();
  const serviceDueEquipment = equipmentList.filter(eq => {
    if (eq.nextServiceDate) {
      const nextService = new Date(eq.nextServiceDate);
      if (nextService <= now) return true;
    }
    if (eq.useLimit && eq.useCount >= eq.useLimit) return true;
    return false;
  });

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-background text-on-background selection:bg-primary/30">
      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-4 md:px-8 md:pt-6">
        {/* TopAppBar (Mobile Only) */}
        <header className="mb-6 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-2">
            <span className="font-sans text-3xl text-primary tracking-tighter font-extrabold">GoDive</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowNotifications(true)}
              className="relative p-3 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant cursor-pointer border border-outline-variant/20"
            >
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              {unreadNotifications > 0 && (
                <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-background animate-pulse" />
              )}
            </button>
            <div
              onClick={() => onNavigateToProfile?.()}
              className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary/20 shadow-md cursor-pointer transition-transform active:scale-95"
            >
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-surface-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[32px] text-on-surface-variant">account_circle</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative w-full h-[320px] md:h-[400px] rounded-3xl overflow-hidden shadow-sm group mb-6">
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105" 
            style={{ backgroundImage: `url("https://images.unsplash.com/photo-1544552866-d3ed42536cfd?auto=format&fit=crop&q=80&w=1600")` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full p-6 md:p-10 flex flex-col justify-end">
            <p className="font-sans text-xs font-bold tracking-widest text-primary uppercase mb-1 opacity-90">Welcome back</p>
            <h2 className="font-sans text-2xl md:text-4xl font-extrabold text-on-surface mb-6">
              Your next adventure awaits, {profile?.displayName || "Diver"}.
            </h2>
            
            <div
              onClick={() => setShowRanks(true)}
              className="glass-pane rounded-2xl p-5 max-w-md w-full backdrop-blur-xl cursor-pointer hover:bg-white/80 transition-colors"
            >
              <div className="flex justify-between items-end mb-2">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Current Status</p>
                  <div className="flex items-center gap-1.5 mb-0.5 text-primary">
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    <p className="text-[10px] font-bold uppercase tracking-wider">{rankInfo.title}</p>
                  </div>
                  <p className="text-sm font-extrabold text-on-surface">Level {level}</p>
                </div>
                <p className="text-xs font-bold text-primary">
                  {nextLevelXp - validTotalXp} XP to Lvl {level + 1}
                </p>
              </div>
              <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" 
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <button 
            onClick={() => setIsLoggingDive(true)}
            className="bg-primary text-on-primary font-sans text-xs font-bold uppercase tracking-wider py-4 px-6 rounded-2xl flex justify-center items-center gap-2 hover:bg-primary-container transition-all shadow-sm active:scale-[0.98] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            Log New Dive
          </button>
          <button 
            onClick={() => onNavigateToEvent?.('explorer')}
            className="bg-surface-container-lowest text-on-surface border border-outline-variant/30 font-sans text-xs font-bold uppercase tracking-wider py-4 px-6 rounded-2xl flex justify-center items-center gap-2 hover:bg-surface-container transition-all shadow-sm active:scale-[0.98] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">explore</span>
            Explore Sites
          </button>
        </div>

        <button 
          onClick={() => onNavigateToDiveTimer?.()}
          className="w-full bg-error text-white font-sans text-xs font-bold uppercase tracking-wider py-4 px-6 rounded-2xl flex justify-center items-center gap-2 hover:bg-red-600 transition-all shadow-sm active:scale-[0.98] cursor-pointer mb-6"
        >
          <span className="material-symbols-outlined text-[20px]">warning</span>
          Launch Dive Safety Timer
        </button>

        {/* Bento Grid Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div 
            onClick={() => setActiveHistory('dives')}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm flex flex-col justify-between aspect-square md:aspect-auto md:h-36 cursor-pointer hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-outline text-2xl mb-4">history</span>
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Total Dives</p>
              <p className="text-3xl font-extrabold text-on-surface">{dives}</p>
            </div>
          </div>
          <div 
            onClick={() => setActiveHistory('sightings')}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm flex flex-col justify-between aspect-square md:aspect-auto md:h-36 cursor-pointer hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-outline text-2xl mb-4">set_meal</span>
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Species Spotted</p>
              <p className="text-3xl font-extrabold text-on-surface">{fish}</p>
            </div>
          </div>
        </div>

        {/* Weekly Challenges */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[2rem] overflow-hidden shadow-sm mb-6">
          <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 p-6 border-b border-outline-variant/20">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-sans text-xl text-on-surface font-black uppercase tracking-tight">Weekly Challenge</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Limited Time Event</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded-full border border-primary/20">Active Now</span>
              </div>
            </div>
          </div>

          {(() => {
            const startOfYear = new Date(new Date().getFullYear(), 0, 1);
            const today = new Date();
            const diff = today.getTime() - startOfYear.getTime();
            const oneWeek = 1000 * 60 * 60 * 24 * 7;
            const weekIndex = Math.floor(diff / oneWeek) % WEEKLY_CHALLENGES.length;
            const challenge = WEEKLY_CHALLENGES[weekIndex];

            return (
              <div
                onClick={() => setShowChallengeDetail(true)}
                className="p-6 relative group cursor-pointer hover:bg-surface-container-low transition-colors"
              >
                <div className="flex flex-col gap-5">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white shadow-lg shadow-primary/20 shrink-0">
                      <span className="material-symbols-outlined text-3xl">
                        {challenge.icon || "military_tech"}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-black text-on-surface leading-tight mb-1">{challenge.title}</h4>
                      <p className="text-sm text-on-surface-variant font-medium leading-relaxed italic opacity-80 line-clamp-2">
                        {challenge.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <div className="bg-surface-container rounded-2xl p-3 border border-outline-variant/20 flex flex-col items-center justify-center gap-1">
                      <div className="flex items-center gap-1.5 text-primary">
                        <span className="material-symbols-outlined text-[18px]">military_tech</span>
                        <span className="text-sm font-black">{challenge.points}</span>
                      </div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60">XP Bonus</p>
                    </div>
                    <div className="bg-surface-container rounded-2xl p-3 border border-outline-variant/20 flex flex-col items-center justify-center gap-1">
                      <div className="flex items-center gap-1.5 text-secondary">
                        <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                        <span className="text-sm font-black">{(challenge as any).rewardTitle || challenge.badge}</span>
                      </div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60">{(challenge as any).rewardTitle ? 'Unlock Title' : 'Unlock Badge'}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-center">
                  <button className="w-full py-3.5 rounded-xl bg-on-surface text-surface font-black uppercase tracking-[0.2em] text-[10px] shadow-sm hover:scale-[1.02] active:scale-95 transition-all">
                    Participate Now
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Joined Events */}
        {myEvents.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="font-sans text-on-surface text-lg font-black uppercase tracking-tight italic">Events You've Joined</h3>
              <button 
                onClick={() => onNavigateToEvent?.('list')}
                className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline cursor-pointer"
              >
                View All
              </button>
            </div>

            <div className="no-scrollbar flex gap-4 overflow-x-auto -mx-4 px-4 pb-2 snap-x snap-mandatory">
              {myEvents.map((e) => (
                <div 
                  key={e.id}
                  onClick={() => onNavigateToEvent?.(e.id)}
                  className="snap-start shrink-0 flex flex-col items-center gap-2 group cursor-pointer w-24"
                >
                  <div className="w-20 h-20 rounded-full bg-surface-container-lowest border-2 border-primary/20 shadow-md flex items-center justify-center text-primary group-hover:scale-105 group-hover:border-primary transition-all overflow-hidden relative">
                    {e.image ? (
                      <img src={e.image} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="material-symbols-outlined text-[32px]">calendar_today</span>
                    )}
                    <div className="absolute inset-0 bg-primary/5 group-hover:bg-transparent transition-colors" />
                  </div>
                  <p className="text-[10px] font-extrabold text-on-surface text-center leading-tight line-clamp-2 uppercase tracking-tighter">
                    {e.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dive Badges */}
        <section className="w-full min-w-0 pb-10">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-2xl font-bold tracking-tight text-on-surface">Dive Badges</h3>
            <button 
              onClick={() => setShowBadges(true)}
              className="flex items-center gap-1 text-sm font-bold text-primary transition-colors hover:text-primary-container cursor-pointer"
            >
              All Badges <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
          
          {earnedBadges.length > 0 ? (
            <div className="no-scrollbar flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scroll-pl-4 md:-mx-8 md:px-8 md:scroll-pl-8 snap-x snap-mandatory after:content-[''] after:shrink-0 after:w-px border-transparent">
              {earnedBadges.map((badge, idx) => (
                <div key={`badge-${badge.id}-${idx}`} className="snap-start shrink-0 cursor-pointer" onClick={() => setActiveBadgeId(badge.id)}>
                  <BadgeCard {...badge} id={badge.id} />
                </div>
              ))}
            </div>
          ) : (
            <div 
              onClick={() => setShowBadges(true)}
              className="flex flex-col items-center justify-center py-10 px-6 rounded-[2rem] bg-surface-container-lowest border border-dashed border-outline-variant/30 cursor-pointer hover:bg-surface-container transition-colors group"
            >
              <div className="h-12 w-12 rounded-full bg-surface-container flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl text-on-surface-variant">workspace_premium</span>
              </div>
              <p className="text-sm font-medium text-on-surface-variant">No badges earned yet</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mt-1">Tap to see all available</p>
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
            onNavigateToProfile={onNavigateToProfile}
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
        {showChallengeDetail && (
          <ChallengeDetailModal
            onClose={() => setShowChallengeDetail(false)}
          />
        )}
        {showNotifications && (
          <NotificationCenter 
            onClose={() => setShowNotifications(false)} 
            onNavigateToDiveTimer={onNavigateToDiveTimer}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const ChallengeDetailModal = ({ onClose }: { onClose: () => void }) => {
  const startOfYear = new Date(new Date().getFullYear(), 0, 1);
  const today = new Date();
  const diff = today.getTime() - startOfYear.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  const weekIndex = Math.floor(diff / oneWeek) % WEEKLY_CHALLENGES.length;
  const challenge = WEEKLY_CHALLENGES[weekIndex];

  const participants = [
    { name: "Tobias", status: "In Progress", progress: 65, avatar: null },
    { name: "MarineExplorer", status: "Completed", progress: 100, avatar: null },
    { name: "DeepDiver99", status: "In Progress", progress: 30, avatar: null },
    { name: "AquaLuna", status: "In Progress", progress: 10, avatar: null },
  ];

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
        className="relative w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] rounded-[3rem] bg-surface-container-lowest border border-outline-variant/30 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-48 w-full overflow-hidden shrink-0">
          <img src={challenge.image} className="w-full h-full object-cover" alt={challenge.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/40 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 transition-colors"
          >
            <X size={20} />
          </button>
          <div className="absolute bottom-6 left-8">
            <span className="bg-primary text-on-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-2 inline-block">
              Weekly Event
            </span>
            <h2 className="text-2xl font-black text-on-surface uppercase italic tracking-tight">{challenge.title}</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">assignment</span>
              Mission Requirements
            </h3>
            <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/20">
              <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
                {challenge.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-surface-container px-4 py-2 rounded-full border border-outline-variant/10">
                  <span className="material-symbols-outlined text-primary text-[18px]">military_tech</span>
                  <span className="text-xs font-bold text-on-surface">{challenge.points} XP</span>
                </div>
                <div className="flex items-center gap-2 bg-surface-container px-4 py-2 rounded-full border border-outline-variant/10">
                  <span className="material-symbols-outlined text-secondary text-[18px]">workspace_premium</span>
                  <span className="text-xs font-bold text-on-surface">{(challenge as any).rewardTitle || challenge.badge}</span>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-secondary flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">groups</span>
                Live Participants
              </h3>
              <span className="text-[10px] font-bold text-on-surface-variant opacity-50">1,248 Explorers Joined</span>
            </div>

            <div className="space-y-3">
              {participants.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center border border-outline-variant/10">
                      <UserIcon size={18} className="text-on-surface-variant/40" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">{p.name}</p>
                      <p className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        p.status === 'Completed' ? "text-green-500" : "text-primary/60"
                      )}>
                        {p.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 min-w-[80px]">
                    <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${p.progress}%` }}
                        className={cn(
                          "h-full rounded-full",
                          p.status === 'Completed' ? "bg-green-500" : "bg-primary"
                        )}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-on-surface-variant">{p.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="p-8 border-t border-outline-variant/20 bg-surface-container-low/50 backdrop-blur-md">
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl bg-primary text-on-primary font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            I'm taking the challenge!
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const RanksModal = ({ ranks, activeLevel, onClose }: { ranks: Rank[], activeLevel: number, onClose: () => void }) => {
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

import { MARINE_SPECIES_DATA } from "../constants/marineLifeData";

const HistoryModal = ({ 
  type, 
  onClose,
  allDives,
  allSightings,
  discoveredSpecies,
  onNavigateToProfile
}: { 
  type: 'dives' | 'sightings', 
  onClose: () => void,
  allDives: any[],
  allSightings: any[],
  discoveredSpecies: Set<string>,
  onNavigateToProfile?: () => void
}) => {
  const { profile } = useAuth();
  const isDives = type === 'dives';
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<'all' | 'spotted' | 'not-seen' | 'rare'>('all');
  const [selectedSpecies, setSelectedSpecies] = useState<any>(null);

  const speciesLogMap = React.useMemo(() => {
    const map = new window.Map<string, { count: number, lastSeen?: any }>();
    
    const record = (species: string, timestamp: any) => {
      if (!species) return;
      const key = species.trim();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { count: 1, lastSeen: timestamp });
      } else {
        existing.count += 1;
        if (timestamp?.seconds > (existing.lastSeen?.seconds || 0)) {
          existing.lastSeen = timestamp;
        }
      }
    };

    allSightings.forEach(s => record(s.species || s.label, s.timestamp));
    allDives.forEach(d => {
      if (d.fishSpotted) d.fishSpotted.forEach((s: string) => record(s, d.timestamp));
    });

    return map;
  }, [allSightings, allDives]);

  const filteredSpecies = React.useMemo(() => {
    let list = MARINE_SPECIES_DATA.map(s => {
      const stats = speciesLogMap.get(s.name);
      return {
        ...s,
        spottedCount: stats?.count || 0,
        lastSeen: stats?.lastSeen
      };
    });

    if (searchQuery) {
      list = list.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.scientificName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filter === 'spotted') list = list.filter(s => s.spottedCount > 0);
    if (filter === 'not-seen') list = list.filter(s => s.spottedCount === 0);
    if (filter === 'rare') list = list.filter(s => s.rarity === 'rare');

    return list;
  }, [speciesLogMap, searchQuery, filter]);

  if (isDives) {
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
          className="relative w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] rounded-[3rem] bg-surface-container-high border border-white/10 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-white/5 bg-surface-container-high/50 backdrop-blur-md md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black tracking-tighter text-white uppercase italic">Dive Journal</h3>
              <button onClick={onClose} className="p-2 rounded-full bg-white/5 text-on-surface-variant hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-black/40 border border-white/5 rounded-full py-3 pl-11 pr-4 text-xs font-bold text-white w-full"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">
            <div className="flex flex-col gap-4">
              {allDives.filter(i => (i.location || "").toLowerCase().includes(searchQuery.toLowerCase())).map((item) => (
                <div key={item.id} className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined">history</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="text-lg font-black text-primary truncate leading-none mb-1">
                        {item.location}
                      </h4>
                      <span className="text-[10px] font-black uppercase text-on-surface-variant/40 shrink-0 ml-2">
                        {formatDate(item.date)}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant/60 font-bold truncate italic">
                      {item.diveType || 'Diving'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* TopAppBar (Matched with Main Header) */}
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-sans text-3xl text-primary tracking-tighter font-extrabold">GoDive</span>
        </div>
        <div className="flex items-center gap-4">
          <div
            onClick={() => {
              onClose();
              onNavigateToProfile?.();
            }}
            className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary/20 shadow-md cursor-pointer transition-transform active:scale-95"
          >
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant">account_circle</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-surface-container/50 text-on-surface-variant hover:text-primary transition-colors">
            <X size={24} />
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-6 mb-6">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search marine species..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0089b7]/20 transition-all"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 mb-8 flex gap-3 overflow-x-auto no-scrollbar">
        {[
          { id: 'all', label: 'All' },
          { id: 'spotted', label: 'Spotted' },
          { id: 'not-seen', label: 'Not Seen' },
          { id: 'rare', label: 'Rare' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={cn(
              "shrink-0 px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all",
              filter === f.id ? "bg-[#005f82] text-white shadow-md" : "bg-[#eff6ff] text-[#005f82] border border-[#005f82]/10"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-10 no-scrollbar">
        <div className="grid grid-cols-2 gap-4">
          {filteredSpecies.map((species, idx) => {
            const isFeatured = idx === 0 && filter === 'all' && !searchQuery;
            return (
              <motion.div
                key={species.id}
                onClick={() => setSelectedSpecies(species)}
                className={cn(
                  "relative rounded-[2.5rem] bg-white border border-slate-100 shadow-sm overflow-hidden flex flex-col group cursor-pointer hover:shadow-md transition-all",
                  isFeatured && "col-span-2 aspect-[16/9]"
                )}
              >
                <div className={cn("relative w-full overflow-hidden", isFeatured ? "flex-1" : "aspect-square")}>
                  <img src={species.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={species.name} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {isFeatured && (
                    <div className="absolute bottom-6 left-8 right-6 flex items-end justify-between">
                      <div>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter leading-none mb-1">{species.name}</h2>
                        <p className="text-sm font-bold text-white/70 italic">{species.scientificName}</p>
                      </div>
                      <div className="bg-[#005f82] px-4 py-2 rounded-full shadow-lg border border-white/10">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">
                          {species.spottedCount > 0 ? "SPOTTED" : "NOT SEEN"}
                        </span>
                      </div>
                    </div>
                  )}

                  {!isFeatured && (
                    <div className="absolute top-4 right-4">
                      <button className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/10">
                        <HeartPulse size={20} className={species.spottedCount > 0 ? "fill-white" : ""} />
                      </button>
                    </div>
                  )}
                </div>

                {!isFeatured && (
                  <div className="p-5 flex flex-col items-center text-center">
                    <h3 className="text-base font-black text-[#1e293b] leading-tight mb-0.5">{species.name}</h3>
                    <p className="text-[11px] font-bold text-slate-400 italic mb-4">{species.scientificName}</p>

                    <div className="w-full pt-4 border-t border-slate-50">
                      {species.rarity === 'rare' ? (
                        <div className="flex items-center justify-center gap-1.5 text-error">
                          <AlertTriangle size={14} className="fill-error/10" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Rare Species</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                           <span className={cn(
                             "text-[9px] font-black uppercase tracking-widest",
                             species.spottedCount > 0 ? "text-[#0089b7]" : "text-slate-300"
                           )}>
                             {species.spottedCount > 0 ? `Spotted ${species.spottedCount}x` : "Not Seen"}
                           </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom Padding for Navbar */}
      <div className="h-24 shrink-0" />
    </motion.div>
  );
};

const BadgesModal = ({ badges, onClose, onBadgeClick }: { badges: any[], onClose: () => void, onBadgeClick: (id: string) => void }) => {
  const earned = badges.filter(b => b.earned);
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
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="relative w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] rounded-[32px] bg-surface-container-high border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center p-6 border-b border-white/5 relative">
          <h3 className="text-2xl font-black italic tracking-tight text-on-surface">All Badges</h3>
          <button onClick={onClose} className="absolute right-6 p-2 rounded-full text-on-surface-variant hover:bg-white/5"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar flex flex-col gap-10">
          <div>
            <h4 className="text-xl font-black italic text-on-surface mb-6 flex items-center gap-2"><Award className="text-secondary" /> Earned ({earned.length})</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {earned.map(b => (
                <div key={b.id} className="relative flex flex-col items-center gap-2 p-4 rounded-3xl bg-surface-container/50 border border-white/5 group cursor-pointer" onClick={() => onBadgeClick(b.id)}>
                   <div className={cn("flex h-14 w-14 items-center justify-center rounded-full border-2 p-3", getTierColor(b.tier))}>
                    <b.icon size={24} />
                  </div>
                  <span className="text-[11px] font-bold text-on-surface text-center uppercase">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const BadgeDetailModal = ({ badgeId, onClose, onAction }: { badgeId: string, onClose: () => void, onAction: () => void }) => {
  const { badgeStats } = useUser();
  const allBadges = computeBadgesWithStats(badgeStats);
  const badge = allBadges.find(b => b.id === badgeId);

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
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-[3rem] bg-surface-container-high border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-10 flex flex-col items-center text-center">
          <div className={cn("flex h-24 w-24 items-center justify-center rounded-full border-4 p-5 mb-6", getTierColor(badge.tier))}>
            <badge.icon size={48} />
          </div>
          <h3 className="text-3xl font-black uppercase text-white italic mb-2">{badge.label}</h3>
          <p className="text-xs text-on-surface-variant/60 mb-8">{badge.desc}</p>
          <button onClick={onClose} className="w-full py-4 rounded-2xl bg-primary text-on-primary font-black uppercase tracking-widest">Close</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const StatsCard = ({ title, value, unit, icon: Icon, color, onClick }: StatsCardProps) => (
  <motion.div
    whileHover={{ y: -5 }}
    onClick={onClick}
    className={cn("relative overflow-hidden rounded-[1.75rem] p-5 backdrop-blur-2xl border border-white/10 shadow-2xl cursor-pointer", color === "primary" ? "bg-primary/5" : "bg-secondary/5")}
  >
    <Icon className="absolute -right-4 -top-4 opacity-5 text-white" size={140} />
    <div className="relative z-10">
      <p className="text-[10px] font-black uppercase text-on-surface-variant/40">{title}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-black text-white">{value}</span>
        <span className="text-[10px] font-black text-on-surface-variant/30 uppercase">{unit}</span>
      </div>
    </div>
  </motion.div>
);

const BadgeCard = ({ id, label, icon: Icon, color, tier, progressRatio, currentValue, nextTierRequirement, unit }: any) => (
  <div className="flex min-w-[140px] flex-col items-center gap-4 rounded-3xl bg-surface-container-high/40 p-6 backdrop-blur-xl border border-white/5">
    <div className={cn("flex h-16 w-14 items-center justify-center rounded-full border-2 p-3", getTierColor(tier))}>
      <Icon size={24} />
    </div>
    <span className="text-xs font-bold text-on-surface text-center uppercase">{label}</span>
  </div>
);

const getTierColor = (tier: string) => {
  switch (tier?.toLowerCase()) {
    case 'bronze': return 'bg-amber-700/20 text-amber-600 border-amber-700/30';
    case 'silver': return 'bg-slate-400/20 text-slate-300 border-slate-400/30';
    case 'gold': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
    case 'platinum': return 'bg-cyan-300/20 text-cyan-200 border-cyan-300/30';
    case 'diamond': return 'bg-purple-400/20 text-purple-300 border-purple-400/30';
    default: return 'bg-white/5 text-white/20 border-white/10';
  }
};

const getTierSolidColor = (tier: string) => {
  switch (tier?.toLowerCase()) {
    case 'bronze': return 'bg-amber-600';
    case 'silver': return 'bg-slate-300';
    case 'gold': return 'bg-yellow-500';
    case 'platinum': return 'bg-cyan-300';
    case 'diamond': return 'bg-purple-400';
    default: return 'bg-white/20';
  }
};

interface StatsCardProps {
  title: string;
  value: number | string;
  unit: string;
  icon: React.ElementType;
  color: 'primary' | 'secondary';
  onClick: () => void;
}

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
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-[2rem] bg-white border border-slate-200 shadow-2xl p-6 no-scrollbar"
      >
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="p-1.5 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors border border-slate-200"
                title="Go Back"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <h3 className="text-xl font-black italic tracking-tighter text-slate-800 uppercase">
              {selectedCategory || "Select Expedition"}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {!selectedCategory ? (
            Object.keys(EXPEDITION_TYPES).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="flex items-center justify-between w-full p-5 rounded-full bg-white border border-slate-100 hover:bg-slate-50 hover:border-[#0089b7]/20 transition-all text-left shadow-sm group"
              >
                <span className="text-sm font-black text-slate-800 group-hover:text-[#0089b7]">{cat}</span>
                <ChevronRight size={18} className="text-slate-300 group-hover:text-[#0089b7]/40" />
              </button>
            ))
          ) : (
            EXPEDITION_TYPES[selectedCategory].map(type => (
              <button
                key={type}
                onClick={() => { onSelect(type); onClose(); }}
                className="w-full p-5 rounded-full bg-white hover:bg-[#0089b7] border border-slate-100 text-slate-800 hover:text-white text-sm font-black transition-all text-left shadow-sm"
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

const StartDiveModal = ({ onClose }: { onClose: () => void }) => {
  const { updateBadgeStats } = useUser();
  const { profile } = useAuth();
  const [gpsLoading, setGpsLoading] = useState(true);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showDiveTypePicker, setShowDiveTypePicker] = useState(false);

  const [diveData, setDiveData] = useState({
    location: "Getting GPS location...",
    date: new Date().toISOString().split('T')[0],
    diveType: "Drift Dive",
    depth: "",
    duration: "",
    fishSpotted: [] as string[],
    photos: [] as string[],
    notes: "",
    shareToFeed: true,
    feedDescription: "",
    useStandardSetup: true,
    selectedEquipmentIds: [] as string[],
  });

  // --- Ecosystem Observation State ---
  const [aiDetectionStatus, setAiDetectionStatus] = useState<'idle' | 'detecting' | 'done'>('idle');
  const [detectedSpecies, setDetectedSpecies] = useState<{name: string, confidence: number, accepted?: boolean, isManualEntry?: boolean}[]>([]);
  const [speciesToView, setSpeciesToView] = useState<any>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const speciesSearchRef = React.useRef<HTMLInputElement>(null);

  // Production-ready vision API pipeline
  const identifySpecies = async (imageBase64: string) => {
    setAiDetectionStatus('detecting');

    try {
      // Ensure we hit the absolute URL in production so we don't fall back to an empty static file
      const baseUrl = import.meta.env.VITE_API_URL || 'https://us-central1-project-7c683cb5-9592-4a84-97d.cloudfunctions.net';
      const response = await fetch(`${baseUrl}/identifySpecies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageBase64,
          maxResults: 3,
          confidenceThreshold: 0.5,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`Vision API error: ${response.status}`, errorData || 'Unknown error');
        setAiDetectionStatus('done');
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        console.error("Invalid JSON response from vision API. Is the backend server running?", parseErr);
        setAiDetectionStatus('done');
        return;
      }

      // Expected response shape:
      // { matches: [{ name: string, confidence: number }] }
      if (data?.matches && Array.isArray(data.matches) && data.matches.length > 0) {
        // De-duplicate within the new batch and cap at 3 results
        const seen = new Set<string>();
        const newResults = data.matches
          .filter((m: { name: string }) => {
            if (seen.has(m.name)) return false;
            seen.add(m.name);
            return true;
          })
          .slice(0, 3)
          .map((m: { name: string; confidence: number }) => ({
            name: m.name,
            confidence: Math.round(m.confidence * 100),
            accepted: false,
            isManualEntry: false,
          }));

        // Merge with existing state: keep old entries intact, only append new unique ones
        setDetectedSpecies(prev => {
          const merged = [...prev];
          newResults.forEach((r: any) => {
            if (!merged.find(p => p.name === r.name)) {
              merged.push(r);
            }
          });
          return merged;
        });
      }
      // If no matches returned, detectedSpecies stays empty — no quiz, no guessing
    } catch (err) {
      console.error('Species identification failed:', err);
      // Silent failure: suggestion area stays empty, manual input is the fallback
    } finally {
      setAiDetectionStatus('done');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setAiDetectionStatus('idle');

    let maxPhotos = 3;
    if (profile?.subscriptionTier === 'premium') maxPhotos = 10;
    if (profile?.subscriptionTier === 'vip') maxPhotos = 30;

    const remainingSlots = maxPhotos - diveData.photos.length;
    if (remainingSlots <= 0) {
      alert(`Maximum ${maxPhotos} photos per dive log on your current plan.`);
      return;
    }

    Array.from(files).slice(0, remainingSlots).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
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
          setDiveData(prev => ({
            ...prev,
            photos: [...prev.photos, compressedDataUrl]
          }));
          identifySpecies(compressedDataUrl);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const [fishSearch, setFishSearch] = useState("");
  const [showFishDropdown, setShowFishDropdown] = useState(false);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);

  React.useEffect(() => {
    if (!profile?.id) return;
    const q = query(collection(db, "equipment"), where("userId", "==", profile.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const equip: Equipment[] = [];
      snapshot.forEach((docSnap) => {
        equip.push({ id: docSnap.id, ...docSnap.data() } as Equipment);
      });
      setEquipmentList(equip);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "equipment");
    });
    return () => unsubscribe();
  }, [profile?.id]);

  const filteredFish = MARINE_LIFE_DATABASE.filter(f =>
    f.toLowerCase().includes(fishSearch.toLowerCase()) &&
    !diveData.fishSpotted.includes(f)
  );

  const handleAddFish = (fish: string, isManual = false) => {
    if (diveData.fishSpotted.includes(fish)) return; // prevent duplicate log entries
    setDiveData(prev => ({ ...prev, fishSpotted: [...prev.fishSpotted, fish] }));
    setFishSearch("");
    setShowFishDropdown(false);
    
    // If accepting an existing AI suggestion, mark it accepted
    // If manual entry, add a standalone entry — never pollute AI cards with manual flags
    setDetectedSpecies(prev => {
        const existingIdx = prev.findIndex(sp => sp.name === fish);
        if (existingIdx !== -1) {
            const updated = [...prev];
            updated[existingIdx] = { ...updated[existingIdx], accepted: true };
            return updated;
        }
        // Only append a manual entry card if this is a manual selection
        if (isManual) {
            return [...prev, { name: fish, confidence: -1, accepted: true, isManualEntry: true }];
        }
        return prev;
    });
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[2.5rem] bg-[#f8fafc] p-6 sm:p-8 shadow-2xl border border-white no-scrollbar"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#0089b7] flex items-center justify-center text-white shadow-md">
              <span className="text-xl font-bold">A</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#1e293b] italic tracking-tight uppercase leading-none">
                Dive Log
              </h2>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0089b7] mt-1.5 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#0089b7] animate-pulse" />
                New entry in progress
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Location */}
          <div className="group">
            <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 ml-1">Expedition Location</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0089b7] z-10 pointer-events-none">
                <MapPin size={18} className="fill-[#0089b7]/10" />
              </div>
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="w-full text-left rounded-xl bg-white py-4 pl-12 pr-4 text-sm font-bold text-slate-700 border border-slate-200 hover:border-[#0089b7]/30 transition-all shadow-sm"
              >
                {diveData.location}
              </button>
            </div>
          </div>

          {/* Date */}
          <div className="group">
            <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 ml-1">Date</label>
            <div className="relative">
              <input
                type="date"
                name="date"
                value={diveData.date}
                onChange={handleChange}
                style={{ WebkitAppearance: 'none' }}
                className="w-full rounded-xl bg-white py-4 px-4 text-sm font-bold text-slate-700 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0089b7]/20 focus:border-[#0089b7] transition-all shadow-sm pr-4 [&::-webkit-calendar-picker-indicator]:hidden"
              />
            </div>
          </div>

          {/* Type */}
          <div className="group">
            <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 ml-1">Expedition Type</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0089b7] z-10 pointer-events-none">
                <Compass size={18} />
              </div>
              <button
                type="button"
                onClick={() => setShowDiveTypePicker(true)}
                className="w-full text-left rounded-xl bg-white py-4 pl-12 pr-12 text-sm font-bold text-slate-700 border border-slate-200 focus:outline-none transition-all shadow-sm hover:border-[#0089b7]/30"
              >
                {diveData.diveType}
              </button>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
                <ChevronRight size={16} className="rotate-90" />
              </div>
            </div>
          </div>

          {/* Depth & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="group">
              <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 ml-1">Max Depth (m)</label>
              <input
                type="number"
                name="depth"
                placeholder="Depth"
                value={diveData.depth}
                onChange={handleChange}
                className="w-full rounded-xl bg-white py-4 px-4 text-sm font-bold text-slate-700 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0089b7]/20 focus:border-[#0089b7] transition-all shadow-sm"
              />
            </div>
            <div className="group">
              <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 ml-1">Duration (min)</label>
              <input
                type="number"
                name="duration"
                placeholder="Time"
                value={diveData.duration}
                onChange={handleChange}
                className="w-full rounded-xl bg-white py-4 px-4 text-sm font-bold text-slate-700 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0089b7]/20 focus:border-[#0089b7] transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Observations — Manual Search + Logged Species Chips */}
          <div className="group">
            <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 ml-1">Ecosystem Observations</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 z-10 pointer-events-none">
                <Search size={18} />
              </div>
              <input
                ref={speciesSearchRef}
                id="species-search-input"
                type="text"
                placeholder="Search species or enter manually..."
                value={fishSearch}
                onChange={(e) => { setFishSearch(e.target.value); setShowFishDropdown(true); }}
                onFocus={() => setShowFishDropdown(true)}
                className="w-full rounded-xl bg-white py-4 pl-12 pr-4 text-sm font-bold text-slate-700 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0089b7]/20 focus:border-[#0089b7] transition-all shadow-sm"
              />
              <AnimatePresence>
                {showFishDropdown && fishSearch && filteredFish.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl z-50 py-2 no-scrollbar"
                  >
                    {filteredFish.map(f => (
                      <button
                        key={f}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleAddFish(f, true)}
                        className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        {f}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Logged Species Chips — always visible regardless of photo attachment */}
            {diveData.fishSpotted.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {diveData.fishSpotted.map((fish) => (
                  <div key={fish} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0089b7]/10 border border-[#0089b7]/20 text-[#0089b7] text-xs font-bold shadow-sm">
                    <Fish size={12} />
                    {fish}
                    <button onClick={() => handleRemoveFish(fish)} className="ml-0.5 text-[#0089b7]/50 hover:text-red-500 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Photos & AI Detection */}
          <div className="group">
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 ml-1">Visual Evidence</label>
            <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" multiple accept="image/*" />
            
            {diveData.photos.length > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-2">
                    {diveData.photos.map((photo, idx) => (
                        <div key={idx} className="relative w-24 h-24 shrink-0 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                            <img src={photo} className="w-full h-full object-cover" alt="Upload" />
                        </div>
                    ))}
                </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[21/9] rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-white flex flex-col items-center justify-center gap-3 group/upload hover:border-[#0089b7]/30 hover:bg-slate-50 transition-all shadow-sm"
            >
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover/upload:bg-[#0089b7]/10 group-hover/upload:text-[#0089b7] transition-all">
                <Camera size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Capture your discoveries</span>
            </button>

            {/* AI Detection UI */}
            {aiDetectionStatus === 'detecting' && (
               <div className="mt-4 p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                       <Search size={16} className="text-primary" />
                   </div>
                   <div>
                       <p className="text-xs font-bold text-primary">Identifying Species...</p>
                       <p className="text-[10px] text-primary/70">Analyzing image via computer vision</p>
                   </div>
                   <div className="ml-auto flex gap-1">
                       <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]"></span>
                       <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]"></span>
                       <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]"></span>
                   </div>
               </div>
            )}

            {/* AI Suggestion Cards — only rendered when API returns matches */}
            {aiDetectionStatus === 'done' && detectedSpecies.filter(sp => !sp.isManualEntry).length > 0 && (
                <div className="mt-4 space-y-3">
                    {detectedSpecies.filter(sp => !sp.isManualEntry).map((sp, idx) => (
                        <div 
                            key={`ai-${sp.name}-${idx}`}
                            onClick={(e) => {
                                const target = e.target as HTMLElement;
                                if (!target.closest('button')) {
                                    const fullSpecies = MARINE_SPECIES_DATA.find(s => s.name === sp.name);
                                    if (fullSpecies) setSpeciesToView(fullSpecies);
                                }
                            }}
                            className={cn("p-4 rounded-2xl border transition-all cursor-pointer hover:border-primary", sp.accepted ? "bg-green-50 border-green-200" : "bg-white border-slate-200 shadow-sm")}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-[20px]">set_meal</span>
                                    <span className="text-sm font-black text-slate-800">{sp.name}</span>
                                </div>
                                <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full", sp.confidence > 85 ? "bg-green-100 text-green-700" : sp.confidence > 65 ? "bg-yellow-100 text-yellow-700" : "bg-orange-100 text-orange-700")}>
                                    {sp.confidence}% Match
                                </span>
                            </div>
                            {!sp.accepted ? (
                                <div className="flex gap-2 mt-3">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleAddFish(sp.name, false);
                                        }}
                                        className="flex-1 py-2 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-colors"
                                    >
                                        Accept
                                    </button>
                                    <button 
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (!profile) return;
                                            try {
                                                await addDoc(collection(db, "posts"), {
                                                    userId: profile.id,
                                                    userDisplayName: profile.displayName || "Explorer",
                                                    userPhotoURL: profile.photoURL,
                                                    content: `I spotted something on my dive but the AI wasn't sure. It guessed ${sp.name} (${sp.confidence}%). What do you think this is?`,
                                                    image: diveData.photos[0] || "",
                                                    timestamp: serverTimestamp(),
                                                    likesCount: 0,
                                                    commentsCount: 0,
                                                    type: 'identification_request',
                                                    status: 'unresolved'
                                                });
                                                alert("Posted to community feed for identification!");
                                                setDetectedSpecies(prev => prev.filter((_, i) => i !== idx));
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }}
                                        className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
                                    >
                                        Ask Community
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDetectedSpecies(prev => prev.filter((_, i) => i !== idx));
                                            speciesSearchRef.current?.focus();
                                        }}
                                        className="flex-1 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
                                    >
                                        ENTER MANUALLY
                                    </button>
                                </div>
                            ) : (
                                <p className="text-[10px] font-bold text-green-600 mt-2 flex items-center gap-1">
                                    <CheckCircle2 size={12} /> Added to your log
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
          </div>

          {/* Standard Setup Card */}
          <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
            <label className="flex items-start gap-4 cursor-pointer">
              <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 mt-0.5", diveData.useStandardSetup ? "bg-[#0089b7] border-[#0089b7]" : "border-slate-300")}>
                {diveData.useStandardSetup && <CheckCircle2 size={16} className="text-white" />}
              </div>
              <input type="checkbox" checked={diveData.useStandardSetup} onChange={e => setDiveData(prev => ({ ...prev, useStandardSetup: e.target.checked }))} className="hidden" />
              <div>
                <span className="block text-sm font-black text-slate-800 uppercase tracking-tight">Use Standard Setup</span>
                <span className="block text-[10px] text-slate-500 font-medium leading-relaxed mt-1">Automatically select equipment marked as "Standard Setup" in your gear log.</span>
              </div>
            </label>
          </div>

          {/* Share to Feed Card */}
          <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#0089b7]/10 flex items-center justify-center text-[#0089b7]">
                  <Share2 size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight italic leading-tight">Share to Feed</h4>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Inspire the community</p>
                </div>
              </div>
              <button
                onClick={() => setDiveData(prev => ({ ...prev, shareToFeed: !prev.shareToFeed }))}
                className={cn("w-11 h-6 rounded-full relative transition-all duration-300", diveData.shareToFeed ? "bg-[#0089b7]" : "bg-slate-200")}
              >
                <div className={cn("w-4 h-4 bg-white rounded-full absolute top-1 transition-all", diveData.shareToFeed ? "right-1" : "left-1")} />
              </button>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-50">
              <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 italic">Dive Narrative</label>
              <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4">
                <textarea
                  name="feedDescription"
                  placeholder="Tell the community about your discovery..."
                  value={diveData.feedDescription}
                  onChange={handleChange}
                  rows={3}
                  className="w-full bg-transparent text-sm font-medium text-slate-600 focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

          <button
            onClick={async () => {
              if (!profile) return;
              try {
                await addDoc(collection(db, "dives"), {
                  ...diveData,
                  userId: profile.id,
                  timestamp: serverTimestamp()
                });
                updateBadgeStats({ [diveData.diveType]: 1 });
                onClose();
              } catch (err) {
                console.error("Save error:", err);
              }
            }}
            className="w-full py-5 rounded-full bg-[#7dd3fc] text-[#0369a1] font-black uppercase tracking-[0.3em] text-[11px] shadow-xl shadow-blue-200/50 hover:bg-[#bae6fd] active:scale-[0.98] transition-all"
          >
            Finalize Entry
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {speciesToView && (
            <SpeciesInfoModal species={speciesToView} onClose={() => setSpeciesToView(null)} currentUserId={profile?.id} />
        )}
        {showMapPicker && (
          <MapSelectionModal
            onClose={() => setShowMapPicker(false)}
            onSelect={(location) => setDiveData(prev => ({ ...prev, location }))}
          />
        )}
        {showDiveTypePicker && (
          <DiveTypePickerModal
            isOpen={showDiveTypePicker}
            onClose={() => setShowDiveTypePicker(false)}
            onSelect={(type) => setDiveData(prev => ({ ...prev, diveType: type }))}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Species Info Modal
const SpeciesInfoModal = ({ species, onClose, currentUserId }: { species: any, onClose: () => void, currentUserId?: string }) => {
    const [locations, setLocations] = useState<{location: string, count: number}[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch where this species has been spotted by the community
        const fetchLocations = async () => {
            try {
                // Since firestore doesn't support array-contains with group easily without index,
                // we'll fetch a sample of dives and filter client side for prototype, or just use a mock if empty
                const q = query(collection(db, "dives"), limit(100));
                const snapshot = await getDocs(q);
                
                const locCounts: Record<string, number> = {};
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.fishSpotted?.includes(species.name) && data.location) {
                        const loc = data.location.replace(/\s*\(\s*GPS\s*\)\s*/i, '');
                        locCounts[loc] = (locCounts[loc] || 0) + 1;
                    }
                });

                const sortedLocs = Object.entries(locCounts)
                    .map(([location, count]) => ({ location, count }))
                    .sort((a, b) => b.count - a.count);
                
                // If no real data, provide some mock data for the prototype
                if (sortedLocs.length === 0) {
                    setLocations([
                        { location: "Great Barrier Reef", count: 14 },
                        { location: "Blue Hole, Belize", count: 8 },
                        { location: "Similan Islands", count: 3 }
                    ]);
                } else {
                    setLocations(sortedLocs);
                }
            } catch (err) {
                console.error("Error fetching locations:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLocations();
    }, [species.name]);

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 pb-0 sm:pb-4">
            <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
                <div className="relative h-64 shrink-0">
                    <img src={species.image} alt={species.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                    <button onClick={onClose} className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-colors cursor-pointer z-10">
                        <X size={20} />
                    </button>
                    <div className="absolute bottom-6 left-6 right-6">
                        <h2 className="text-3xl font-black text-white italic leading-none">{species.name}</h2>
                        <p className="text-sm font-bold text-white/70 italic">{species.scientificName}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                    {/* Stats */}
                    <div className="flex gap-4">
                        <div className="flex-1 bg-slate-50 rounded-2xl p-4 flex flex-col items-center text-center border border-slate-100">
                            <span className="text-2xl font-black text-[#0089b7]">{species.spottedCount}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Your Sightings</span>
                        </div>
                        <div className="flex-1 bg-slate-50 rounded-2xl p-4 flex flex-col items-center text-center border border-slate-100">
                            <span className="text-2xl font-black text-amber-500 capitalize">{species.rarity}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rarity</span>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Info size={16} className="text-[#0089b7]" />
                            About
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            The {species.name} ({species.scientificName}) is a fascinating marine species. 
                            Users of GoDive log this species to track its migration and population across various dive sites.
                        </p>
                        <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(species.name)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#0089b7] text-xs font-bold mt-2 hover:underline">
                            Read more on Wikipedia <ArrowUpRight size={12} />
                        </a>
                    </div>

                    {/* Where to see it */}
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <MapPin size={16} className="text-[#0089b7]" />
                            High Chances To See It
                        </h3>
                        {loading ? (
                            <div className="animate-pulse flex flex-col gap-2">
                                <div className="h-12 bg-slate-100 rounded-2xl"></div>
                                <div className="h-12 bg-slate-100 rounded-2xl"></div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {locations.map((loc, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#0089b7]/10 flex items-center justify-center text-[#0089b7] font-black text-xs">
                                                #{i + 1}
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">{loc.location}</span>
                                        </div>
                                        <span className="text-xs font-bold text-slate-400">{loc.count} logs</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

