const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize the Admin SDK if it hasn't been initialized already
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * HTTPS Callable Function to securely fetch a participant's private info.
 * Accessible ONLY by the event host or designated co-hosts.
 */
exports.getParticipantPrivateInfo = functions.https.onCall(async (data, context) => {
  // 1. Authentication Check: Is the user logged into the app?
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated', 
      'The function must be called while authenticated.'
    );
  }

  const { targetUserId, eventId } = data;
  const requestUid = context.auth.uid;

  // 2. Input Validation: Do we have the required parameters?
  if (!targetUserId || !eventId) {
    throw new functions.https.HttpsError(
      'invalid-argument', 
      'The function must be called with two arguments: targetUserId and eventId.'
    );
  }

  try {
    // 3. Fetch the specific event document from Firestore
    const eventDoc = await admin.firestore().collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found', 
        'The requested event could not be found.'
      );
    }

    const eventData = eventDoc.data();
    
    // Fallback fields if they don't exist in the document yet
    const host = eventData.host || '';
    const coHosts = eventData.coHosts || []; 
    const participants = eventData.participants || []; 

    // 4. Authorization Check: Is the current user the Host or a Co-host?
    const isHost = requestUid === host;
    const isCoHost = Array.isArray(coHosts) && coHosts.includes(requestUid);

    if (!isHost && !isCoHost) {
      throw new functions.https.HttpsError(
        'permission-denied', 
        'Permission denied. Only the event host or co-hosts can view private participant details.'
      );
    }

    // 5. Verification: Is the target user actually connected to this event?
    const isParticipant = Array.isArray(participants) && participants.includes(targetUserId);
    const isTargetHost = targetUserId === host;

    if (!isParticipant && !isTargetHost) {
      throw new functions.https.HttpsError(
        'permission-denied', 
        'The requested user is not a participant in this event.'
      );
    }

    // 6. Success! Fetch the private subcollection document
    const privateInfoDoc = await admin.firestore()
      .collection('users')
      .doc(targetUserId)
      .collection('private')
      .doc('info')
      .get();

    // If the document doesn't exist yet, return an empty object instead of crashing
    if (!privateInfoDoc.exists) {
      return {};
    }

    // Return the clean data back to the frontend app
    return privateInfoDoc.data();

  } catch (error) {
    console.error('Error in getParticipantPrivateInfo:', error);
    
    // Re-throw if it's already a clean Firebase Error, otherwise wrap it
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal', 
      error.message || 'An internal server error occurred while fetching data.'
    );
  }
});