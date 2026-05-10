import React, { useState, useEffect, useMemo } from "react";
import { Search, Filter, Fish, Star, MapPin, Plus, X, Send, Edit2, Settings, Camera, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "../lib/utils";
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary, MapMouseEvent } from '@vis.gl/react-google-maps';
import { useAuth } from "../contexts/AuthContext";
import { useUser } from "../contexts/UserContext";
import { ActionMenu } from "./ActionMenu";
import { MapErrorBoundary } from "./MapErrorBoundary";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, increment, query, orderBy, limit, onSnapshot, writeBatch, getDoc, getDocs, where, Timestamp, runTransaction } from "firebase/firestore";
import { MARINE_LIFE_DATABASE, getSpeciesXP, getSpeciesRarity } from "../constants/marineLife";
import { filterProfanity } from "../lib/profanity";

const API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

const INITIAL_DIVE_SITES = [
  { id: 'site_1', type: "site", name: "Great Blue Hole", lat: 17.3160, lng: -87.5351 },
  { id: 'site_2', type: "site", name: "Half Moon Caye Wall", lat: 17.2052, lng: -87.5342 },
];

const INITIAL_REVIEWS = {
  'site_1': [
    { id: 1, user: "Alice Walker", rating: 5, text: "Amazing visibility, saw a few reef sharks! The stalactites are mind-blowing at depth." },
    { id: 2, user: "Bob Builder", rating: 4, text: "A bit chilly at depth but totally worth it. Make sure you have your deep diver cert!" }
  ],
  'site_2': []
};

interface ExplorerViewProps {
  onNavigateToEvent?: (id: string) => void;
}

