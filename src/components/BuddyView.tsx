import React, { useState, useEffect } from "react";
import { Search, MapPin, Users, Calendar, ArrowUpRight, ShieldCheck, Ship, UserPlus, UserCheck, X, Loader2, Trash2, Plus, Clock, Info, CheckCircle2, Edit2, Phone, HeartPulse, ImagePlus, ImageIcon, Map as MapIcon, Share2, AlertCircle, Flag, Award, Settings, User as UserIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "../lib/utils";
import { collection, query, where, getDocs, or, doc, updateDoc, arrayUnion, arrayRemove, limit, addDoc, serverTimestamp, orderBy, onSnapshot, deleteDoc, getDoc, increment } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { filterProfanity } from "../lib/profanity";
import { useUser } from "../contexts/UserContext";
import { View, UserProfile, CommunityEvent, UserPrivateInfo } from "../types";
import { calculateLevel, getRankInfo } from "../constants/ranks";
import { computeBadgesWithStats, BADGE_SCHEMA } from "../constants/badges";
import { LocationPickerModal } from "./LocationPickerModal";
import { ActionMenu } from "./ActionMenu";
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin, useMap } from "@vis.gl/react-google-maps";

// Helper to calculate distance between two coordinates in km
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; 
  return d;
};

export const BuddyView = ({ setView, initialEventId }: { setView: (v: View) => void, initialEventId?: string | null }) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { profile, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CommunityEvent | null>(null);
  const [buddies, setBuddies] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [isLoadingBuddies, setIsLoadingBuddies] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [eventSearchDate, setEventSearchDate] = useState("");
  const [eventSearchLocation, setEventSearchLocation] = useState("");
  const [eventSearchCoords, setEventSearchCoords] = useState<{lat: number, lng: number} | null>(null);
  const [eventViewMode, setEventViewMode] = useState<"upcoming" | "archive">("upcoming");
  const [eventSearchRadius, setEventSearchRadius] = useState(25); // Default 25km
  const [eventSortBy, setEventSortBy] = useState<"date" | "distance">("date");
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showLocationSearchModal, setShowLocationSearchModal] = useState(false);
  const [selectedEventForMap, setSelectedEventForMap] = useState<CommunityEvent | null>(null);
  const [selectedEventForParticipants, setSelectedEventForParticipants] = useState<CommunityEvent | null>(null);
  const [selectedBuddyForProfile, setSelectedBuddyForProfile] = useState<UserProfile | null>(null);
  const [localInitialEventId, setLocalInitialEventId] = useState<string | null>(initialEventId || null);

  useEffect(() => {
    if (eventSortBy === "distance" && !userLocation) {
      if (navigator.geolocation) {
        setIsGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setIsGettingLocation(false);
          },
          (error) => {
            console.error("Error getting location:", error);
            setEventSortBy("date"); // fallback
            setIsGettingLocation(false);
          }
        );
      } else {
        setEventSortBy("date");
      }
    }
  }, [eventSortBy, userLocation]);

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("timestamp", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityEvent));
      setEvents(eventData);
      setIsLoadingEvents(false);
    });
    return () => unsubscribe();
  }, []);

  // Cleanup expired events (24h after start time)
  useEffect(() => {
    const cleanupEvents = async () => {
      const now = Date.now();
      const expiredEvents = events.filter(event => {
        if (!event.date) return false;
        try {
          // Combine date and time
          const dateStr = event.date; // YYYY-MM-DD
          const timeStr = event.time || "00:00"; // HH:mm
          const eventStart = new Date(`${dateStr}T${timeStr}`).getTime();
          
          if (isNaN(eventStart)) return false;
          
          // 24 hours = 86400000 ms
          return now > (eventStart + 86400000);
        } catch (e) {
          return false;
        }
      });

      if (expiredEvents.length === 0) return;

      // Archive feature prevents deletion
    };

    if (events.length > 0 && user?.uid) {
      cleanupEvents();
    }
  }, [events, user?.uid]);

  const now = new Date();

  const activeEvents = events.filter(e => {
    const eventDate = new Date(e.date + 'T' + (e.time || '00:00'));
    return eventDate >= now || (now.getTime() - eventDate.getTime() < 86400000);
  });

  const archivedEvents = events.filter(e => {
    const eventDate = new Date(e.date + 'T' + (e.time || '00:00'));
    return eventDate < now && e.hostId === profile?.id;
  });

  const eventsToDisplay = eventViewMode === "upcoming" ? activeEvents : archivedEvents;

  const filteredEvents = eventsToDisplay.filter(e => {
    // If we have a deep linked event, show only that one
    if (localInitialEventId) {
      return e.id === localInitialEventId;
    }



    const matchesDate = !eventSearchDate || e.date === eventSearchDate;
    const matchesTextLocation = !eventSearchLocation || e.location.toLowerCase().includes(eventSearchLocation.toLowerCase());
    
    let matchesRadius = true;
    if (eventSearchCoords && e.lat && e.lng) {
      const distance = getDistance(eventSearchCoords.lat, eventSearchCoords.lng, e.lat, e.lng);
      matchesRadius = distance <= eventSearchRadius;
    }

    return matchesDate && matchesTextLocation && matchesRadius;
  }).sort((a, b) => {
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;

    if (eventSortBy === "distance" && userLocation) {
      const distA = (a.lat && a.lng) ? getDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) : Infinity;
      const distB = (b.lat && b.lng) ? getDistance(userLocation.lat, userLocation.lng, b.lat, b.lng) : Infinity;
      return distA - distB;
    }
    
    const dateA = new Date(`${a.date}T${a.time || "00:00"}`).getTime();
    const dateB = new Date(`${b.date}T${b.time || "00:00"}`).getTime();
    // Show upcoming events first
    return dateA - dateB;
  });

  useEffect(() => {
    const fetchBuddies = async () => {
      if (!profile?.friends || profile.friends.length === 0) {
        setBuddies([]);
        setIsLoadingBuddies(false);
        return;
      }

      try {
        // Break friends into chunks of 10 for Firestore 'in' query
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
    <div className="flex flex-col gap-10 p-6 w-full max-w-4xl mx-auto min-w-0 pb-32">
      <section className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface whitespace-nowrap">Community Events</h2>
          </div>
          {archivedEvents.length > 0 && (
            <div className="flex gap-1 rounded-full bg-surface-container-high/50 p-1 border border-white/5 backdrop-blur-sm shrink-0">
              <button
                onClick={() => setEventViewMode("upcoming")}
                className={cn("px-4 py-2 rounded-full text-xs font-bold transition-colors", eventViewMode === "upcoming" ? "bg-primary/20 text-primary border border-primary/30 shadow-lg" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5")}
              >
                Upcoming
              </button>
              <button
                onClick={() => setEventViewMode("archive")}
                className={cn("px-4 py-2 rounded-full text-xs font-bold transition-colors", eventViewMode === "archive" ? "bg-primary/20 text-primary border border-primary/30 shadow-lg" : "text-on-surface-variant hover:text-on-surface hover:bg-white/5")}
              >
                Archive
              </button>
            </div>
          )}
          {!localInitialEventId && (
            <div className="relative z-10 shrink-0 mr-4">
              <ActionMenu 
                triggerIcon={<Settings size={24} className="text-on-surface-variant" />}
                buttonClassName="hover:bg-white/10"
                items={[
                  { label: "Sort By", isHeader: true },
                  { label: "Date", icon: <Calendar size={16} />, onClick: () => setEventSortBy("date"), active: eventSortBy === "date" },
                  { label: isGettingLocation ? "Locating..." : "Close to me", icon: isGettingLocation ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />, onClick: () => { if (!isGettingLocation) setEventSortBy("distance"); }, active: eventSortBy === "distance" },
                  { isDivider: true },
                  { label: "Filters", isHeader: true },
                  {
                    customComponent: (
                      <div className="px-3 py-2 flex flex-col gap-2">
                        <div className="relative group">
                          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                          <input 
                            type="date"
                            value={eventSearchDate}
                            onChange={(e) => setEventSearchDate(e.target.value)}
                            className="pl-9 pr-4 py-2 w-full bg-surface-container-high/40 border border-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-on-surface focus:ring-1 focus:ring-secondary/50 focus:bg-surface-container-high transition-all"
                          />
                        </div>
                        <div className="relative group">
                          <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                          <input 
                            type="text"
                            placeholder="LOCATION..."
                            value={eventSearchLocation}
                            onChange={(e) => setEventSearchLocation(e.target.value)}
                            onClick={() => setShowLocationSearchModal(true)}
                            readOnly
                            className="pl-9 pr-4 py-2 w-full bg-surface-container-high/40 border border-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-on-surface focus:ring-1 focus:ring-secondary/50 focus:bg-surface-container-high transition-all placeholder:text-on-surface-variant/30 cursor-pointer hover:bg-white/5"
                          />
                        </div>
                        {eventSearchCoords && (
                          <div className="flex items-center gap-2 bg-surface-container-high/40 border border-white/5 rounded-full px-4 py-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-secondary">Radius:</span>
                            <select 
                              value={eventSearchRadius}
                              onChange={(e) => setEventSearchRadius(Number(e.target.value))}
                              className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-on-surface focus:ring-0 p-0 cursor-pointer w-full text-right"
                            >
                              <option value={10}>10km</option>
                              <option value={20}>20km</option>
                              <option value={50}>50km</option>
                              <option value={100}>100km</option>
                              <option value={500}>500km</option>
                            </select>
                          </div>
                        )}
                        {(eventSearchDate || eventSearchLocation || eventSearchCoords) && (
                          <button 
                            onClick={() => { 
                              setEventSearchDate(""); 
                              setEventSearchLocation(""); 
                              setEventSearchCoords(null);
                            }}
                            className="w-full px-4 py-2 mt-1 bg-error/10 text-error rounded-full text-[10px] font-black uppercase tracking-widest border border-error/20 hover:bg-error/20 transition-all text-center"
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                    )
                  }
                ]}
              />
            </div>
          )}
        </div>
      </section>

      {/* Modals rendered without section wrapper to avoid gap */}
      <CreateEventModal 
        isOpen={showCreateEventModal}
        onClose={() => {
          setShowCreateEventModal(false);
          setEditingEvent(null);
        }}
        profile={profile}
        eventToEdit={editingEvent}
      />
      <EventMapModal 
        isOpen={!!selectedEventForMap}
        onClose={() => setSelectedEventForMap(null)}
        event={selectedEventForMap}
      />
      <ParticipantsModal 
        isOpen={!!selectedEventForParticipants}
        onClose={() => setSelectedEventForParticipants(null)}
        event={selectedEventForParticipants}
        onParticipantAction={(msg) => setToastMessage(msg)}
        profile={profile}
        onRemoveBuddy={handleRemoveBuddy}
      />
      <LocationSearchModal
        isOpen={showLocationSearchModal}
        onClose={() => setShowLocationSearchModal(false)}
        onSelectLocation={(loc, coords) => {
          setEventSearchLocation(loc);
          setEventSearchCoords(coords);
          setShowLocationSearchModal(false);
        }}
      />
      <SafetyRequirementModal 
        isOpen={showSafetyModal}
        onClose={() => setShowSafetyModal(false)}
        onGoToProfile={() => {
          setShowSafetyModal(false);
          setView("profile");
        }}
      />

      {localInitialEventId && (
        <section className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
                Specific Expedition
              </h3>
              <button 
                onClick={() => setLocalInitialEventId(null)}
                className="text-[10px] font-black uppercase tracking-widest text-secondary hover:underline"
              >
                Show All Events
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoadingEvents ? (
          <div className="md:col-span-2 flex h-32 items-center justify-center">
            <Loader2 size={32} className="animate-spin text-secondary" />
          </div>
        ) : filteredEvents.length > 0 ? (
          filteredEvents.map((event) => (
            <EventCard 
              key={event.id}
              event={event}
              isJoined={event.participants.includes(profile?.id || "")}
              isHost={event.hostId === profile?.id}
              userLocation={userLocation}
              onEdit={() => {
                setEditingEvent(event);
                setShowCreateEventModal(true);
              }}
              onViewMap={() => setSelectedEventForMap(event)}
              onViewParticipants={() => setSelectedEventForParticipants(event)}
              onSafetyRequirement={() => setShowSafetyModal(true)}
                onJoinRequest={() => setToastMessage("Join request sent to host!")}
            />
          ))
        ) : (
          <div className="md:col-span-2 py-12 flex flex-col items-center justify-center text-center bg-surface-container-high/20 rounded-[40px] border border-white/5">
            <Calendar size={48} className="text-on-surface-variant/20 mb-4" />
            <h4 className="text-on-surface font-black italic text-xl">No Events Found</h4>
            <p className="text-on-surface-variant/60 text-xs font-bold uppercase tracking-widest mt-2">Try changing your filters</p>
          </div>
        )}
      </section>

      {profile?.id && (
        <button
          onClick={() => setShowCreateEventModal(true)}
          className="fixed bottom-24 right-6 sm:bottom-8 sm:right-8 z-40 flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-secondary text-on-secondary shadow-[0_0_40px_rgba(76,214,251,0.3)] transition-all hover:bg-secondary-container hover:scale-110 hover:-rotate-12 active:scale-95 border border-white/20"
          title="Create Event"
        >
          <Plus size={28} />
        </button>
      )}
    </div>
  );
};

const UserSearchModal = ({ isOpen, onClose, results, isSearching, onToggleBuddy, friends, searchQuery, setSearchQuery, onSearch }: any) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/90 backdrop-blur-md" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg rounded-[2.5rem] bg-surface-container-highest border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-white/5 bg-surface-container-highest shrink-0">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-black italic tracking-tight text-on-surface">Find Buddies</h3>
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Community Discovery</p>
                </div>
                <button onClick={onClose} className="rounded-full bg-surface-container-high p-2 text-on-surface hover:bg-white/10 transition-colors border border-white/10">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={onSearch} className="flex gap-2 rounded-2xl bg-white/5 p-2 border border-white/5 focus-within:ring-1 focus-within:ring-secondary/50">
                <div className="flex flex-1 items-center gap-3 px-3 min-w-0">
                  <Search size={18} className="text-secondary shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, email, phone..."
                    className="w-full bg-transparent border-none p-0 text-sm font-medium text-on-surface placeholder:text-outline/30 focus:ring-0 min-w-0 flex-1"
                  />
                </div>
                <button 
                  type="submit"
                  className="rounded-xl bg-secondary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-on-secondary shadow-lg transition-transform active:scale-95 disabled:opacity-50"
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
                     <Loader2 size={48} className="animate-spin text-secondary" />
                     <div className="absolute inset-0 blur-xl bg-secondary/20" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-secondary animate-pulse px-4 py-2 bg-secondary/10 rounded-full border border-secondary/20">Scanning Depths...</span>
                </div>
              ) : results.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">Possible Matches</span>
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
                        className="flex items-center justify-between p-3 rounded-[2rem] bg-surface-container-high/30 border border-white/5 backdrop-blur-md group hover:bg-surface-container-high hover:border-white/10 transition-all duration-300"
                      >
                        <div className="flex items-center gap-4 ml-1 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            {user.photoURL ? (
                              <img 
                                src={user.photoURL} 
                                className="h-14 w-14 rounded-2xl border-2 border-white/10 shadow-2xl object-cover transition-transform group-hover:scale-105 duration-500" 
                                alt={user.displayName}
                              />
                            ) : (
                              <div className="flex h-14 w-14 rounded-2xl border-2 border-white/10 bg-surface/50 text-secondary shadow-2xl items-center justify-center transition-transform group-hover:scale-105 duration-500">
                                <UserIcon size={28} />
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-secondary border-4 border-surface-container-highest shadow-xl" />
                          </div>
                          <div className="flex flex-col min-w-0 flex-1 pr-2">
                            <span className="font-extrabold text-on-surface group-hover:text-secondary transition-colors italic tracking-tight text-lg truncate pr-2 leading-tight">{user.displayName}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] text-on-surface-variant uppercase font-black tracking-[0.1em]">
                                {getRankInfo(calculateLevel((user.points || 0) + (user.rankingPoints || 0))).title}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => onToggleBuddy(user.id, isBuddy)}
                          className={cn(
                            "flex items-center gap-2 rounded-full px-6 py-3 transition-all duration-300 shadow-xl font-black uppercase tracking-[0.2em] text-[9px] shrink-0 active:scale-95 border",
                            isBuddy 
                              ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" 
                              : "bg-secondary text-on-secondary border-secondary/20 hover:shadow-secondary/20"
                          )}
                        >
                          {isBuddy ? (
                            <>
                              <UserCheck size={14} className="text-primary" />
                              <span className="hidden sm:inline">Buddy</span>
                              <span className="sm:hidden">OK</span>
                            </>
                          ) : (
                            <>
                              <UserPlus size={14} className="text-on-secondary" />
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
                  <div className="rounded-full bg-surface-container-high p-6 text-on-surface-variant/20 border border-white/5">
                    <Users size={48} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-on-surface">No Divers Found</h4>
                    <p className="text-xs font-medium text-on-surface-variant mt-1 max-w-[200px] mx-auto opacity-60">Try searching for a different username, email, or phone number.</p>
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

const EventMapModal = ({ isOpen, onClose, event }: { isOpen: boolean, onClose: () => void, event: CommunityEvent | null }) => {
  if (!event) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/95 backdrop-blur-xl" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl rounded-[2.5rem] bg-surface-container-highest border border-white/10 shadow-2xl overflow-hidden flex flex-col aspect-square md:aspect-video"
          >
            <div className="p-6 border-b border-white/5 bg-surface-container-highest flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xl font-black italic tracking-tighter text-on-surface">{event.title}</h3>
                <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant opacity-60">
                   <MapPin size={12} className="text-secondary" />
                   {event.location}
                </div>
              </div>
              <button onClick={onClose} className="rounded-full bg-surface-container-high p-2 text-on-surface hover:bg-white/10 transition-colors border border-white/10">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 relative bg-surface-container-lowest">
              <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || ''}>
                <GoogleMap
                  defaultCenter={{ lat: event.lat || 0, lng: event.lng || 0 }}
                  defaultZoom={15}
                  mapId="EVENT_VIEW_MAP"
                  disableDefaultUI
                  gestureHandling="greedy"
                >
                  <AdvancedMarker position={{ lat: event.lat || 0, lng: event.lng || 0 }}>
                    <div className="relative group">
                      <div className="absolute -inset-4 bg-secondary/20 rounded-full blur-xl group-hover:bg-secondary/40 transition-colors animate-pulse" />
                      <div className="relative flex flex-col items-center">
                        <div className="bg-secondary p-2 rounded-xl shadow-2xl border-2 border-white/20 mb-2">
                           <MapIcon size={24} className="text-on-secondary" />
                        </div>
                        <div className="bg-background/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow-xl">
                           <span className="text-[10px] font-black uppercase text-on-surface whitespace-nowrap">{event.location}</span>
                        </div>
                      </div>
                    </div>
                  </AdvancedMarker>
                </GoogleMap>
              </APIProvider>
            </div>

            <div className="p-6 bg-surface-container shrink-0 border-t border-white/5">
              <button 
                onClick={onClose}
                className="w-full py-4 rounded-2xl bg-secondary text-on-secondary text-xs font-black uppercase tracking-widest shadow-xl shadow-secondary/20 transition-all hover:bg-secondary-container active:scale-95"
              >
                Close Map View
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const SafetyRequirementModal = ({ isOpen, onClose, onGoToProfile }: { isOpen: boolean, onClose: () => void, onGoToProfile: () => void }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/90 backdrop-blur-md" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm rounded-[2.5rem] bg-surface-container-highest border border-white/10 shadow-2xl overflow-hidden p-8 flex flex-col items-center text-center gap-6"
          >
            <div className="h-20 w-20 rounded-3xl bg-secondary/20 flex items-center justify-center text-secondary mb-2 relative">
               <ShieldCheck size={40} />
               <div className="absolute inset-0 blur-xl bg-secondary/30 -z-10" />
            </div>
            
            <div>
              <h3 className="text-2xl font-black italic tracking-tighter text-on-surface mb-2">Dive Safety Required</h3>
              <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
                To join community events, you must have your emergency contact and medical information filled out. This ensures everyone's safety during expeditions.
              </p>
            </div>

            <div className="flex flex-col w-full gap-3">
              <button 
                onClick={onGoToProfile}
                className="w-full py-4 rounded-2xl bg-secondary text-on-secondary text-[11px] font-black uppercase tracking-widest shadow-xl shadow-secondary/20 transition-all hover:bg-secondary-container active:scale-95"
              >
                Complete Safety Info
              </button>
              <button 
                onClick={onClose}
                className="w-full py-4 rounded-2xl bg-white/5 text-on-surface-variant text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface EventCardProps {
  onJoinRequest?: () => void;
  key?: any;
  event: CommunityEvent;
  isJoined: boolean;
  isHost: boolean;
  userLocation?: {lat: number, lng: number} | null;
  onEdit?: () => void;
  onViewMap?: () => void;
  onViewParticipants?: () => void;
  onSafetyRequirement?: () => void;
}

const EventCard = ({ event, isJoined, isHost, userLocation, onEdit, onViewMap, onViewParticipants, onSafetyRequirement, onJoinRequest }: EventCardProps) => {
  const { profile } = useAuth();
  const [isJoining, setIsJoining] = useState(false);
  const isFull = event.maxParticipants > 0 && event.participants.length >= event.maxParticipants && !isJoined;
  const isPending = event.pendingParticipants?.includes(profile?.id || "");
  
  const hasReported = event.reportedBy?.includes(profile?.id || "");

  const handleReport = async () => {
    if (!profile?.id || isHost) return;
    try {
      const eventRef = doc(db, "events", event.id);
      
      if (hasReported) {
        await updateDoc(eventRef, {
          reportedBy: arrayRemove(profile.id), reportsCount: increment(-1), reported: hasReported ? (event.reportsCount && event.reportsCount <= 1 ? false : true) : false
        });
      } else {
        const newReportsCount = (event.reportsCount || 0) + 1;
        
        if (newReportsCount >= 10) {
          await deleteDoc(eventRef);
          
          // Also delete associated posts
          const postsQuery = query(collection(db, "posts"), where("eventId", "==", event.id));
          const postsSnapshot = await getDocs(postsQuery);
          const deletePromises = postsSnapshot.docs.map(postDoc => 
            deleteDoc(doc(db, "posts", postDoc.id))
          );
          await Promise.all(deletePromises);
        } else {
          await updateDoc(eventRef, {
            reportedBy: arrayUnion(profile.id), reportsCount: increment(1), reported: true
          });
        }
      }
    } catch (error) {
      console.error("Error reporting event:", error);
    }
  };

  const handleJoin = async () => {
    if (!profile?.id || isHost) return;

    if (!isJoined && !profile.hasEmergencyContactBonus) {
      onSafetyRequirement?.();
      return;
    }

    setIsJoining(true);
    try {
      const eventRef = doc(db, "events", event.id);

      const isPending = event.pendingParticipants?.includes(profile.id);

      if (isJoined || isPending) {
        await updateDoc(eventRef, {
          participants: arrayRemove(profile.id),
          pendingParticipants: arrayRemove(profile.id)
        });
      } else {
        await updateDoc(eventRef, { pendingParticipants: arrayUnion(profile.id) }); onJoinRequest?.();
      }
    } catch (err) {
      console.error("Error joining event:", err);
      handleFirestoreError(err, OperationType.UPDATE, `events/${event.id}`);
    } finally {
      setIsJoining(false);
    }
  };

  let distanceDisplay = null;
  if (userLocation && event.lat && event.lng) {
    const distance = getDistance(userLocation.lat, userLocation.lng, event.lat, event.lng);
    distanceDisplay = distance < 1 ? "<1 km" : `${distance.toFixed(1)} km`;
  }

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group flex flex-col rounded-[32px] bg-surface-container-high/20 backdrop-blur-3xl border shadow-xl transition-all hover:bg-surface-container-high/40 overflow-hidden relative",
        event.isFeatured ? "border-secondary shadow-[0_0_20px_rgba(76,214,251,0.3)] ring-1 ring-secondary/50" : "border-white/5",
        isFull && "opacity-80"
      )}
    >
      {event.isFeatured && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-secondary text-on-secondary px-4 py-1 rounded-b-xl text-[9px] font-black uppercase tracking-[0.2em] z-10 shadow-lg flex items-center gap-1.5">
          <Award size={10} />
          Featured VIP Event
        </div>
      )}
      <div className="absolute top-4 right-4 z-20">
        {(isHost || (!isHost && profile?.id)) && (
          <div className="bg-black/40 backdrop-blur-md rounded-full border border-white/10">
            <ActionMenu 
              items={(isHost || profile?.email?.toLowerCase() === 'tobias.h.jensen@gmail.com') ? [
                { label: "Edit Event", icon: <Edit2 size={16} />, onClick: () => onEdit && onEdit() },
                { label: "Delete Event", icon: <Trash2 size={16} />, onClick: async () => {
                  if (confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
                    try {
                      await deleteDoc(doc(db, "events", event.id));
                    } catch (error) {
                      console.error("Error deleting event:", error);
                    }
                  }
                }, destructive: true }
              ] : [
                { label: hasReported ? "Remove Report" : "Report Event", icon: <Flag size={16} className={cn(hasReported && "fill-current")} />, onClick: handleReport, destructive: true }
              ]}
            />
          </div>
        )}
      </div>
      {/* Event Image */}
      {event.image && (
        <div className="w-full h-48 overflow-hidden relative">
          <img 
            src={event.image} 
            alt={event.title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-container-high/60 to-transparent" />
        </div>
      )}
      
      <div className="p-6 flex flex-col flex-1">
        <div className={cn("mb-4 flex items-start justify-between", (!event.image && isHost) && "pl-12")}>
        <div className="flex gap-2">
          <span className="rounded-lg bg-white/5 border border-white/10 px-3 py-1 text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
            <Calendar size={10} />
            {formatDate(event.date)}
          </span>
          <span className="rounded-lg bg-white/5 border border-white/10 px-3 py-1 text-[10px] font-black text-secondary uppercase tracking-widest flex items-center gap-1.5">
            <Clock size={10} />
            {event.time}
          </span>
        </div>
        <button 
          onClick={onViewParticipants}
          className="rounded-full bg-white/5 border border-white/10 p-2 text-on-surface-variant hover:text-primary hover:bg-white/10 transition-all active:scale-95 group"
          title="View Participants"
        >
          <ArrowUpRight size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      </div>

      <h4 className="mb-2 text-2xl font-black italic tracking-tighter text-on-surface">{event.title}</h4>
      <p className="mb-4 text-sm font-medium text-on-surface-variant line-clamp-2 leading-relaxed">{event.description}</p>
      
      <div 
        onClick={onViewMap}
        className="flex items-center gap-2 mb-2 cursor-pointer hover:text-primary transition-colors group/loc"
      >
        <MapPin size={14} className="text-secondary group-hover/loc:scale-110 transition-transform" />
        <span className="text-xs font-bold text-on-surface-variant group-hover/loc:text-primary">{event.location}</span>
        {distanceDisplay && (
           <span className="text-[10px] bg-secondary/10 text-secondary border border-secondary/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest ml-2">
             {distanceDisplay} away
           </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-2 opacity-80">
        <Users size={12} className="text-primary" />
        <span className="text-[10px] font-black uppercase tracking-widest text-outline">Max Buddies:</span>
        <span className="text-[11px] font-bold text-on-surface">{event.participants.length} / {event.maxParticipants === 0 ? "∞" : event.maxParticipants}</span>
      </div>

      {(event.certificateRequirements?.length > 0 || event.equipmentRequirements?.length > 0) && (
        <div className="flex flex-col gap-2 mb-4">
          {event.certificateRequirements && event.certificateRequirements.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-black leading-none uppercase tracking-widest text-outline mr-1">Certs:</span>
              {event.certificateRequirements.map((cert, idx) => (
                <span key={idx} className="bg-primary/10 text-primary border border-primary/20 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">{cert}</span>
              ))}
            </div>
          )}
          {event.equipmentRequirements && event.equipmentRequirements.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-black leading-none uppercase tracking-widest text-outline mr-1">Gear:</span>
              {event.equipmentRequirements.map((gear, idx) => (
                <span key={idx} className="bg-tertiary/10 text-tertiary border border-tertiary/20 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">{gear}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={cn("flex items-center justify-between", !isHost ? "mb-6" : "mb-auto")}>
         <div className="flex items-center gap-3">
            {event.hostPhotoURL ? (
              <img src={event.hostPhotoURL} className="h-8 w-8 shrink-0 rounded-full border border-white/10 object-cover" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-surface/50 text-secondary">
                <UserIcon size={16} />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-outline">Hosted By</span>
              <span className="text-[11px] font-bold text-on-surface">{event.hostDisplayName}</span>
            </div>
         </div>
         <div className="flex flex-col items-end">
            <span className="text-[10px] font-black uppercase tracking-widest text-outline">Type</span>
            <span className="text-[11px] font-bold text-primary">{event.type}</span>
         </div>
      </div>

      {!isHost && (
        <div className="mt-auto flex justify-center pt-4 border-t border-white/5">
          <button 
            onClick={handleJoin}
            disabled={isJoining || (isFull && !isJoined) || isPending}
            className={cn(
              "w-full max-w-[240px] rounded-xl px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2",
              isJoined 
                ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20" 
                : "bg-secondary text-on-secondary shadow-lg shadow-secondary/10 hover:bg-secondary-container"
            )}
          >
            {isJoining ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isJoined ? (
              <>
                <CheckCircle2 size={16} />
                Leave Event
              </>
            ) : isPending ? (
              <>
                <Loader2 size={14} className="animate-pulse" />
                Pending Approval
              </>
            ) : isFull ? (
              "Full"
            ) : (
              "Join Event"
            )}
          </button>
        </div>
      )}
      </div>
      
      {isFull && (
        <div className="absolute inset-0 bg-background/20 pointer-events-none" />
      )}
    </motion.div>
  );
};

const CreateEventModal = ({ isOpen, onClose, profile, eventToEdit }: any) => {
  const { updateBadgeStats } = useUser();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    lat: 0,
    lng: 0,
    date: "",
    time: "",
    maxParticipants: 0,
    type: "Eco-Cleanup" as const,
    image: "",
    shareToFeed: false,
    certificateRequirements: [] as string[],
    equipmentRequirements: [] as string[]
  });

  const [certInput, setCertInput] = useState("");
  const [equipInput, setEquipInput] = useState("");

  useEffect(() => {
    if (eventToEdit) {
      setFormData({
        title: eventToEdit.title,
        description: eventToEdit.description,
        location: eventToEdit.location,
        lat: eventToEdit.lat || 0,
        lng: eventToEdit.lng || 0,
        date: eventToEdit.date,
        time: eventToEdit.time || "",
        maxParticipants: eventToEdit.maxParticipants ?? 0,
        type: eventToEdit.type || "Eco-Cleanup",
        image: eventToEdit.image || "",
        shareToFeed: false,
        certificateRequirements: eventToEdit.certificateRequirements || [],
        equipmentRequirements: eventToEdit.equipmentRequirements || []
      });
    } else {
      setFormData({
        title: "",
        description: "",
        location: "",
        lat: 0,
        lng: 0,
        date: "",
        time: "",
        maxParticipants: 0,
        type: "Eco-Cleanup",
        image: "",
        shareToFeed: false,
        certificateRequirements: [],
        equipmentRequirements: []
      });
    }
  }, [eventToEdit, isOpen]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be smaller than 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      
      setIsModerating(true);
      try {
        const response = await fetch("/api/moderate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 })
        });

        if (!response.ok) {
          throw new Error("Moderation server failed to respond");
        }
        const text = await response.text();
        if (!text) {
          throw new Error("Empty response from moderation server");
        }
        const result = JSON.parse(text);
        
        if (result.safe) {
          setFormData(prev => ({ ...prev, image: base64 }));
        } else {
          alert("Image was flagged as inappropriate. Please choose another one.");
        }
      } catch (err) {
        console.error("Moderation error:", err);
        // Fallback: allow if moderation fails but alert user
        setFormData(prev => ({ ...prev, image: base64 }));
      } finally {
        setIsModerating(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = "A title is required for your expedition.";
    if (!formData.description.trim()) newErrors.description = "Please provide a short description.";
    if (!formData.location) newErrors.location = "Select a dive site or point on the map.";
    if (!formData.date) newErrors.date = "Pick a date for your dive.";
    if (!formData.time) newErrors.time = "Set a start time.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Auto-dismiss errors after 5 seconds
      setTimeout(() => setErrors({}), 5000);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      if (eventToEdit) {
        await updateDoc(doc(db, "events", eventToEdit.id), {
          title: filterProfanity(formData.title) || "Untitled Event",
          description: filterProfanity(formData.description) || "",
          location: filterProfanity(formData.location) || "",
          lat: formData.lat || 0,
          lng: formData.lng || 0,
          date: formData.date || new Date().toISOString().split('T')[0],
          time: formData.time || "",
          maxParticipants: formData.maxParticipants || 0,
          type: formData.type || "Eco-Cleanup",
          image: formData.image || "",
          certificateRequirements: formData.certificateRequirements,
          equipmentRequirements: formData.equipmentRequirements,
          timestamp: serverTimestamp()
        });
      } else {
        // Enforce Tier Limits
        if (profile.subscriptionTier !== 'vip') {
          const recentEventsQ = query(collection(db, "events"), where("hostId", "==", profile.id));
          const recentEventsSnap = await getDocs(recentEventsQ);
          let count = 0;
          const nowMs = Date.now();
          const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
          const oneDayMs = 24 * 60 * 60 * 1000;
          const timeLimitMs = profile.subscriptionTier === 'premium' ? oneDayMs : oneWeekMs;
          const oldestValid = nowMs - timeLimitMs;
          
          recentEventsSnap.forEach(d => {
            const ts = d.data().timestamp?.toMillis ? d.data().timestamp.toMillis() : Date.now();
            if (ts > oldestValid) count++;
          });

          if (count >= 1) {
            setErrors({ submit: `Event creation limit reached. ${profile.subscriptionTier === 'premium' ? 'Tritons can create 1 event per day.' : 'Resident Divers can create 1 event per week.'}` });
            setIsSubmitting(false);
            return;
          }
        }

        const eventData = {
          title: filterProfanity(formData.title) || "Untitled Event",
          description: filterProfanity(formData.description) || "",
          location: filterProfanity(formData.location) || "",
          lat: formData.lat || 0,
          lng: formData.lng || 0,
          date: formData.date || new Date().toISOString().split('T')[0],
          time: formData.time || "",
          maxParticipants: formData.maxParticipants || 0,
          type: formData.type || "Eco-Cleanup",
          image: formData.image || "",
          certificateRequirements: formData.certificateRequirements,
          equipmentRequirements: formData.equipmentRequirements,
          hostId: profile.id,
          hostDisplayName: profile.displayName || "Unknown Diver",
          hostPhotoURL: profile.photoURL || "",
          isFeatured: profile.subscriptionTier === 'vip',
          participants: [profile.id],
          timestamp: serverTimestamp()
        };

        console.log("EVENT DATA", eventData);

        const eventDocRef = await addDoc(collection(db, "events"), eventData);

        if (formData.shareToFeed) {
          const firstName = profile.displayName ? profile.displayName.split(' ')[0] : 'A diver';
          const locationText = (eventData.location && !eventData.location.includes("Location at") && !eventData.location.includes("Current Location")) 
            ? ` 📍 ${eventData.location}` 
            : '';
          await addDoc(collection(db, "posts"), {
            eventId: eventDocRef.id,
            userId: profile.id,
            userDisplayName: profile.displayName || "Unknown Diver",
            userPhotoURL: profile.photoURL || "",
            location: eventData.location,
            content: filterProfanity(`${firstName} has shared an event!\n\n${eventData.title}\n📅 ${eventData.date}${locationText}`),
            image: eventData.image || "",
            likesCount: 0,
            commentsCount: 0,
            likedBy: [],
            reportsCount: 0,
            reportedBy: [],
            tags: ["Expedition", eventData.type].map(t => filterProfanity(t)),
            timestamp: serverTimestamp()
          });
        }
      }
      onClose();
    } catch (err) {
      console.error("Error saving event:", err);
      handleFirestoreError(err, eventToEdit ? OperationType.UPDATE : OperationType.CREATE, eventToEdit ? `events/${eventToEdit.id}` : "events");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/95 backdrop-blur-xl" 
              onClick={onClose} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl rounded-[2.5rem] bg-surface-container-highest border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-white/5 bg-surface-container-highest flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-3xl font-black italic tracking-tighter text-on-surface">
                    {eventToEdit ? "Edit Expedition" : "Plan Expedition"}
                  </h3>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
                      {eventToEdit ? "Update your dive event" : "Host a Dive event"}
                    </p>
                    {Object.keys(errors).length > 0 && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-error bg-error/10 px-3 py-1 rounded-full border border-error/20 flex items-center gap-1.5 animate-pulse">
                        <AlertCircle size={10} />
                        Missing Required Fields
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">

                  <button onClick={onClose} className="rounded-full bg-surface-container-high p-3 text-on-surface hover:bg-white/10 transition-colors border border-white/10">
                    <X size={24} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 no-scrollbar bg-surface-container-highest/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-outline ml-1">Expedition Title</label>
                    <input 
                      type="text"
                      value={formData.title}
                      onChange={e => {
                        setFormData(prev => ({ ...prev, title: e.target.value }));
                        if (errors.title) setErrors(prev => { const n = {...prev}; delete n.title; return n; });
                      }}
                      placeholder="e.g. Midnight Wreck Exploration"
                      className={cn(
                        "w-full rounded-2xl bg-white/5 border p-4 text-on-surface focus:ring-secondary focus:border-secondary transition-all",
                        errors.title ? "border-error/50 bg-error/5" : "border-white/10"
                      )}
                    />
                    {errors.title && (
                      <p className="text-[9px] font-bold text-error uppercase tracking-widest ml-1">{errors.title}</p>
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-outline ml-1">Description</label>
                    <textarea 
                      rows={3}
                      value={formData.description}
                      onChange={e => {
                        setFormData(prev => ({ ...prev, description: e.target.value }));
                        if (errors.description) setErrors(prev => { const n = {...prev}; delete n.description; return n; });
                      }}
                      placeholder="Share details about the dive, what to bring, and expectations..."
                      className={cn(
                        "w-full rounded-2xl bg-white/5 border p-4 text-on-surface focus:ring-secondary focus:border-secondary transition-all",
                        errors.description ? "border-error/50 bg-error/5" : "border-white/10"
                      )}
                    />
                    {errors.description && (
                      <p className="text-[9px] font-bold text-error uppercase tracking-widest ml-1">{errors.description}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-outline">Location</label>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        setShowLocationPicker(true);
                        if (errors.location) setErrors(prev => { const n = {...prev}; delete n.location; return n; });
                      }}
                      className={cn(
                        "w-full group flex items-center justify-between rounded-2xl bg-white/5 border p-4 text-left transition-all hover:border-secondary/50",
                        errors.location ? "border-error/50 bg-error/5" : "border-white/10"
                      )}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <MapPin className="text-secondary shrink-0" size={18} />
                        <span className={cn(
                          "text-sm font-medium truncate",
                          formData.location ? "text-on-surface" : "text-outline/40"
                        )}>
                          {formData.location || "Select location on map"}
                        </span>
                      </div>
                    </button>
                    {errors.location && (
                      <p className="text-[9px] font-bold text-error uppercase tracking-widest ml-1">{errors.location}</p>
                    )}
                  </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-outline ml-1">Event Type</label>
                  <select 
                    value={formData.type}
                    onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full rounded-2xl bg-white/5 border-white/10 p-4 text-on-surface focus:ring-secondary focus:border-secondary appearance-none"
                  >
                    {["Eco-Cleanup", "Photography / Macro", "Drift / Current", "Species Hunt", "Training / Skills", "Exploration", "Sunrise / Early Bird", "Shore Dive", "Liveaboard / Full Day", "After-Dive Social"].map(t => (
                      <option key={t} value={t} className="bg-surface-container-highest">{t}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-outline ml-1">Date</label>
                  <div className="relative">
                    <input 
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={formData.date}
                      onChange={e => {
                        setFormData(prev => ({ ...prev, date: e.target.value }));
                        if (errors.date) setErrors(prev => { const n = {...prev}; delete n.date; return n; });
                      }}
                      className={cn(
                        "w-full rounded-2xl bg-white/5 border py-4 px-4 text-on-surface focus:ring-secondary focus:border-secondary transition-all appearance-none",
                        errors.date ? "border-error/50 bg-error/5" : "border-white/10"
                      )}
                    />
                  </div>
                  {errors.date && (
                    <p className="text-[9px] font-bold text-error uppercase tracking-widest ml-1">{errors.date}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-outline ml-1">Time</label>
                  <div className="relative">
                    <input 
                      type="time"
                      value={formData.time}
                      onChange={e => {
                        setFormData(prev => ({ ...prev, time: e.target.value }));
                        if (errors.time) setErrors(prev => { const n = {...prev}; delete n.time; return n; });
                      }}
                      className={cn(
                        "w-full rounded-2xl bg-white/5 border py-4 px-4 text-on-surface focus:ring-secondary focus:border-secondary transition-all appearance-none",
                        errors.time ? "border-error/50 bg-error/5" : "border-white/10"
                      )}
                    />
                  </div>
                  {errors.time && (
                    <p className="text-[9px] font-bold text-error uppercase tracking-widest ml-1">{errors.time}</p>
                  )}
                </div>



                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-outline">Max Buddies</label>
                    <button 
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, maxParticipants: prev.maxParticipants === 0 ? 4 : 0 }))}
                      className="text-[9px] font-black uppercase tracking-widest text-secondary hover:text-secondary-container transition-colors"
                    >
                      {formData.maxParticipants === 0 ? "Set Limit" : "Make Unlimited"}
                    </button>
                  </div>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                    {formData.maxParticipants === 0 ? (
                      <div className="w-full rounded-2xl bg-white/5 border-white/10 py-4 pr-4 pl-12 text-on-surface flex items-center">
                        <span className="text-xl">∞</span>
                        <span className="ml-2 text-xs font-bold text-outline/40">(Unlimited)</span>
                      </div>
                    ) : (
                      <input 
                        type="number"
                        min={2}
                        max={100}
                        value={formData.maxParticipants}
                        onChange={e => setFormData(prev => ({ ...prev, maxParticipants: Math.max(2, parseInt(e.target.value) || 2) }))}
                        className="w-full rounded-2xl bg-white/5 border-white/10 py-4 pr-4 pl-12 text-on-surface focus:ring-secondary focus:border-secondary transition-all"
                      />
                    )}
                  </div>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-outline ml-1">Certificate Requirements</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.certificateRequirements.map((cert, idx) => (
                      <div key={idx} className="flex items-center gap-1 bg-primary/20 text-primary border border-primary/30 rounded-lg px-3 py-1.5 text-xs font-bold">
                        <span>{cert}</span>
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, certificateRequirements: prev.certificateRequirements.filter((_, i) => i !== idx) }))} className="ml-1 hover:text-white transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={certInput}
                      onChange={e => setCertInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (certInput.trim()) {
                            setFormData(prev => ({ ...prev, certificateRequirements: [...prev.certificateRequirements, certInput.trim()] }));
                            setCertInput("");
                          }
                        }
                      }}
                      placeholder="e.g. Open Water, Nitrox"
                      className="flex-1 rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-on-surface focus:ring-secondary focus:border-secondary transition-all"
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        if (certInput.trim()) {
                          setFormData(prev => ({ ...prev, certificateRequirements: [...prev.certificateRequirements, certInput.trim()] }));
                          setCertInput("");
                        }
                      }}
                      className="rounded-2xl bg-primary px-6 font-bold text-on-primary hover:bg-primary-container transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-outline ml-1">Equipment Requirements</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.equipmentRequirements.map((equip, idx) => (
                      <div key={idx} className="flex items-center gap-1 bg-tertiary/20 text-tertiary border border-tertiary/30 rounded-lg px-3 py-1.5 text-xs font-bold">
                        <span>{equip}</span>
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, equipmentRequirements: prev.equipmentRequirements.filter((_, i) => i !== idx) }))} className="ml-1 hover:text-white transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={equipInput}
                      onChange={e => setEquipInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (equipInput.trim()) {
                            setFormData(prev => ({ ...prev, equipmentRequirements: [...prev.equipmentRequirements, equipInput.trim()] }));
                            setEquipInput("");
                          }
                        }
                      }}
                      placeholder="e.g. Dive Computer, Compass"
                      className="flex-1 rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-on-surface focus:ring-secondary focus:border-secondary transition-all"
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        if (equipInput.trim()) {
                          setFormData(prev => ({ ...prev, equipmentRequirements: [...prev.equipmentRequirements, equipInput.trim()] }));
                          setEquipInput("");
                        }
                      }}
                      className="rounded-2xl bg-tertiary px-6 font-bold text-on-tertiary hover:bg-tertiary/80 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-outline ml-1">Event Image (Optional)</label>
                    <div className="relative group/img">
                      <div className={cn(
                        "w-full h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all cursor-pointer overflow-hidden relative bg-white/5",
                        formData.image ? "border-secondary/50" : "border-white/10 hover:border-secondary/30"
                      )}>
                        {formData.image ? (
                          <>
                            <img src={formData.image} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                              <ImagePlus size={24} className="text-white" />
                            </div>
                          </>
                        ) : (
                          <>
                            {isModerating ? (
                              <Loader2 size={32} className="animate-spin text-secondary" />
                            ) : (
                              <ImagePlus size={32} className="text-secondary opacity-40" />
                            )}
                            <span className="text-xs font-bold text-on-surface-variant/40 uppercase tracking-widest">
                              {isModerating ? "Verifying..." : "Click to Upload (Max 2MB)"}
                            </span>
                          </>
                        )}
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                      {formData.image && (
                         <button 
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, image: "" }))}
                          className="absolute -top-2 -right-2 p-1.5 bg-error text-on-error rounded-full shadow-lg border-2 border-background"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
              </div>

              {!eventToEdit && (
                <div className="mt-8 p-4 rounded-2xl bg-secondary/5 border border-secondary/10 flex items-center justify-between">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary">
                      <Share2 size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">Share to Community Feed</p>
                      <p className="text-[10px] text-on-surface-variant/60 font-black uppercase tracking-widest">Post this event to the feed automatically</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, shareToFeed: !prev.shareToFeed }))}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      formData.shareToFeed ? "bg-secondary" : "bg-white/10"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200",
                        formData.shareToFeed ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              )}

              <div className="mt-8 flex gap-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-on-surface hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] py-4 rounded-2xl bg-secondary text-on-secondary text-xs font-black uppercase tracking-widest shadow-xl shadow-secondary/20 transition-all hover:bg-secondary-container active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      {eventToEdit ? "Update Expedition" : "Launch Expedition"} 
                      <ArrowUpRight size={16}/>
                    </>
                  )}
                </button>
              </div>

              {eventToEdit && (
                <div className="mt-4 pt-4 border-t border-error/10">
                  {showDeleteConfirm && (
                    <div className="rounded-2xl border border-error/20 bg-error/10 p-4">
                      <p className="text-center text-sm font-bold text-on-surface mb-4">
                        Are you sure you want to delete this expedition?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 py-3 rounded-xl bg-white/5 text-on-surface text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await deleteDoc(doc(db, "events", eventToEdit.id));
                              
                              // Delete associated posts
                              const postsQuery = query(collection(db, "posts"), where("eventId", "==", eventToEdit.id));
                              const postsSnapshot = await getDocs(postsQuery);
                              const deletePromises = postsSnapshot.docs.map(postDoc => 
                                deleteDoc(doc(db, "posts", postDoc.id))
                              );
                              await Promise.all(deletePromises);

                              setShowDeleteConfirm(false);
                              onClose();
                            } catch (err) {
                              console.error("Error deleting event:", err);
                            }
                          }}
                          className="flex-1 py-3 rounded-xl bg-error text-white text-xs font-black uppercase tracking-widest hover:bg-error/80 transition-colors"
                        >
                          Yes, Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    <LocationPickerModal 
      isOpen={showLocationPicker}
      onClose={() => setShowLocationPicker(false)}
      onSelect={(loc) => setFormData(prev => ({ ...prev, location: loc.name, lat: loc.lat, lng: loc.lng }))}
    />
  </>
  );
};

