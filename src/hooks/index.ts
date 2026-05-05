/**
 * index.ts — Barrel export for all Smart Nap Timer custom hooks
 *
 * Responsible for:
 * - Re-exporting all hooks and related types from each module
 * - Allowing screens/components to import cleanly from a single path
 *
 * Used by:
 * - All screens and services that need to import a hook
 *
 * Notes:
 * - Exports only; contains no logic — add new hooks here after creating their file
 */

export { useAdaptiveThreshold } from './useAdaptiveThreshold';
export type { AdaptiveThresholdResult } from './useAdaptiveThreshold';

export { usePlacementReminder } from './usePlacementReminder';

export { useDurationSuggestion } from './useDurationSuggestion';
export type { DurationSuggestion } from './useDurationSuggestion';

export { buildSessionSummary } from './useSessionSummary';
export type { SessionSummaryData } from './useSessionSummary';

export { useDashboardData } from './useDashboardData';
export type { DashboardData, ChartPoint } from './useDashboardData';

export { useRollingWindow } from './useRollingWindow';
export { useSleepDetection } from './useSleepDetection';
export { usePermissions } from './usePermissions';
export { useScreenDim } from './useScreenDim';
export { useAIModel } from './useAIModel';

export { usePlacement } from './usePlacement';
export type { UsePlacementResult } from './usePlacement';
