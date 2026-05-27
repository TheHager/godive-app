const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { GoogleGenAI } = require('@google/genai');
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

// Helper for CORS preflight
function handleCors(req, res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}

exports.moderateImage = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let bodyData = req.body;
    if (typeof req.body === 'string') {
      try { bodyData = JSON.parse(req.body); } catch(e) {}
    }

    const imageBase64 = bodyData.imageBase64;
    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64" });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.MODERATION_GEMINI_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.error("Moderation API Error: Gemini API key is missing from environment variables.");
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }

    let ai;
    try {
      ai = new GoogleGenAI({ apiKey });
    } catch (initErr) {
      console.error("GoogleGenAI initialization error:", initErr);
      return res.status(500).json({ error: "Failed to initialize AI client: " + initErr.message });
    }
    
    // Strip data url prefix if needed
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: "Analyze this image. Does it contain any NSFW, explicit, sexual, or otherwise highly offensive or inappropriate content? Reply with exactly 'SAFE' or 'VIOLATION'." },
              { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
            ]
          }
        ]
      });
    } catch (genErr) {
      console.error("Gemini generation error:", genErr);
      let errorMsg = genErr.message || "Failed to evaluate image";
      if (errorMsg.includes("API_KEY_INVALID") || errorMsg.includes("API key not valid")) {
         errorMsg = "The Gemini API key is invalid. Please check your environment variables.";
      }
      return res.status(500).json({ error: "Gemini API call failed: " + errorMsg });
    }

    if (!response || typeof response.text !== 'string') {
      return res.status(500).json({ error: "Gemini API returned an empty response." });
    }

    const resultText = response.text.trim().toUpperCase();
    if (resultText === "VIOLATION" || resultText.includes("VIOLATION")) {
      return res.status(200).json({ safe: false });
    } else {
      return res.status(200).json({ safe: true });
    }
  } catch (error) {
    console.error("Gemini Error:", error);
    return res.status(500).json({ error: error.message || "Failed to evaluate image" });
  }
});

exports.identifySpecies = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let bodyData = req.body;
    if (typeof req.body === 'string') {
      try { bodyData = JSON.parse(req.body); } catch(e) {}
    }

    const image = bodyData.image;
    const maxResults = bodyData.maxResults || 3;
    const confidenceThreshold = bodyData.confidenceThreshold || 0.5;

    if (!image) {
      return res.status(400).json({ error: "Missing image data" });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.MODERATION_GEMINI_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.error("Vision API Error: Gemini API key is missing from environment variables.");
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }

    let ai;
    try {
      ai = new GoogleGenAI({ apiKey });
    } catch (initErr) {
      console.error("GoogleGenAI initialization error:", initErr);
      return res.status(500).json({ error: "Failed to initialize AI client: " + initErr.message });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are a marine biologist AI. Analyze this underwater/marine photograph and identify any marine species visible.

Rules:
- Only identify species you can see clear visual evidence for (fin shape, body pattern, coloring, anatomy).
- Do NOT guess or hallucinate. If unsure, return fewer results or an empty array.
- Return at most ${maxResults} species.
- Only include species where your confidence is above ${confidenceThreshold} (0 to 1 scale).
- Use common English names (e.g. "Blue Tang", "Manta Ray", "Green Sea Turtle").

Respond with ONLY valid JSON in this exact format, no markdown, no explanation:
{"matches":[{"name":"Species Name","confidence":0.85}]}`
              },
              { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
            ]
          }
        ]
      });
    } catch (genErr) {
      console.error("Gemini generation error:", genErr);
      let errorMsg = genErr.message || "Failed to identify species";
      if (errorMsg.includes("API_KEY_INVALID") || errorMsg.includes("API key not valid")) {
         errorMsg = "The Gemini API key is invalid. Please check your environment variables.";
      }
      return res.status(500).json({ error: "Gemini API call failed: " + errorMsg });
    }

    if (!response || typeof response.text !== 'string') {
      console.error("Gemini returned an invalid or empty response object.");
      return res.status(500).json({ error: "Gemini API returned an empty response." });
    }

    const rawText = response.text.trim();
    if (!rawText) {
      console.error("Gemini returned empty text content.");
      return res.status(500).json({ error: "Gemini API returned empty text." });
    }

    const jsonStr = rawText.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    try {
      const parsed = JSON.parse(jsonStr);
      const matches = Array.isArray(parsed.matches) ? parsed.matches : [];
      return res.status(200).json({ matches });
    } catch (parseErr) {
      console.error("Failed to parse Gemini species response:", rawText, parseErr);
      return res.status(500).json({ error: "Failed to parse AI response into JSON", details: rawText });
    }
  } catch (error) {
    console.error("Unhandled error in identifySpecies:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});