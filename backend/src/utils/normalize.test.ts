import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixMojibake, normalize, sortKey } from './normalize';

test('normalize ignora tildes, mayúsculas y puntuación', () => {
  assert.equal(normalize('José Pérez, S.A.'), 'JOSE PEREZ SA');
  assert.equal(normalize('ĐOÀN ANH DŨNG'), 'DOAN ANH DUNG');
  assert.equal(normalize('Straße GmbH'), 'STRASSE GMBH');
});

test('sortKey: letras A-Z, luego otros alfabetos, números y símbolos', () => {
  const names = ['#1 MARKETING', '1 BEST CARE', 'Жаннат', 'Zeta SA', 'Alfa SA', 'Élan SA'];
  const sorted = [...names].sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));
  assert.deepEqual(sorted, ['Alfa SA', 'Élan SA', 'Zeta SA', 'Жаннат', '1 BEST CARE', '#1 MARKETING']);
});

test('fixMojibake repara doble codificación y no toca nombres válidos', () => {
  const broken = Buffer.from('宮崎', 'utf8').toString('latin1');
  assert.equal(fixMojibake(broken), '宮崎');
  assert.equal(fixMojibake('José Pérez'), 'José Pérez');
});
