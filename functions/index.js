const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.getParticipantPrivateInfo = functions.https.onCall(async (data, context) => {
  // 1. Modtag både standard-data OG vores nye manuelle token
  const { targetUserId, eventId, token } = data;
  
  let requestUid = context.auth ? context.auth.uid : null;

  // 2. Den ultimative Plan B: Hvis browseren klippede auth-headeren væk (CORS), 
  // så dekoder vi bare det manuelle token, vi har sendt med i konvolutten!
  if (!requestUid && token) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      requestUid = decodedToken.uid;
    } catch (error) {
      console.error("Manual token verification failed:", error);
    }
  }

  // Hvis vi STADIG ikke har noget ID, så afviser vi
  if (!requestUid) {
    throw new functions.https.HttpsError(
      'unauthenticated', 
      'The function must be called while authenticated.'
    );
  }

  if (!targetUserId || !eventId) {
    throw new functions.https.HttpsError(
      'invalid-argument', 
      'The function must be called with two arguments: targetUserId and eventId.'
    );
  }

  try {
    const eventDoc = await admin.firestore().collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'The requested event could not be found.');
    }

    const eventData = eventDoc.data();
    
    // 3. FIX: Nu leder vi efter 'hostId' (som din frontend bruger) i stedet for 'host'
    const host = eventData.hostId || eventData.host || '';
    const coHosts = eventData.coHosts || []; 
    const participants = eventData.participants || []; 

    const isHost = requestUid === host;
    const isCoHost = Array.isArray(coHosts) && coHosts.includes(requestUid);

    // (Tillad også at man kigger på sin egen profil)
    if (!isHost && !isCoHost && requestUid !== targetUserId) {
      throw new functions.https.HttpsError(
        'permission-denied', 
        'Permission denied. Only the event host or co-hosts can view private participant details.'
      );
    }

    const isParticipant = Array.isArray(participants) && participants.includes(targetUserId);
    const isTargetHost = targetUserId === host;

    if (!isParticipant && !isTargetHost) {
      throw new functions.https.HttpsError(
        'permission-denied', 
        'The requested user is not a participant in this event.'
      );
    }

    const privateInfoDoc = await admin.firestore()
      .collection('users')
      .doc(targetUserId)
      .collection('private')
      .doc('info')
      .get();

    if (!privateInfoDoc.exists) {
      return {};
    }

    return privateInfoDoc.data();

  } catch (error) {
    console.error('Error in getParticipantPrivateInfo:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal', 
      error.message || 'An internal server error occurred while fetching data.'
    );
  }
});