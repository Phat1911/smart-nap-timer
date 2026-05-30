/**
 * config.ts — Global configuration constants and localization data helpers
 *
 * Responsible for:
 * - DETECTION: sleep detection parameters (sample interval, stillness %, score trigger...)
 * - ADAPTIVE: EMA weights for adaptive threshold (70/30 prev/last)
 * - INSUFFICIENT: insufficient sleep threshold ratio (0.85) and warning streak (3)
 * - DURATION_SUGGESTIONS: 3 standard duration options (20/60/90 minutes)
 * - TIME_OF_DAY: time-of-day bucket ranges (night/morning/afternoon/evening)
 * - PLACEMENT_PROFILES: per-placement parameters (variance threshold, weights, icon, tip)
 * - getLocalizedDurationSuggestions(): returns DURATION_SUGGESTIONS with translated descriptions
 * - getLocalizedPlacementProfiles(): returns PLACEMENT_PROFILES with localized label/desc/tip
 * - getSleepScoreTrigger(): returns score trigger (can be overridden in __DEV__)
 *
 * Used by:
 * - SessionService: DETECTION, ADAPTIVE, INSUFFICIENT, TIME_OF_DAY
 * - ConfidenceEngine: DETECTION, PLACEMENT_PROFILES
 * - HomeScreen: DURATION_SUGGESTIONS, PLACEMENT_PROFILES (via getLocalized helpers)
 * - useDurationSuggestion, useAdaptiveThreshold: ADAPTIVE, DURATION_SUGGESTIONS
 * - AlarmService: ALARM_SOUNDS, SNOOZE_MINUTES, ALARM_RAMP_SECONDS
 * - DevToolsScreen: getSleepScoreTrigger(), _devOverrides
 *
 * Notes:
 * - PLACEMENT_PROFILES uses English defaults; always call getLocalized helpers when rendering UI
 * - getSleepScoreTrigger() returns _devOverrides.sleepScoreTrigger in __DEV__ for DevTools customization
 * - STILL_ACCEL_VARIANCE = 0.015 is the default threshold; each placement has its own stillVarianceThreshold
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import type { PhonePlacement } from '../models/Session';
import { Strings } from './strings';
import type { StringsType } from './strings';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

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
  SUSTAINED_HIGH_COUNT: 6,         // consecutive high-score checks before firing
  STILL_ACCEL_VARIANCE: 0.015,     // default accelVariance below this = still

  // Default confidence score weights (overridden per placement profile)
  WEIGHT_ACCELEROMETER: 40,
  WEIGHT_GYROSCOPE: 20,
  WEIGHT_MIC: 30,
  WEIGHT_DURATION: 10,
};

// Temporary debug switches for sensor-fusion diagnosis.
// Keep these off in normal builds; flip them back to false after testing.
export const DEBUG_DETECTION = {
  MIC_ONLY_FUSION: false,
};

// Adaptive threshold formula weights
export const ADAPTIVE = {
  PREV_AVG_WEIGHT: 0.7,
  LAST_SESSION_WEIGHT: 0.3,
  AI_ACTIVATION_DAYS: 30,          // AI kicks in after 30 days of session history
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

export type AlarmSoundId = typeof ALARM_SOUNDS[number]['id'] | (string & {});
export const DEFAULT_ALARM_SOUND: AlarmSoundId = 'alarm';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

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

// ─────────────────────────────────────────
// Placement Profiles
// ─────────────────────────────────────────

export const PLACEMENT_PROFILES: Record<PhonePlacement, PlacementProfile> = {
  mattress: {
    label: 'Mattress',
    description: 'Face-down beside your hip',
    icon: '🛏️',
    // Mattress absorbs all vibration — phone is always still, so accel is a weak
    // discriminator. Duration is the most reliable proxy; mic rhythm provides
    // the false-positive guard (random noise has no 12-24 BPM rhythm, real
    // breathing does, so the higher micAgreeMin filters awake noise out).
    stillVarianceThreshold: 0.008,
    weights: { accel: 20, gyro: 5, mic: 20, duration: 55 },
    accelAgreeMin: 72,
    micAgreeMin: 62,
    tip: 'Place face-down on the mattress beside your hip. Do not hold it.',
    accuracyStars: 3,
  },
  hand: {
    label: 'Hand',
    description: 'Held loosely in your hand',
    icon: '✋',
    // Grip relaxation = sharp stillness onset -- good accel signal
    stillVarianceThreshold: 0.020,
    weights: { accel: 55, gyro: 25, mic: 10, duration: 10 },
    accelAgreeMin: 60,
    micAgreeMin: 25,
    tip: 'Hold loosely in your palm. Once the confidence bar reaches ~65%, gently place the phone on your chest or mattress — detection continues automatically.',
    accuracyStars: 4,
  },
  chest: {
    label: 'Chest',
    description: 'Resting on your chest',
    icon: '🧍',
    // Chest moves with breathing -- be lenient on accel, rely on mic rhythm
    stillVarianceThreshold: 0.030,
    weights: { accel: 20, gyro: 10, mic: 55, duration: 15 },
    accelAgreeMin: 25,
    micAgreeMin: 58,
    tip: 'Rest face-up on your chest. Breathing rhythm detected directly.',
    accuracyStars: 4,
  },
  pocket: {
    label: 'Pocket',
    description: 'In pocket or on nightstand',
    icon: '🪑',
    // Weakest signal -- rely more on duration as a proxy
    stillVarianceThreshold: 0.005,
    weights: { accel: 30, gyro: 15, mic: 15, duration: 40 },
    accelAgreeMin: 35,
    micAgreeMin: 20,
    tip: 'Least accurate. Use mattress or hand placement for better results.',
    accuracyStars: 2,
  },
};

/** Default placement for new users */
export const DEFAULT_PLACEMENT: PhonePlacement = 'mattress';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

