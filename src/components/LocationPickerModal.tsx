import React, { useState, useEffect, useMemo } from "react";
import { Search, MapPin, X, Navigation, Check, Loader2, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";
import { APIProvider, Map, AdvancedMarker, useMapsLibrary, MapMouseEvent } from '@vis.gl/react-google-maps';
import { MapErrorBoundary } from "./MapErrorBoundary";
import { collection, query, limit, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

interface LocationPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (location: { name: string; lat: number; lng: number }) => void;
  initialLocation?: string;
}

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export const LocationPickerModal = ({ isOpen, onClose, onSelect, initialLocation }: LocationPickerProps) => {
  const [search, setSearch] = useState("");
  const [sites, setSites] = useState<any[]>([]);
  const [mapCenter, setMapCenter] = useState({ lat: 17.3160, lng: -87.5351 });
  const [selectedPoint, setSelectedPoint] = useState<{lat: number, lng: number, name: string} | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Maps libraries
  const placesLib = useMapsLibrary('places');
  const geocodingLib = useMapsLibrary('geocoding');
  const markerLib = useMapsLibrary('marker');
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null);
  const [placesSuggestions, setPlacesSuggestions] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, "dive_sites"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sitesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSites(sitesData);
    });
    return () => unsubscribe();
  }, []);

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
        if (placesLib.AutocompleteSuggestion) {
          const { suggestions } = await (placesLib.AutocompleteSuggestion as any).fetchAutocompleteSuggestions({
            input: search,
          });
          setPlacesSuggestions(suggestions.slice(0, 5));
        } else {
          const service = new placesLib.AutocompleteService();
          service.getPlacePredictions({ input: search }, (predictions) => {
            setPlacesSuggestions(predictions ? predictions.slice(0, 5) : []);
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

  const filteredSites = useMemo(() => {
    if (!search) return [];
    return sites.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).slice(0, 3);
  }, [search, sites]);

  const handlePlaceSelect = (placeId: string, description: string) => {
    if (!geocoder) return;
    geocoder.geocode({ placeId }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        const newPoint = { lat: loc.lat(), lng: loc.lng(), name: description };
        setMapCenter({ lat: loc.lat(), lng: loc.lng() });
        setSelectedPoint(newPoint);
        setSearch("");
        setShowSuggestions(false);
      }
    });
  };

  const handleSiteSelect = (site: any) => {
    const newPoint = { lat: site.lat, lng: site.lng, name: site.name };
    setMapCenter({ lat: site.lat, lng: site.lng });
    setSelectedPoint(newPoint);
    setSearch("");
    setShowSuggestions(false);
  };

  const handleMapClick = (e: MapMouseEvent) => {
    if (e.detail.latLng) {
      const lat = e.detail.latLng.lat;
      const lng = e.detail.latLng.lng;
      
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return;
      
      // Attempt to geocode the point to get a name
      if (geocoder) {
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            setSelectedPoint({ lat, lng, name: results[0].formatted_address });
          } else {
            setSelectedPoint({ lat, lng, name: `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}` });
          }
        });
      } else {
        setSelectedPoint({ lat, lng, name: `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      }
    }
  };

  const handleConfirm = () => {
    if (selectedPoint) {
      onSelect(selectedPoint);
      onClose();
    }
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
          const loc = { lat, lng };
          setMapCenter(loc);
          if (geocoder) {
            geocoder.geocode({ location: loc }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                setSelectedPoint({ ...loc, name: results[0].formatted_address });
              } else {
                setSelectedPoint({ ...loc, name: "Current Location" });
              }
            });
          }
        }
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        className="relative w-full max-w-4xl h-full sm:h-[80vh] bg-surface-container-highest sm:rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl border border-white/10"
      >
        {/* Header */}
        <div className="p-6 bg-surface-container-highest border-b border-white/5 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-secondary/20 flex items-center justify-center text-secondary">
              <MapPin size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-on-surface">Select Dive Site</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">Tap map or search for a location</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-surface-container-high p-2 text-on-surface hover:bg-white/10 transition-colors border border-white/10">
            <X size={20} />
          </button>
        </div>

        {/* Search Bar - Floating */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-20">
          <div className="relative group">
            <div className="flex items-center gap-3 rounded-2xl bg-surface-container-highest/90 p-1.5 pl-4 backdrop-blur-md border border-white/10 shadow-2xl transition-all focus-within:border-secondary/50">
              <Search size={18} className="text-secondary shrink-0" />
              <input 
                type="text"
                value={search}
                onChange={(e) => {setSearch(e.target.value); setShowSuggestions(true);}}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search dive sites or places..."
                className="flex-1 bg-transparent border-none py-2 text-sm text-on-surface placeholder:text-outline/30 focus:ring-0"
              />
              <button 
                onClick={handleCurrentLocation}
                className="p-2 rounded-xl bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors"
                title="Use Current Location"
              >
                <Navigation size={18} />
              </button>
            </div>

            <AnimatePresence>
              {showSuggestions && (search.length > 0) && (filteredSites.length > 0 || placesSuggestions.length > 0) && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 rounded-[2rem] bg-surface-container-highest border border-white/10 shadow-2xl overflow-hidden py-2"
                >
                  {filteredSites.length > 0 && (
                     <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-outline">Dive Sites</div>
                  )}
                  {filteredSites.map(site => (
                    <button 
                      key={site.id}
                      onClick={() => handleSiteSelect(site)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                    >
                      <MapPin size={14} className="text-primary" />
                      <span className="text-sm font-medium text-on-surface">{site.name}</span>
                    </button>
                  ))}

                  {placesSuggestions.length > 0 && (
                     <div className="px-4 py-2 mt-2 text-[10px] font-black uppercase tracking-widest text-outline border-t border-white/5 pt-4">Global Locations</div>
                  )}
                  {placesSuggestions.map((suggestion, idx) => {
                    const isPrediction = 'place_id' in suggestion;
                    const id = isPrediction ? suggestion.place_id : suggestion.placePrediction?.placeId;
                    const text = isPrediction ? suggestion.description : suggestion.placePrediction?.text.text;

                    return (
                      <button 
                        key={id ? `${id}-${idx}` : `place-${idx}`}
                        onClick={() => handlePlaceSelect(id, text)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                      >
                        <Search size={14} className="text-on-surface-variant" />
                        <span className="text-sm font-medium text-on-surface truncate">{text}</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative bg-surface-container">
            <Map
              center={mapCenter}
              onCenterChanged={e => {
                const newCenter = e.detail.center;
                if (typeof newCenter.lat === 'number' && typeof newCenter.lng === 'number' && !isNaN(newCenter.lat) && !isNaN(newCenter.lng)) {
                  setMapCenter(newCenter);
                }
              }}
              defaultZoom={12}
              mapId="DIVE_PICKER_MAP"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{width: '100%', height: '100%'}}
              disableDefaultUI={true}
              onClick={handleMapClick}
              clickableIcons={false}
            >
              {/* Existing Dive Sites */}
              {markerLib && sites
                .filter(site => typeof site.lat === 'number' && typeof site.lng === 'number' && !isNaN(site.lat) && !isNaN(site.lng))
                .map((site) => (
                <MapErrorBoundary key={site.id}>
                  <AdvancedMarker 
                    position={{lat: site.lat, lng: site.lng}}
                    onClick={() => handleSiteSelect(site)}
                  >
                    <div className="p-2 rounded-full bg-primary/80 text-on-primary shadow-lg border border-white/20 backdrop-blur-sm transform transition-transform hover:scale-110">
                      <MapPin size={18} />
                    </div>
                  </AdvancedMarker>
                </MapErrorBoundary>
              ))}

              {/* Selected Point */}
              {markerLib && selectedPoint && typeof selectedPoint.lat === 'number' && typeof selectedPoint.lng === 'number' && !isNaN(selectedPoint.lat) && !isNaN(selectedPoint.lng) && (
                <MapErrorBoundary>
                  <AdvancedMarker position={{lat: selectedPoint.lat, lng: selectedPoint.lng}}>
                    <div className="flex flex-col items-center">
                      <div className="p-3 rounded-full bg-secondary text-on-secondary shadow-2xl border-4 border-white shadow-secondary/50 animate-bounce">
                        <MapPin size={24} />
                      </div>
                    </div>
                  </AdvancedMarker>
                </MapErrorBoundary>
              )}
            </Map>

          {/* Map Controls */}
          <div className="absolute right-6 bottom-32 flex flex-col gap-2">
             {/* Map hint */}
             <div className="bg-surface-container-highest/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-on-surface pointer-events-none shadow-xl">
               Tap map to select location
             </div>
          </div>
        </div>

        {/* Footer Info & Confirm */}
        <div className="p-6 bg-surface-container-highest border-t border-white/5 shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-on-surface-variant flex-shrink-0 border border-white/10">
                <Info size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-outline">Selected Location</span>
                <p className="text-lg font-bold text-on-surface truncate pr-4 italic tracking-tight underline decoration-secondary/30 decoration-2 underline-offset-4">
                  {selectedPoint ? selectedPoint.name : "Tap on map..."}
                </p>
              </div>
            </div>
            
            <div className="flex gap-4 w-full sm:w-auto">
              <button 
                onClick={onClose}
                className="flex-1 sm:px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-on-surface hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirm}
                disabled={!selectedPoint}
                className="flex-[2] sm:px-12 py-4 rounded-2xl bg-secondary text-on-secondary text-xs font-black uppercase tracking-widest shadow-xl shadow-secondary/20 transition-all hover:bg-secondary-container active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
              >
                <Check size={18} />
                Confirm Site
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
