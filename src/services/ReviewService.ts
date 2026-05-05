/**
 * ReviewService — Triggers the App Store / Play Store review dialog
 *
 * Responsible for:
 * - Checking that rating >= 4 stars before showing the review dialog
 * - Ensuring the prompt is shown at most once (flag stored in AsyncStorage)
 * - Saving the flag before calling review to guard against crashes resetting the flag
 *
 * Used by:
 * - WakeScreen: maybeRequestReview(rating) after the user submits a rating
 *
 * Notes:
 * - expo-store-review is NOT supported in Expo Go — mocked in __DEV__
 * - iOS: the dialog is controlled by the OS — not guaranteed to appear every time
 * - Android: same behaviour with Google's In-App Review API
 * - The flag is saved first to prevent StoreReview.requestReview() from throwing
 *   before the flag is set, which would cause a re-prompt on the next session
 *
 * 7.6 — Review Prompt
 *
 * After a high wake rating (4-5 stars), requests an in-app store review
 * exactly once. The flag is persisted so the user is never prompted again.
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

let StoreReview: any;
if (!__DEV__) {
  StoreReview = require('expo-store-review');
} else {
  StoreReview = { requestReview: async () => {} };
}

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const REVIEW_REQUESTED_KEY = '@smart_nap_timer:review_requested';

// ─────────────────────────────────────────
// Exports
// ─────────────────────────────────────────

/**
 * Call after saving a session with a high rating.
 * No-ops if rating < 4 or already prompted.
 */
/**
 * Requests an App Store/Play Store review if eligible (rating >= 4, not yet prompted)
 * @param rating - The user's nap rating (1-5)
 */
export async function maybeRequestReview(rating: number): Promise<void> {
  if (rating < 4) return;
  try {
    const already = await AsyncStorage.getItem(REVIEW_REQUESTED_KEY);
    if (already) return;

    // Persist the flag first so a crash/error below doesn't re-prompt.
    await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, '1');

    await StoreReview.requestReview();
  } catch {
    // Silent — review prompt is best-effort
  }
}
