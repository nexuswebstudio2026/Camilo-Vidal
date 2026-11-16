import test from 'node:test';
import assert from 'node:assert/strict';
import { inferSectionFromCategory, validatePoliticalRecordInput } from './records';

test('validatePoliticalRecordInput accepts valid record and sanitizes angle brackets', () => {
  const res = validatePoliticalRecordInput({
    category: 'Presidencia JAC',
    title: 'Gestión comunitaria <script>',
    period: 'Julio de 2022',
    status: 'Confirmado',
    detail: 'Detalle válido con más de diez caracteres.',
    visibility: 'publica',
    sort_order: 45,
  });

  assert.equal(res.ok, true);
  assert.equal(res.data?.title, 'Gestión comunitaria script');
  assert.equal(res.data?.section, 'presidente_jac');
  assert.equal(res.data?.visibility, 'publica');
});

test('validatePoliticalRecordInput rejects missing required fields', () => {
  const res = validatePoliticalRecordInput({
    category: '',
    title: 'ab',
    period: '',
    status: '',
    detail: 'corto',
    visibility: 'otra',
    sort_order: -1,
  });

  assert.equal(res.ok, false);
  assert.ok(res.errors?.title);
  assert.ok(res.errors?.period);
  assert.ok(res.errors?.detail);
  assert.ok(res.errors?.visibility);
  assert.ok(res.errors?.sort_order);
});

test('inferSectionFromCategory maps categories accurately', () => {
  assert.equal(inferSectionFromCategory('Secretaría JAC'), 'secretario_jac');
  assert.equal(inferSectionFromCategory('Proyecto Nexus Web Studio'), 'proyecto_nexus');
  assert.equal(inferSectionFromCategory('Proyección futura como edil'), 'proyeccion_edil');
});
