import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

const SITES = [
  { id: 'kohtao_1', name: 'Chumphon Pinnacle' },
  { id: 'kohtao_2', name: 'Southwest Pinnacle' },
  { id: 'kohtao_3', name: 'White Rock' },
  { id: 'kohtao_4', name: 'Twins Peak' },
  { id: 'kohtao_5', name: 'Shark Island' },
  { id: 'kohtao_6', name: 'Sail Rock' },
  { id: 'kohtao_7', name: 'Green Rock' },
  { id: 'kohtao_8', name: 'HTMS Sattakut wreck' },
  { id: 'kohtao_9', name: 'Japanese Gardens' },
  { id: 'kohtao_10', name: 'Mango Bay' },
  { id: 'kohtao_11', name: 'Aow Leuk' },
  { id: 'kohtao_12', name: 'Hin Wong Pinnacle' },
  { id: 'kohtao_13', name: 'Laem Thien' },
  { id: 'kohtao_14', name: 'Lighthouse' },
  { id: 'kohtao_15', name: 'Junkyard Reef' },
  { id: 'kohtao_16', name: 'Biorock' },
  { id: 'kohtao_17', name: 'Buoyancy World' },
  { id: 'kohtao_18', name: 'Sairee Reef' },
  { id: 'kohtao_19', name: 'Red Rock Nang Yuan Cave' },
  { id: 'kohtao_20', name: 'Hin Pee Wee' },
  { id: 'kohtao_21', name: 'Pottery Pinnacle' },
  { id: 'kohtao_22', name: 'Three Rocks' },
  { id: 'kohtao_23', name: 'Mao Bay' },
  { id: 'kohtao_24', name: 'Tanote Bay' },
  { id: 'kohtao_25', name: 'King Kong Rock' },
  { id: 'kohtao_26', name: 'No Name Pinnacle' },
  { id: 'kohtao_27', name: 'Hin Nam' },
  { id: 'kohtao_28', name: 'Tao Tong' },
  { id: 'kohtao_29', name: 'Crystal Bay Koh Tao' }
];

async function downloadImage(url, filepath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Unexpected response ${res.statusText}`);
  const buffer = await res.buffer();
  fs.writeFileSync(filepath, buffer);
}

async function scrapeYahoo(query) {
  const url = `https://images.search.yahoo.com/search/images?p=${encodeURIComponent(query + ' Koh Tao dive site underwater')}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }});
  const html = await res.text();
  const $ = cheerio.load(html);
  
  let imageUrl = null;
  // Yahoo image results typically have src attributes, sometimes data-src
  $('img').each((i, el) => {
    const src = $(el).attr('data-src') || $(el).attr('src');
    // filter out small icons and tracking pixels
    if (src && src.startsWith('https://') && src.includes('tse')) {
      imageUrl = src;
      return false; // break
    }
  });
  return imageUrl;
}

async function main() {
  const outputDir = path.join(process.cwd(), 'public', 'sites');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const site of SITES) {
    const filename = `${site.id}.jpg`;
    const filepath = path.join(outputDir, filename);
    
    if (fs.existsSync(filepath)) {
      console.log(`[SKIP] ${filename} already exists.`);
      continue;
    }

    try {
      console.log(`[SEARCH] Searching for ${site.name}...`);
      let imgUrl = await scrapeYahoo(site.name);
      
      if (!imgUrl) {
         // Fallback to Wikipedia or just generic underwater search
         console.log(`[FALLBACK] Searching generic for ${site.name}...`);
         imgUrl = await scrapeYahoo('underwater coral reef dive site');
      }

      if (imgUrl) {
        console.log(`[DOWNLOAD] Downloading ${imgUrl} for ${site.name}...`);
        await downloadImage(imgUrl, filepath);
      } else {
        console.log(`[FAILED] Could not find image for ${site.name}`);
      }
      
      // Delay to avoid rate limits
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`[ERROR] Failed to process ${site.name}:`, err.message);
    }
  }
}

main().then(() => console.log('Done!')).catch(console.error);
