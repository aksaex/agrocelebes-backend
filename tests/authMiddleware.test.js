const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const verifikasiToken = require('../middleware/authMiddleware');

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
  const req = { header: () => 'Bearer token_palsu_123' };
  const res = {
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.body = data; }
  };
  const next = () => { throw new Error('Harusnya tidak memanggil next()'); };
  
  process.env.JWT_SECRET = 'rahasia_negara';

  verifikasiToken(req, res, next);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.pesan, 'Token tidak valid!');
});