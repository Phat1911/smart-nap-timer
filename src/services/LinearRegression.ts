/**
 * Tasks 4.1 + 4.2 — Pure TypeScript linear regression (no external libraries)
 *
 * Inputs (normalised to 0-1 before training/prediction):
 *   hour (0-23), day_of_week (0-6), prev_latency (minutes), wake_rating (1-5)
 * Output: predicted sleep-onset latency in minutes
 *
 * Normal-equation solution: β = (XᵀX)⁻¹ Xᵀy
 * Confidence exposed as R² (0-100 integer).
 */
import { AIModelWeights } from '../models/Session';

// ── Public types ─────────────────────────────────────────────────────────────

export interface TrainingRow {
  hour: number;          // 0-23
  day_of_week: number;   // 0-6
  prev_latency: number;  // minutes (latency of the previous session)
  wake_rating: number;   // 1-5
  actual_latency: number; // minutes — what we're predicting
}

export interface PredictInput {
  hour: number;
  day_of_week: number;
  prev_latency: number;
  wake_rating: number;
}

// ── Normalisation (fixed ranges for consistency between train & predict) ─────

const HOUR_MAX = 23;
const DOW_MAX = 6;
const LATENCY_MAX = 60; // cap at 60 min before normalising
const RATING_MIN = 1;
const RATING_RANGE = 4; // 5 - 1

function normaliseFeatures(input: PredictInput): number[] {
  return [
    input.hour / HOUR_MAX,
    input.day_of_week / DOW_MAX,
    Math.min(input.prev_latency, LATENCY_MAX) / LATENCY_MAX,
    (input.wake_rating - RATING_MIN) / RATING_RANGE,
  ];
}

// ── Matrix utilities ─────────────────────────────────────────────────────────

function transpose(A: number[][]): number[][] {
  const rows = A.length;
  const cols = A[0].length;
  const T: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      T[j][i] = A[i][j];
  return T;
}

function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const n = B[0].length;
  const k = B.length;
  const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      for (let l = 0; l < k; l++)
        C[i][j] += A[i][l] * B[l][j];
  return C;
}

/** Gaussian elimination with partial pivoting. Returns null if singular. */
function matInv(A: number[][]): number[][] | null {
  const n = A.length;
  // Augment [A | I]
  const aug: number[][] = A.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-10) return null; // singular

    const scale = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= scale;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  return aug.map((row) => row.slice(n));
}

// ── LinearRegression class ───────────────────────────────────────────────────

export class LinearRegression {
  /** [intercept, coef_hour, coef_dow, coef_prev_latency, coef_wake_rating] */
  private w: number[] = [0, 0, 0, 0, 0];
  private _rSquared = 0;
  private _trainedOn = 0;
  private _lastTrained = '';

  // ── Training ────────────────────────────────────────────────────────────────

  train(data: TrainingRow[]): void {
    if (data.length < 2) return;

    // X: n×5 design matrix (bias + 4 normalised features), y: n-vector
    const X: number[][] = data.map((row) => [
      1,
      ...normaliseFeatures({
        hour: row.hour,
        day_of_week: row.day_of_week,
        prev_latency: row.prev_latency,
        wake_rating: row.wake_rating,
      }),
    ]);
    const y: number[] = data.map((row) => row.actual_latency);

    // β = (XᵀX)⁻¹ Xᵀy
    const Xt = transpose(X);
    const XtX = matMul(Xt, X);
    const XtXInv = matInv(XtX);
    if (!XtXInv) return; // degenerate (e.g. all identical inputs)

    const Xty = matMul(Xt, y.map((v) => [v]));
    const beta = matMul(XtXInv, Xty);
    this.w = beta.map((row) => row[0]);

    // R² = 1 - SS_res / SS_tot
    const yPred = X.map((row) =>
      row.reduce((sum, val, i) => sum + val * this.w[i], 0),
    );
    const yMean = y.reduce((a, b) => a + b, 0) / y.length;
    const ssTot = y.reduce((sum, v) => sum + (v - yMean) ** 2, 0);
    const ssRes = y.reduce((sum, v, i) => sum + (v - (yPred[i] ?? 0)) ** 2, 0);
    this._rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

    this._trainedOn = data.length;
    this._lastTrained = new Date().toISOString();
  }

  // ── Prediction ──────────────────────────────────────────────────────────────

  predict(input: PredictInput): number {
    const features = [1, ...normaliseFeatures(input)];
    const raw = features.reduce((sum, val, i) => sum + val * this.w[i], 0);
    return Math.max(1, raw); // latency is always >= 1 min
  }

  // ── Weight serialisation ────────────────────────────────────────────────────

  getWeights(): AIModelWeights {
    return {
      intercept: this.w[0] ?? 0,
      coef_hour: this.w[1] ?? 0,
      coef_day_of_week: this.w[2] ?? 0,
      coef_prev_latency: this.w[3] ?? 0,
      coef_wake_rating: this.w[4] ?? 0,
      trained_on_sessions: this._trainedOn,
      last_trained: this._lastTrained,
    };
  }

  loadWeights(w: AIModelWeights): void {
    this.w = [
      w.intercept,
      w.coef_hour,
      w.coef_day_of_week,
      w.coef_prev_latency,
      w.coef_wake_rating,
    ];
    this._trainedOn = w.trained_on_sessions;
    this._lastTrained = w.last_trained;
  }

  // ── Accessors ───────────────────────────────────────────────────────────────

  /** R² as a 0-100 integer */
  get confidence(): number {
    return Math.round(this._rSquared * 100);
  }

  get trainedOnSessions(): number {
    return this._trainedOn;
  }
}
