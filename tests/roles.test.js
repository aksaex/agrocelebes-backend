const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRole, isValidRole, VALID_ROLES } = require('../utils/roles');

test('[Roles] Menormalkan role pembeli menjadi kud', () => {
  assert.strictEqual(normalizeRole('pembeli'), 'kud');
});

test('[Roles] Menormalkan role dengan spasi dan kapital', () => {
  assert.strictEqual(normalizeRole('  PaBrIk  '), 'pabrik');
});

test('[Roles] Role valid untuk petani', () => {
  assert.strictEqual(isValidRole('petani'), true);
});

test('[Roles] Role tidak valid ditolak', () => {
  assert.strictEqual(isValidRole('superadmin'), false);
});

test('[Roles] Daftar role valid memuat seluruh role inti', () => {
  assert.deepStrictEqual(VALID_ROLES, ['petani', 'kud', 'pabrik', 'kios', 'admin']);
});