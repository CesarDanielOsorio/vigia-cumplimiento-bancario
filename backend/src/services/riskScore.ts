import { FACTORS, LEVELS, MISSING_SCORE, type LevelKey, type Scores, type Weights } from '../config/riskMatrix';

export interface Adjustment {
  type: string; // CONTROL | AGRAVANTE
  description: string;
  points: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export const levelFor = (score: number): LevelKey =>
  [...LEVELS].reverse().find(l => score >= l.min)!.key;

/**
 * Cálculo reproducible de la matriz:
 *   aporte    = peso × puntaje ÷ 5
 *   inherente = Σ aportes                       (0 a 100)
 *   residual  = inherente − controles + agravantes   (acotado a 0..100)
 */
export function computeScore(scores: Scores, adjustments: Adjustment[], weights: Weights) {
  const factors = FACTORS.map(f => {
    const raw = scores[f.key];
    const missing = raw === null || raw === undefined;
    const score = missing ? MISSING_SCORE : raw;
    const weight = weights[f.key];
    return { key: f.key, label: f.label, score, missing, weight, contribution: round1((weight * score) / 5) };
  });

  const inherent = round1(factors.reduce((s, f) => s + (f.weight * f.score) / 5, 0));
  const controls = adjustments.filter(a => a.type === 'CONTROL').reduce((s, a) => s + a.points, 0);
  const aggravants = adjustments.filter(a => a.type === 'AGRAVANTE').reduce((s, a) => s + a.points, 0);
  const residual = Math.min(100, Math.max(0, round1(inherent - controls + aggravants)));

  return {
    factors,
    inherent,
    controls,
    aggravants,
    residual,
    level: levelFor(residual),
    missingCount: factors.filter(f => f.missing).length,
  };
}

// Ordena por residual descendente; en empate, por inherente y luego por código.
export function rank<T extends { code: string; score: { residual: number; inherent: number } }>(items: T[]) {
  return [...items].sort(
    (a, b) => b.score.residual - a.score.residual || b.score.inherent - a.score.inherent || a.code.localeCompare(b.code),
  );
}
