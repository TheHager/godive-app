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
  console.log("Logged in:", auth.currentUser.uid);
  
  const siteId = "xyz_test_actual_" + Date.now();
  const siteRef = doc(db, 'dive_sites', siteId);
  
  console.log("Creating site...");
  await setDoc(siteRef, {
    name: "Original Name",
    lat: 1.123, lng: 2.123,
    type: "site",
    status: 'unverified',
    upvotes: 1, downvotes: 0,
    userId: auth.currentUser.uid,
    timestamp: serverTimestamp()
  });
  console.log("Created site", siteId);
  
  console.log("Updating site...");
  try {
    await updateDoc(siteRef, {
      name: "",
      lat: Number("1.123"),
      lng: Number("2.123"),
      timestamp: serverTimestamp()
    });
    console.log("Update successful!");
  } catch(e) {
    console.error("Update failed:", e.message);
  }
  process.exit(0);
}
run().catch(console.error);
