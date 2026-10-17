// Casos límit de E1: el que NO s'ha de detectar i formats alternatius.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectRules } from '../../src/lib/pii-rules.js';

const types = (t) => detectRules(t).map((e) => `${e.type}:${e.text}`);

test('DNI amb lletra incorrecta no es detecta', () => {
  assert.deepEqual(types('DNI 12345678A'), []);
  assert.deepEqual(types('DNI 12345678Z'), ['DNI:12345678Z']);
  assert.deepEqual(types('DNI 12345678-Z'), ['DNI:12345678-Z']);
});

test('IBAN amb control incorrecte no es detecta', () => {
  assert.deepEqual(types('IBAN ES91 2100 0418 4502 0005 1333'), []);
  assert.deepEqual(types('IBAN ES9121000418450200051332'), ['IBAN:ES9121000418450200051332']);
});

test('imports, dates i números de factura no són telèfons ni codis postals', () => {
  assert.deepEqual(types('Total: 1.337,05 € el 15/01/2026, factura FCR-2026-0042'), []);
  assert.deepEqual(types('Hi van venir 12345 persones'), []);
  assert.deepEqual(types('Referència 612345678901'), []);
});

test('telèfons en diversos formats', () => {
  assert.deepEqual(types('Truca al +34 612 34 56 78 o al 0034 931234567'), ['TEL:+34 612 34 56 78', 'TEL:0034 931234567']);
  assert.deepEqual(types('Mòbil 699.12.34.56'), ['TEL:699.12.34.56']);
});

test('codi postal amb context', () => {
  assert.deepEqual(types('C.P. 08001'), ['CP:08001']);
  assert.deepEqual(types('Carrer Gran, 5, 08001 Barcelona'), ['CP:08001']);
  assert.deepEqual(types('El 08001 Barcelona'), []);
});

test('el telèfon dins un IBAN no es compta dues vegades', () => {
  assert.deepEqual(types('ES82 9000 0101 6612 3456 7890'), ['IBAN:ES82 9000 0101 6612 3456 7890']);
});
