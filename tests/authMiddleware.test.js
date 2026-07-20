const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');
const verifikasiToken = authMiddleware.verifikasiToken || authMiddleware;
const { authorizeRoles } = authMiddleware;

test('[Middleware Autentikasi] Menolak akses jika token tidak ada', () => {
  const req = { header: () => null }; 
  const res = {
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.body = data; }
  };
  const next = () => { throw new Error('Harusnya tidak memanggil next()'); };

  verifikasiToken(req, res, next);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.pesan, 'Akses ditolak! Token tidak ditemukan.');
});

test('[Middleware Autentikasi] Menolak token JWT yang tidak valid', () => {
  const req = { headers: { authorization: 'Bearer token_palsu_123' } };
  const res = {
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.body = data; }
  };
  const next = () => { throw new Error('Harusnya tidak memanggil next()'); };
  
  process.env.JWT_SECRET = 'rahasia_negara';

  verifikasiToken(req, res, next);
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.pesan, 'Token tidak valid.');
});

test('[Middleware RBAC] Menolak role yang tidak diizinkan', () => {
  const req = { user: { role: 'petani' } };
  const res = {
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.body = data; }
  };
  const next = () => { throw new Error('Harusnya tidak memanggil next()'); };

  authorizeRoles('kud', 'admin')(req, res, next);

  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.pesan, 'Akses ditolak! Role Anda tidak diizinkan.');
});

test('[Middleware RBAC] Mengizinkan role yang sesuai', () => {
  const req = { user: { role: 'kud' } };
  const res = {
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.body = data; }
  };
  let called = false;
  const next = () => { called = true; };

  authorizeRoles('kud', 'admin')(req, res, next);

  assert.strictEqual(called, true);
  assert.strictEqual(res.statusCode, undefined);
});