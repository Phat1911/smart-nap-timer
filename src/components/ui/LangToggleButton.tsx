/**
 * LangToggleButton.tsx — Language toggle button displayed in the top-right corner
 *
 * Responsible for:
 * - Showing "EN" when currently in Vietnamese and "VI" when currently in English
 * - Calling toggleLang() from LanguageContext when the user taps to switch language
 *
 * Used by:
 * - TopRightContext: App.tsx places LangToggleButton in the top-right overlay
 *   via setTopRight() so the button appears on all screens
 *
 * Notes:
 * - hitSlop extends the touch target by 8px on each side for easier tapping on small devices
 * - Does not manage language state itself — only reads/calls from LanguageContext
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { Colors } from '../../constants';

// ─────────────────────────────────────────
// Render
// ─────────────────────────────────────────

/**
 * EN/VI language toggle button — shows the other language label to invite the user to switch
 * @returns TouchableOpacity showing "EN" or "VI" based on current language
 */
export default function LangToggleButton() {
  const { lang, toggleLang } = useLanguage();
  return (
    <TouchableOpacity onPress={toggleLang} style={styles.btn} hitSlop={{ top: 9, bottom: 9, left: 9, right: 9 }}>
      <Text style={styles.label}>{lang === 'vi' ? 'EN' : 'VI'}</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: Colors.text_primary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
