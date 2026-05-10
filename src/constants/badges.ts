import { Badge, BadgeProgress, BadgeWithProgress } from "../types";
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
  ArrowDown,
  Compass, Map as LucideMap, Trophy, HeartPulse, Zap, MessageSquare, 
  Image as ImageIcon, Video, Star, Award, Globe, History, Box, Eye, CheckCircle2, Lock,
  Share2, Upload, Crosshair, HelpCircle,
  Wind,
  Snowflake,
  Mountain,
  FlaskConical,
  Activity,
  Timer,
  Droplet,
  Shield,
  HardHat,
  Ship,
  TrendingDown,
  Rocket
} from "lucide-react";

export const BADGE_SCHEMA: Badge[] = [
  // Recreational Diving
  { id: 'Drift Dive', label: 'Drift Master', icon: Waves, color: 'primary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Master the art of riding the currents.' },
  { id: 'Enriched Dive (nitrox)', label: 'Oxygen Optimizer', icon: Wind, color: 'secondary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Extend your bottom time with enriched air.' },
  { id: 'Deep Dive', label: 'Abyss Explorer', icon: ArrowDown, color: 'tertiary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Venture into the deep blue (30m+).' },
  { id: 'Night Dive', label: 'Night Owl', icon: Moon, color: 'primary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Discover the ocean’s secrets after sunset.' },
  { id: 'Wreck Dive', label: 'Iron Ghost Hunter', icon: Ship, color: 'secondary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Explore the history of sunken vessels.' },
  { id: 'Ice Dive', label: 'Frost Bitten', icon: Snowflake, color: 'tertiary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Brave the freezing waters beneath the ice.' },
  { id: 'Altitude Dive', label: 'Mountain Diver', icon: Mountain, color: 'primary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Submerge in high-altitude lakes.' },

  // Technical diving
  { id: 'Cave Dive', label: 'Dark Zone Navigator', icon: Box, color: 'secondary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Master the complexity of overhead environments.' },
  { id: 'Rebreather Diving', label: 'Silent Voyager', icon: Activity, color: 'tertiary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Dive without bubbles using CCR technology.' },
  { id: 'Deep Sea/Trimix Diving', label: 'Trimix Titan', icon: FlaskConical, color: 'primary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Go beyond the limits of air with helium mixes.' },

  // Freediving
  { id: 'Constant Weight (CWT)', label: 'Monofin Monarch', icon: Anchor, color: 'secondary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Reach new depths with a single breath and weight.' },
  { id: 'Constant No Fins (CNF)', label: 'Pure Human', icon: HeartPulse, color: 'tertiary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'The ultimate test of technique without any fins.' },
  { id: 'Free Immersion (FIM)', label: 'Line Puller', icon: ArrowDown, color: 'primary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Pull yourself into the depths and back.' },
  { id: 'Variable Weight (VWT)', label: 'Sled Rider', icon: TrendingDown, color: 'secondary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Descend fast with weight and ascend on your own.' },
  { id: 'No Limits (NLT)', label: 'The Limitless', icon: Rocket, color: 'tertiary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Push the absolute boundaries of human depth.' },

  // Pool Disciplines
  { id: 'Static Apnea (STA)', label: 'Zen Master', icon: Timer, color: 'primary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Master the mind and hold your breath in total stillness.' },
  { id: 'Dynamic Apnea (DYN)', label: 'Pool Glider', icon: Droplet, color: 'secondary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Cover incredible distances on a single breath.' },

  // Commercial & Scientific Diving
  { id: 'Commercial Diving', label: 'Underground Worker', icon: HardHat, color: 'tertiary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Build and repair in the world\'s toughest environments.' },
  { id: 'Scientific Diving', label: 'Marine Researcher', icon: Globe, color: 'primary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Dive for data and protect our oceans.' },
  { id: 'Public Safety Diving', label: 'Guardian Diver', icon: Shield, color: 'secondary', unit: 'dives', thresholds: [5, 10, 20, 50, 100], desc: 'Serve and protect in challenging underwater missions.' },

  // New Trophies
  { id: 'Reef Mapper', label: 'Reef Mapper', icon: MapPin, color: 'primary', unit: 'sites registered', thresholds: [5, 10, 20, 50, 100], desc: 'The architect of our underwater world.', isChallenge: false },
  { id: 'Species Sage', label: 'Species Sage', icon: Fish, color: 'secondary', unit: 'species logged', thresholds: [5, 10, 20, 50, 100], desc: 'If it swims, I know its name.', isChallenge: false },
  { id: 'Charter Captain', label: 'Charter Captain', icon: Ship, color: 'tertiary', unit: 'events hosted', thresholds: [5, 10, 20, 50, 100], desc: 'Bringing the surface world into the deep.', isChallenge: false },
  { id: 'Social Puffer', label: 'Social Puffer', icon: MessageSquare, color: 'primary', unit: 'posts', thresholds: [5, 10, 20, 50, 100], desc: 'Making waves and keeping the community bubbling.', isChallenge: false },

  // Weekly Challenge Badges
  { id: 'Reef Guardian', label: 'Reef Guardian', icon: Shield, color: 'primary', unit: 'challenges', thresholds: [1, 5, 10, 20, 50], desc: 'Protect and restore the coral reefs.', isChallenge: true },
  { id: 'Expedition Leader', label: 'Expedition Leader', icon: Anchor, color: 'secondary', unit: 'challenges', thresholds: [1, 5, 10, 20, 50], desc: 'Lead the community on epic dives.', isChallenge: true },
  { id: 'Manta Master', label: 'Manta Master', icon: Box, color: 'tertiary', unit: 'challenges', thresholds: [1, 5, 10, 20, 50], desc: 'Encounter and document Manta Rays.', isChallenge: true },
  { id: 'Local Legend', label: 'Local Legend', icon: Box, color: 'primary', unit: 'challenges', thresholds: [1, 5, 10, 20, 50], desc: 'Become a master of your local dive site.', isChallenge: true },
  { id: 'Social Leader', label: 'Social Leader', icon: HeartPulse, color: 'secondary', unit: 'challenges', thresholds: [1, 5, 10, 20, 50], desc: 'Be the heart of the diving community.', isChallenge: true },
  { id: 'Marine Biologist', label: 'Marine Biologist', icon: Globe, color: 'tertiary', unit: 'challenges', thresholds: [1, 5, 10, 20, 50], desc: 'Advancing marine science and cleanup efforts.', isChallenge: true },
  { id: 'Rising Star', label: 'Rising Star', icon: Star, color: 'primary', unit: 'challenges', thresholds: [1, 5, 10, 20, 50], desc: 'Shining bright in the diving community.', isChallenge: true },
];

export const TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

export const getBadgeProgress = (currentValue: number, thresholds: number[]): BadgeProgress => {
  let tierIndex = -1;
  for (let i = 0; i < thresholds.length; i++) {
    if (currentValue >= thresholds[i]) {
      tierIndex = i;
    } else {
      break;
    }
  }

  const isMaxed = tierIndex === thresholds.length - 1;
  const currentTier = tierIndex >= 0 ? TIER_NAMES[tierIndex] : "Locked";
  const nextTierName = isMaxed ? "Maxed" : TIER_NAMES[tierIndex + 1];
  
  const nextTierRequirement = isMaxed ? thresholds[thresholds.length - 1] : thresholds[tierIndex + 1];
  const previousRequirement = tierIndex >= 0 ? thresholds[tierIndex] : 0;
  
  const progressRatio = isMaxed ? 1 : Math.max(0, Math.min(1, (currentValue - previousRequirement) / (nextTierRequirement - previousRequirement))); 

  return {
    earned: tierIndex >= 0,
    tier: currentTier,
    nextTierName,
    nextTierRequirement,
    currentValue,
    isMaxed,
    progressRatio,
  };
};

export const computeBadgesWithStats = (stats: Record<string, number>): BadgeWithProgress[] => {
  return BADGE_SCHEMA.map(def => ({
    ...def,
    ...getBadgeProgress(stats[def.id] || 0, def.thresholds)
  }));
};

