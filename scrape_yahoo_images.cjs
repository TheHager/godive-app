const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

const SITES = [
  { id: 'kohtao_1', name: 'Chumphon Pinnacle Koh Tao dive site underwater' },
  { id: 'kohtao_2', name: 'Southwest Pinnacle Koh Tao dive site underwater' },
  { id: 'kohtao_3', name: 'White Rock Koh Tao dive site underwater' },
  { id: 'kohtao_4', name: 'Twins Peak Koh Tao dive site underwater' },
  { id: 'kohtao_5', name: 'Shark Island Koh Tao dive site underwater' },
  { id: 'kohtao_6', name: 'Sail Rock Koh Tao dive site underwater' },
  { id: 'kohtao_7', name: 'Green Rock Koh Tao dive site underwater' },
  { id: 'kohtao_8', name: 'HTMS Sattakut wreck Koh Tao underwater' },
  { id: 'kohtao_9', name: 'Japanese Gardens Koh Tao dive site underwater' },
  { id: 'kohtao_10', name: 'Mango Bay Koh Tao dive site underwater' },
  { id: 'kohtao_11', name: 'Aow Leuk Koh Tao dive site underwater' },
  { id: 'kohtao_12', name: 'Hin Wong Pinnacle Koh Tao dive site underwater' },
  { id: 'kohtao_13', name: 'Laem Thien Koh Tao dive site underwater' },
  { id: 'kohtao_14', name: 'Lighthouse Koh Tao dive site underwater' },
  { id: 'kohtao_15', name: 'Junkyard Reef Koh Tao dive site underwater' },
  { id: 'kohtao_16', name: 'Biorock Koh Tao dive site underwater' },
  { id: 'kohtao_17', name: 'Buoyancy World Koh Tao dive site underwater' },
  { id: 'kohtao_18', name: 'Sairee Reef Koh Tao dive site underwater' },
  { id: 'kohtao_19', name: 'Red Rock Nang Yuan Cave dive site underwater' },
  { id: 'kohtao_20', name: 'Hin Pee Wee Koh Tao dive site underwater' },
  { id: 'kohtao_21', name: 'Pottery Pinnacle Koh Tao dive site underwater' },
  { id: 'kohtao_22', name: 'Three Rocks Koh Tao dive site underwater' },
  { id: 'kohtao_23', name: 'Mao Bay Koh Tao dive site underwater' },
  { id: 'kohtao_24', name: 'Tanote Bay Koh Tao dive site underwater' },
  { id: 'kohtao_25', name: 'King Kong Rock Koh Tao dive site underwater' },
  { id: 'kohtao_26', name: 'No Name Pinnacle Koh Tao dive site underwater' },
  { id: 'kohtao_27', name: 'Hin Nam Koh Tao dive site underwater' },
  { id: 'kohtao_28', name: 'Tao Tong Koh Tao dive site underwater' },
  { id: 'kohtao_29', name: 'Crystal Bay Koh Tao snorkeling underwater' }
];

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    if (url.startsWith('data:image')) {
      const base64Data = url.replace(/^data:image\/jpeg;base64,/, "").replace(/^data:image\/png;base64,/, "");
      fs.writeFile(filepath, base64Data, 'base64', (err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      https.get(url, (res) => {
        if (res.statusCode === 200) {
          res.pipe(fs.createWriteStream(filepath))
             .on('error', reject)
             .once('close', () => resolve());
        } else {
          res.resume();
          reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
        }
      }).on('error', reject);
    }
  });
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  const outputDir = path.join(__dirname, 'public', 'sites');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const site of SITES) {
    const filepath = path.join(outputDir, `${site.id}.jpg`);
    if (fs.existsSync(filepath)) {
      console.log(`[SKIP] ${site.id}.jpg already exists.`);
      continue;
    }

    try {
      console.log(`[SEARCH] ${site.name}...`);
      await page.goto(`https://images.search.yahoo.com/search/images?p=${encodeURIComponent(site.name)}`, { waitUntil: 'domcontentloaded' });
      
      const imgUrl = await page.evaluate(() => {
        // Find the first image result that is a valid thumbnail
        const images = document.querySelectorAll('img');
        for (let img of images) {
          // Yahoo uses data-src or src for loaded images. Ignore small icons.
          let src = img.getAttribute('data-src') || img.src;
          if (src && (src.includes('tse') || src.includes('yimg')) && !src.includes('clear.gif') && img.width > 50) {
            return src;
          }
        }
        return null;
      });

      if (imgUrl) {
        await downloadImage(imgUrl, filepath);
        console.log(`[DOWNLOADED] ${site.id}.jpg from ${imgUrl}`);
      } else {
        console.log(`[FAILED] No image found for ${site.name}`);
      }
      
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.error(`[ERROR] ${site.name}: ${e.message}`);
    }
  }

  await browser.close();
  console.log('Finished downloading 29 dive site images.');
})();
