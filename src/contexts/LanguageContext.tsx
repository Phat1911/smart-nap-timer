/**
 * LanguageContext — Manages the display language (Vietnamese / English)
 *
 * Responsible for:
 * - Auto-detecting the device language on first launch
 * - Persisting the language selection in AsyncStorage across app opens
 * - Providing reactive strings — any component using useLanguage() updates automatically
 *   when the user switches language, without needing to restart the app
 * - Exposing toggleLang() to switch between vi ↔ en
 *
 * Used by:
 * - All screens and components: import { useLanguage } from this context
 * - LangToggleButton: calls toggleLang() when the button is pressed
 *
 * Notes:
 * - Uses Intl.DateTimeFormat to detect locale — works on both iOS and Android
 * - Defaults to detecting 'vi' if locale starts with 'vi', otherwise 'en'
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EN, VI } from '../constants/strings';
import type { StringsType } from '../constants/strings';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

type Lang = 'vi' | 'en';
const LANG_KEY = '@smart_nap_timer:language';

interface LanguageContextValue {
  strings:    StringsType;
  lang:       Lang;
  toggleLang: () => void;
}

// ─────────────────────────────────────────
// Context / Provider
// ─────────────────────────────────────────

const LanguageContext = createContext<LanguageContextValue>({
  strings:    EN,
  lang:       'en',
  toggleLang: () => {},
});

function detectDeviceLang(): Lang {
  return Intl.DateTimeFormat().resolvedOptions().locale.startsWith('vi') ? 'vi' : 'en';
}

/**
 * Provider that wraps the entire app to provide the language context
 * @param children - The full component subtree
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectDeviceLang());

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((saved) => {
      if (saved === 'vi' || saved === 'en') setLang(saved);
    }).catch(() => {});
  }, []);

  function toggleLang() {
    const next: Lang = lang === 'vi' ? 'en' : 'vi';
    setLang(next);
    AsyncStorage.setItem(LANG_KEY, next).catch(() => {});
  }

  const strings = lang === 'vi' ? VI : EN;

  return (
    <LanguageContext.Provider value={{ strings, lang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─────────────────────────────────────────
// Exports
// ─────────────────────────────────────────

/**
 * Hook to get strings and language control functions from context
 * @returns strings (reactive), lang ('vi'|'en'), toggleLang()
 */
export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
