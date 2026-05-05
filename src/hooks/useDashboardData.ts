/**
 * useDashboardData — Hook that aggregates display data for DashboardScreen
 *
 * Responsible for:
 * - Loading SessionStats and the session list to build chart data
 * - Extracting the last 10 sessions to draw the latency chart (3.9)
 * - Providing showInsufficientWarning when insufficient streak >= 3 (3.17)
 * - Exposing refresh() for DashboardScreen's useFocusEffect to trigger a reload
 *
 * Used by:
 * - DashboardScreen: stats, chartPoints, showInsufficientWarning, loading
 *
 * Notes:
 * - tick state is the trigger mechanism: when refresh() is called, tick increments,
 *   causing useEffect to re-run and reload data (instead of using a complex callback)
 *
 * Tasks 3.9, 3.10, 3.17 — Dashboard real data hook
 * 3.9  Chart data from real sessionService.loadAll()
 * 3.10 Stats from sessionService.getStats()
 * 3.17 Insufficient streak warning (streak >= 3)
 */
// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { sessionService } from '../services/SessionService';
import { SessionStats, NapSession } from '../models/Session';
import { INSUFFICIENT } from '../constants/config';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

export interface ChartPoint {
  session: number;
  latency: number;
  date: string;
}

export interface DashboardData {
  stats: SessionStats | null;
  chartPoints: ChartPoint[];
  showInsufficientWarning: boolean;
  isEmpty: boolean;
  loading: boolean;
  refresh: () => void;
}

// ─────────────────────────────────────────
// Hook
// ─────────────────────────────────────────

/**
 * Hook that loads and processes dashboard data from sessionService
 * @returns stats, chartPoints, showInsufficientWarning, isEmpty, loading, refresh
 */
export function useDashboardData(): DashboardData {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    setLoading(true);
    async function load() {
      const [allStats, sessions] = await Promise.all([
        sessionService.getStats(),
        sessionService.loadAll(),
      ]);

      setStats(allStats);

      // Build chart points from last 10 sessions (3.9)
      const last10 = sessions.slice(-10);
      setChartPoints(
        last10.map((s: NapSession, i: number) => ({
          session: i + 1,
          latency: s.latency_minutes,
          date: s.date,
        })),
      );

      setLoading(false);
    }
    load();
  }, [tick]);

  const showInsufficientWarning =
    (stats?.insufficient_streak ?? 0) >= INSUFFICIENT.STREAK_WARNING;

  return {
    stats,
    chartPoints,
    showInsufficientWarning,
    isEmpty: (stats?.total_sessions ?? 0) === 0,
    loading,
    refresh,
  };
}
