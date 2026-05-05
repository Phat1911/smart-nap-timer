/**
 * colors.ts — Material Design 3 Dark Theme color palette for the entire app
 *
 * Responsible for:
 * - Defining the Colors object: all colors used in the UI (background, surface, primary, error...)
 * - Ensuring color consistency across all screens and components
 *
 * Used by:
 * - All screens, components, and StyleSheets in the project
 *
 * Notes:
 * - Entirely dark theme — no light mode
 * - surface_container_* are different levels of background (lowest → highest = darker → lighter)
 * - primary_dim (#675df9) used for button background; primary (#a8a4ff) used for text/icon active
 */

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

// Material Design 3 Dark Theme palette matching the app design
export const Colors = {
  // Core backgrounds
  background: '#0e0e13',
  surface: '#0e0e13',
  surface_container_lowest: '#000000',
  surface_container_low: '#131319',
  surface_container: '#19191f',
  surface_container_high: '#1f1f26',
  surface_container_highest: '#25252d',
  surface_variant: '#25252d',
  surface_bright: '#2c2b33',

  // Primary
  primary: '#a8a4ff',
  primary_dim: '#675df9',
  primary_fixed: '#9995ff',
  primary_fixed_dim: '#8a85ff',
  on_primary: '#1e009f',
  primary_container: '#9995ff',
  on_primary_container: '#16007d',
  inverse_primary: '#5044e3',

  // Secondary
  secondary: '#aa8ffd',
  secondary_dim: '#a78cfa',
  secondary_container: '#4e329b',
  on_secondary: '#290071',
  on_secondary_container: '#d7c8ff',

  // Tertiary
  tertiary: '#ff9dd0',
  tertiary_container: '#fb88c6',
  on_tertiary: '#6c0f4c',
  on_tertiary_container: '#5e0041',

  // Text / On colors
  on_surface: '#f9f5fd',
  on_surface_variant: '#acaab1',
  on_background: '#f9f5fd',

  // Error
  error: '#ff6e84',
  error_dim: '#d73357',
  error_container: '#a70138',
  on_error: '#490013',
  on_error_container: '#ffb2b9',

  // Outline
  outline: '#76747b',
  outline_variant: '#48474d',

  // Inverse
  inverse_surface: '#fcf8ff',
  inverse_on_surface: '#55545b',

  // Legacy aliases used elsewhere in codebase
  bg_base: '#0a0a0f',
  bg_surface: '#131319',
  bg_elevated: '#1f1f26',
  bg_card: '#25252d',
  text_primary: '#f9f5fd',
  text_secondary: '#acaab1',
  text_muted: '#76747b',
  border: '#48474d',
  border_active: '#a8a4ff',
  success: '#4ade80',
  warning: '#facc15',
  danger: '#ff6e84',
  info: '#60a5fa',
  confidence_low: '#ff6e84',
  confidence_mid: '#facc15',
  confidence_high: '#4ade80',
  awake: '#ff6e84',
  drowsy: '#facc15',
  asleep: '#4ade80',
  primary_glow: 'rgba(168, 164, 255, 0.2)',
};
