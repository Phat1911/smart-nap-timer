export type DetectionMethod = 'accelerometer' | 'mic' | 'combo' | 'manual_tap';

export type WakeRating = 1 | 2 | 3 | 4 | 5;

export type TimeOfDay = 'night' | 'morning' | 'afternoon' | 'evening';

/** P.1 — Where the user places their phone during a nap session */
export type PhonePlacement = 'mattress' | 'hand' | 'chest' | 'pocket';

export interface NapSession {
  session_id: string;
  date: string;                      // ISO date string
  hour: number;                      // 0-23
  day_of_week: number;               // 0-6 (Sunday=0)
  time_of_day: TimeOfDay;
  target_minutes: number;
  actual_sleep_minutes: number;
  latency_minutes: number;           // time from Start to sleep detected
  threshold_T_used: number;          // stillness threshold used (minutes)
  detection_method: DetectionMethod;
  placement: PhonePlacement;         // P.1 — phone placement used this session
  wake_rating: WakeRating | null;
  is_insufficient: boolean;          // actual < target * 0.85
  confidence_score: number;          // 0-100 at time of detection
}

export interface SessionStats {
  total_sessions: number;
  avg_latency_minutes: number;
  avg_actual_sleep_minutes: number;
  avg_wake_rating: number;
  best_wake_rating: WakeRating;
  insufficient_streak: number;       // consecutive insufficient sessions
}

export interface AdaptiveThreshold {
  night: number;
  morning: number;
  afternoon: number;
  evening: number;
}

export interface AIModelWeights {
  intercept: number;
  coef_hour: number;
  coef_day_of_week: number;
  coef_prev_latency: number;
  coef_wake_rating: number;
  trained_on_sessions: number;
  last_trained: string;
}
