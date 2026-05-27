import "dotenv/config";
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
      const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.MODERATION_GEMINI_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("Moderation API Error: Gemini API key is missing from environment variables.");
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

  // Vision API: Identify marine species from an uploaded image
  app.post("/api/vision/identify-species", async (req, res) => {
    try {
      const { image, maxResults = 3, confidenceThreshold = 0.5 } = req.body;
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
      } catch (initErr: any) {
        console.error("GoogleGenAI initialization error:", initErr);
        return res.status(500).json({ error: "Failed to initialize AI client: " + initErr.message });
      }

      // Strip data url prefix if present
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
      } catch (genErr: any) {
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

      // Parse the JSON response, stripping any markdown fencing
      const jsonStr = rawText.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
      try {
        const parsed = JSON.parse(jsonStr);
        const matches = Array.isArray(parsed.matches) ? parsed.matches : [];
        return res.status(200).json({ matches });
      } catch (parseErr: any) {
        console.error("Failed to parse Gemini species response:", rawText, parseErr);
        return res.status(500).json({ error: "Failed to parse AI response into JSON", details: rawText });
      }
    } catch (error: any) {
      console.error("Unhandled error in /api/vision/identify-species:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
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
