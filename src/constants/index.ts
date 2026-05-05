/**
 * index.ts — Barrel export for all Smart Nap Timer constants
 *
 * Responsible for:
 * - Re-exporting Colors, config constants (DETECTION, ADAPTIVE...), Strings from sub-modules
 * - Allowing screens/services to import from '../constants' instead of specific paths
 *
 * Used by:
 * - All screens, hooks, and services that need Colors, DETECTION, DURATION_SUGGESTIONS...
 */

export * from './colors';
export * from './config';
export * from './strings';
