/**
 * index.ts — Barrel export for all Smart Nap Timer model types
 *
 * Responsible for:
 * - Re-exporting all types from Session.ts and Tier.ts
 * - Allowing other files to import types from a single '../models' path instead of individual files
 *
 * Used by:
 * - All services, hooks, and screens that need NapSession, TierName, PhonePlacement...
 */

export * from './Session';
export * from './Tier';
