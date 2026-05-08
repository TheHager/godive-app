import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, serverTimestamp, setDoc, writeBatch, increment } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const firebaseConfig = JSON.parse(configStr);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function run() {
  await signInWithEmailAndPassword(auth, "test.user2@example.com", "password123");
  console.log("Logged in:", auth.currentUser.uid);
  
  const siteId = "site_vote_" + Date.now();
  const siteRef = doc(db, 'dive_sites', siteId);
  const voteRef = doc(db, 'dive_sites', siteId, 'votes', auth.currentUser.uid);
  
  console.log("Creating site...");
  await setDoc(siteRef, {
    name: "My Site",
    lat: 1.123, lng: 2.123,
    type: "site",
    status: 'unverified',
    upvotes: 0, downvotes: 0,
    userId: auth.currentUser.uid,
    timestamp: serverTimestamp()
  });
  console.log("Created site", siteId);
  
  console.log("Voting on site...");
  try {
    const batch = writeBatch(db);
    batch.set(voteRef, { vote: 'up', timestamp: serverTimestamp() });
    batch.update(siteRef, {
      upvotes: increment(1),
      status: 'unverified',
      timestamp: serverTimestamp()
    });
    await batch.commit();
    console.log("Vote successful!");
  } catch(e) {
    console.error("Vote failed:", e.message);
  }
  process.exit(0);
}
run().catch(console.error);
