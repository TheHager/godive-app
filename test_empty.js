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
  
  const siteId = "site_empty_" + Date.now();
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
      name: "",
      lat: 1.22,
      lng: 2.22,
      timestamp: serverTimestamp()
    });
    console.log("Empty name update successful!");
  } catch(e) {
    console.error("Empty name update failed:", e.message);
  }
  process.exit(0);
}
run().catch(console.error);
