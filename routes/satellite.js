// routes/satellite.js
const express = require('express');
const xml2js = require('xml2js'); 
const axios = require('axios');   
const User = require('../models/User');
const { verifikasiToken, authorizeRoles } = require('../middleware/authMiddleware');
const { hitungAgroScore } = require('../utils/agroScore');

// IMPORT UTILITAS GEE & CLOUDINARY
const { hitungNdviSatelit } = require('../utils/geeNdvi');
const { labelLandCover } = require('../utils/geeLandCover');
const { cloudinary } = require('../config/cloudinary'); // Pastikan path ini sesuai dengan file konfigurasi Anda

const router = express.Router();

// Cache
const ndviCache = new Map();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// ================== HELPER: CLOUDINARY UPLOADER ==================
async function uploadGeeImageToCloudinary(geeImageUrl, petaniId) {
  try {
      if (!geeImageUrl) return null;

      const response = await axios.get(geeImageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);

      const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
              {
                  folder: 'agrocelebes_satelit_sawah',
                  public_id: `sawah_${petaniId}_${Date.now()}`,
                  resource_type: 'image'
              },
              (error, result) => {
                  if (error) reject(error);
                  else resolve(result);
              }
          );
          stream.end(buffer);
      });

      console.log("✅ Gambar satelit berhasil disimpan permanen ke Cloudinary:", uploadResult.secure_url);
      return uploadResult.secure_url; 
  } catch (err) {
      console.error("⚠️ Gagal mengunggah gambar satelit ke Cloudinary:", err.message);
      return geeImageUrl; // Fallback ke URL GEE jika gagal upload
  }
}

// ================== HELPER: BMKG RIIL ==================
async function getSkorCuacaDinamis(lat, lng) {
  try {
    let kodeWilayah = '73.11.04.1001'; 
    if (lat > -4.2 && lng < 119.7) kodeWilayah = '73.72.01.1001'; 
    else if (lat > -4.2 && lng >= 119.7) kodeWilayah = '73.14.01.1001'; 
    else if (lat < -4.8) kodeWilayah = '73.09.01.1001'; 

    const response = await axios.get(
      'https://data.bmkg.go.id/DataMKG/MEWS/DigitalForecast/DigitalForecast-SulawesiSelatan.xml',
      { timeout: 8000 }
    );
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(response.data);

    const areas = result?.data?.forecast?.area;
    const areaList = Array.isArray(areas) ? areas : [areas];
    const targetArea = areaList.find(a => a?.$.id === kodeWilayah) || areaList[0];

    if (!targetArea?.parameter) return 0.60;

    const params = Array.isArray(targetArea.parameter) ? targetArea.parameter : [targetArea.parameter];
    const rainParam = params.find(p => p?.$.id === 'rain');

    let rainValues = [];
    if (rainParam?.timerange) {
      const timers = Array.isArray(rainParam.timerange) ? rainParam.timerange : [rainParam.timerange];
      rainValues = timers.slice(0, 3).map(tr => {
        const val = tr?.value;
        const v = Array.isArray(val) ? val[0] : val;
        return parseFloat(v?._ || v);
      }).filter(v => !isNaN(v));
    }

    let avgRain = rainValues.length > 0 ? rainValues.reduce((a, b) => a + b, 0) / rainValues.length : 5;

    let skor;
    if (avgRain >= 5 && avgRain <= 20) skor = 0.95;
    else if (avgRain > 20 && avgRain <= 40) skor = 0.75;
    else if (avgRain > 40) skor = 0.45;
    else if (avgRain >= 1 && avgRain < 5) skor = 0.70;
    else skor = 0.40;

    console.log(`🌤️ BMKG ${kodeWilayah}: curah hujan rata-rata ${avgRain.toFixed(1)} mm/hari → skor ${skor}`);
    return skor;
  } catch (error) {
    console.warn("⚠️ API BMKG gagal:", error.message, "— pakai fallback 0.55");
    return 0.55;
  }
}

