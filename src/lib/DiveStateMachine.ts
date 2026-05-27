import { DiveState, ActiveDive, UserPrivateInfo } from '../types';
import { db, auth } from './firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { DiveService } from './DiveServiceBridge';
import { NotificationService } from './NotificationService';

export type StateChangeListener = (newState: DiveState) => void;

/**
 * Manages the state of a dive, handling the countdown timer and 
 * escalation timeouts for the Dead Man's Switch.
 */
export class DiveStateMachine {
  private static instance: DiveStateMachine;
  private currentState: DiveState = DiveState.INACTIVE;
  private listeners: Set<StateChangeListener> = new Set();

  private currentDiveId: string | null = null;
  public expectedEndTimeMs: number | null = null;
  public phaseEndTimeMs: number | null = null;

  // Last known location for distress advertising
  private lastLat: number = 0;
  private lastLng: number = 0;

  // Timeouts for client-side escalations
  private w1ToW2Timeout: ReturnType<typeof setTimeout> | null = null;
  private w2ToAlarmTimeout: ReturnType<typeof setTimeout> | null = null;
  private diveTimer: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    this.recoverState();
  }

  public static getInstance(): DiveStateMachine {
    if (!DiveStateMachine.instance) {
      DiveStateMachine.instance = new DiveStateMachine();
    }
    return DiveStateMachine.instance;
  }

  public getState(): DiveState {
    return this.currentState;
  }

  public getDiveId(): string | null {
    return this.currentDiveId;
  }

  public addListener(listener: StateChangeListener) {
    this.listeners.add(listener);
  }

  public removeListener(listener: StateChangeListener) {
    this.listeners.delete(listener);
  }

  private setState(newState: DiveState) {
    if (this.currentState === newState) return;
    this.currentState = newState;
    this.listeners.forEach(listener => listener(newState));
    console.log(`[DiveStateMachine] Transitioned to ${newState}`);
  }

  private clearAllTimeouts() {
    if (this.w1ToW2Timeout) clearTimeout(this.w1ToW2Timeout);
    if (this.w2ToAlarmTimeout) clearTimeout(this.w2ToAlarmTimeout);
    if (this.diveTimer) clearInterval(this.diveTimer);
    this.w1ToW2Timeout = null;
    this.w2ToAlarmTimeout = null;
    this.diveTimer = null;
  }

  /**
   * Registers a new dive. Transitions from INACTIVE to DIVING.
   */
  public async registerDive(params: {
    durationMinutes: number;
    bufferMinutes: number;
    lat: number;
    lng: number;
    locationName?: string;
    privateInfo: UserPrivateInfo;
    buddyIds?: string[];
    deviceToken?: string;
  }) {
    if (this.currentState !== DiveState.INACTIVE) {
      throw new Error("Cannot start a new dive while state is " + this.currentState);
    }

    const user = auth.currentUser;
    if (!user) throw new Error("User must be authenticated to start a dive");

    // 1. Generate unique Dive ID
    const diveId = `dive_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.currentDiveId = diveId;

    const durationMs = params.durationMinutes * 60 * 1000;
    this.expectedEndTimeMs = Date.now() + durationMs;
    this.lastLat = params.lat;
    this.lastLng = params.lng;

    // 2. Sync to Firebase (Creates ActiveDive document)
    const activeDive: ActiveDive = {
      diveId,
      userId: user.uid,
      diverName: user.displayName || 'Unknown Diver',
      startTime: serverTimestamp(),
      plannedDurationMinutes: params.durationMinutes,
      expectedEndTime: serverTimestamp(), // Re-computed by backend Cloud Function
      bufferMinutes: params.bufferMinutes,
      lastKnownLat: params.lat,
      lastKnownLng: params.lng,
      lastKnownLocationName: params.locationName || null,
      emergencyContact1Name: params.privateInfo.emergencyContactName || 'Unknown',
      emergencyContact1Phone: params.privateInfo.emergencyContactPhone || '',
      emergencyContact2Name: params.privateInfo.emergencyContactName2 || null,
      emergencyContact2Phone: params.privateInfo.emergencyContactPhone2 || null,
      medicalNotes: params.privateInfo.medicalNotes || null,
      status: 'ACTIVE',
      deviceToken: params.deviceToken || 'token_not_provided',
      buddyIds: params.buddyIds || [],
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "activeDives", diveId), activeDive);
    } catch (e) {
      console.error("Failed to sync dive to Firebase", e);
      throw new Error("Failed to start dive due to network error");
    }

    // 3. Start Native Timer via Plugin
    try {
      await DiveService.startTimer({ durationMs, diveId });
    } catch (e) {
      console.warn("Native DiveService not available, falling back to JS timer.", e);
    }

    // 4. Start internal JS timer fallback (in case native fails or in dev)
    this.startClientTimerFallback(durationMs);

    // 5. Update State
    this.setState(DiveState.DIVING);
  }

  /**
   * Extends the current dive by adding minutes.
   */
  public async extendDive(additionalMinutes: number) {
    if (this.currentState === DiveState.INACTIVE) {
      throw new Error("No active dive to extend");
    }
    if (!this.currentDiveId) throw new Error("No dive ID");

    const additionalMs = additionalMinutes * 60 * 1000;
    this.expectedEndTimeMs = (this.expectedEndTimeMs || Date.now()) + additionalMs;

    // 1. Update Native Timer
    try {
      await DiveService.extendTimer({ additionalMs });
    } catch (e) {
      console.warn("Failed to extend native timer", e);
    }

    // 2. Update Firebase
    try {
      await updateDoc(doc(db, "activeDives", this.currentDiveId), {
        status: 'EXTENDED',
      });
    } catch (e) {
      console.error("Failed to update Firebase for extension", e);
    }

    // 3. Reset internal timeouts and state
    this.clearAllTimeouts();
    const remainingMs = this.expectedEndTimeMs - Date.now();
    this.startClientTimerFallback(remainingMs);

    // Stop BLE broadcasting if we were in Warning Level 2
    if (this.currentState === DiveState.WARNING_LEVEL_2 || this.currentState === DiveState.ALARM_TRIGGERED) {
      try {
        await DiveService.stopAdvertising();
      } catch (e) {
        console.warn("Failed to stop advertising", e);
      }
    }

    this.setState(DiveState.DIVING);
  }

  /**
   * Safely ends the current dive and cancels all alarms.
   */
  public async endDive() {
    if (this.currentState === DiveState.INACTIVE) return;
    const diveId = this.currentDiveId;

    this.clearAllTimeouts();
    this.expectedEndTimeMs = null;
    this.phaseEndTimeMs = null;
    this.currentDiveId = null;

    // 1. Update State to INACTIVE immediately for snappy UI and to prevent lockups
    this.setState(DiveState.INACTIVE);

    // 2. Stop Native Service & BLE asynchronously without blocking the thread
    Promise.all([
      DiveService.stopTimer().catch(e => console.warn("Failed to stop native timer", e)),
      DiveService.stopAdvertising().catch(e => console.warn("Failed to stop native advertising", e))
    ]);

    // 3. Update Firebase API
    if (diveId) {
      try {
        await updateDoc(doc(db, "activeDives", diveId), {
          status: 'ENDED',
          endedAt: serverTimestamp(),
        });
      } catch (e) {
        console.error("Failed to mark dive as ended in Firebase", e);
      }
    }
  }

  /**
   * Handles timer expiration, moving to WARNING_LEVEL_1.
   * Called by the native bridge event or internal fallback timer.
   */
  public onTimerExpired() {
    if (this.currentState !== DiveState.DIVING) return;

    this.clearAllTimeouts();
    this.setState(DiveState.WARNING_LEVEL_1);
    console.log("[DiveStateMachine] Sending Local Notification #1 (Standard Warning)");

    NotificationService.getInstance().pushNotification({
      title: 'Dive Timer Expired',
      body: 'Your planned dive duration has ended. Please extend or end your dive immediately.',
      type: 'safety'
    });

    // After 5 minutes in W1, escalate to W2
    const W1_TIMEOUT_MS = 5 * 60 * 1000;
    this.phaseEndTimeMs = Date.now() + W1_TIMEOUT_MS;
    this.w1ToW2Timeout = setTimeout(() => {
      this.onWarning1Expired();
    }, W1_TIMEOUT_MS);
  }

  /**
   * Moves to WARNING_LEVEL_2 (Critical Alert).
   */
  private async onWarning1Expired() {
    if (this.currentState !== DiveState.WARNING_LEVEL_1) return;

    this.setState(DiveState.WARNING_LEVEL_2);
    console.log("[DiveStateMachine] Sending Local Notification #2 (Critical Alert / Audio Override)");

    NotificationService.getInstance().pushNotification({
      title: 'CRITICAL: Final Local Warning',
      body: 'You are 5 minutes overdue. If you do not cancel this alert, distress broadcasting will activate.',
      type: 'safety'
    });

    // Request Critical Alert permission natively if needed
    try {
      await DiveService.requestCriticalAlertPermission();
    } catch (e) {
      console.warn("Critical alert permission request failed", e);
    }

    // After 5 minutes in W2, escalate to ALARM_TRIGGERED
    const W2_TIMEOUT_MS = 5 * 60 * 1000;
    this.phaseEndTimeMs = Date.now() + W2_TIMEOUT_MS;
    this.w2ToAlarmTimeout = setTimeout(() => {
      this.onWarning2Expired();
    }, W2_TIMEOUT_MS);
  }

  /**
   * Moves to ALARM_TRIGGERED (BLE distress broadcasting & Cloud limit).
   */
  private async onWarning2Expired() {
    if (this.currentState !== DiveState.WARNING_LEVEL_2) return;
    this.phaseEndTimeMs = null;
    this.setState(DiveState.ALARM_TRIGGERED);

    const user = auth.currentUser;
    // Start BLE distress advertising natively
    try {
      await DiveService.startDistressAdvertising({
        diverId: user?.uid || 'unknown',
        lat: this.lastLat,
        lng: this.lastLng,
        batteryLevel: 100 // Typically fetched natively
      });
      console.log("[DiveStateMachine] Distress Broadcasting ACTIVATED.");
      
      NotificationService.getInstance().pushNotification({
        title: 'DISTRESS SIGNAL ACTIVE',
        body: 'Local BLE mesh activated. Attempting to alert nearby divers and boats.',
        type: 'safety'
      });
    } catch (e) {
      console.warn("Failed to start BLE distress advertising", e);
    }

    // At this point, the server-side Cloud Task will independently escalate
    // and send SMS/Push notifications after the total 15 minute buffer elapses.
  }

  /**
   * Called when a buddy marks the diver as safe via BLE mesh.
   */
  public onBuddySafeReceived() {
    if (this.currentState === DiveState.WARNING_LEVEL_2 || this.currentState === DiveState.ALARM_TRIGGERED) {
      this.endDive();
    }
  }

  private startClientTimerFallback(durationMs: number) {
    if (this.diveTimer) clearInterval(this.diveTimer);

    const endTime = Date.now() + durationMs;
    this.diveTimer = setInterval(() => {
      if (Date.now() >= endTime) {
        this.onTimerExpired();
      }
    }, 1000);
  }

  private recoverState() {
    // In production, we'd read from localStorage to see if a dive was active
    // before the app was killed, and sync with the native service.
  }
}

// Setup global listeners for native events
DiveService.addListener('timerExpired', () => {
  DiveStateMachine.getInstance().onTimerExpired();
});

DiveService.addListener('safeReceived', () => {
  DiveStateMachine.getInstance().onBuddySafeReceived();
});
