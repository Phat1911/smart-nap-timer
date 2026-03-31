/**
 * Tasks 5.7 + 5.9 -- RevenueCat SDK + tier persistence
 * Auto-detects Vietnamese locale → routes to PayOS backend
 * International locale → routes to RevenueCat IAP
 */
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

// RevenueCat API keys -- replace before shipping
const RC_API_KEY_IOS     = 'appl_REPLACE_WITH_IOS_KEY';
const RC_API_KEY_ANDROID = 'goog_REPLACE_WITH_ANDROID_KEY';

// Payment backend URL -- update after Render deploy
export const PAYMENT_BACKEND_URL = 'https://smart-nap-timer-backend.onrender.com'; // Render deploy

const TIER_STORAGE_KEY = '@smart_nap_timer:active_tier';

// ── Locale detection ──────────────────────────────────────────────────────────

function isVietnameseLocale(): boolean {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.startsWith('vi');
  } catch {
    return false;
  }
}

// ── TierService ───────────────────────────────────────────────────────────────

class TierService {
  private _configured = false;

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

  async getCurrentTier(): Promise<TierName> {
    try {
      const cached = await AsyncStorage.getItem(TIER_STORAGE_KEY);
      if (cached === 'pro' || cached === 'max') return cached;
    } catch {}
    return 'free';
  }

  async getFeatureLimits(): Promise<TierLimits> {
    const tier = await this.getCurrentTier();
    return TIER_LIMITS[tier];
  }

  async setTier(tier: TierName): Promise<void> {
    await AsyncStorage.setItem(TIER_STORAGE_KEY, tier);
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

  async purchase(tier: 'pro' | 'max', userId: string): Promise<TierName> {
    if (isVietnameseLocale()) {
      return this.purchaseViaPayOS(tier, userId);
    }
    return this.purchaseViaRevenueCat(tier);
  }

  // ── PayOS path (Vietnam) ───────────────────────────────────────────────────

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
    const offerings = await Purchases.getOfferings();
    const current   = offerings.current;
    if (!current) throw new Error('No offerings available');

    const pkg: any = current.availablePackages.find(
      (p: any) => p.product.identifier === pricing.productId,
    );
    if (!pkg) throw new Error(`Product ${pricing.productId} not found`);

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const newTier: TierName =
      customerInfo.entitlements.active['max']?.isActive ? 'max' :
      customerInfo.entitlements.active['pro']?.isActive ? 'pro' : 'free';

    await this.setTier(newTier);
    return newTier;
  }

  // ── Restore (international only) ──────────────────────────────────────────

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
    return isVietnameseLocale();
  }
}

export const tierService = new TierService();
