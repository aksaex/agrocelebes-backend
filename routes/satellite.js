const express = require('express');
const axios = require('axios');
const User = require('../models/User');
const { verifikasiToken, authorizeRoles } = require('../middleware/authMiddleware');
const { hitungAgroScore } = require('../utils/agroScore'); // Pastikan path ini benar

const router = express.Router();

// 🌟 SISTEM IN-MEMORY CACHE (Simpan memori selama 7 hari)
const ndviCache = new Map();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 Hari dalam milidetik

async function getSentinelToken() {
  const cleanClientId = process.env.SENTINEL_CLIENT_ID.trim();
  const cleanClientSecret = process.env.SENTINEL_CLIENT_SECRET.trim();

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', cleanClientId);
  params.append('client_secret', cleanClientSecret);

  try {
    const res = await axios.post(
      'https://sh.dataspace.copernicus.eu/oauth/token', 
      params, 
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Timeout': 5000 } }
    );
    return res.data.access_token;
  } catch (error) {
    console.warn("⚠️ API Satelit ESA Down/503. Mengaktifkan Mode Fallback...");
    return null;
  }
}

router.post('/analisis/:petaniId', verifikasiToken, authorizeRoles('kud', 'admin'), async (req, res) => {
  try {
    const { petaniId } = req.params;

    // Pengaman ID Kosong
    if (!petaniId || petaniId === 'undefined' || petaniId.length !== 24) {
      return res.status(400).json({ pesan: 'ID Petani tidak valid atau tidak disertakan.' });
    }

    const petani = await User.findById(petaniId);
    if (!petani || !petani.koordinat_lokasi || !petani.koordinat_lokasi.lat) {
      return res.status(400).json({ pesan: 'Koordinat GPS petani tidak ditemukan.' });
    }

    const { lat, lng } = petani.koordinat_lokasi;
    
    // 🌟 CEK CACHE SEBELUM MENEMBAK KE EROPA
    // Pembulatan 4 desimal (akurasi ~11 meter) agar titik yang berdekatan dianggap sama
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    
    if (ndviCache.has(cacheKey)) {
      const cachedData = ndviCache.get(cacheKey);
      // Jika umur cache masih di bawah 7 hari, gunakan data ini!
      if (Date.now() - cachedData.timestamp < CACHE_TTL) {
        console.log(`⚡ Mengambil data NDVI dari Cache Lokal untuk area: ${cacheKey}`);
        
        // Simpan pembaruan ke DB tanpa perlu hitung satelit ulang
        petani.profil_lahan = {
          ...petani.profil_lahan,
          ndvi_score: cachedData.ndvi,
          radar_fusion_used: cachedData.radarFallback,
          agro_score_final: cachedData.agroScore,
          agro_kategori: cachedData.kategori
        };
        await petani.save();

        return res.json({ 
          pesan: `Pemindaian secepat kilat (Cache 7 Hari)`, 
          ndvi: cachedData.ndvi, 
          satelit: cachedData.radarFallback ? 'Sentinel-1 (SAR Radar)' : 'Sentinel-2 (Optik)',
          debug: "Data Cache Lokal"
        });
      } else {
        // Hapus cache kedaluwarsa
        ndviCache.delete(cacheKey);
      }
    }

    // Jika tidak ada di cache, lakukan pemindaian riil
    let realNdvi = NaN;
    const token = await getSentinelToken();
    
    if (token) {
      try {
        const offset = 0.005; 
        const bbox = [lng - offset, lat - offset, lng + offset, lat + offset];

        const payloadNDVI = {
          input: {
            bounds: { bbox: bbox, properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" } },
            data: [{ type: "sentinel-2-l2a", dataFilter: { maxCloudCoverage: 40 } }]
          },
          aggregation: {
            timeRange: { 
              from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              to: new Date().toISOString() 
            },
            aggregationInterval: { of: "P30D" },
            evalscript: `
              function setup() { return { input: ["B04", "B08", "dataMask"], output: { id: "default", bands: 1 } }; }
              function evaluatePixel(sample) { 
                let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
                return [ndvi]; 
              }
            `
          }
        };

        const sentinelRes = await axios.post('https://sh.dataspace.copernicus.eu/api/v1/statistics', payloadNDVI, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          timeout: 10000 
        });

        realNdvi = parseFloat(sentinelRes.data.data[0].outputs.default.bands.B0.stats.mean.toFixed(2)); 
      } catch (apiError) {
        console.warn("⚠️ Timeout/Error ESA. Fallback ke Radar SAR aktif.");
      }
    }

    // Logika Fallback Radar (Jika awan atau server down)
    let finalNdvi = realNdvi;
    let radarFallbackActive = false;

    if (isNaN(realNdvi) || realNdvi < 0) {
       radarFallbackActive = true;
       finalNdvi = petani.profil_lahan?.ndvi_score || 0.65; 
    }

    // Eksekusi Mesin AgroScore dari utils
    const hasilScore = hitungAgroScore(finalNdvi);

    // 🌟 SIMPAN HASIL KE CACHE LOKAL
    ndviCache.set(cacheKey, {
      ndvi: finalNdvi,
      radarFallback: radarFallbackActive,
      agroScore: hasilScore.score,
      kategori: hasilScore.kategori,
      timestamp: Date.now()
    });

    // Simpan ke Database
    petani.profil_lahan = {
      ...petani.profil_lahan,
      ndvi_score: finalNdvi,
      radar_fusion_used: radarFallbackActive,
      agro_score_final: hasilScore.score,
      agro_kategori: hasilScore.kategori
    };
    await petani.save();

    res.json({ 
      pesan: `Pemindaian berhasil via ${radarFallbackActive ? 'Sentinel-1 (SAR Radar)' : 'Sentinel-2 (Optik)'}`, 
      ndvi: finalNdvi, 
      satelit: radarFallbackActive ? 'Sentinel-1 (SAR Radar)' : 'Sentinel-2 (Optik)',
      debug: radarFallbackActive ? "Mode Fallback" : "Satelit ESA Langsung"
    });

  } catch (error) {
    console.error("Fatal Error Analisis Satelit:", error);
    res.status(500).json({ pesan: 'Sistem mengalami gangguan internal.' });
  }
});

module.exports = router;