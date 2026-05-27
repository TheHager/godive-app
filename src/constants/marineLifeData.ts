export interface MarineSpecies {
  id: string;
  name: string;
  scientificName: string;
  image: string;
  rarity: 'common' | 'uncommon' | 'rare';
}

export const MARINE_SPECIES_DATA: MarineSpecies[] = [
  {
    id: 'whale-shark',
    name: 'Whale Shark',
    scientificName: 'Rhincodon typus',
    image: 'https://images.unsplash.com/photo-1560275619-4662e36fa65c?auto=format&fit=crop&q=80&w=800',
    rarity: 'rare'
  },
  {
    id: 'clownfish',
    name: 'Clownfish',
    scientificName: 'Amphiprioninae',
    image: 'https://images.unsplash.com/photo-1544552866-d3ed42536cfd?auto=format&fit=crop&q=80&w=800',
    rarity: 'common'
  },
  {
    id: 'green-sea-turtle',
    name: 'Green Sea Turtle',
    scientificName: 'Chelonia mydas',
    image: 'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?auto=format&fit=crop&q=80&w=800',
    rarity: 'uncommon'
  },
  {
    id: 'manta-ray',
    name: 'Manta Ray',
    scientificName: 'Mobula alfredi',
    image: 'https://images.unsplash.com/photo-1598977123418-454555aa1694?auto=format&fit=crop&q=80&w=800',
    rarity: 'uncommon'
  },
  {
    id: 'blue-ringed-octopus',
    name: 'Blue Ringed Octopus',
    scientificName: 'Hapalochlaena',
    image: 'https://images.unsplash.com/photo-1545671913-b89ac1b4ac10?auto=format&fit=crop&q=80&w=800',
    rarity: 'rare'
  },
  {
    id: 'lionfish',
    name: 'Lionfish',
    scientificName: 'Pterois',
    image: 'https://images.unsplash.com/photo-1534043464124-3be32fe000c9?auto=format&fit=crop&q=80&w=800',
    rarity: 'uncommon'
  },
  {
    id: 'great-white-shark',
    name: 'Great White Shark',
    scientificName: 'Carcharodon carcharias',
    image: 'https://images.unsplash.com/photo-1564349683136-77e08bef1ef1?auto=format&fit=crop&q=80&w=800',
    rarity: 'rare'
  },
  {
    id: 'moray-eel',
    name: 'Moray Eel',
    scientificName: 'Muraenidae',
    image: 'https://images.unsplash.com/photo-1572452140417-640c427c34d3?auto=format&fit=crop&q=80&w=800',
    rarity: 'common'
  }
];