/**
 * Returns DURATION_SUGGESTIONS with descriptions translated to the current language
 * @param strings - Translated Strings object (default: English Strings)
 * @returns DURATION_SUGGESTIONS array with localised descriptions
 */
export function getLocalizedDurationSuggestions(strings: StringsType = Strings): typeof DURATION_SUGGESTIONS {
  return [
    { ...DURATION_SUGGESTIONS[0], description: strings.duration_power_nap },
    { ...DURATION_SUGGESTIONS[1], description: strings.duration_deep_rest },
    { ...DURATION_SUGGESTIONS[2], description: strings.duration_full_cycle },
  ];
}

/**
 * Returns PLACEMENT_PROFILES with label, description, and tip translated to the current language
 * @param strings - Translated Strings object (default: English Strings)
 * @returns PLACEMENT_PROFILES with all text localised
 */
export function getLocalizedPlacementProfiles(strings: StringsType = Strings): typeof PLACEMENT_PROFILES {
  return {
    mattress: {
      ...PLACEMENT_PROFILES.mattress,
      label:       strings.placement_mattress_label,
      description: strings.placement_mattress_desc,
      tip:         strings.placement_mattress_tip,
    },
    hand: {
      ...PLACEMENT_PROFILES.hand,
      label:       strings.placement_hand_label,
      description: strings.placement_hand_desc,
      tip:         strings.placement_hand_tip,
    },
    chest: {
      ...PLACEMENT_PROFILES.chest,
      label:       strings.placement_chest_label,
      description: strings.placement_chest_desc,
      tip:         strings.placement_chest_tip,
    },
    pocket: {
      ...PLACEMENT_PROFILES.pocket,
      label:       strings.placement_pocket_label,
      description: strings.placement_pocket_desc,
      tip:         strings.placement_pocket_tip,
    },
  };
}

// ── Dev-only runtime overrides (resets on restart, no persistence) ────────────

export const _devOverrides = {
  sleepScoreTrigger: DETECTION.SLEEP_SCORE_TRIGGER as number,
};

/**
 * Returns the confidence score threshold for triggering sleep detection
 * @returns Value from _devOverrides in __DEV__ (DevTools can modify it); DETECTION.SLEEP_SCORE_TRIGGER in production
 */
export function getSleepScoreTrigger(): number {
  return __DEV__ ? _devOverrides.sleepScoreTrigger : DETECTION.SLEEP_SCORE_TRIGGER;
}
