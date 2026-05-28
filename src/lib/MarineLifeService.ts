import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface MarineSpecies {
  id: number;
  commonName: string;
  scientificName: string;
  category: string;
  imageUrl: string | null;
}

export interface MarineSpeciesDetails extends MarineSpecies {
  description: string | null;
  highResImageUrl: string | null;
  wikipediaUrl: string | null;
}

const MARINE_TAXA_IDS = [
  47178,  // Actinopterygii (Ray-finned fishes)
  47273,  // Elasmobranchii (Sharks, Rays)
  47115,  // Mollusca (Mollusks, including octopuses and squids)
  47534,  // Anthozoa (Corals, Sea anemones)
  46255,  // Cetacea (Whales, Dolphins, Porpoises)
  152871, // Pinnipedia (Seals, Sea lions, Walruses)
  47795,  // Chelonioidea (Sea turtles)
  47186,  // Decapoda (Crabs, Lobsters, Shrimp)
].join(',');

export class MarineLifeService {
  /**
   * Search for marine species using the iNaturalist API.
   * Throttling/debouncing should be handled by the caller.
   */
  static async searchSpecies(query: string): Promise<MarineSpecies[]> {
    if (!query || query.trim().length < 2) return [];

    try {
      const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(query)}&is_active=true&taxon_id=${MARINE_TAXA_IDS}&rank=species,complex`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`iNaturalist API error: ${response.status}`);
      }

      const data = await response.json();

      return data.results.map((result: any) => ({
        id: result.id,
        commonName: result.preferred_common_name || result.english_common_name || result.name,
        scientificName: result.name,
        category: result.iconic_taxon_name || 'Unknown',
        imageUrl: result.default_photo?.medium_url || null,
      }));
    } catch (error) {
      console.error('Error searching marine species:', error);
      return [];
    }
  }

  /**
   * Fetch detailed information for a specific species by its iNaturalist ID.
   */
  static async getSpeciesDetails(id: number): Promise<MarineSpeciesDetails | null> {
    try {
      const url = `https://api.inaturalist.org/v1/taxa/${id}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch species details');
      const data = await response.json();
      const result = data.results[0];
      if (!result) return null;

      return {
        id: result.id,
        commonName: result.preferred_common_name || result.english_common_name || result.name,
        scientificName: result.name,
        category: result.iconic_taxon_name || 'Unknown',
        imageUrl: result.default_photo?.medium_url || null,
        highResImageUrl: result.default_photo?.original_url || result.default_photo?.large_url || result.default_photo?.medium_url || null,
        description: result.wikipedia_summary || null,
        wikipediaUrl: result.wikipedia_url || null,
      };
    } catch (error) {
      console.error('Error fetching species details:', error);
      return null;
    }
  }

  /**
   * Fetch nearby marine species observations using iNaturalist API.
   * Sorts by observation count ascending to prioritize rare/uncommon species.
   */
  static async getNearbyTreasures(lat: number, lng: number, radius: number = 50): Promise<MarineSpecies[]> {
    try {
      const url = `https://api.inaturalist.org/v1/observations/species_counts?lat=${lat}&lng=${lng}&radius=${radius}&taxon_id=${MARINE_TAXA_IDS}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch nearby treasures');
      const data = await response.json();
      
      // Sort ascending by count (rarer species first)
      const results = data.results.sort((a: any, b: any) => a.count - b.count);

      return results.map((result: any) => {
        const taxon = result.taxon;
        return {
          id: taxon.id,
          commonName: taxon.preferred_common_name || taxon.english_common_name || taxon.name,
          scientificName: taxon.name,
          category: taxon.iconic_taxon_name || 'Unknown',
          imageUrl: taxon.default_photo?.medium_url || null,
        };
      });
    } catch (error) {
      console.error('Error fetching nearby treasures:', error);
      return [];
    }
  }

  /**
   * Retrieves a cached species from Firebase.
   */
  static async getCachedSpecies(id: number): Promise<MarineSpecies | null> {
    try {
      const docRef = doc(db, 'marine_species', id.toString());
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as MarineSpecies;
      }

      return null;
    } catch (error) {
      console.error('Error fetching cached marine species:', error);
      return null;
    }
  }

  /**
   * Caches a species in Firebase for faster future access.
   * Since firestore rules restrict overwrites, we use setDoc without merge, 
   * but if it already exists it might throw a permission error.
   * To handle this gracefully, we check first or just catch the error.
   */
  static async cacheSpecies(species: MarineSpecies): Promise<void> {
    try {
      // First, check if it already exists to avoid throwing a permission error
      const existing = await this.getCachedSpecies(species.id);
      if (existing) {
        return; // Already cached
      }

      const docRef = doc(db, 'marine_species', species.id.toString());
      await setDoc(docRef, {
        id: species.id,
        commonName: species.commonName,
        scientificName: species.scientificName,
        category: species.category,
        imageUrl: species.imageUrl,
      });
    } catch (error) {
      console.error('Error caching marine species:', error);
      // It's possible we hit a permission-denied error due to rules (if created by another user concurrently).
      // We can safely ignore it since the goal was just to ensure it's cached.
    }
  }
}
