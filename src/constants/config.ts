import type { PhonePlacement } from '../models/Session';

// Detection thresholds
export const DETECTION = {
  SAMPLE_INTERVAL_MS: 500,
  DEFAULT_THRESHOLD_MINUTES: 5,
  MIN_THRESHOLD_MINUTES: 3,
  MAX_THRESHOLD_MINUTES: 10,
  ROLLING_WINDOW_MINUTES: 5,
  STILLNESS_PERCENTAGE: 0.95,      // 95% of samples must be still
  RESET_MOVEMENT_SECONDS: 30,      // sustained movement for this long resets detection
  SLEEP_SCORE_TRIGGER: 80,         // score >= 80 = asleep
  SUSTAINED_HIGH_COUNT: 3,         // consecutive high-score checks before firing
  STILL_ACCEL_VARIANCE: 0.015,     // default accelVariance below this = still

  // Default confidence score weights (overridden per placement profile)
  WEIGHT_ACCELEROMETER: 40,
  WEIGHT_GYROSCOPE: 20,
  WEIGHT_MIC: 30,
  WEIGHT_DURATION: 10,
};

// Adaptive threshold formula weights
export const ADAPTIVE = {
  PREV_AVG_WEIGHT: 0.7,
  LAST_SESSION_WEIGHT: 0.3,
  AI_ACTIVATION_SESSION: 5,        // AI kicks in after 5 sessions
};

// Insufficient sleep detection
export const INSUFFICIENT = {
  THRESHOLD_RATIO: 0.85,           // actual < target * 0.85 = insufficient
  STREAK_WARNING: 3,               // warn after 3 consecutive insufficient sessions
};

// Duration suggestions (sleep science defaults)
export const DURATION_SUGGESTIONS = [
  { label: '20 min', value: 20, description: 'Power Nap' },
  { label: '60 min', value: 60, description: 'Deep Rest' },
  { label: '90 min', value: 90, description: 'Full Cycle' },
];

// Time of day buckets (hour ranges, end is exclusive, covers full 24h)
export const TIME_OF_DAY = {
  night:     { start: 0,  end: 5  },  // 00:00 - 04:59
  morning:   { start: 5,  end: 12 },  // 05:00 - 11:59
  afternoon: { start: 12, end: 17 },  // 12:00 - 16:59
  evening:   { start: 17, end: 24 },  // 17:00 - 23:59
};

// Snooze duration
export const SNOOZE_MINUTES = 10;

// Alarm ramp duration
export const ALARM_RAMP_SECONDS = 30;

// Bundled alarm sounds
export const ALARM_SOUNDS = [
  { id: 'alarm',         label: 'Classic', file: require('../../assets/sounds/alarm.wav') },
  { id: 'alarm_bell',    label: 'Bell',    file: require('../../assets/sounds/alarm_bell.wav') },
  { id: 'alarm_gentle',  label: 'Gentle',  file: require('../../assets/sounds/alarm_gentle.wav') },
  { id: 'alarm_digital', label: 'Digital', file: require('../../assets/sounds/alarm_digital.wav') },
] as const;

export type AlarmSoundId = typeof ALARM_SOUNDS[number]['id'];
export const DEFAULT_ALARM_SOUND: AlarmSoundId = 'alarm';

// ── P.2  Placement profiles ───────────────────────────────────────────────────

export interface PlacementProfile {
  /** Display label shown in the picker */
  label: string;
  /** Short description shown below label */
  description: string;
  /** MaterialCommunityIcons icon name */
  icon: string;
  /**
   * Variance threshold for "still" classification.
   * Lower = more sensitive (better for placements that dampen movement).
   * Higher = more lenient (better for placements that amplify movement).
   */
  stillVarianceThreshold: number;
  /** Per-placement confidence score weights (must sum to 100) */
  weights: {
    accel: number;
    gyro: number;
    mic: number;
    duration: number;
  };
  /** Minimum accelScore for the sensor to "agree" (false positive guard) */
  accelAgreeMin: number;
  /** Minimum micScore for the sensor to "agree" (false positive guard) */
  micAgreeMin: number;
  /** One-line placement tip shown on onboarding and HomeScreen */
  tip: string;
  /** Accuracy rating shown in the picker (1-4 stars) */
  accuracyStars: number;
}

export const PLACEMENT_PROFILES: Record<PhonePlacement, PlacementProfile> = {
  mattress: {
    label: 'Mattress',
    description: 'Face-down beside your hip',
    icon: 'bed-queen-outline',
    // Mattress absorbs movement -- use lower variance threshold for better sensitivity
    stillVarianceThreshold: 0.008,
    // Accel is primary signal; mic is weak (phone far from mouth)
    weights: { accel: 50, gyro: 15, mic: 20, duration: 15 },
    accelAgreeMin: 55,
    micAgreeMin: 25,
    tip: 'Place face-down on the mattress beside your hip. Do not hold it.',
    accuracyStars: 3,
  },
  hand: {
    label: 'Hand',
    description: 'Held loosely in your hand',
    icon: 'hand-back-right-outline',
    // Grip relaxation = sharp stillness onset -- good accel signal
    stillVarianceThreshold: 0.020,
    weights: { accel: 55, gyro: 25, mic: 10, duration: 10 },
    accelAgreeMin: 60,
    micAgreeMin: 20,
    tip: 'Hold loosely. The app detects when your grip relaxes at sleep onset.',
    accuracyStars: 4,
  },
  chest: {
    label: 'Chest',
    description: 'Resting on your chest',
    icon: 'human',
    // Chest moves with breathing -- be lenient on accel, rely on mic rhythm
    stillVarianceThreshold: 0.030,
    weights: { accel: 20, gyro: 10, mic: 55, duration: 15 },
    accelAgreeMin: 25,
    micAgreeMin: 50,
    tip: 'Rest face-up on your chest. Breathing rhythm detected directly.',
    accuracyStars: 4,
  },
  pocket: {
    label: 'Pocket',
    description: 'In pocket or on nightstand',
    icon: 'table-furniture',
    // Weakest signal -- rely more on duration as a proxy
    stillVarianceThreshold: 0.005,
    weights: { accel: 30, gyro: 15, mic: 15, duration: 40 },
    accelAgreeMin: 35,
    micAgreeMin: 15,
    tip: 'Least accurate. Use mattress or hand placement for better results.',
    accuracyStars: 2,
  },
};

/** Default placement for new users */
export const DEFAULT_PLACEMENT: PhonePlacement = 'mattress';
