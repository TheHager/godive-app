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
  homeBase?: string;
  role?: string;
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
  depth: number;
  duration: number;
  date: string;
  description: string;
  tags: string[];
}

export interface Sighting {
  id: string;
  userId: string;
  speciesName: string;
  type: "fish" | "rare" | "flora";
  location: {
    lat: number;
    lng: number;
  };
  locationName: string;
  timestamp: string;
  imageUrl: string;
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
  pendingParticipants?: string[];
  coHosts?: string[];
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

export type View = "dashboard" | "explorer" | "feed" | "buddy" | "friends" | "pricing" | "profile" | "admin" | "equipment" | "diveTimer";

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
}

export enum DiveState {
  INACTIVE = 'INACTIVE',
  DIVING = 'DIVING',
  WARNING_LEVEL_1 = 'WARNING_LEVEL_1',
  WARNING_LEVEL_2 = 'WARNING_LEVEL_2',
  ALARM_TRIGGERED = 'ALARM_TRIGGERED',
}

export interface ActiveDive {
  diveId: string;
  userId: string;
  diverName: string;
  
  // Timing (Firestore Timestamps)
  startTime: any;
  plannedDurationMinutes: number;
  expectedEndTime: any;
  bufferMinutes: number;
  
  // Location
  lastKnownLat: number;
  lastKnownLng: number;
  lastKnownLocationName?: string;
  
  // Emergency Contacts
  emergencyContact1Name: string;
  emergencyContact1Phone: string;
  emergencyContact2Name?: string;
  emergencyContact2Phone?: string;
  medicalNotes?: string;
  
  // Status
  status: 'ACTIVE' | 'EXTENDED' | 'ENDED' | 'ESCALATED';
  
  // Push & Mesh
  deviceToken: string;
  buddyIds?: string[];
  buddyDeviceTokens?: string[];
  
  // Metadata
  createdAt: any;
  endedAt?: any;
  escalatedAt?: any;
  escalationResults?: {
    sms1: boolean;
    sms2: boolean;
    push: boolean;
  };
}
