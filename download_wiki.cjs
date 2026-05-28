const fs = require('fs');
const https = require('https');
const path = require('path');

const URLS = [
  "https://upload.wikimedia.org/wikipedia/commons/e/ea/Coral_Outcrop_Flynn_Reef.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/1/18/Coral_reef_at_Palmyra_Atoll_National_Wildlife_Refuge.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/e/e6/Coral_reef_in_the_Red_Sea.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Tubbataha_Reef_3.jpg/800px-Tubbataha_Reef_3.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Acanthurus_leucosternon.jpg/800px-Acanthurus_leucosternon.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/d/df/A_sea_turtle_at_a_coral_reef.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Flickr_-_Schmiebel_-_The_Green_Turtle_%281%29.jpg/800px-Flickr_-_Schmiebel_-_The_Green_Turtle_%281%29.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Coral_reef_in_Egypt.jpg/800px-Coral_reef_in_Egypt.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Maldives_coral_reef.jpg/800px-Maldives_coral_reef.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Coral_reef_fish.jpg/800px-Coral_reef_fish.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Coral_reef_at_Baker_Island_National_Wildlife_Refuge.jpg/800px-Coral_reef_at_Baker_Island_National_Wildlife_Refuge.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Sea_anemone_and_clownfish.jpg/800px-Sea_anemone_and_clownfish.jpg"
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Handle redirects manually if needed, but wikipedia usually doesn't for these
      if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, (res2) => {
          res2.pipe(fs.createWriteStream(dest)).on('finish', resolve).on('error', reject);
        });
      } else {
        res.pipe(fs.createWriteStream(dest)).on('finish', resolve).on('error', reject);
      }
    }).on('error', reject);
  });
}

(async () => {
  let startIndex = 18;
  for (let url of URLS) {
    const p = path.join(__dirname, 'public', 'sites', `kohtao_${startIndex}.png`);
    await download(url, p);
    console.log(`Downloaded ${url} to kohtao_${startIndex}.png`);
    startIndex++;
  }
})();
