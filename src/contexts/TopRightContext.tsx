/**
 * TopRightContext — Manages the global custom top-right button
 *
 * Responsible for:
 * - Allowing screens to place a button (icon or text) in the top-right corner
 * - The button is rendered in LangOverlay (App.tsx) above NavigationContainer
 *   so it always appears in the correct position regardless of scroll state
 * - Automatically resets to null when the screen unmounts (via useEffect cleanup)
 *
 * Used by:
 * - WakeScreen: sets the "X" (close icon) button to dismiss the screen
 * - PaywallScreen: sets a custom text button
 * - App.tsx (LangOverlay): reads the button and renders it into the UI
 *
 * Notes:
 * - This pattern avoids screens needing to know about LangOverlay
 *   and avoids complex portal/teleport solutions — just call setButton()
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import React, { createContext, useContext, useState } from 'react';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

export type TopRightButton =
  | { type: 'icon'; iconName: string; iconColor: string; onPress: () => void }
  | { type: 'text'; label: string; onPress: () => void };

interface TopRightContextValue {
  button: TopRightButton | null;
  setButton: (btn: TopRightButton | null) => void;
}

// ─────────────────────────────────────────
// Context / Provider
// ─────────────────────────────────────────

const TopRightContext = createContext<TopRightContextValue>({
  button: null,
  setButton: () => {},
});

/**
 * Provider that wraps the app to provide the top-right button context
 * @param children - The component subtree
 */
export function TopRightProvider({ children }: { children: React.ReactNode }) {
  const [button, setButton] = useState<TopRightButton | null>(null);
  return (
    <TopRightContext.Provider value={{ button, setButton }}>
      {children}
    </TopRightContext.Provider>
  );
}

// ─────────────────────────────────────────
// Exports
// ─────────────────────────────────────────

/**
 * Hook for screens to read or set the top-right button
 * @returns button (current state), setButton (update function)
 */
export function useTopRight(): TopRightContextValue {
  return useContext(TopRightContext);
}
