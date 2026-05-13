import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DetectionMethod, NapSession, PhonePlacement } from '../models/Session';
import { sessionService } from './SessionService';
import { navigationRef } from '../navigation/navigationRef';

const PENDING_WAKE_INTENT_KEY = '@smart_nap_timer:pending_wake_intent';

type WakeAlarmIntent =
  | {
      kind: 'monitoring_timeout';
      targetMinutes: number;
      placement: PhonePlacement;
      placements: PhonePlacement[];
      maxFallAsleepMinutes: number;
      detectionMethod: DetectionMethod;
      confidenceScore: number;
    }
  | {
      kind: 'sleeping_timeout';
      sessionId?: string;
      targetMinutes: number;
      sleepStartTime: number;
      placement: PhonePlacement;
      placements: PhonePlacement[];
      latencySeconds: number;
      detectionMethod: DetectionMethod;
      confidenceScore: number;
    };

type WakeRouteParams = { sessionId: string; fallAsleepTimeout?: boolean };

class WakeFlowService {
  async queuePendingWakeIntent(intent: WakeAlarmIntent): Promise<void> {
    console.log(`🎯 WakeFlowService: Queuing wake intent (kind=${intent.kind})`);
    await AsyncStorage.setItem(PENDING_WAKE_INTENT_KEY, JSON.stringify(intent)).catch(() => {});
  }

  async clearPendingWakeIntent(): Promise<void> {
    console.log('🎯 WakeFlowService: Clearing pending wake intent');
    await AsyncStorage.removeItem(PENDING_WAKE_INTENT_KEY).catch(() => {});
  }

  async consumePendingWakeIntent(): Promise<boolean> {
    console.log('🎯 WakeFlowService: Attempting to consume pending wake intent');
    const raw = await AsyncStorage.getItem(PENDING_WAKE_INTENT_KEY).catch(() => null);
    if (!raw) {
      console.log('🎯 WakeFlowService: No pending wake intent found');
      return false;
    }

    if (!navigationRef.isReady()) {
      return false;
    }

    await this.clearPendingWakeIntent();

    try {
      const intent = JSON.parse(raw) as WakeAlarmIntent;
      console.log(`🎯 WakeFlowService: Parsed intent (kind=${intent.kind})`);
      const params = await this.resolveWakeRouteParams(intent);
      if (!params) {
        console.log('🎯 WakeFlowService: Failed to resolve route params');
        return false;
      }
      console.log(`🎯 WakeFlowService: Navigating to Wake screen (sessionId=${params.sessionId})`);
      navigationRef.navigate('Wake' as never, params as never);
      return true;
    } catch (error) {
      console.error('🎯 WakeFlowService: Failed to consume pending wake intent:', error);
      return false;
    }
  }

  private async resolveWakeRouteParams(intent: WakeAlarmIntent): Promise<WakeRouteParams | null> {
    const now = new Date();

    if (intent.kind === 'monitoring_timeout') {
      const sessionId = `session_${Date.now()}`;
      const session: NapSession = {
        session_id:           sessionId,
        date:                 now.toISOString(),
        hour:                 now.getHours(),
        day_of_week:          now.getDay(),
        time_of_day:          sessionService.getTimeOfDay(now.getHours()),
        target_minutes:       intent.targetMinutes,
        actual_sleep_minutes: 0,
        latency_minutes:      intent.maxFallAsleepMinutes,
        threshold_T_used:     intent.maxFallAsleepMinutes,
        detection_method:     intent.detectionMethod,
        placement:            intent.placement,
        placements:           intent.placements.length > 0 ? intent.placements : [intent.placement],
        wake_rating:          null,
        is_insufficient:      true,
        confidence_score:     intent.confidenceScore,
      };

      await sessionService.save(session).catch(() => {});
      return { sessionId, fallAsleepTimeout: true };
    }

    const sessionId = intent.sessionId ?? `session_${intent.sleepStartTime}`;
    const session: NapSession = {
      session_id:           sessionId,
      date:                 now.toISOString(),
      hour:                 now.getHours(),
      day_of_week:          now.getDay(),
      time_of_day:          sessionService.getTimeOfDay(now.getHours()),
      target_minutes:       intent.targetMinutes,
      actual_sleep_minutes: intent.targetMinutes,
      latency_minutes:      Math.round((intent.latencySeconds / 60) * 10) / 10,
      threshold_T_used:     intent.targetMinutes,
      detection_method:     intent.detectionMethod,
      placement:            intent.placement,
      placements:           intent.placements.length > 0 ? intent.placements : [intent.placement],
      wake_rating:          null,
      is_insufficient:      sessionService.isInsufficient(intent.targetMinutes, intent.targetMinutes),
      confidence_score:     intent.confidenceScore,
    };

    await sessionService.save(session).catch(() => {});
    return { sessionId };
  }
}

export const wakeFlowService = new WakeFlowService();
export type { WakeAlarmIntent };