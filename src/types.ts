export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  bio?: string;
  certificates?: string[];
  rank: string;
  points: number;
  rankingPoints?: number;
  divesCount: number;
  currentLocation: string;
  subscriptionTier: "free" | "premium" | "vip";
  emailVerified: boolean;
  friends?: string[];
  phoneNumber?: string;
  hasEmergencyContactBonus?: boolean;
  pinnedBadgeId?: string;
  badgeStats?: Record<string, number>;
}

export interface UserPrivateInfo {
  phoneNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactName2?: string;
  emergencyContactPhone2?: string;
  medicalNotes?: string;
}

export interface DiveLog {
  id: string;
  userId: string;
  locationName: string;
  location?: string;
  depth: number;
  duration: number;
  date: string;
  description: string;
  tags: string[];
  fishSpotted?: string[];
  photos?: string[];
  diveType?: string;
  notes?: string;
  equipmentIds?: string[];
  timestamp?: { seconds: number; nanoseconds: number };
}

export interface Sighting {
  id: string;
  userId: string;
  speciesName: string;
  type: "fish" | "rare" | "flora";
  location: {
    lat: number;
    lng: number;
  } | string;
  locationName: string;
  timestamp: string | { seconds: number; nanoseconds: number };
  imageUrl: string;
  species?: string;
  label?: string;
  date?: string;
}

export type HistoryItem = (DiveLog | Sighting) & { source?: string };

export function isDiveLog(item: HistoryItem): item is DiveLog & { source?: string } {
  return 'diveType' in item || 'depth' in item || 'duration' in item || item.source === 'dive';
}

export function isSighting(item: HistoryItem): item is Sighting & { source?: string } {
  return !isDiveLog(item);
}

export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  time: string;
  maxParticipants: number;
  participants: string[];
  hostId: string;
  hostDisplayName: string;
  hostPhotoURL?: string;
  image?: string;
  isFeatured?: boolean;
  type: "Beginner Friendly" | "Deep Water Cert" | "Wreck Dive" | "Night Dive" | "Social";
  timestamp: string;
  lat?: number;
  lng?: number;
  reportedBy?: string[];
  reportsCount?: number;
  certificateRequirements?: string[];
  equipmentRequirements?: string[];
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  imageUrl: string;
  likesCount: number;
  commentsCount: number;
  tags: string[];
  timestamp: string;
  reportedBy?: string[];
  reportsCount?: number;
}

export type View = "dashboard" | "explorer" | "feed" | "buddy" | "friends" | "pricing" | "profile" | "admin" | "equipment";

export interface Equipment {
  id: string;
  userId: string;
  name: string;
  type: string;
  purchaseDate?: string;
  lastServiceDate?: string;
  nextServiceDate?: string;
  useCount: number;
  useLimit?: number;
  weight?: number;
  capacity?: number;
  notes?: string;
  isStandardSetup?: boolean;
  timestamp: any;
}
