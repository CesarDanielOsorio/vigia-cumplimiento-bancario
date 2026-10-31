import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Role } from '@prisma/client';
import { PERMISSIONS, can, permissionsOf, type Permission } from './permissions';

const ALL = Object.keys(PERMISSIONS) as Permission[];

test('Una sola A: solo el Auditor/QA aprueba versiones y cierra incidencias', () => {
  for (const p of ['weights.approve', 'incidents.close'] as Permission[]) {
    assert.deepEqual(PERMISSIONS[p].roles, ['AUDITOR'], p);
  }
});

test('El administrador ve y configura todo, pero no aprueba', () => {
  const admin = permissionsOf('ADMIN');
  assert.ok(admin.includes('system.manage'));
  assert.ok(admin.includes('audit.view'));
  assert.ok(!can('ADMIN', 'weights.approve'));
  assert.ok(!can('ADMIN', 'incidents.close'));
});

test('Segregación: nadie puede proponer y aprobar la misma versión', () => {
  for (const role of Object.values(Role)) {
    assert.ok(!(can(role, 'weights.propose') && can(role, 'weights.approve')), role);
  }
});

test('Cada corrección del RACI la ejecuta el rol que indica la causa', () => {
  assert.ok(can('ANALISTA_RIESGO', 'incidents.correct.CAPTURA'));
  assert.ok(can('ANALISTA_DATOS', 'incidents.correct.REGLA'));
  assert.ok(can('DESARROLLADOR_BI', 'incidents.correct.CALCULO'));
  assert.ok(!can('ANALISTA_RIESGO', 'incidents.correct.CALCULO'));
  assert.ok(!can('AUDITOR', 'incidents.correct.CAPTURA'));
});

test('Mínimo privilegio: solo el administrador gestiona usuarios y sincroniza listas', () => {
  for (const p of ['system.manage', 'lists.sync'] as Permission[]) {
    assert.deepEqual(PERMISSIONS[p].roles, ['ADMIN'], p);
  }
});

test('Todo permiso está asignado al menos a un rol', () => {
  for (const p of ALL) assert.ok(PERMISSIONS[p].roles.length > 0, p);
});
