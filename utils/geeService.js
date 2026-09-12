// utils/geeService.js
const ee = require('@google/earthengine');
const path = require('path');

let isInitialized = false;

async function initGEE() {
  if (isInitialized) {
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      let privateKey;

      // CEK APAKAH BERJALAN DI VERCEL ATAU LOKAL
      if (process.env.GOOGLE_CREDENTIALS) {
        // Mode Produksi (Vercel): Ambil dari satu Environment Variable dan parse
        console.log("☁️ Menggunakan kredensial GEE dari Environment Vercel (GOOGLE_CREDENTIALS)");
        try {
          // Parsing string JSON kembali menjadi objek JavaScript
          privateKey = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        } catch (parseError) {
           console.error("❌ Gagal mem-parsing GOOGLE_CREDENTIALS dari Vercel:", parseError);
           return reject(new Error("Format JSON di Environment Vercel salah."));
        }
      } else {
        // Mode Lokal (Komputer Anda): Ambil dari file JSON fisik
        console.log("💻 Menggunakan kredensial GEE dari file lokal");
        try {
            privateKey = require(path.join(__dirname, '..', 'agrocelebes-06a369b69250.json'));
        } catch (fileError) {
             console.error("❌ File JSON lokal tidak ditemukan!", fileError);
             return reject(new Error("File kredensial lokal tidak ditemukan."));
        }
      }

      // 2. Lakukan Autentikasi dengan kunci yang sudah valid
      ee.data.authenticateViaPrivateKey(
        privateKey,
        () => {
          // 3. Inisialisasi
          ee.initialize(
            null, null,
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
      console.error('❌ [GEE Service] Terjadi kesalahan sistem saat memuat kredensial.', error);
      reject(error);
    }
  });
}

module.exports = { ee, initGEE };