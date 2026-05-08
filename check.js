import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const firebaseConfig = JSON.parse(configStr);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkKine() {
  const KINE_UIDS = ['iYQ4ZEuUUTZhXEBZ9GAsrQszbHC2', 'kAZrE6F4iVaL22icmNLOklI1Wow1'];
  for (const uid of KINE_UIDS) {
     const posts = await getDocs(query(collection(db, "posts"), where("userId", "==", uid)));
     console.log(`Posts for ${uid}: ${posts.docs.length}`);
  }
  process.exit(0);
}
checkKine().catch(console.error);
