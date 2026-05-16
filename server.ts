import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import path from "path";

import admin from 'firebase-admin';

// Initialize Firebase Admin
// We use application default credentials or explicitly provide project ID
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: 'project-7c683cb5-9592-4a84-97d'
    });
  }
} catch (error) {
  console.error("Firebase Admin Initialization Error:", error);
}


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" })); // allow image base64 payloads

  // API routes
  // Secure endpoint to fetch private user info
  app.post("/api/get-private-info", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (e) {
        return res.status(401).json({ error: "Invalid token" });
      }

      const uid = decodedToken.uid;
      const { targetUserId, eventId } = req.body;

      if (!targetUserId || !eventId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check if user is accessing their own info
      if (uid === targetUserId) {
         const privateInfoDoc = await admin.firestore().doc(`users/${targetUserId}/private/info`).get();
         return res.json(privateInfoDoc.data() || {});
      }

      // Fetch the event document
      const eventDoc = await admin.firestore().doc(`events/${eventId}`).get();
      if (!eventDoc.exists) {
        return res.status(404).json({ error: "Event not found" });
      }

      const eventData = eventDoc.data();
      if (!eventData) {
        return res.status(404).json({ error: "Event data is empty" });
      }
      const isHost = eventData.hostId === uid || (eventData.coHosts && eventData.coHosts.includes(uid));

      if (!isHost) {
        return res.status(403).json({ error: "Forbidden: Not a host or co-host" });
      }

      // Verify targetUserId is a participant
      const isParticipant = eventData.participants && eventData.participants.includes(targetUserId);
      if (!isParticipant) {
        return res.status(403).json({ error: "Forbidden: Target user is not a participant in this event" });
      }

      // Fetch target user's private info
      const privateInfoDoc = await admin.firestore().doc(`users/${targetUserId}/private/info`).get();

      return res.json(privateInfoDoc.data() || {});

    } catch (error: any) {
      console.error("Error in /api/get-private-info:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.post("/api/moderate-image", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64" });
      }

      // Initialize Gemini
      const apiKey = process.env.MODERATION_GEMINI_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is missing." });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Strip data url prefix if needed
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const response = await ai.models.generateContent({
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

      const resultText = response.text?.trim().toUpperCase() || "";
      if (resultText === "VIOLATION" || resultText.includes("VIOLATION")) {
        return res.json({ safe: false });
      } else {
        return res.json({ safe: true });
      }
    } catch (error: any) {
      console.error("Gemini Error:", error);
      let errorMessage = error.message || "Failed to evaluate image";
      if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("API key not valid")) {
        errorMessage = "The Gemini API key is invalid. Please go to the Settings menu (gear icon in the top right), and enter a valid key for MODERATION_GEMINI_KEY. You can get a free key from aistudio.google.com/app/apikey.";
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
