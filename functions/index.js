const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.getParticipantPrivateInfo = functions.https.onRequest(async (req, res) => {
  // 1. MANUEL CORS HÅNDTERING (Dette garanterer, at browseren lukker os igennem)
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Hvis browseren sender et "må jeg godt?" (OPTIONS) preflight-kald, siger vi ja med det samme
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  // Accepter kun POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. Tjekker direkte i konvolutten efter dit 'Bearer' token
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. Missing or invalid Authorization header.' });
    }

    const token = authHeader.split('Bearer ')[1];
    let requestUid;
    
    try {
      // 3. Vi lader Firebase låse tokenet op og bekræfte din identitet
      const decodedToken = await admin.auth().verifyIdToken(token);
      requestUid = decodedToken.uid;
    } catch (err) {
      console.error("Token verification failed:", err);
      return res.status(401).json({ error: 'Access denied. Invalid session token.' });
    }

    const { targetUserId, eventId } = req.body;

    if (!targetUserId || !eventId) {
      return res.status(400).json({ error: 'Missing required parameters: targetUserId and eventId' });
    }

    // 4. Den korrekte database-logik fra før
    const eventDoc = await admin.firestore().collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return res.status(404).json({ error: 'The requested event could not be found.' });
    }

    const eventData = eventDoc.data();
    
    const host = eventData.hostId || eventData.host || '';
    const coHosts = eventData.coHosts || []; 
    const participants = eventData.participants || []; 

    const isHost = requestUid === host;
    const isCoHost = Array.isArray(coHosts) && coHosts.includes(requestUid);

    // Må man kigge? (Er man host, co-host, eller kigger man på sig selv?)
    if (!isHost && !isCoHost && requestUid !== targetUserId) {
      return res.status(403).json({ error: 'Permission denied. Only event hosts can view this data.' });
    }

    const isParticipant = Array.isArray(participants) && participants.includes(targetUserId);
    const isTargetHost = targetUserId === host;

    if (!isParticipant && !isTargetHost) {
      return res.status(403).json({ error: 'The user is not a participant in this event.' });
    }

    // 5. Hent dataen og send den tilbage
    const privateInfoDoc = await admin.firestore()
      .collection('users')
      .doc(targetUserId)
      .collection('private')
      .doc('info')
      .get();

    if (!privateInfoDoc.exists) {
      return res.status(200).json({});
    }

    return res.status(200).json(privateInfoDoc.data());

  } catch (error) {
    console.error('Error in getParticipantPrivateInfo:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
});