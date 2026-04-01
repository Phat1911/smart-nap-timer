import type { SoundType } from '../services/AudioService';

export type TierName = 'free' | 'pro' | 'max';

export interface TierLimits {
  /** Max nap sessions allowed per day. Infinity = unlimited */
  dailyNapLimit: number;
  /** Max sessions shown in dashboard history. Infinity = unlimited */
  historyLimit: number;
  /** Which white-noise sounds are unlocked */
  soundsUnlocked: SoundType[];
  /** Whether AI latency predictions are active */
  aiEnabled: boolean;
  /** Whether session data JSON/CSV export is available */
  exportEnabled: boolean;
  /** Whether prediction confidence % is shown */
  confidenceEnabled: boolean;
  /** Whether the full insufficient-sleep report is shown */
  fullReportEnabled: boolean;
  /**
   * Max number of phone placements the user can combine per nap.
   * Free=1 (single), Pro=2 (dual fusion), Max=4 (quad fusion)
   */
  maxPlacements: number;
}

/** Feature limits for each tier */
export const TIER_LIMITS: Record<TierName, TierLimits> = {
  free: {
    dailyNapLimit:      2,
    historyLimit:       7,
    soundsUnlocked:     ['rain'],
    aiEnabled:          false,
    exportEnabled:      false,
    confidenceEnabled:  false,
    fullReportEnabled:  false,
    maxPlacements:      1,
  },
  pro: {
    dailyNapLimit:      5,
    historyLimit:       30,
    soundsUnlocked:     ['rain', 'fan', 'static', 'brown'],
    aiEnabled:          true,
    exportEnabled:      false,
    confidenceEnabled:  false,
    fullReportEnabled:  true,
    maxPlacements:      2,
  },
  max: {
    dailyNapLimit:      Infinity,
    historyLimit:       Infinity,
    soundsUnlocked:     ['rain', 'fan', 'static', 'brown'],
    aiEnabled:          true,
    exportEnabled:      true,
    confidenceEnabled:  true,
    fullReportEnabled:  true,
    maxPlacements:      4,
  },
};

export interface TierPricing {
  label: string;
  price: string;
  entitlementId: string;   // RevenueCat entitlement identifier
  productId: string;       // App Store / Play Store product ID
}

export const TIER_PRICING: Record<Exclude<TierName, 'free'>, TierPricing> = {
  pro: {
    label:          'Pro',
    price:          '$2.99/month',
    entitlementId:  'pro',
    productId:      'smart_nap_timer_pro_monthly',
  },
  max: {
    label:          'Max',
    price:          '$6.99/month',
    entitlementId:  'max',
    productId:      'smart_nap_timer_max_monthly',
  },
};
