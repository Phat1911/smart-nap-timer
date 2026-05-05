/**
 * StreakService — Computes streak, weekly count, and nap achievement badges
 *
 * Responsible for:
 * - Computing the current consecutive streak (both today and yesterday count)
 * - Counting naps in the current week (Monday through today)
 * - Managing milestone badges (3/7/14/30 days) — stored in AsyncStorage to avoid re-awarding
 * - Detecting newly unlocked badges so HomeScreen can show a notification
 *
 * Used by:
 * - useStreak: calls compute() every time HomeScreen is focused
 * - DashboardScreen: reads streak data to display and share
 *
 * Notes:
 * - Uses local time (not UTC) for date calculations — respects the user's timezone
 * - addDays() uses UTC arithmetic to avoid DST edge cases when adding/subtracting days
 * - Streak does not break if the user hasn't napped today but did nap yesterday
 *
 * 7.2 — Streak & Habit Tracking
 *
 * Computes the current nap streak, weekly nap count, and milestone badges
 * entirely from the existing session history. No new storage format is added
 * beyond a single AsyncStorage key for the set of already-awarded badges.
 *
 * Streak rules:
 *   - 1 streak day = any calendar day (local time) with ≥ 1 completed session
 *   - Streak continues through today OR yesterday (i.e. a gap only breaks the
 *     streak if the user missed a FULL day, not just today so far)
 *   - Resets to 0 if the last session day is 2+ days ago
 *
 * Weekly count: sessions on Monday–today (ISO week, local time).
 *
 * Badge milestones: 3 / 7 / 14 / 30 consecutive days.
 * Badges persist in AsyncStorage; newlyEarnedBadges is non-empty only on the
 * first call after crossing a threshold.
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { sessionService } from './SessionService';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StreakData {
  currentStreak: number;
  weeklyCount: number;
  weeklyGoal: number;
  /** Milestone streak values for which badges have been earned (e.g. [3, 7]) */
  earnedBadges: number[];
  /** Badges just earned for the first time — HomeScreen shows a congratulation */
  newlyEarnedBadges: number[];
}

export interface BadgeInfo {
  days: number;
  label: string;
  emoji: string;
}

export const BADGE_MILESTONES: BadgeInfo[] = [
  { days: 3,  label: '3-Day Streak',   emoji: '🌙' },
  { days: 7,  label: 'Week Warrior',   emoji: '🔥' },
  { days: 14, label: '2-Week Master',  emoji: '⭐' },
  { days: 30, label: 'Month Champion', emoji: '🏆' },
];

const WEEKLY_GOAL        = 5;
const BADGES_STORAGE_KEY = '@smart_nap_timer:streak_badges'; // JSON number[]

// ── Date helpers (local time) ─────────────────────────────────────────────────

/** Convert an ISO date string to a local YYYY-MM-DD string. */
function localDateOf(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today's local date as YYYY-MM-DD. */
function todayLocal(): string {
  return localDateOf(new Date().toISOString());
}

/**
 * Add (or subtract) days from a YYYY-MM-DD string.
 * Uses UTC arithmetic to avoid DST edge cases.
 */
function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, '0'),
    String(dt.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** Monday of the current ISO week (local time). */
function mondayOfCurrentWeek(): string {
  const now = new Date();
  const dow = now.getDay(); // 0 = Sun
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + offsetToMonday);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Core calculations ─────────────────────────────────────────────────────────

function calcStreak(sessionDates: Set<string>): number {
  const today     = todayLocal();
  const yesterday = addDays(today, -1);

  // No session today or yesterday → streak broken
  if (!sessionDates.has(today) && !sessionDates.has(yesterday)) return 0;

  // Walk backwards starting from today (or yesterday if today has nothing yet)
  let current = sessionDates.has(today) ? today : yesterday;
  let streak  = 0;
  while (sessionDates.has(current)) {
    streak++;
    current = addDays(current, -1);
  }
  return streak;
}

function calcWeeklyCount(
  sessions: { date: string }[],
  monday: string,
  today: string,
): number {
  return sessions.filter((s) => {
    const d = localDateOf(s.date);
    return d >= monday && d <= today;
  }).length;
}

// ── Storage ───────────────────────────────────────────────────────────────────

async function loadStoredBadges(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(BADGES_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

async function saveBadges(badges: number[]): Promise<void> {
  await AsyncStorage.setItem(BADGES_STORAGE_KEY, JSON.stringify(badges)).catch(() => {});
}

// ── StreakService ─────────────────────────────────────────────────────────────

class StreakService {
  async compute(): Promise<StreakData> {
    const sessions = await sessionService.loadAll();

    // Build a set of unique local dates that have ≥ 1 session
    const sessionDates = new Set(sessions.map((s) => localDateOf(s.date)));

    const currentStreak = calcStreak(sessionDates);
    const monday        = mondayOfCurrentWeek();
    const today         = todayLocal();
    const weeklyCount   = calcWeeklyCount(sessions, monday, today);

    // Determine which milestones are now earned
    const nowEarned    = BADGE_MILESTONES
      .filter((b) => currentStreak >= b.days)
      .map((b) => b.days);

    const storedBadges = await loadStoredBadges();
    const newlyEarned  = nowEarned.filter((d) => !storedBadges.includes(d));

    if (newlyEarned.length > 0) {
      await saveBadges([...storedBadges, ...newlyEarned]);
    }

    return {
      currentStreak,
      weeklyCount,
      weeklyGoal: WEEKLY_GOAL,
      earnedBadges:       [...storedBadges, ...newlyEarned],
      newlyEarnedBadges:  newlyEarned,
    };
  }
}

export const streakService = new StreakService();
