import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const firebaseConfig = JSON.parse(configStr);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const siteRef = doc(db, 'dive_sites', "DOES_NOT_EXIST");
  try {
    await updateDoc(siteRef, { lat: 1 });
  } catch(e) {
    console.error("Caught error:", e.message);
  }
}
run();
