const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'project-7c683cb5-9592-4a84-97d'
  });
}

const deadManSwitch = require('./deadManSwitch');
exports.onActiveDiveCreated = deadManSwitch.onActiveDiveCreated;
exports.onActiveDiveUpdated = deadManSwitch.onActiveDiveUpdated;
exports.processDiveTimeout = deadManSwitch.processDiveTimeout;

exports.getParticipantPrivateInfo = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      return res.status(401).json({ error: 'Missing token.' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const requestUid = decodedToken.uid;

    let bodyData = req.body;
    if (typeof req.body === 'string') {
      try { bodyData = JSON.parse(req.body); } catch(e) {}
    }

    const targetUserId = String(bodyData.targetUserId || '').trim();
    const eventId = String(bodyData.eventId || '').trim();
    
    // Her fanger vi databasenavnet fra appen!
    const databaseId = String(bodyData.databaseId || '(default)').trim();

    if (!targetUserId || !eventId) {
      return res.status(400).json({ error: 'Missing parameters.' });
    }

    // LÅSER OP FOR DEN RIGTIGE DATABASE!
    const db = getFirestore(databaseId);

    let eventDoc;
    try {
      eventDoc = await db.collection('events').doc(eventId).get();
    } catch (e) {
      return res.status(500).json({ 
        error: `[DB ERROR 1] Could not reach events DB '${databaseId}'. EventID: '${eventId}'. Error: ${e.message}` 
      });
    }

    if (!eventDoc.exists) {
      return res.status(404).json({ error: `Event with ID '${eventId}' not found in database '${databaseId}'.` });
    }
    
    const eventData = eventDoc.data();
    const hostId = eventData.hostId || eventData.host || '';
    const coHosts = eventData.coHosts || [];
    const participants = eventData.participants || [];

    const isHost = requestUid === hostId;
    const isCoHost = coHosts.includes(requestUid);
    const isTargetHost = targetUserId === hostId;
    const isTargetParticipant = participants.includes(targetUserId);

    if (!isHost && !isCoHost && requestUid !== targetUserId) {
      return res.status(403).json({ error: 'Permission denied. Only hosts can view this data.' });
    }

    if (!isTargetParticipant && !isTargetHost && requestUid !== targetUserId) {
      return res.status(403).json({ error: 'Target user is not in this event.' });
    }

    let infoSnap;
    try {
      infoSnap = await db.collection('users').doc(targetUserId).collection('private').doc('info').get();
    } catch (e) {
      return res.status(500).json({ error: `[DB ERROR 2] Could not reach private DB '${databaseId}': ${e.message}` });
    }
    
    if (!infoSnap.exists) {
      return res.status(200).json({});
    }

    return res.status(200).json(infoSnap.data());

  } catch (error) {
    console.error("Backend Error:", error);
    return res.status(500).json({ error: `[CRITICAL] Backend Error: ${error.message}` });
  }
});