const ParticipantsModal = ({ isOpen, onClose, event, profile, onRemoveBuddy, onParticipantAction }: {
  onParticipantAction?: (msg: string) => void; isOpen: boolean, onClose: () => void, event: CommunityEvent | null, profile: UserProfile | null, onRemoveBuddy: (id: string) => void }) => {
  const [liveEvent, setLiveEvent] = useState<CommunityEvent | null>(event);
  const [pendingParticipants, setPendingParticipants] = useState<UserProfile[]>([]);
  const isHost = Boolean(liveEvent?.hostId === profile?.id || profile?.email?.toLowerCase() === 'tobias.h.jensen@gmail.com' || (liveEvent?.coHosts || []).includes(profile?.id || ""));
  const isOriginalHost = liveEvent?.hostId === profile?.id || profile?.email?.toLowerCase() === 'tobias.h.jensen@gmail.com';
  const [participants, setParticipants] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedParticipant, setSelectedParticipant] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (isOpen && event?.id) {
      const unsub = onSnapshot(doc(db, "events", event.id), (doc) => {
        if (doc.exists()) {
          setLiveEvent({ id: doc.id, ...doc.data() } as CommunityEvent);
        }
      });
      return () => unsub();
    }
  }, [isOpen, event?.id]);

  useEffect(() => {
    const fetchParticipants = async () => {
      const allToFetch = [...(liveEvent?.participants || []), ...(liveEvent?.pendingParticipants || [])];
      if (!allToFetch || allToFetch.length === 0) {
        setPendingParticipants([]);
        setParticipants([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const participantProfiles: UserProfile[] = [];
        // Fetch in chunks of 10
        const chunks = [];
        for (let i = 0; i < allToFetch.length; i += 10) {
          chunks.push(allToFetch.slice(i, i + 10));
        }

        const promises = chunks.map(chunk => 
          getDocs(query(collection(db, "users"), where("id", "in", chunk))).catch(error => {
            handleFirestoreError(error, OperationType.LIST, "users");
            return null;
          })
        );

        const snapshots = await Promise.all(promises);
        snapshots.forEach(snap => {
          if (snap) {
            snap.docs.forEach(doc => {
              participantProfiles.push(doc.data() as UserProfile);
            });
          }
        });

        setParticipants(participantProfiles.filter(p => liveEvent?.participants?.includes(p.id)));
        setPendingParticipants(participantProfiles.filter(p => liveEvent?.pendingParticipants?.includes(p.id)));
      } catch (err) {
        console.error("Error fetching participants:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && event) {
      fetchParticipants();
    }
  }, [isOpen, liveEvent?.participants, liveEvent?.pendingParticipants]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/95 backdrop-blur-xl" 
              onClick={onClose} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg rounded-[2.5rem] bg-surface-container-highest border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-white/5 bg-surface-container-highest flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-black italic tracking-tighter text-on-surface">Expedition Crew</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                    {liveEvent?.participants.length} Divers Registered
                  </p>
                </div>
                <button onClick={onClose} className="rounded-full bg-surface-container-high p-2 text-on-surface hover:bg-white/10 transition-colors border border-white/10">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 size={32} className="animate-spin text-secondary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-outline">Gathering profiles...</span>
                  </div>
                ) : participants.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {participants.map((member) => (
                      <motion.div 
                        key={member.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => setSelectedParticipant(member)}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-4">
                          {member.photoURL ? (
                            <img 
                              src={member.photoURL} 
                              className="h-12 w-12 shrink-0 rounded-xl object-cover border border-white/10" 
                            />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface/50 text-secondary">
                              <UserIcon size={24} />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="font-bold text-on-surface text-sm group-hover:text-primary transition-colors">{member.displayName}</span>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-widest text-outline">
                                {getRankInfo(calculateLevel((member.points || 0) + (member.rankingPoints || 0))).title}
                              </span>
                              <span className="text-[9px] font-bold text-secondary tracking-tight">
                                {member.divesCount || 0} Dives Complete
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {isOriginalHost && profile?.id !== member.id && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const eventRef = doc(db, "events", liveEvent!.id);
                                  const isUserCoHost = liveEvent?.coHosts?.includes(member.id);
                                  if (isUserCoHost) {
                                    await updateDoc(eventRef, { coHosts: arrayRemove(member.id) });
                                  } else {
                                    await updateDoc(eventRef, { coHosts: arrayUnion(member.id) });
                                  }
                                } catch (error) { console.error("Error updating co-host:", error); }
                              }}
                              className={cn("px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all", liveEvent?.coHosts?.includes(member.id) ? "bg-error/10 text-error hover:bg-error/20" : "bg-white/5 text-on-surface hover:bg-white/10")}
                            >
                              {liveEvent?.coHosts?.includes(member.id) ? "Remove Co-Host" : "Make Co-Host"}
                            </button>
                          )}
                          <ArrowUpRight size={16} className="text-outline/40 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Users size={40} className="mx-auto text-outline/20 mb-3" />
                    <p className="text-xs font-bold text-outline uppercase tracking-widest">No divers yet</p>
                  </div>
                )}

              {isHost && pendingParticipants.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">Pending Approval <span className="bg-error/20 text-error px-2 py-0.5 rounded-full text-[9px]">{pendingParticipants.length}</span></h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    {pendingParticipants.map((user) => (
                      <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl bg-white/5 border border-white/5 p-4">
                        <div className="flex items-center gap-4 min-w-0">
                          {user.photoURL ? (
                            <img src={user.photoURL} className="h-12 w-12 rounded-full border border-white/10 object-cover" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-surface/50 text-secondary">
                              <UserIcon size={20} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-on-surface truncate text-sm">{user.displayName}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              try {
                                const eventRef = doc(db, "events", liveEvent!.id);
                                await updateDoc(eventRef, {
                                  pendingParticipants: arrayRemove(user.id),
                                  participants: arrayUnion(user.id)
                                });
                              } catch(e) {}
                            }}
                            className="bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-primary/30 transition-all"
                          >
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const eventRef = doc(db, "events", liveEvent!.id);
                                await updateDoc(eventRef, {
                                  pendingParticipants: arrayRemove(user.id)
                                });
                              } catch(e) {}
                            }}
                            className="bg-error/10 text-error px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-error/20 transition-all"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>

              <div className="p-6 bg-surface-container shrink-0 border-t border-white/5">
                <button 
                  onClick={onClose}
                  className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-on-surface hover:bg-white/10 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <UserProfileModal 
        isOpen={!!selectedParticipant}
        onClose={() => setSelectedParticipant(null)}
        user={selectedParticipant}
        isBuddy={profile?.friends?.includes(selectedParticipant?.id || "") || false}
        onRemoveBuddy={onRemoveBuddy}
        isEventHost={isHost}
      />
    </>
  );
};

