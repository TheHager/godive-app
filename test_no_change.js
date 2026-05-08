import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const firebaseConfig = JSON.parse(configStr);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function run() {
  await signInWithEmailAndPassword(auth, "test.user2@example.com", "password123");
  
  const siteId = "site_nochange_" + Date.now();
  const siteRef = doc(db, 'dive_sites', siteId);
  
  await setDoc(siteRef, {
    name: "My Site",
    lat: 1.123, lng: 2.123,
    type: "site",
    status: 'unverified',
    upvotes: 0, downvotes: 0,
    userId: auth.currentUser.uid,
    timestamp: serverTimestamp()
  });
  
  try {
    await updateDoc(siteRef, {
      name: "My Site", // exact same
      lat: 1.123, // exact same
      lng: 2.123, // exact same
      timestamp: serverTimestamp()
    });
    console.log("No-change update successful!");
  } catch(e) {
    console.error("No-change update failed:", e.message);
  }
  process.exit(0);
}
run().catch(console.error);
