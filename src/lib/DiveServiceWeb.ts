import { WebPlugin } from '@capacitor/core';
import type { DiveServicePlugin, DistressPayload } from './DiveServiceBridge';

export class DiveServiceWeb extends WebPlugin implements DiveServicePlugin {
  private timerInterval: any = null;
  private remainingMs: number = 0;

  async startTimer(options: { durationMs: number; diveId: string }): Promise<void> {
    console.log(`[Web Mock] startTimer called for ${options.diveId} with ${options.durationMs}ms`);
    this.remainingMs = options.durationMs;
    
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.timerInterval = setInterval(() => {
      this.remainingMs -= 1000;
      if (this.remainingMs <= 0) {
        clearInterval(this.timerInterval);
        this.remainingMs = 0;
        this.notifyListeners('timerExpired', {});
      } else {
        this.notifyListeners('timerTick', { remaining: this.remainingMs });
      }
    }, 1000);
  }

  async stopTimer(): Promise<void> {
    console.log('[Web Mock] stopTimer called');
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  async extendTimer(options: { additionalMs: number }): Promise<void> {
    console.log(`[Web Mock] extendTimer called with ${options.additionalMs}ms`);
    this.remainingMs += options.additionalMs;
  }

  async startDistressAdvertising(options: DistressPayload): Promise<void> {
    console.log(`[Web Mock] startDistressAdvertising called for ${options.diverId}`);
  }

  async stopAdvertising(): Promise<void> {
    console.log('[Web Mock] stopAdvertising called');
  }

  async startBuddyScan(): Promise<void> {
    console.log('[Web Mock] startBuddyScan called');
  }

  async stopBuddyScan(): Promise<void> {
    console.log('[Web Mock] stopBuddyScan called');
  }

  async broadcastSafe(options: { targetDiverId: string }): Promise<void> {
    console.log(`[Web Mock] broadcastSafe called for ${options.targetDiverId}`);
  }

  async requestCriticalAlertPermission(): Promise<{ granted: boolean }> {
    console.log('[Web Mock] requestCriticalAlertPermission called (auto-granting for web)');
    return { granted: true };
  }
}
