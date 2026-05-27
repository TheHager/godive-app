import { registerPlugin } from '@capacitor/core';

export interface DistressPayload {
  diverId: string;
  lat: number;
  lng: number;
  batteryLevel: number;
}

export interface DiveServicePlugin {
  startTimer(options: { durationMs: number; diveId: string }): Promise<void>;
  stopTimer(): Promise<void>;
  extendTimer(options: { additionalMs: number }): Promise<void>;
  
  startDistressAdvertising(options: DistressPayload): Promise<void>;
  stopAdvertising(): Promise<void>;
  
  startBuddyScan(): Promise<void>;
  stopBuddyScan(): Promise<void>;
  broadcastSafe(options: { targetDiverId: string }): Promise<void>;
  
  requestCriticalAlertPermission(): Promise<{ granted: boolean }>;
  
  addListener(event: 'timerTick', fn: (data: { remaining: number }) => void): Promise<any>;
  addListener(event: 'timerExpired', fn: () => void): Promise<any>;
  addListener(event: 'distressDetected', fn: (data: DistressPayload) => void): Promise<any>;
  addListener(event: 'safeReceived', fn: (data: { diverId: string }) => void): Promise<any>;
}

export const DiveService = registerPlugin<DiveServicePlugin>('DiveService', {
  web: () => import('./DiveServiceWeb').then(m => new m.DiveServiceWeb()),
});
