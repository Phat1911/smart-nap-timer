/**
 * services/index.ts — Centralised re-export for all services
 *
 * Responsible for:
 * - Allowing imports from '../services' instead of specific file paths
 *
 * Used by:
 * - Screens and hooks that import services via this barrel export
 *
 * Notes: Only exports singletons and types — classes are not exported directly
 */
export { motionService } from './MotionService';
export type { MotionSample } from './MotionService';

export { micService } from './MicService';
export type { MicSample } from './MicService';

export { alarmService } from './AlarmService';

export { audioService } from './AudioService';
export type { SoundType } from './AudioService';

export { sessionService } from './SessionService';

export { aiModelService } from './AIModelService';

export { LinearRegression } from './LinearRegression';
export type { TrainingRow, PredictInput } from './LinearRegression';

export { usageService } from './UsageService';

export { tierService } from './TierService';
export { placementHabitAnalyzer } from './PlacementHabitAnalyzer';
