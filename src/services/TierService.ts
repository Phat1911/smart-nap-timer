/**
 * TierService — Manages subscription tiers and payment verification
 *
 * Responsible for:
 * - Configuring the RevenueCat SDK (production builds only)
 * - Reading and caching the current tier in AsyncStorage (offline cache)
 * - Detecting Vietnamese locale → routing to PayOS (Android)
 * - iOS and international → using RevenueCat (required by App Store Review)
 * - Fetching the authoritative tier from the backend server on every foreground
 * - Generating and storing a device ID (UUID) to identify the user for PayOS
 *
 * Used by:
 * - App.tsx: warmUp() on startup, fetchTierFromServer() on every foreground
 * - PaywallScreen: purchase(), createPayOSLink(), pollPayOSStatus()
 * - useTier, useTierGate: getCurrentTier(), getFeatureLimits()
 * - DevToolsScreen: setTier() to override in dev
 *
 * Notes:
 * - RevenueCat does not work in Expo Go — uses __DEV__ mock
 * - iOS must ALWAYS use StoreKit (App Store Guideline 3.1.1)
 * - warmUp() is best-effort, non-blocking — errors are silently ignored
 *
 * Tasks 5.7 + 5.9 -- RevenueCat SDK + tier persistence
 * Auto-detects Vietnamese locale → routes to PayOS backend
 * International locale → routes to RevenueCat IAP
 */
// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { TierName, TIER_LIMITS, TierLimits, TIER_PRICING } from '../models/Tier';

// ── RevenueCat conditional import ─────────────────────────────────────────────
// react-native-purchases is a native module and CANNOT run in Expo Go.
// In __DEV__ (Expo Go), we use a no-op mock so the app loads without crashing.
// In production EAS builds, the real SDK is used.
let Purchases: any;
let LOG_LEVEL: any;
let PurchasesPackage: any;

if (!__DEV__) {
  const rc = require('react-native-purchases');
  Purchases     = rc.default;
  LOG_LEVEL     = rc.LOG_LEVEL;
  PurchasesPackage = rc.PurchasesPackage;
} else {
  // Dev mock -- all methods are no-ops that return safe defaults
  LOG_LEVEL = { ERROR: 'ERROR' };
  Purchases = {
    setLogLevel:     () => {},
    configure:       async () => {},
    getCustomerInfo: async () => ({ entitlements: { active: {} } }),
    getOfferings:    async () => ({ current: null }),
    purchasePackage: async () => { throw new Error('IAP not available in Expo Go'); },
    restorePurchases:async () => ({ entitlements: { active: {} } }),
  };
}

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

// RevenueCat API keys -- replace before shipping
const RC_API_KEY_IOS     = 'appl_REPLACE_WITH_IOS_KEY';
const RC_API_KEY_ANDROID = 'goog_REPLACE_WITH_ANDROID_KEY';

// Payment backend URL -- update after Render deploy
export const PAYMENT_BACKEND_URL = 'https://smart-nap-timer-backend.onrender.com'; // Render deploy

const TIER_STORAGE_KEY = '@smart_nap_timer:active_tier';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

// ── Locale detection ──────────────────────────────────────────────────────────

