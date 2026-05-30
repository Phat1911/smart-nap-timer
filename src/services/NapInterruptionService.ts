/**
 * NapInterruptionService — Owns interruption suppression for the nap lifecycle
 *
 * Responsible for:
 * - Blocking foreground notifications while a nap is active
 * - Enabling Android DND while a nap is active
 * - Restoring normal notification behavior when the nap truly ends
 * - Being idempotent so multiple callers do not fight each other
 *
 * Used by:
 * - MonitoringScreen: start() when monitoring begins
 * - WakeScreen: stop() when the nap ends
 * - MonitoringScreen: stop() when the user cancels before sleep
 */

import { notificationBlocker } from './NotificationBlocker';
import DndService from './DndService';

class NapInterruptionService {
  private isActive = false;
  private lastStartPromise: Promise<void> | null = null;

  async start(): Promise<void> {
    if (this.isActive && this.lastStartPromise) {
      console.log('NapInterruptionService: start() called but already active');
      return this.lastStartPromise;
    }

    this.isActive = true;
    console.log('NapInterruptionService: start() initiating suppression');
    this.lastStartPromise = (async () => {
      await notificationBlocker.block();
      await DndService.enable();
    })().catch((error) => {
      // Keep the nap flow alive even if one suppression layer fails.
      console.warn('NapInterruptionService: failed to start suppression', error);
    });

    return this.lastStartPromise;
  }

  async stop(): Promise<void> {
    if (!this.isActive && !this.lastStartPromise) {
      console.log('NapInterruptionService: stop() called but not active');
      return;
    }

    console.log('NapInterruptionService: stop() initiated — awaiting any in-flight start');
    // Mark inactive so future starts will create a new promise.
    this.isActive = false;
    // Capture and clear any in-flight start promise so we can await it.
    const pendingStart = this.lastStartPromise;
    this.lastStartPromise = null;

    const stopPromise = (async () => {
      // If a start was in-flight, wait for it to finish so we don't lose ordering
      if (pendingStart) {
        try { await pendingStart; } catch { /* ignore */ }
      }
      await notificationBlocker.unblock();
      await DndService.disable();
    })().catch((error) => {
      console.warn('NapInterruptionService: failed to restore notifications', error);
    });

    return stopPromise;
  }
}

export const napInterruptionService = new NapInterruptionService();