export const ExplorerView = ({ onNavigateToEvent }: ExplorerViewProps = {}) => {
  const { profile } = useAuth();
  const { updateBadgeStats } = useUser();
  const [search, setSearch] = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [selectedSite, setSelectedSite] = useState<any | null>(null);
  const [sites, setSites] = useState<any[]>(INITIAL_DIVE_SITES);
  const [sightings, setSightings] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    // Current time minus 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const qS = query(
      collection(db, "sightings"), 
      where("timestamp", ">=", Timestamp.fromDate(yesterday)),
      orderBy("timestamp", "desc")
    );
    const unsubscribeS = onSnapshot(qS, (snapshot) => {
      const sightingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().timestamp?.toMillis() || Date.now()
      }));
      setSightings(sightingsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "sightings");
    });

    const qD = query(collection(db, "dive_sites"), limit(200));
    const unsubscribeD = onSnapshot(qD, (snapshot) => {
      const sitesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setSites(prev => {
        // Create a map to store unique sites, prioritizing fetched data
        const sitesMap = new window.Map();
        
        // Add initial sites first
        INITIAL_DIVE_SITES.forEach(site => {
          sitesMap.set(site.id, site);
        });
        
        // Overwrite with fetched sites (which may have more data like reviews/stats)
        sitesData.forEach(site => {
          sitesMap.set(site.id, site);
        });
        
        return Array.from(sitesMap.values());
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "dive_sites");
    });

    const qE = query(collection(db, "events"), orderBy("timestamp", "desc"), limit(200));
    const unsubscribeE = onSnapshot(qE, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(eventsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "events");
    });

    return () => {
      unsubscribeS();
      unsubscribeD();
      unsubscribeE();
    };
  }, []);

  useEffect(() => {
    // Temporary cleanup of 'fyh' site requested by user
    const cleanupFyh = async () => {
      try {
        const q = query(collection(db, "dive_sites"), where("name", "==", "fyh"));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      } catch (err) {
        console.error("Error cleaning up fyh:", err);
      }
    };
    cleanupFyh();
  }, []);

  const [viewMode, setViewMode] = useState<'all' | 'sites' | 'sightings' | 'unverified' | 'events'>('all');
  const [selectionMode, setSelectionMode] = useState<'none' | 'site' | 'sighting'>('none');
  const [pendingLocation, setPendingLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [isAddingSighting, setIsAddingSighting] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 17.3160, lng: -87.5351 });
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) {
      const mins = Math.floor(diff / (1000 * 60));
      return `${mins}m ago`;
    }
    return `${hours}h ago`;
  };

  const recentSightings = sightings; // Filtered by limit in query already

  const allMarkers = [
    ...recentSightings,
    ...sites.map(s => ({ ...s, label: s.name, type: s.status === 'unverified' ? 'unverified' : 'site' })),
    ...events.map(e => ({ ...e, label: e.title, type: 'event' }))
  ];

  const filteredMarkers = (search 
    ? allMarkers.filter(m => m.label.toLowerCase().includes(search.toLowerCase()))
    : allMarkers).filter(m => m.lat != null && m.lng != null && !isNaN(m.lat) && !isNaN(m.lng) && typeof m.lat === 'number' && typeof m.lng === 'number');

  const placesLib = useMapsLibrary('places');
  const geocodingLib = useMapsLibrary('geocoding');
  const markerLib = useMapsLibrary('marker');
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null);
  const [placesSuggestions, setPlacesSuggestions] = useState<any[]>([]);

  useEffect(() => {
    if (!geocodingLib) return;
    setGeocoder(new geocodingLib.Geocoder());
  }, [geocodingLib]);

  useEffect(() => {
    if (!placesLib || !search || search.trim().length === 0) {
      setPlacesSuggestions([]);
      return;
    }
    
    const fetchSuggestions = async () => {
      try {
        // Use the new AutocompleteSuggestion API if available, fallback to legacy if not
        if (placesLib.AutocompleteSuggestion) {
          const { suggestions } = await (placesLib.AutocompleteSuggestion as any).fetchAutocompleteSuggestions({
            input: search,
          });
          setPlacesSuggestions(suggestions.slice(0, 3));
        } else {
          const service = new placesLib.AutocompleteService();
          service.getPlacePredictions({ input: search }, (predictions) => {
            setPlacesSuggestions(predictions ? predictions.slice(0, 3) : []);
          });
        }
      } catch (error) {
        console.error("Error fetching autocomplete suggestions:", error);
        setPlacesSuggestions([]);
      }
    };

    const delay = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(delay);
  }, [search, placesLib]);

  const searchSuggestions = useMemo(() => {
    if (!search) return [];
    const markerLabels = Array.from(new Set(allMarkers.map(m => m.label)));
    const combined = Array.from(new Set([...MARINE_LIFE_DATABASE, ...markerLabels]));
    
    return combined
        .filter(label => label.toLowerCase().includes(search.toLowerCase()) && label.toLowerCase() !== search.toLowerCase())
        .slice(0, 4);
  }, [search, allMarkers]);

  const handlePlaceSelect = (placeId: string) => {
    if (!geocoder) return;
    geocoder.geocode({ placeId }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        setMapCenter({ lat: loc.lat(), lng: loc.lng() });
        setSearch("");
        setShowSearchSuggestions(false);
      }
    });
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setSearch(suggestion);
    setShowSearchSuggestions(false);
    
    // Attempt to pan to logic
    const matchingMarker = allMarkers.find(m => m.label.toLowerCase() === suggestion.toLowerCase());
    if (matchingMarker) {
      setMapCenter({ lat: matchingMarker.lat, lng: matchingMarker.lng });
    }
  };

  const handleAddReview = async (siteId: string, review: any) => {
    if (!profile?.id) return;

    try {
      const siteRef = doc(db, "dive_sites", siteId);
      const reviewRef = doc(db, "dive_sites", siteId, "reviews", profile.id);

      await runTransaction(db, async (transaction) => {
        const siteDoc = await transaction.get(siteRef);
        const reviewDoc = await transaction.get(reviewRef);

        let currentSiteData: any = siteDoc.exists() ? siteDoc.data() : null;
        
        // If site doesn't exist in DB yet (hardcoded site), we'll handle it
        if (!currentSiteData) {
          const hardcodedSite = INITIAL_DIVE_SITES.find(s => s.id === siteId);
          if (hardcodedSite) {
            currentSiteData = {
              ...hardcodedSite,
              status: 'verified',
              upvotes: 0,
              downvotes: 0,
              userId: profile.id,
              timestamp: serverTimestamp(),
              avgRating: 0,
              reviewCount: 0
            };
            transaction.set(siteRef, currentSiteData);
          } else {
             throw new Error("Site not found");
          }
        }

        const newRating = Number(review.rating);

        if (reviewDoc.exists()) {
          // Update existing review
          transaction.update(reviewRef, {
            rating: newRating,
            text: filterProfanity(review.text),
            timestamp: serverTimestamp()
          });
          setToastMessage("Review updated!");
        } else {
          // Add new review
          transaction.set(reviewRef, {
            userId: profile.id,
            userDisplayName: profile.displayName || "Explorer",
            rating: newRating,
            text: filterProfanity(review.text),
            timestamp: serverTimestamp()
          });
          setToastMessage("Review added! Thanks for sharing.");
        }
      });
    } catch (err) {
      console.error("Error saving review:", err);
      setToastMessage("Failed to save review.");
    }
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUpvoteSite = async (siteId: string) => {
    if (!profile?.id) return;

    try {
      const site = sites.find(s => s.id === siteId);
      if (site?.userId === profile.id) {
        setToastMessage("You cannot vote on your own suggestion.");
        setTimeout(() => setToastMessage(null), 3000);
        setSelectedSite(null);
        return;
      }

      const batch = writeBatch(db);
      const siteRef = doc(db, "dive_sites", siteId);
      const voteRef = doc(db, "dive_sites", siteId, "votes", profile.id);

      const currentUpvotes = (site?.upvotes || 0);

      batch.set(voteRef, { vote: 'up', timestamp: serverTimestamp() });
      
      const updateData: any = { upvotes: increment(1) };
      if (currentUpvotes + 1 >= 10) {
        updateData.status = 'verified';
      }
      batch.update(siteRef, updateData);

      await batch.commit();

      setToastMessage("Thanks for verifying!");
    } catch (err: any) {
      if (err.message?.includes("PERMISSION_DENIED") || err.message?.includes("insufficient permissions")) {
        setToastMessage("You have already voted on this site.");
      } else {
        console.error("Error upvoting:", err);
        setToastMessage("Failed to submit vote. Please try again.");
      }
    }
    setSelectedSite(null);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDownvoteSite = async (siteId: string) => {
    if (!profile?.id) return;

    try {
      const site = sites.find(s => s.id === siteId);
      if (site?.userId === profile.id) {
        setToastMessage("You cannot vote on your own suggestion.");
        setTimeout(() => setToastMessage(null), 3000);
        setSelectedSite(null);
        return;
      }

      const batch = writeBatch(db);
      const siteRef = doc(db, "dive_sites", siteId);
      const voteRef = doc(db, "dive_sites", siteId, "votes", profile.id);

      const currentDownvotes = (site?.downvotes || 0);

      batch.set(voteRef, { vote: 'down', timestamp: serverTimestamp() });
      
      batch.update(siteRef, { downvotes: increment(1) });

      await batch.commit();

      setToastMessage("Thanks for the feedback!");
    } catch (err: any) {
      if (err.message?.includes("PERMISSION_DENIED") || err.message?.includes("insufficient permissions")) {
        setToastMessage("You have already voted on this site.");
      } else {
        console.error("Error downvoting:", err);
        setToastMessage("Failed to submit vote. Please try again.");
      }
    }
    setSelectedSite(null);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddSite = async (site: any) => {
    let finalStatus = 'unverified';
    if (profile?.subscriptionTier === 'premium' || profile?.subscriptionTier === 'vip') {
      finalStatus = 'verified';
    }

    const siteData = { 
      name: filterProfanity(site.name),
      lat: Number(site.lat),
      lng: Number(site.lng),
      type: site.type,
      status: finalStatus, 
      upvotes: 1, 
      downvotes: 0,
      userId: profile?.id || "anonymous",
      userDisplayName: profile?.displayName || "Explorer",
      photo: site.photo || null,
      timestamp: serverTimestamp()
    };
    
    // Optimistic UI insert with temporary ID
    const tempSite = { ...siteData, id: site.id };
    setSites(prev => [...prev, tempSite]);
    setToastMessage(finalStatus === 'verified' ? "Dive site added as a Verified Contributor!" : "Dive site suggestion submitted for community review!");
    setTimeout(() => setToastMessage(null), 3000);
    setIsAddingSite(false);

    // Save to Firestore and award XP
    try {
      const docRef = await addDoc(collection(db, "dive_sites"), siteData);
      
      // Update the local site with the final Firestore ID
      setSites(prev => prev.map(s => s.id === site.id ? { ...s, id: docRef.id } : s));
      
      if (profile?.id) {
        let shouldAwardXP = true;
        // FREE tier restriction: XP for the first 5 suggested sites daily (shared limit or independent? We'll make it simple checking if they suggested >=5 today)
        if (profile?.subscriptionTier === 'free' || !profile?.subscriptionTier) {
           const startOfDayMs = new Date().setHours(0,0,0,0);
           const todaySitesQ = query(collection(db, "dive_sites"), where("userId", "==", profile.id), where("timestamp", ">=", new Date(startOfDayMs)));
           const todaySitesSnap = await getDocs(todaySitesQ);
           if (todaySitesSnap.size >= 5) { // 5 sites today limit reached for XP
             shouldAwardXP = false;
           }
        }

        if (shouldAwardXP) {
          const userRef = doc(db, "users", profile.id);
          let xpAward = 150;
          if (profile?.subscriptionTier === 'vip') xpAward = Math.floor(xpAward * 1.5);
          
          await updateDoc(userRef, {
            points: increment(xpAward)
          });
        }
      }
    } catch (err) {
      console.error("Error saving site:", err);
      // rollback if needed
      setSites(prev => prev.filter(s => s.id !== site.id));
    }
  };

  const handleUpdateSite = async (siteId: string, updatedData: any) => {
    try {
      const siteRef = doc(db, "dive_sites", siteId);
      const newData = {
        name: filterProfanity(updatedData.name),
        lat: Number(updatedData.lat),
        lng: Number(updatedData.lng),
      };
      
      await updateDoc(siteRef, {
        ...newData,
        timestamp: serverTimestamp(),
      });
      setSites(prev => prev.map(s => s.id === siteId ? { ...s, ...newData } : s));
      setToastMessage("Dive site updated successfully.");
      setSelectedSite(null);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error("Error updating site:", err);
      setToastMessage("Failed to update site. Please try again.");
    }
  };

  const handleDeleteSite = async (siteId: string) => {
    try {
      const siteRef = doc(db, "dive_sites", siteId);
      await deleteDoc(siteRef);
      setSites(prev => prev.filter(s => s.id !== siteId));
      setToastMessage("Dive site removed successfully.");
      setSelectedSite(null);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error("Error deleting site:", err);
      setToastMessage("Failed to delete site. Please check your permissions.");
    }
  };

  const handleAddSighting = async (sighting: any) => {
    // Award XP based on rarity from shared database
    const rarity = getSpeciesRarity(sighting.label);
    const xp = getSpeciesXP(sighting.label);

    const sightingData = {
      ...sighting,
      species: filterProfanity(sighting.label),
      type: rarity === "rare" ? "rare" : "fish",
      userId: profile?.id || "anonymous",
      userDisplayName: profile?.displayName || "Explorer",
      timestamp: serverTimestamp(),
      createdAt: Date.now()
    };

    setSightings(prev => [...prev, sightingData]);
    setIsAddingSighting(false);

    // Save to Firestore
    try {
      await addDoc(collection(db, "sightings"), sightingData);
      
      if (profile?.id) {
        const userRef = doc(db, "users", profile.id);
        await updateDoc(userRef, {
          points: increment(xp)
        });
      }
    } catch (err) {
      console.error("Error saving sighting:", err);
    }
  };

  const handleFindNearMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
            const newLoc = { lat, lng };
            setUserLocation(newLoc);
            setMapCenter(newLoc);
          }
        },
        (error) => {
          console.error("Error getting location: ", error);
        }
      );
    }
  };

  if (!hasValidKey) {
    return (
      <div className="flex flex-1 w-full items-center justify-center p-6 bg-surface-container-lowest text-on-surface">
        <div className="max-w-md text-center rounded-3xl bg-surface-container p-8 shadow-2xl border border-white/10">
          <h2 className="mb-4 text-xl font-black uppercase text-secondary">Google Maps API Key Required</h2>
          <p className="mb-6 text-sm text-on-surface-variant text-left">
            <strong>Step 1:</strong> <a href="https://console.cloud.google.com/google/maps-apis/start" target="_blank" rel="noopener" className="text-secondary hover:underline">Get an API Key</a><br/><br/>
            <strong>Step 2:</strong> Add your key as a secret in AI Studio:
          </p>
          <ul className="mb-6 text-sm text-left text-on-surface-variant list-disc pl-5 space-y-2">
            <li>Open <strong>Settings</strong> (⚙️ gear icon, <strong>top-right corner</strong>)</li>
            <li>Select <strong>Secrets</strong></li>
            <li>Type <code>GOOGLE_MAPS_PLATFORM_KEY</code> as the secret name, press <strong>Enter</strong></li>
            <li>Paste your API key as the value, press <strong>Enter</strong></li>
          </ul>
          <p className="text-xs text-on-surface-variant/70">The app builds automatically after you add the secret.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 w-full overflow-hidden bg-surface-container-lowest">
        <Map
          center={mapCenter}
          onCenterChanged={e => {
            const newCenter = e.detail.center;
            if (typeof newCenter.lat === 'number' && typeof newCenter.lng === 'number' && !isNaN(newCenter.lat) && !isNaN(newCenter.lng)) {
              setMapCenter(newCenter);
            }
          }}
          defaultZoom={12}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{width: '100%', height: '100%', cursor: selectionMode !== 'none' ? 'crosshair' : undefined}}
          disableDefaultUI={true}
          onClick={(e: MapMouseEvent) => {
            if (selectionMode !== 'none' && e.detail.latLng) {
              setPendingLocation(e.detail.latLng);
              if (selectionMode === 'site') setIsAddingSite(true);
              if (selectionMode === 'sighting') setIsAddingSighting(true);
              setSelectionMode('none');
            }
          }}
        >
          {(viewMode === 'all' || viewMode === 'sites' || viewMode === 'sightings' || viewMode === 'unverified' || viewMode === 'events') && markerLib && filteredMarkers
            .filter(m => {
              if (viewMode === 'unverified') return m.type === 'unverified';
              if (viewMode === 'events') return m.type === 'event';
              if (m.type === 'unverified' || m.type === 'event') return false; // Hide unverified and events from sights/sites modes
              if (viewMode === 'sites') return m.type === 'site';
              if (viewMode === 'sightings') return m.type !== 'site';
              return true;
            })
            .map((marker, mIdx) => (
             <MapErrorBoundary key={`marker-${marker.type}-${marker.id || mIdx}`}>
               <AdvancedMarker 
                  position={{lat: marker.lat, lng: marker.lng}} 
                  title={marker.label}
                  onClick={() => {
                    if (marker.type === 'site' || marker.type === 'unverified') {
                      setSelectedSite(marker as any);
                    } else if (marker.type === 'event' && onNavigateToEvent) {
                      onNavigateToEvent(marker.id);
                    }
                  }}
               >
                  <div className="flex flex-col items-center group">
                    <div 
                      className={cn(
                         "p-2.5 rounded-full shadow-lg transition-transform group-hover:scale-110 cursor-pointer backdrop-blur-md border",
                         marker.type === 'fish' ? "bg-surface-container-high/90 border-secondary/30 text-secondary" : 
                         marker.type === 'site' ? "bg-surface-container-high/90 border-primary/30 text-primary" : 
                         marker.type === 'unverified' ? "bg-surface-container-high/90 border-orange-500/30 text-orange-500" :
                         marker.type === 'event' ? "bg-surface-container-high/90 border-purple-500/30 text-purple-500" :
                         "bg-surface-container-high/90 border-tertiary/30 text-tertiary"
                      )}
                    >
                      {marker.type === 'fish' ? <Fish size={20} /> : 
                       marker.type === 'site' ? <MapPin size={20} /> :
                       marker.type === 'unverified' ? <MapPin size={20} /> :
                       marker.type === 'event' ? <Calendar size={20} /> :
                       <Star size={20} />}
                    </div>
                    <div className="mt-2 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap rounded-xl bg-surface-container-high/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface backdrop-blur-md border border-white/10 pointer-events-none">
                      <span>{marker.label}</span>
                      {marker.createdAt && (
                        <span className="text-[8px] text-on-surface-variant font-medium normal-case tracking-normal mt-0.5">
                          {formatDate(marker.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
               </AdvancedMarker>
             </MapErrorBoundary>
          ))}
          {markerLib && userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number' && !isNaN(userLocation.lat) && !isNaN(userLocation.lng) && (
             <MapErrorBoundary>
               <AdvancedMarker position={userLocation} title="You are here">
                 <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse" />
               </AdvancedMarker>
             </MapErrorBoundary>
          )}
        </Map>

      {/* Floating UI */}
      <AnimatePresence>
        {selectedSite && selectedSite.type !== 'unverified' && (
          <SiteReviewModal 
            key="review-modal"
            site={selectedSite}
            onClose={() => setSelectedSite(null)}
            onAddReview={handleAddReview}
          />
        )}
        {selectedSite && selectedSite.type === 'unverified' && (
          <UnverifiedSiteModal 
            key="unverified-modal"
            site={selectedSite}
            onClose={() => setSelectedSite(null)}
            onUpvote={() => handleUpvoteSite(selectedSite.id)}
            onDownvote={() => handleDownvoteSite(selectedSite.id)}
            onUpdate={(data: any) => handleUpdateSite(selectedSite.id, data)}
            onDelete={() => handleDeleteSite(selectedSite.id)}
          />
        )}
        {isAddingSite && (
          <AddSiteModal 
            key="add-site-modal"
            location={pendingLocation}
            onClose={() => {setIsAddingSite(false); setPendingLocation(null);}}
            onAdd={handleAddSite}
          />
        )}
        {isAddingSighting && (
          <AddSightingModal 
            key="add-sighting-modal"
            location={pendingLocation}
            onClose={() => {setIsAddingSighting(false); setPendingLocation(null);}}
            onAdd={handleAddSighting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="pointer-events-auto absolute top-6 left-1/2 -translate-x-1/2 z-[60] rounded-2xl bg-surface-container-highest px-6 py-4 shadow-2xl border border-primary/30"
          >
            <span className="text-sm font-bold text-on-surface">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col p-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6 justify-between">
        <div className="flex w-full items-center justify-between gap-2 sm:gap-4">
          <div className="pointer-events-auto w-full max-w-md relative flex-1">
            <div className="flex gap-2 rounded-full bg-surface-container-high/90 p-1.5 backdrop-blur-md shadow-lg border border-white/10 focus-within:border-primary/50 transition-colors">
            <div className="flex flex-1 items-center gap-3 px-4">
              <Search size={18} className="text-on-surface-variant" />
              <input
                type="text"
                placeholder="Search marine life, sites..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSearchSuggestions(true);
                }}
                onFocus={() => setShowSearchSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                className="w-full bg-transparent border-none p-0 text-sm font-medium text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 outline-none"
              />
            </div>
            <button 
              onClick={handleFindNearMe}
              className="rounded-full p-2 text-primary hover:bg-primary/10 transition-colors"
               title="Find near me"
             >
              <MapPin size={18} />
            </button>
          </div>
          
          <AnimatePresence>
            {showSearchSuggestions && (searchSuggestions.length > 0 || placesSuggestions.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-white/10 bg-surface-container-highest shadow-2xl z-20 py-2 max-h-[60vh] overflow-y-auto no-scrollbar"
              >
                {searchSuggestions.length > 0 && (
                  <div className="px-4 pb-1 pt-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50">
                    Dive Sites & Marine Life
                  </div>
                )}
                {searchSuggestions.map((suggestion, i) => (
                  <div
                    key={`sug-${suggestion}-${i}`}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className="cursor-pointer px-4 py-2.5 text-sm font-medium text-on-surface hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <Search size={14} className="text-on-surface-variant" />
                    {suggestion}
                  </div>
                ))}

                {placesSuggestions.length > 0 && (
                  <div className="px-4 pb-1 pt-3 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50">
                    Locations
                  </div>
                )}
                {placesSuggestions.map((suggestion) => {
                  const isPrediction = 'place_id' in suggestion;
                  const id = isPrediction ? suggestion.place_id : suggestion.placePrediction?.placeId;
                  const text = isPrediction ? suggestion.description : suggestion.placePrediction?.text.text;
                  
                  return (
                    <div
                      key={`place-${id}`}
                      onClick={() => handlePlaceSelect(id)}
                      className="cursor-pointer px-4 py-2.5 text-sm font-medium text-on-surface hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <MapPin size={14} className="text-on-surface-variant" />
                      {text}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="pointer-events-auto relative shrink-0">
          <div className="rounded-full bg-surface-container-high/90 backdrop-blur-md shadow-lg border border-white/10 p-1.5 flex items-center justify-center">
            <ActionMenu 
              triggerIcon={<Settings size={20} className="text-on-surface-variant" />}
              buttonClassName="hover:bg-white/10 rounded-full w-[34px] h-[34px] flex items-center justify-center p-0 m-0 transition-colors"
              items={[
                { label: "View Mode", isHeader: true },
                { label: "All", icon: <Filter size={16} />, onClick: () => setViewMode("all"), active: viewMode === "all" },
                { label: "Sites", icon: <MapPin size={16} />, onClick: () => setViewMode("sites"), active: viewMode === "sites" },
                { label: "Sightings", icon: <Fish size={16} />, onClick: () => setViewMode("sightings"), active: viewMode === "sightings" },
                { label: "Events", icon: <Calendar size={16} />, onClick: () => setViewMode("events"), active: viewMode === "events" },
                { label: "Unverified", icon: <MapPin size={16} />, onClick: () => setViewMode("unverified"), active: viewMode === "unverified" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="pointer-events-auto flex w-full items-end justify-between gap-2 sm:gap-4 pb-4">
        <div className="flex-1" />
        
        <div className="relative shrink-0">
            <AnimatePresence>
              {showAddMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-16 right-0 mb-2 flex flex-col gap-2 min-w-[200px]"
                >
                  <button 
                    onClick={() => { setSelectionMode('site'); setShowAddMenu(false); }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-surface-container-high p-4 text-sm font-bold text-on-surface shadow-xl hover:bg-surface-container-highest transition-colors border border-white/10"
                  >
                    <div className="rounded-full bg-primary/20 p-2 text-primary">
                      <MapPin size={18} />
                    </div>
                    Suggest Dive Site
                  </button>
                  <button 
                    onClick={() => { setSelectionMode('sighting'); setShowAddMenu(false); }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-surface-container-high p-4 text-sm font-bold text-on-surface shadow-xl hover:bg-surface-container-highest transition-colors border border-white/10"
                  >
                    <div className="rounded-full bg-secondary/20 p-2 text-secondary">
                      <Fish size={18} />
                    </div>
                    Log Marine Life
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <button 
              onClick={() => setShowAddMenu(!showAddMenu)}
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-[1.25rem] transition-all active:scale-95 border border-white/20 hover:scale-110",
                showAddMenu ? "bg-surface-container-highest text-on-surface" : "bg-secondary text-on-secondary hover:bg-secondary-container hover:-rotate-12 shadow-[0_0_40px_rgba(76,214,251,0.3)]"
              )}
            >
              <Plus size={28} className={cn("transition-transform", showAddMenu && "rotate-45")} />
            </button>
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {selectionMode !== 'none' && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="pointer-events-auto absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 rounded-full bg-surface-container-highest p-3 pr-6 shadow-2xl border border-secondary/30"
          >
            <button 
              onClick={() => setSelectionMode('none')}
              className="rounded-full bg-surface-container-lowest p-2 text-on-surface-variant hover:text-on-surface transition-colors"
            >
               <X size={16} />
            </button>
            <span className="text-sm font-bold text-on-surface">Tap map to select {selectionMode === 'site' ? 'suggested dive site' : 'sighting'} location</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SiteReviewModal = ({ site, onClose, onAddReview }: any) => {
  const { profile } = useAuth();
  const [newReviewText, setNewReviewText] = useState("");
  const [newRating, setNewRating] = useState(0);
  const [siteReviews, setSiteReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!site?.id) return;
    
    setIsLoading(true);
    const reviewsRef = collection(db, "dive_sites", site.id, "reviews");
    const q = query(reviewsRef, orderBy("timestamp", "desc"), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviews = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setSiteReviews(reviews);
      
      // Check if current user already has a review
      if (profile?.id) {
        const myReview = reviews.find(r => r.userId === profile.id);
        if (myReview) {
          setNewRating(myReview.rating);
          setNewReviewText(myReview.text);
          setIsUpdating(true);
        }
      }
      
      setIsLoading(false);
    }, (err) => {
      setIsLoading(false);
      handleFirestoreError(err, OperationType.GET, `dive_sites/${site.id}/reviews`);
    });

    return () => unsubscribe();
  }, [site.id, profile?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRating === 0 || !newReviewText.trim()) return;
    onAddReview(site.id, {
      rating: newRating,
      text: newReviewText.trim(),
    });
    setNewReviewText("");
    setNewRating(0);
  };

  const avgRating = site.avgRating 
    ? site.avgRating.toFixed(1)
    : siteReviews.length > 0 
      ? (siteReviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0) / siteReviews.length).toFixed(1)
      : "No ratings";

  const totalReviews = site.reviewCount || siteReviews.length;

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-[2rem] bg-surface-container-highest/60 backdrop-blur-3xl shadow-2xl border border-white/5"
      >
        {site.photo && (
          <div className="w-full h-48 relative shrink-0">
            <img src={site.photo} className="w-full h-full object-cover" alt={site.name} />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container-highest/60 to-transparent" />
          </div>
        )}
        <div className="flex items-center justify-between border-b border-white/5 p-6 relative">
          <div className="relative z-10">
            <h2 className="text-lg font-black uppercase text-on-surface">{site.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Star size={14} className="text-secondary fill-secondary" />
              <span className="text-xs font-bold text-on-surface-variant">{avgRating} • {totalReviews} reviews</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-on-surface-variant hover:bg-white/5 transition-colors relative z-10">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-8 w-8 border-4 border-secondary/20 border-t-secondary rounded-full animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">Fetching Reviews...</span>
            </div>
          ) : siteReviews.length === 0 ? (
            <div className="text-center text-on-surface-variant text-sm py-8">
              No reviews yet. Be the first to review!
            </div>
          ) : (
            siteReviews.map((r: any) => (
              <div key={r.id} className="rounded-2xl border border-white/5 bg-surface-container-high p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-on-surface">{r.userDisplayName}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} size={12} className={star <= r.rating ? "text-secondary fill-secondary" : "text-outline"} />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-on-surface-variant leading-relaxed">{r.text}</p>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/5 bg-surface-container-high p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
            {isUpdating ? "Update Your Review" : "Add Your Review"}
          </h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setNewRating(star)}
                  className="rounded-full p-1"
                >
                  <Star size={24} className={star <= newRating ? "text-secondary fill-secondary" : "text-outline transition-colors hover:text-secondary"} />
                </button>
              ))}
            </div>
            <div className="relative">
              <textarea
                value={newReviewText}
                onChange={(e) => setNewReviewText(e.target.value)}
                placeholder="What did you see? How was the visibility?"
                className="w-full resize-none rounded-xl border border-white/10 bg-surface-container-highest p-3 pr-12 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary min-h-[80px]"
              />
              <button
                type="submit"
                disabled={!newRating || !newReviewText.trim()}
                className="absolute bottom-3 right-3 rounded-full bg-secondary p-2 text-on-secondary shadow-lg disabled:opacity-50 transition-colors"
                title="Post Review"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

const AddSiteModal = ({ onClose, onAdd, location }: any) => {
  const [name, setName] = useState("");
  const initialLat = location && typeof location.lat === 'number' && !isNaN(location.lat) ? location.lat.toFixed(4) : "17.3160";
  const initialLng = location && typeof location.lng === 'number' && !isNaN(location.lng) ? location.lng.toFixed(4) : "-87.5351";
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [photo, setPhoto] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
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
        setPhoto(compressedDataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const plat = parseFloat(lat);
    const plng = parseFloat(lng);
    if (!name.trim() || isNaN(plat) || isNaN(plng)) return;
    onAdd({
      id: `site_${Date.now()}`,
      type: "site",
      name: name.trim(),
      lat: plat,
      lng: plng,
      photo: photo || undefined
    });
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-[2rem] bg-surface-container-highest/60 backdrop-blur-3xl shadow-2xl border border-white/5 p-6 max-h-[90vh] overflow-y-auto no-scrollbar"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black uppercase text-on-surface">Suggest Dive Site</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-on-surface-variant hover:bg-white/5 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="group">
            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-3 ml-1 group-focus-within:text-white transition-colors">Site Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shark Point"
              className="w-full rounded-2xl bg-black/40 p-4 text-sm font-bold text-white placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-2 focus:ring-primary/40 border border-white/5 transition-all hover:border-white/20 hover:bg-black/60"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="group">
              <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-3 ml-1 group-focus-within:text-white transition-colors">Latitude</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full rounded-2xl bg-black/40 p-4 text-sm font-bold text-white placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-2 focus:ring-white/20 border border-white/5 transition-all hover:border-white/20 hover:bg-black/60"
              />
            </div>
            <div className="group">
              <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-3 ml-1 group-focus-within:text-white transition-colors">Longitude</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full rounded-2xl bg-black/40 p-4 text-sm font-bold text-white placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-2 focus:ring-white/20 border border-white/5 transition-all hover:border-white/20 hover:bg-black/60"
              />
            </div>
          </div>

          <div className="group">
            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-3 ml-1 group-focus-within:text-white transition-colors">Attach Photo</label>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handlePhotoUpload} 
              className="hidden" 
              accept="image/*" 
            />
            {photo ? (
              <div className="relative aspect-video rounded-2xl bg-black/40 overflow-hidden border border-white/5 group-hover:border-white/20 transition-all">
                <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-red-500/80 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full min-h-[100px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-black/20 hover:bg-white/5 hover:border-white/30 transition-all text-on-surface-variant/50 hover:text-white/80"
              >
                <Camera size={24} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Upload Image</span>
              </button>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={!name.trim() || !lat || !lng}
            className="mt-4 w-full rounded-2xl bg-primary py-4 text-[11px] font-black uppercase tracking-[0.2em] text-on-primary shadow-[0_20px_40px_-12px_rgba(76,145,251,0.3)] disabled:opacity-50 disabled:grayscale transition-all"
          >
            Submit Suggestion
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

const AddSightingModal = ({ onClose, onAdd, location }: any) => {
  const [fishSearch, setFishSearch] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const initialLat = location && typeof location.lat === 'number' && !isNaN(location.lat) ? location.lat.toFixed(4) : "17.3160";
  const initialLng = location && typeof location.lng === 'number' && !isNaN(location.lng) ? location.lng.toFixed(4) : "-87.5351";
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);

  const filteredFish = MARINE_LIFE_DATABASE.filter(f => 
    f.toLowerCase().includes(fishSearch.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const plat = parseFloat(lat);
    const plng = parseFloat(lng);
    if (!fishSearch.trim() || isNaN(plat) || isNaN(plng)) return;
    onAdd({
      id: `sighting_${Date.now()}`,
      type: "fish",
      label: fishSearch.trim(),
      lat: plat,
      lng: plng,
      createdAt: Date.now()
    });
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-[2rem] bg-surface-container-highest/60 backdrop-blur-3xl shadow-2xl border border-white/5 p-6"
        style={{ overflow: 'visible' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black uppercase text-on-surface">Log Marine Life</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-on-surface-variant hover:bg-white/5 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="relative group">
            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-3 ml-1 group-focus-within:text-secondary transition-colors">Species</label>
            <div className="relative">
              <input
                type="text"
                value={fishSearch}
                onChange={(e) => {
                  setFishSearch(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                placeholder="Search marine life..."
                className="w-full rounded-2xl bg-black/40 py-4 pl-12 pr-4 text-sm font-bold text-white placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-2 focus:ring-secondary/40 border border-white/5 transition-all hover:border-white/20 hover:bg-black/60"
              />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant/20 z-10">
                <Fish size={22} />
              </div>
            </div>
            <AnimatePresence>
              {showSearchDropdown && (fishSearch || filteredFish.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute left-0 right-0 top-full mt-3 max-h-56 overflow-y-auto rounded-3xl border border-white/10 bg-surface-container-highest shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)] z-[60] no-scrollbar py-3 backdrop-blur-xl"
                >
                  {filteredFish.length === 0 ? (
                    <div className="text-center p-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40 mb-4">Species Not Found</p>
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => {
                          setFishSearch(fishSearch);
                          setShowSearchDropdown(false);
                        }} 
                        className="w-full bg-secondary/10 hover:bg-secondary/20 text-secondary py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-secondary/20">
                        Select "{fishSearch}" anyway
                      </motion.button>
                    </div>
                  ) : (
                    filteredFish.map((f, idx) => (
                      <button
                        key={`${f}-${idx}`}
                        type="button"
                        className="w-full text-left px-5 py-3 text-sm font-bold text-white/80 hover:text-white hover:bg-white/5 transition-all flex items-center gap-3 group/item border-b border-white/5 last:border-0"
                        onClick={() => {
                          setFishSearch(f);
                          setShowSearchDropdown(false);
                        }}
                      >
                        <div className="w-2 h-2 rounded-full bg-secondary/30 group-hover/item:bg-secondary transition-colors" />
                        {f}
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="group">
              <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-3 ml-1 group-focus-within:text-white transition-colors">Latitude</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full rounded-2xl bg-black/40 p-4 text-sm font-bold text-white placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-2 focus:ring-white/20 border border-white/5 transition-all hover:border-white/20 hover:bg-black/60"
              />
            </div>
            <div className="group">
              <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-3 ml-1 group-focus-within:text-white transition-colors">Longitude</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full rounded-2xl bg-black/40 p-4 text-sm font-bold text-white placeholder:text-on-surface-variant/20 focus:outline-none focus:ring-2 focus:ring-white/20 border border-white/5 transition-all hover:border-white/20 hover:bg-black/60"
              />
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={!fishSearch.trim() || !lat || !lng}
            className="mt-4 w-full rounded-2xl bg-secondary py-4 text-[11px] font-black uppercase tracking-[0.2em] text-on-secondary shadow-[0_20px_40px_-12px_rgba(76,214,251,0.3)] disabled:opacity-50 disabled:grayscale transition-all"
          >
            Log Sighting
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export const UnverifiedSiteModal = ({ site, onClose, onUpvote, onDownvote, onUpdate, onDelete }: any) => {
  const { profile } = useAuth();
  const isCreator = profile?.id === site.userId;
  const [hasVoted, setHasVoted] = useState(false);
  const [checkingVote, setCheckingVote] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editName, setEditName] = useState(site.name || "");
  const [editLat, setEditLat] = useState(site.lat?.toString() || "");
  const [editLng, setEditLng] = useState(site.lng?.toString() || "");

  useEffect(() => {
    const checkVote = async () => {
      if (!profile?.id || !site.id || site.id.startsWith('site_')) { // Skip initial mock sites
        setCheckingVote(false);
        return;
      }
      try {
        const voteRef = doc(db, "dive_sites", site.id, "votes", profile.id);
        const voteSnap = await getDoc(voteRef);
        if (voteSnap.exists()) {
          setHasVoted(true);
        }
      } catch (err) {
        console.error("Error checking vote:", err);
      } finally {
        setCheckingVote(false);
      }
    };
    checkVote();
  }, [profile?.id, site.id]);

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-sm rounded-[2rem] bg-surface-container-highest/60 backdrop-blur-3xl shadow-2xl border border-white/5 overflow-hidden"
      >
        {site.photo && !isEditing && (
          <div className="w-full h-40 relative">
            <img src={site.photo} className="w-full h-full object-cover" alt={site.name} />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container-highest/80 to-transparent" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-orange-500 border border-orange-500/50">
                  Unverified
                </span>
              </div>
              <h2 className="text-xl font-black text-on-surface">{site.name}</h2>
            </div>
            <div className="flex items-center gap-1">
              {profile?.id === site.userId && !isEditing && (
                <ActionMenu 
                  items={[
                    { label: "Edit Site", icon: <Edit2 size={16} />, onClick: () => setIsEditing(true) }
                  ]}
                />
              )}
              <button onClick={onClose} className="rounded-full p-2 text-on-surface-variant hover:bg-white/5 transition-colors">
                 <X size={20} />
              </button>
            </div>
          </div>

        {isEditing ? (
          <form className="mt-4" onSubmit={(e) => {
            e.preventDefault();
            if (onUpdate) {
              onUpdate({ name: editName, lat: editLat, lng: editLng });
              setIsEditing(false);
            }
          }}>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-2 ml-1">Site Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-2xl bg-black/40 p-3 text-sm font-bold text-white border border-white/5 focus:ring-2 focus:ring-primary/40 focus:outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-2 ml-1">Lat</label>
                  <input
                    type="number"
                    step="any"
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    className="w-full rounded-2xl bg-black/40 p-3 text-sm font-bold text-white border border-white/5 focus:ring-2 focus:ring-primary/40 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant/40 mb-2 ml-1">Lng</label>
                  <input
                    type="number"
                    step="any"
                    value={editLng}
                    onChange={(e) => setEditLng(e.target.value)}
                    className="w-full rounded-2xl bg-black/40 p-3 text-sm font-bold text-white border border-white/5 focus:ring-2 focus:ring-primary/40 focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button 
                type="button" 
                onClick={() => setIsEditing(false)}
                className="flex-1 py-3 rounded-2xl border border-white/10 text-[11px] font-black uppercase tracking-widest text-on-surface-variant/80 hover:bg-white/5"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="flex-1 py-3 rounded-2xl bg-primary text-[11px] font-black uppercase tracking-widest text-black shadow-[0_0_15px_rgba(76,145,251,0.3)]"
              >
                Save
              </button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/5">
              {!isDeleting ? (
                <button 
                  type="button"
                  onClick={() => setIsDeleting(true)}
                  className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-error/60 hover:text-error transition-colors"
                >
                  Delete Site
                </button>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Are you sure?</span>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setIsDeleting(false)}
                      className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface"
                    >
                      No
                    </button>
                    <button 
                      type="button"
                      onClick={onDelete}
                      className="px-3 py-1 bg-error/20 text-error rounded-lg text-[10px] font-black uppercase tracking-widest border border-error/30"
                    >
                      Yes, Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        ) : (
          <>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
              {hasVoted 
                ? "You have already submitted your verification for this dive site. Thank you for contributing to the community!"
                : isCreator
                ? "You created this site suggestion. Other community members will need to verify its location."
                : "This dive site was suggested by the community but has not yet been verified. Does this dive site exist?"}
            </p>

            <div className="flex items-center justify-between gap-4">
              <button 
                onClick={onUpvote}
                disabled={hasVoted || checkingVote || isCreator}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-2xl border p-4 transition-all",
                  hasVoted || checkingVote || isCreator
                    ? "bg-white/5 border-white/10 text-on-surface-variant/40 opacity-50 cursor-not-allowed"
                    : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 cursor-pointer"
                )}
              >
                <span className="text-lg font-black">{site.upvotes || 0} / 10</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">Verify Site</span>
              </button>

              <button 
                 onClick={onDownvote}
                 disabled={hasVoted || checkingVote || isCreator}
                 className={cn(
                   "flex flex-1 flex-col items-center gap-1 rounded-2xl border p-4 transition-all",
                   hasVoted || checkingVote || isCreator
                     ? "bg-white/5 border-white/10 text-on-surface-variant/40 opacity-50 cursor-not-allowed"
                     : "bg-error/10 border-error/30 text-error hover:bg-error/20 cursor-pointer"
                 )}
              >
                 <span className="text-lg font-black">{site.downvotes || 0} / 10</span>
                 <span className="text-[10px] font-bold uppercase tracking-widest">Fake / Incorrect</span>
              </button>
            </div>
          </>
        )}
        </div>
      </motion.div>
    </div>
  );
};