function isVietnameseLocale(): boolean {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.startsWith('vi');
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────
// Class Definition
// ─────────────────────────────────────────

// ── TierService ───────────────────────────────────────────────────────────────

class TierService {
  private _configured = false;
  private _cachedOfferings: any = null;

  /**
   * Configures the RevenueCat SDK with the platform-appropriate API key
   * Only configures once (guarded by _configured)
   */
  async configure(): Promise<void> {
    if (this._configured) return;
    try {
      const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
      Purchases.setLogLevel(LOG_LEVEL.ERROR);
      await Purchases.configure({ apiKey });
      this._configured = true;
      // Skip RevenueCat sync in __DEV__ (Expo Go) -- mock returns empty
      // entitlements which would overwrite Dev Tools tier overrides.
      if (!__DEV__) {
        this.refreshTierFromRevenueCat().catch(() => {});
      }
    } catch (e) {
      console.warn('TierService.configure failed:', e);
    }
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  /**
   * Reads the current tier from the AsyncStorage cache
   * @returns 'free' if no data exists or a read error occurs
   */
  async getCurrentTier(): Promise<TierName> {
    try {
      const cached = await AsyncStorage.getItem(TIER_STORAGE_KEY);
      if (cached === 'pro' || cached === 'max') {
        console.log(`💎 TierService: current tier is '${cached}'`);
        return cached;
      }
    } catch {}
    console.log('💎 TierService: current tier is \'free\'');
    return 'free';
  }

  async getFeatureLimits(): Promise<TierLimits> {
    const tier = await this.getCurrentTier();
    return TIER_LIMITS[tier];
  }

  async setTier(tier: TierName): Promise<void> {
    await AsyncStorage.setItem(TIER_STORAGE_KEY, tier);
    console.log(`💎 TierService: tier set to '${tier}'`);
  }

  // ── RevenueCat sync ────────────────────────────────────────────────────────

  async refreshTierFromRevenueCat(): Promise<TierName> {
    try {
      const info = await Purchases.getCustomerInfo();
      const ents = info.entitlements.active;
      const tier: TierName =
        ents['max']?.isActive ? 'max' :
        ents['pro']?.isActive ? 'pro' : 'free';
      await this.setTier(tier);
      return tier;
    } catch {
      return this.getCurrentTier();
    }
  }

  // ── Purchase (auto-routes by locale) ──────────────────────────────────────

  /**
   * Initiates a tier purchase — automatically routes to PayOS or RevenueCat based on platform/locale
   * @param tier - The tier to upgrade to ('pro' | 'max')
   * @param userId - Device ID used by PayOS to identify the user
   * @returns The new tier after a successful purchase
   * @throws Error if the payment fails
   */
  async purchase(tier: 'pro' | 'max', userId: string): Promise<TierName> {
    // iOS must always use StoreKit/RevenueCat regardless of locale
    // (App Store Review Guideline 3.1.1 — no custom payment on iOS)
    if (Platform.OS === 'ios') {
      return this.purchaseViaRevenueCat(tier);
    }
    // Android: route by locale (PayOS for VN, RevenueCat for international)
    if (isVietnameseLocale()) {
      return this.purchaseViaPayOS(tier, userId);
    }
    return this.purchaseViaRevenueCat(tier);
  }

  // ── PayOS path (Vietnam) ───────────────────────────────────────────────────

  /**
   * Creates a PayOS payment link for Vietnamese users (Android)
   * @param tier - The tier to purchase
   * @param userId - The user's device ID
   * @returns checkoutUrl (opened in browser) and orderCode (used to poll status)
   * @throws Error if the backend does not respond or returns a non-200 status
   */
  async createPayOSLink(tier: 'pro' | 'max', userId: string): Promise<{
    checkoutUrl: string;
    orderCode: number;
  }> {
    const res = await fetch(`${PAYMENT_BACKEND_URL}/payments/create`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tier, userId }),
    });
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    return res.json();
  }

  /**
   * Polls the PayOS order status from the backend
   * @param orderCode - Order code received from createPayOSLink()
   * @returns 'pending' | 'paid' | 'cancelled' (returns 'pending' on network error)
   */
  async pollPayOSStatus(orderCode: number): Promise<'pending' | 'paid' | 'cancelled'> {
    const res = await fetch(`${PAYMENT_BACKEND_URL}/payments/status/${orderCode}`);
    if (!res.ok) return 'pending';
    const data = await res.json();
    return data.status;
  }

  private async purchaseViaPayOS(
    tier: 'pro' | 'max',
    userId: string,
  ): Promise<TierName> {
    // Caller (PaywallScreen) opens checkoutUrl in browser and polls status
    // This method is for internal upgrade after poll confirms 'paid'
    await this.setTier(tier);
    return tier;
  }

  // ── RevenueCat path (international) ───────────────────────────────────────

  private async purchaseViaRevenueCat(tier: 'pro' | 'max'): Promise<TierName> {
    const pricing   = TIER_PRICING[tier];
    if (!this._cachedOfferings) {
      this._cachedOfferings = await Purchases.getOfferings();
    }
    const offerings = this._cachedOfferings;
    const current   = offerings.current;
    if (!current) throw new Error('No offerings available');

    const pkg: any = current.availablePackages.find(
      (p: any) => p.product.identifier === pricing.productId,
    );
    if (!pkg) throw new Error(`Product ${pricing.productId} not found`);

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    this._cachedOfferings = null;  // force refresh after purchase
    const newTier: TierName =
      customerInfo.entitlements.active['max']?.isActive ? 'max' :
      customerInfo.entitlements.active['pro']?.isActive ? 'pro' : 'free';

    await this.setTier(newTier);
    return newTier;
  }

  // ── Warm-up (call at launch to pre-configure RC + cache offerings) ─────────

  async warmUp(): Promise<void> {
    try {
      await this.configure();
      if (!__DEV__ && !this._cachedOfferings) {
        this._cachedOfferings = await Purchases.getOfferings();
      }
    } catch {
      // Silent -- warm-up is best-effort, never blocking
    }
  }

  // ── Restore (international only) ──────────────────────────────────────────

  /**
   * Restores purchases via RevenueCat (international path only)
   * @returns The restored tier
   * @throws Error if RevenueCat does not respond
   */
  async restorePurchases(): Promise<TierName> {
    try {
      const info = await Purchases.restorePurchases();
      const tier: TierName =
        info.entitlements.active['max']?.isActive ? 'max' :
        info.entitlements.active['pro']?.isActive ? 'pro' : 'free';
      await this.setTier(tier);
      return tier;
    } catch {
      throw new Error('Failed to restore purchases. Please try again.');
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  get isVietnamese(): boolean {
    return Platform.OS !== 'ios' && isVietnameseLocale();
  }

  private static readonly DEVICE_ID_KEY = '@smart_nap_timer:device_id';

  /**
   * Fetch the authoritative tier from the backend server.
   * Called after payment confirmation AND on every app foreground.
   * Falls back to cached AsyncStorage tier if network unavailable.
   */
  async fetchTierFromServer(userId: string): Promise<TierName> {
    try {
      const url = `${PAYMENT_BACKEND_URL}/payments/me/tier?userId=${encodeURIComponent(userId)}`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      const tier = data?.tier;
      if (tier === 'pro' || tier === 'max' || tier === 'free') {
        await this.setTier(tier);   // write to AsyncStorage as cache
        return tier;
      }
      throw new Error('Invalid tier value from server');
    } catch {
      // Network unavailable -- fall back to cached tier
      return this.getCurrentTier();
    }
  }

  /**
   * Gets or creates a UUID-format device ID for identifying the user with PayOS
   * @returns UUID string, falls back to a timestamp string if AsyncStorage fails
   */
  async getOrCreateDeviceId(): Promise<string> {
    try {
      const existing = await AsyncStorage.getItem(TierService.DEVICE_ID_KEY);
      if (existing) return existing;
      // Generate a simple UUID-like string using Math.random (no external deps)
      const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
      await AsyncStorage.setItem(TierService.DEVICE_ID_KEY, id);
      return id;
    } catch {
      return `fallback_${Date.now()}`;
    }
  }
}

// ─────────────────────────────────────────
// Exports
// ─────────────────────────────────────────

export const tierService = new TierService();
