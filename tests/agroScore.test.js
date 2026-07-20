const test = require('node:test');
const assert = require('node:assert/strict');
const { hitungAgroScore } = require('../utils/agroScore');

test('[AgroScore] Menghitung skor dasar dengan benar', () => {
  assert.strictEqual(hitungAgroScore({ luasLahanHa: 2, cuacaScore: 2, riwayatJurnalScore: 2 }), 80);
});

test('[AgroScore] Menangani nilai string angka', () => {
  assert.strictEqual(hitungAgroScore({ luasLahanHa: '3', cuacaScore: '1', riwayatJurnalScore: '2' }), 60);
});

test('[AgroScore] Mengembalikan 0 jika input negatif menghasilkan skor rendah', () => {
  assert.strictEqual(hitungAgroScore({ luasLahanHa: -1, cuacaScore: 1, riwayatJurnalScore: 1 }), 0);
});

test('[AgroScore] Membatasi skor maksimum di 100', () => {
  assert.strictEqual(hitungAgroScore({ luasLahanHa: 20, cuacaScore: 20, riwayatJurnalScore: 20 }), 100);
});

test('[AgroScore] Memakai nilai default saat input kosong', () => {
  assert.strictEqual(hitungAgroScore({}), 0);
});