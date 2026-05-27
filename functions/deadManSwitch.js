const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onTaskDispatched } = require("firebase-functions/v2/tasks");
const { getFirestore } = require("firebase-admin/firestore");
const { CloudTasksClient } = require("@google-cloud/tasks");

// Twilio Mock Setup
const MOCK_MODE = true; 
const region = "europe-west3";
const project = process.env.GCLOUD_PROJECT || "project-7c683cb5-9592-4a84-97d";
const queue = "dive-timeout-queue"; 

const tasksClient = new CloudTasksClient();

exports.onActiveDiveCreated = onDocumentCreated(
    { document: "activeDives/{diveId}", region },
    async (event) => {
        const snap = event.data;
        if (!snap) return;
        const data = snap.data();
        const diveId = event.params.diveId;

        if (data.status !== 'ACTIVE') return;

        const expectedEndTime = data.expectedEndTime?.toDate();
        if (!expectedEndTime) {
            console.error("No expectedEndTime set on dive", diveId);
            return;
        }

        // Add the buffer time to calculate actual escalation time
        const bufferMinutes = data.bufferMinutes || 15;
        const escalationTime = new Date(expectedEndTime.getTime() + (bufferMinutes * 60 * 1000));

        // Create Cloud Task
        const location = region;
        const queuePath = tasksClient.queuePath(project, location, queue);
        
        // In Firebase v2, onTaskDispatched functions have a predictable URL
        const url = `https://${region}-${project}.cloudfunctions.net/processDiveTimeout`;
        const payload = { diveId };

        const task = {
            httpRequest: {
                httpMethod: 'POST',
                url,
                body: Buffer.from(JSON.stringify(payload)).toString('base64'),
                headers: {
                    'Content-Type': 'application/json',
                },
            },
            scheduleTime: {
                seconds: Math.floor(escalationTime.getTime() / 1000)
            }
        };

        try {
            const [response] = await tasksClient.createTask({ parent: queuePath, task });
            const taskId = response.name;
            await snap.ref.update({ taskId });
            console.log(`Created Task ${taskId} for dive ${diveId} to trigger at ${escalationTime}`);
        } catch (error) {
            console.error(`Failed to create task for dive ${diveId}:`, error);
        }
    }
);

exports.onActiveDiveUpdated = onDocumentUpdated(
    { document: "activeDives/{diveId}", region },
    async (event) => {
        const before = event.data.before.data();
        const after = event.data.after.data();
        
        // If dive ended, we must cancel the old task
        if (before.status !== 'ENDED' && after.status === 'ENDED') {
            if (after.taskId) {
                try {
                    await tasksClient.deleteTask({ name: after.taskId });
                    console.log(`Cancelled task ${after.taskId} for dive ${event.params.diveId} because it ended safely.`);
                } catch (e) {
                    console.log(`Task already executed or deleted: ${e.message}`);
                }
            }
        }
    }
);

exports.processDiveTimeout = onTaskDispatched(
    {
        retryConfig: { maxAttempts: 3 },
        region
    },
    async (req) => {
        const payload = req.data;
        const diveId = payload.diveId;
        const db = getFirestore();
        
        const diveRef = db.collection("activeDives").doc(diveId);
        const diveSnap = await diveRef.get();
        
        if (!diveSnap.exists) return;
        const dive = diveSnap.data();

        // Safety check: Don't escalate if diver marked themselves safe!
        if (dive.status === 'ENDED' || dive.status === 'ESCALATED') {
            console.log(`Dive ${diveId} is already ${dive.status}. Aborting escalation.`);
            return;
        }

        console.log(`ESCALATING DIVE ${diveId} - Contacting Emergency Contacts!`);

        let smsSuccess = false;
        const contacts = [
            { name: dive.emergencyContact1Name, phone: dive.emergencyContact1Phone },
            { name: dive.emergencyContact2Name, phone: dive.emergencyContact2Phone }
        ].filter(c => c.name && c.phone);

        const message = `EMERGENCY (GoDive): Diver ${dive.diverName} is OVERDUE for their dive at ${dive.lastKnownLocationName || 'an unknown location'}. Last known GPS coords: ${dive.lastKnownLat}, ${dive.lastKnownLng}. Medical notes: ${dive.medicalNotes || 'None'}. Please attempt to contact them or alert local authorities immediately.`;

        for (const contact of contacts) {
            if (MOCK_MODE) {
                console.log(`[MOCK SMS] To: ${contact.phone}`);
                console.log(`[MOCK SMS] Body: ${message}`);
                smsSuccess = true;
            } else {
                // Real Twilio logic here
            }
        }

        // Update DB to mark as escalated
        await diveRef.update({
            status: 'ESCALATED',
            escalatedAt: new Date(),
            escalationResults: {
                smsSent: smsSuccess
            }
        });
    }
);
