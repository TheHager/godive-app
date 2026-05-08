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
  Compass, Map as LucideMap, Trophy, HeartPulse, Zap, 
  Image as ImageIcon, Video, Star, Award, Globe, History, Box, Eye, CheckCircle2, Lock,
  Share2, Upload, Crosshair, HelpCircle
} from "lucide-react";

export const BADGE_SCHEMA = [
  { id: 'recreational', label: "Rec Diver", icon: Waves, color: "primary", unit: "dives", thresholds: [5, 10, 25, 50, 100], desc: "Log recreational dives." },
  { id: 'deep', label: "Deep Specialist", icon: ArrowDown, color: "secondary", unit: "dives", thresholds: [5, 10, 20, 40, 80], desc: "Log dives deeper than 30m." },
  { id: 'night', label: "Night Owl", icon: Moon, color: "primary", unit: "dives", thresholds: [5, 10, 25, 50, 100], desc: "Complete dives after sunset." },
  { id: 'cave', label: "Cavern Explorer", icon: Box, color: "secondary", unit: "dives", thresholds: [3, 7, 15, 30, 50], desc: "Navigate through caves and caverns." },
  { id: 'photography', label: "Photo Master", icon: Camera, color: "tertiary", unit: "dives", thresholds: [5, 15, 30, 60, 120], desc: "Log dives focused on photography." },
  { id: 'navigation', label: "Master Navigator", icon: Compass, color: "tertiary", unit: "dives", thresholds: [5, 10, 25, 50, 100], desc: "Dives focused on precise navigation." },
  { id: 'rescue', label: "Guardian", icon: HeartPulse, color: "primary", unit: "dives", thresholds: [1, 5, 10, 25, 50], desc: "Rescue training or related activities." },
  { id: 'training', label: "Scholar", icon: Award, color: "secondary", unit: "dives", thresholds: [5, 10, 25, 50, 100], desc: "Training and certification dives." },
];

export const TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

export const getBadgeProgress = (currentValue: number, thresholds: number[]) => {
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

export const computeBadgesWithStats = (stats: Record<string, number>) => {
  return BADGE_SCHEMA.map(def => ({
    ...def,
    ...getBadgeProgress(stats[def.id] || 0, def.thresholds)
  }));
};

