// utils/geeService.js
const ee = require('@google/earthengine');
const path = require('path');

// Inisialisasi GEE hanya dilakukan sekali (singleton pattern)
let isInitialized = false;

async function initGEE() {
  if (isInitialized) {
    return; // Jika sudah inisialisasi, lewati
  }

  return new Promise((resolve, reject) => {
    try {
      // 1. Arahkan ke file JSON kredensial Anda
      // Sesuaikan nama file jika Anda mengubahnya
      const privateKey = require(path.join(__dirname, '..', 'agrocelebes-06a369b69250.json'));

      // 2. Lakukan Autentikasi
      ee.data.authenticateViaPrivateKey(
        privateKey,
        () => {
          // 3. Jika autentikasi berhasil, inisialisasi modul Earth Engine
          ee.initialize(
            null,
            null,
            () => {
              console.log('✅ [GEE Service] Berhasil terhubung ke Google Earth Engine');
              isInitialized = true;
              resolve();
            },
            (err) => {
              console.error('❌ [GEE Service] Gagal inisialisasi GEE:', err);
              reject(new Error('Gagal inisialisasi GEE: ' + err));
            }
          );
        },
        (err) => {
          console.error('❌ [GEE Service] Gagal autentikasi *private key* GEE:', err);
          reject(new Error('Gagal autentikasi GEE: ' + err));
        }
      );
    } catch (error) {
      console.error('❌ [GEE Service] Gagal memuat file JSON kredensial. Pastikan path file benar.', error);
      reject(error);
    }
  });
}

module.exports = { ee, initGEE };