const UserProfileModal = ({ isOpen, onClose, user, isBuddy, onRemoveBuddy, isEventHost }: { isOpen: boolean, onClose: () => void, user: UserProfile | null, isBuddy?: boolean, onRemoveBuddy?: (id: string) => void, isEventHost?: boolean }) => {
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { profile: currentUser } = useAuth();
  const canViewPrivate = Boolean(isEventHost) || currentUser?.id === user?.id;

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
            className="absolute inset-0 bg-background/95 backdrop-blur-md" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm rounded-[2.5rem] bg-surface-container-highest border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="p-8 text-center flex flex-col items-center bg-gradient-to-b from-secondary/10 to-transparent shrink-0">
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
                <div className="absolute -bottom-2 -right-2 bg-secondary p-2 rounded-xl border-4 border-surface-container-highest shadow-xl">
                  <HeartPulse size={16} className="text-on-secondary" />
                </div>
              </div>

              {((user.pinnedBadgeId && user.badgeStats) && (() => {
                  const b = computeBadgesWithStats(user.badgeStats!).find((bx: any) => bx.id === user.pinnedBadgeId);
                  if (b && b.earned) {
                    const BIcon = b.icon;
                    return (
                      <div className="flex items-center justify-center gap-2 mb-2 bg-white/5 pr-3 pl-1 py-1 rounded-full border border-white/10">
                        <div className="bg-primary/20 text-primary p-1.5 rounded-full">
                          <BIcon size={14} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-primary">{b.label}</span>
                      </div>
                    );
                  }
                  return null;
              })())}
              
              <h3 className="text-2xl font-black italic tracking-tighter text-on-surface">{user.displayName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-secondary">
                  {getRankInfo(calculateLevel((user.points || 0) + (user.rankingPoints || 0))).title}
                </span>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                  LVL {calculateLevel((user.points || 0) + (user.rankingPoints || 0))}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              <div className="space-y-4">
                {user.bio && (
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-1 mb-4">
                    <div className="text-[9px] font-black uppercase tracking-widest text-outline">Bio</div>
                    <div className="text-xs font-medium text-on-surface-variant leading-relaxed italic">"{user.bio}"</div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant/40 mb-2">
                  <Ship size={12} />
                  Dive Stats
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-1 text-center">
                     <div className="text-[9px] font-black uppercase tracking-widest text-outline">Total Dives</div>
                     <div className="text-xl font-black text-on-surface italic">{user.divesCount || 0}</div>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-1 text-center">
                     <div className="text-[9px] font-black uppercase tracking-widest text-outline">Exp. Points</div>
                     <div className="text-xl font-black text-secondary italic">{(user.points || 0) + (user.rankingPoints || 0)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant/40 mb-2 pt-2 border-t border-white/5">
                  <Award size={12} />
                  Diving Certifications
                </div>
                <div className="flex flex-wrap gap-2">
                  {(user.certificates || []).length > 0 ? (
                    user.certificates?.map((cert: string) => (
                      <span key={cert} className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary shadow-sm">
                        {cert}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs italic text-on-surface-variant/50">No certifications recorded</span>
                  )}
                </div>

                {user.badgeStats && (() => {
                  const earnedBadges = computeBadgesWithStats(user.badgeStats).filter((b: any) => b.earned);
                  if (earnedBadges.length > 0) {
                    return (
                      <>
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant/40 mb-2 pt-2 border-t border-white/5">
                          <Award size={12} />
                          Earned Badges
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {earnedBadges.map((b: any) => {
                            const BIcon = b.icon;
                            return (
                              <div key={b.id} className="flex items-center gap-2 bg-surface-container/50 border border-white/10 rounded-xl px-2.5 py-1.5" title={b.label}>
                                <BIcon size={14} className="text-secondary" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{b.label}</span>
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
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-on-surface-variant/40 mb-2 pt-2 border-t border-white/5">
                      <Phone size={12} />
                      Contact Info
                    </div>
                <div className="space-y-3">

                  {isLoading ? (
                    <div className="h-10 flex items-center justify-center">
                      <Loader2 size={24} className="animate-spin text-secondary" />
                    </div>
                  ) : privateInfo?.phoneNumber && (
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-1">
                       <div className="text-[9px] font-black uppercase tracking-widest text-outline">Phone</div>
                       <div className="text-sm font-bold text-on-surface">{privateInfo.phoneNumber}</div>
                    </div>
                  )}
                </div>

                {!isLoading && (
                  <>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-error/60 mb-2 pt-2">
                      <ShieldCheck size={12} />
                      Emergency Contacts
                    </div>

                    {privateInfo?.emergencyContactName ? (
                      <div className="space-y-3">
                        <div className="bg-error/5 rounded-2xl p-4 border border-error/10 space-y-1">
                           <div className="text-[9px] font-black uppercase tracking-widest text-error/60">Primary Contact</div>
                           <div className="text-sm font-bold text-on-surface">{privateInfo.emergencyContactName}</div>
                           <div className="text-xs font-medium text-on-surface-variant">{privateInfo.emergencyContactPhone}</div>
                        </div>
                        {privateInfo.emergencyContactName2 && (
                          <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-1">
                             <div className="text-[9px] font-black uppercase tracking-widest text-outline">Secondary Contact</div>
                             <div className="text-sm font-bold text-on-surface">{privateInfo.emergencyContactName2}</div>
                             <div className="text-xs font-medium text-on-surface-variant">{privateInfo.emergencyContactPhone2}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center text-[10px] font-bold text-outline uppercase tracking-widest italic py-8">
                        No Emergency Contact Provided
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary/60 mb-2 pt-2">
                      <Info size={12} />
                      Medical Information
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 min-h-[60px]">
                       <p className={cn(
                         "text-xs font-medium leading-relaxed",
                         privateInfo?.medicalNotes ? "text-on-surface italic" : "text-outline/40 italic"
                       )}>
                         {privateInfo?.medicalNotes || "No medical history or allergies noted."}
                       </p>
                    </div>
                  </>
                )}
              </>
            )}
              </div>
            </div>

            <div className="p-6 bg-surface-container shrink-0 border-t border-white/5 space-y-3">
              {isBuddy && onRemoveBuddy && (
                <button 
                  onClick={() => {
                    onRemoveBuddy(user.id);
                    onClose();
                  }}
                  className="w-full py-4 rounded-2xl bg-error/10 border border-error/20 text-error text-[10px] font-black uppercase tracking-widest transition-all hover:bg-error/20 active:scale-95"
                >
                  Remove Buddy
                </button>
              )}
              <button 
                onClick={onClose}
                className="w-full py-4 rounded-2xl bg-secondary text-on-secondary text-xs font-black uppercase tracking-widest shadow-xl shadow-secondary/20 transition-all hover:bg-secondary-container active:scale-95"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const LocationSearchModal = ({ isOpen, onClose, onSelectLocation }: { isOpen: boolean, onClose: () => void, onSelectLocation: (loc: string, coords: { lat: number, lng: number }) => void }) => {
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [mapProps, setMapProps] = useState({
    center: { lat: 59.9139, lng: 10.7522 },
    zoom: 11
  });

  const handleMapClick = async (e: any) => {
    const lat = e.detail.latLng.lat;
    const lng = e.detail.latLng.lng;
    setSelectedCoords({ lat, lng });
    setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        const coords = { lat: latitude, lng: longitude };
        setSelectedCoords(coords);
        setMapProps({
          center: coords,
          zoom: 14
        });
        setAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      }, (error) => {
        console.error("Error getting location:", error);
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/95 backdrop-blur-xl" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl rounded-[2.5rem] bg-surface-container-highest border border-white/10 shadow-2xl overflow-hidden flex flex-col aspect-square md:aspect-video"
          >
            <div className="p-6 bg-surface-container-highest flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xl font-black italic tracking-tighter text-on-surface">Search by Map</h3>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">
                  Click on the map to set search center
                </p>
              </div>
              <button onClick={onClose} className="rounded-full bg-surface-container-high p-2 text-on-surface hover:bg-white/10 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 relative">
              <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || ''}>
                <GoogleMap
                  center={mapProps.center}
                  zoom={mapProps.zoom}
                  onCameraChanged={(e) => {
                    setMapProps({
                      center: e.detail.center,
                      zoom: e.detail.zoom
                    });
                  }}
                  mapId="DEMO_MAP_ID"
                  disableDefaultUI
                  gestureHandling="greedy"
                  onClick={handleMapClick}
                >
                  {selectedCoords && (
                    <AdvancedMarker position={selectedCoords}>
                      <div className="relative">
                        <div className="absolute -inset-8 bg-secondary/10 rounded-full animate-ping" />
                        <div className="bg-secondary p-2 rounded-xl shadow-2xl border-2 border-white/20">
                          <MapIcon size={24} className="text-on-secondary" />
                        </div>
                      </div>
                    </AdvancedMarker>
                  )}
                </GoogleMap>
              </APIProvider>
              
              <div className="absolute bottom-6 left-6 right-6 pointer-events-none">
                <div className="bg-background/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl pointer-events-auto flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleGetCurrentLocation}
                      className="h-10 w-10 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary hover:bg-secondary/30 transition-all active:scale-95 group/pin"
                      title="Use My Location"
                    >
                      <MapPin size={20} className="group-hover/pin:scale-110 transition-transform" />
                    </button>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-secondary">Search Center</div>
                      <div className="text-xs font-bold text-on-surface truncate max-w-[200px]">
                        {address || "Select a location on map..."}
                      </div>
                    </div>
                  </div>
                  <button
                    disabled={!selectedCoords}
                    onClick={() => selectedCoords && onSelectLocation(address, selectedCoords)}
                    className="px-6 py-3 rounded-xl bg-secondary text-on-secondary text-[10px] font-black uppercase tracking-widest shadow-xl shadow-secondary/20 transition-all hover:bg-secondary-container active:scale-95 disabled:opacity-50"
                  >
                    Set Area
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