// ================== ENDPOINT UTAMA ==================
router.post('/analisis/:petaniId', verifikasiToken, authorizeRoles('kud', 'admin'), async (req, res) => {
  try {
    const { petaniId } = req.params;

    if (!petaniId || petaniId === 'undefined' || petaniId.length !== 24) {
      return res.status(400).json({ pesan: 'ID Petani tidak valid.' });
    }

    const petani = await User.findById(petaniId);
    if (!petani?.koordinat_lokasi?.lat) {
      return res.status(400).json({ pesan: 'Koordinat GPS petani tidak ditemukan.' });
    }

    // 1. Koordinat Asli & Validasi Wilayah
    const { lat, lng } = petani.koordinat_lokasi;

    if (lat < -11 || lat > 6 || lng < 95 || lng > 141) {
      return res.status(400).json({ pesan: '❌ Koordinat di luar wilayah Indonesia.' });
    }
    if (lat < -6 || lat > -2 || lng < 118 || lng > 121) {
      return res.status(400).json({
        pesan: '❌ Layanan verifikasi satelit saat ini hanya untuk wilayah Sulawesi Selatan.'
      });
    }

    // 2. Cek Cache
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (ndviCache.has(cacheKey)) {
      const cached = ndviCache.get(cacheKey);
      
      if ((Date.now() - cached.timestamp < CACHE_TTL) && cached.gambar_sawah) {
        console.log(`⚡ Cache hit: ${cacheKey}`);
        petani.profil_lahan = {
          ...petani.profil_lahan,
          ndvi_score: cached.ndvi,
          agro_score_final: cached.agroScore,
          agro_kategori: cached.kategori,
          land_cover_kode: cached.landCoverKode,
          gambar_sawah: cached.gambar_sawah,
          last_verified: new Date()
        };
        await petani.save();
        return res.json({
          pesan: `✅ Pemindaian dari cache`,
          status_lahan: cached.statusVegetasi,
          ndvi: cached.ndvi,
          satelit: 'Sentinel-2 (Cache)',
          land_cover_label: labelLandCover(cached.landCoverKode),
          agro_score: cached.agroScore,
          kategori: cached.kategori,
          koordinat: { lat, lng },
          gambar_sawah: cached.gambar_sawah,
          debug: 'Cache Lokal'
        });
      }
      
      ndviCache.delete(cacheKey);
    }

    // 3. TUTUPAN LAHAN DIMATIKAN SEMENTARA - GUNAKAN DEFAULT
    console.log(`🔍 Bypass pengecekan tutupan lahan. Setel default ke 40 (Lahan Pertanian).`);
    const landCoverKode = 40; 

    // 4. HITUNG NDVI
    console.log(`📡 Memulai pemindaian NDVI via Google Earth Engine...`);
    const hasilSatelit = await hitungNdviSatelit(lat, lng);

    if (!hasilSatelit.tersedia) {
      return res.status(503).json({
        pesan: `⚠️ ${hasilSatelit.pesan || 'Satelit tidak dapat memindai lahan saat ini.'} Kemungkinan karena awan tebal. Silakan coba lagi dalam 2-3 hari.`,
        status: 'gagal_teknis'
      });
    }

    const finalNdvi = hasilSatelit.ndvi;
    const urlGeeSementara = hasilSatelit.gambar_url; 
    console.log(`✅ GEE NDVI: ${finalNdvi}`);

    // 🌟 UPLOAD KE CLOUDINARY AGAR PERMANEN
    console.log("☁️ Mengamankan gambar satelit ke Cloudinary...");
    const urlGambarPermanen = await uploadGeeImageToCloudinary(urlGeeSementara, petaniId);

    // 5. LOGIKA BARU: TOLERANSI SAWAH KERING
    let statusVegetasi = 'Aktif Tumbuh';
    if (finalNdvi < 0.20) {
      statusVegetasi = 'Pasca Panen / Lahan Kering';
      console.log(`ℹ️ Lahan terdeteksi sedang masa istirahat/kering (NDVI: ${finalNdvi}).`);
    }

    // 6. HITUNG AGROSCORE
    const skorBmkg = await getSkorCuacaDinamis(lat, lng);
    const hasilScore = hitungAgroScore(finalNdvi, skorBmkg, 0.9);

    // 7. Simpan ke Cache
    ndviCache.set(cacheKey, {
      ndvi: finalNdvi,
      agroScore: hasilScore.score,
      kategori: hasilScore.kategori,
      landCoverKode: landCoverKode,
      statusVegetasi: statusVegetasi,
      gambar_sawah: urlGambarPermanen, 
      timestamp: Date.now()
    });

    // 8. Simpan ke Database
    petani.profil_lahan = {
      ...petani.profil_lahan,
      ndvi_score: finalNdvi,
      agro_score_final: hasilScore.score,
      agro_kategori: hasilScore.kategori,
      land_cover_kode: landCoverKode,
      gambar_sawah: urlGambarPermanen, 
      last_verified: new Date(),
      koordinat_verified: { lat, lng }
    };
    await petani.save();
    
    console.log("📦 SIAP MENGIRIM DATA KE FRONTEND!");
    console.log("URL Gambar yang dikirim:", urlGambarPermanen);

    res.json({
      pesan: `✅ Verifikasi berhasil. Lahan valid.`,
      status_lahan: statusVegetasi,
      ndvi: finalNdvi,
      satelit: 'Sentinel-2 (Google Earth Engine & Cloudinary)',
      land_cover_label: 'Lahan Pertanian (Mock)',
      agro_score: hasilScore.score,
      kategori: hasilScore.kategori,
      koordinat: { lat, lng },
      gambar_sawah: urlGambarPermanen 
    });

  } catch (error) {
    console.error("💥 Fatal Error Analisis Satelit (GEE):", error);
    res.status(500).json({ pesan: 'Sistem mengalami gangguan internal saat menghubungi satelit.' });
  }
});

module.exports = router;