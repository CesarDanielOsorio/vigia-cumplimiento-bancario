import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, levelFor, rank } from './riskScore';
import { DEFAULT_WEIGHTS, type Scores, type Weights } from '../config/riskMatrix';

// Escenarios sintéticos del enunciado (mismos datos que prisma/seed.ts).
const EVENTS: { code: string; scores: Scores; controls: number[]; aggravants?: number[] }[] = [
  { code: 'EV-001', scores: { monto: 4, frecuencia: 4, producto: 3, canal: 1, jurisdiccion: 3, perfil: 4, pep: 0 }, controls: [3, 2] },
  { code: 'EV-002', scores: { monto: 4, frecuencia: 3, producto: 4, canal: 3, jurisdiccion: 5, perfil: 4, pep: 5 }, controls: [2, 2] },
  { code: 'EV-003', scores: { monto: 1, frecuencia: 1, producto: 0, canal: 2, jurisdiccion: 0, perfil: 1, pep: 0 }, controls: [2] },
  { code: 'EV-004', scores: { monto: 2, frecuencia: 3, producto: 2, canal: 2, jurisdiccion: 2, perfil: 2, pep: 0 }, controls: [2, 2] },
  { code: 'EV-005', scores: { monto: 4, frecuencia: null, producto: 3, canal: 1, jurisdiccion: 1, perfil: null, pep: 0 }, controls: [2], aggravants: [6] },
];

const adjustments = (e: (typeof EVENTS)[number]) => [
  ...e.controls.map(points => ({ type: 'CONTROL', description: 'control', points })),
  ...(e.aggravants ?? []).map(points => ({ type: 'AGRAVANTE', description: 'agravante', points })),
];
const score = (code: string, weights: Weights = DEFAULT_WEIGHTS) => {
  const e = EVENTS.find(x => x.code === code)!;
  return computeScore(e.scores, adjustments(e), weights);
};

test('Prueba 1: el score de EV-002 se reproduce factor por factor', () => {
  const s = score('EV-002');
  assert.deepEqual(s.factors.map(f => f.contribution), [16, 9, 8, 6, 20, 12, 10]);
  assert.equal(s.inherent, 81);
  assert.equal(s.controls, 4);
  assert.equal(s.residual, 77);
  assert.equal(s.level, 'CRITICO');
});

test('Prueba 2: un escenario coherente por nivel (tablero del enunciado)', () => {
  const expected = { 'EV-001': [60, 55, 'ALTO'], 'EV-002': [81, 77, 'CRITICO'], 'EV-003': [14, 12, 'BAJO'], 'EV-004': [39, 35, 'MEDIO'] };
  for (const [code, [inherent, residual, level]] of Object.entries(expected)) {
    const s = score(code);
    assert.equal(s.inherent, inherent, `${code} inherente`);
    assert.equal(s.residual, residual, `${code} residual`);
    assert.equal(s.level, level, `${code} nivel`);
  }
});

test('Regla de dato faltante: puntaje conservador de 3 y marca visible (EV-005)', () => {
  const s = score('EV-005');
  assert.equal(s.missingCount, 2);
  assert.deepEqual(s.factors.filter(f => f.missing).map(f => [f.key, f.score]), [['frecuencia', 3], ['perfil', 3]]);
  assert.equal(s.inherent, 46);
  assert.equal(s.residual, 50); // 46 − 2 + 6
  assert.equal(s.level, 'ALTO');
});

test('Prueba 4: escenario B de sensibilidad (Monto 10 %, Jurisdicción 30 %) no cambia el orden', () => {
  const b: Weights = { ...DEFAULT_WEIGHTS, monto: 10, jurisdiccion: 30 };
  const inh = (w: Weights) => ['EV-001', 'EV-002', 'EV-003', 'EV-004'].map(c => score(c, w).inherent);
  assert.deepEqual(inh(DEFAULT_WEIGHTS), [60, 81, 14, 39]);
  assert.deepEqual(inh(b), [58, 83, 12, 39]);
});

test('Prueba 4: un escenario extremo sí cambia el orden (EV-004 supera a EV-005)', () => {
  const c: Weights = { monto: 5, frecuencia: 5, producto: 5, canal: 30, jurisdiccion: 40, perfil: 5, pep: 5 };
  c.pep = 100 - (c.monto + c.frecuencia + c.producto + c.canal + c.jurisdiccion + c.perfil);
  const order = (w: Weights) =>
    EVENTS.map(e => ({ code: e.code, i: score(e.code, w).inherent }))
      .sort((a, b) => b.i - a.i || a.code.localeCompare(b.code))
      .map(x => x.code);
  assert.deepEqual(order(DEFAULT_WEIGHTS), ['EV-002', 'EV-001', 'EV-005', 'EV-004', 'EV-003']);
  assert.notDeepEqual(order(c), order(DEFAULT_WEIGHTS));
});

test('Niveles: límites 24/25, 49/50 y 74/75', () => {
  assert.deepEqual([0, 24, 25, 49, 50, 74, 75, 100].map(levelFor),
    ['BAJO', 'BAJO', 'MEDIO', 'MEDIO', 'ALTO', 'ALTO', 'CRITICO', 'CRITICO']);
});

test('El residual se acota a 0..100', () => {
  const max: Scores = { monto: 5, frecuencia: 5, producto: 5, canal: 5, jurisdiccion: 5, perfil: 5, pep: 5 };
  const zero: Scores = { monto: 0, frecuencia: 0, producto: 0, canal: 0, jurisdiccion: 0, perfil: 0, pep: 0 };
  assert.equal(computeScore(max, [{ type: 'AGRAVANTE', description: 'x', points: 20 }], DEFAULT_WEIGHTS).residual, 100);
  assert.equal(computeScore(zero, [{ type: 'CONTROL', description: 'x', points: 10 }], DEFAULT_WEIGHTS).residual, 0);
});

test('El ranking ordena por residual y desempata por inherente y código', () => {
  const ranked = rank(EVENTS.map(e => ({ code: e.code, score: score(e.code) })));
  assert.deepEqual(ranked.map(e => e.code), ['EV-002', 'EV-001', 'EV-005', 'EV-004', 'EV-003']);
});
