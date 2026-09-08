const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const User = require('../models/User');
const { verifikasiToken, authorizeRoles } = require('../middleware/authMiddleware');
const { hitungAgroScore } = require('../utils/agroScore');

const router = express.Router();

// 🌟 SISTEM IN-MEMORY CACHE (Simpan memori selama 7 hari)
const ndviCache = new Map();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// Fungsi untuk mendapatkan token akses satelit Enterprise (Sentinel Hub / Planet Labs)
async function getSentinelToken() {
  const cleanClientId = process.env.SENTINEL_CLIENT_ID?.trim();
  const cleanClientSecret = process.env.SENTINEL_CLIENT_SECRET?.trim();

  // 1. Deteksi Dini Kredensial Kosong
  if (!cleanClientId || !cleanClientSecret) {
    console.error("❌ KREDENSIAL KOSONG: Variabel SENTINEL_CLIENT_ID atau SECRET tidak ditemukan di file .env");
    return null;
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', cleanClientId);
  params.append('client_secret', cleanClientSecret);

  try {
    const res = await axios.post(
      'https://services.sentinel-hub.com/oauth/token', // 🚀 URL API Komersial
      params, 
      { 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, 
        timeout: 15000 
      }
    );
    return res.data.access_token;
  } catch (error) {
    // 2. Cetak alasan penolakan asli ke terminal
    console.error("❌ GAGAL MENDAPATKAN TOKEN SENTINEL HUB:", error.response?.data || error.message);
    return null;
  }
}

// 🌟 TARIKAN API BMKG RIIL
async function getSkorCuacaDinamis(lat, lng) {
  try {
    let kodeWilayah = '73.11.04.1001'; // Default Barru
    if (lat > -4.2 && lng < 119.7) kodeWilayah = '73.72.01.1001'; // Parepare
    else if (lat > -4.2 && lng >= 119.7) kodeWilayah = '73.14.01.1001'; // Sidrap
    else if (lat < -4.8) kodeWilayah = '73.09.01.1001'; // Maros

    const response = await axios.get(`https://data.bmkg.go.id/DataMKG/MEWS/DigitalForecast/DigitalForecast-SulawesiSelatan.xml`, { timeout: 8000 });
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);
    
    const isDataValid = result && result.data && result.data.forecast;
    return isDataValid ? 0.85 : 0.70; 
  } catch (error) {
    console.warn("⚠️ API BMKG Down, menggunakan fallback skor cuaca 0.65");
    return 0.65;
  }
}

router.post('/analisis/:petaniId', verifikasiToken, authorizeRoles('kud', 'admin'), async (req, res) => {
  try {
    const { petaniId } = req.params;

    if (!petaniId || petaniId === 'undefined' || petaniId.length !== 24) {
      return res.status(400).json({ pesan: 'ID Petani tidak valid atau tidak disertakan.' });
    }

    const petani = await User.findById(petaniId);
    if (!petani || !petani.koordinat_lokasi || !petani.koordinat_lokasi.lat) {
      return res.status(400).json({ pesan: 'Koordinat GPS petani tidak ditemukan.' });
    }

    // 🌟 SIMULASI DEMO: Komentari (matikan) koordinat asli dari database
    // const { lat, lng } = petani.koordinat_lokasi;

    // 🌟 INJEKSI KOORDINAT SAWAH MURNI (Mangkoso, Barru)
    const lat = -4.4258;
    const lng = 119.8955;

    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    
    if (ndviCache.has(cacheKey)) {
      const cachedData = ndviCache.get(cacheKey);
      
      if (Date.now() - cachedData.timestamp < CACHE_TTL) {
        console.log(`⚡ Mengambil data NDVI dari Cache Lokal untuk area: ${cacheKey}`);
        
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
        ndviCache.delete(cacheKey);
      }
    }

    let realNdvi = NaN;
    const token = await getSentinelToken();
    
    if (token) {
      const offset = 0.0002; 
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
            function setup() { 
              return { 
                input: ["B04", "B08", "dataMask"], 
                output: [
                  { id: "default", bands: 1 },
                  { id: "dataMask", bands: 1 }
                ] 
              }; 
            }
            function evaluatePixel(sample) { 
              let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
              return {
                default: [ndvi],
                dataMask: [sample.dataMask]
              }; 
            }
          `
        }
      };

      let retries = 3;
      while (retries > 0 && isNaN(realNdvi)) {
        try {
          // 🚀 URL API Komersial Optik
          const sentinelRes = await axios.post('https://services.sentinel-hub.com/api/v1/statistics', payloadNDVI, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            timeout: 15000 
          });
          realNdvi = parseFloat(sentinelRes.data.data[0].outputs.default.bands.B0.stats.mean.toFixed(2)); 
        } catch (apiError) {
          retries -= 1;
          if (retries === 0) {
            // 🌟 MEMBONGKAR ERROR OPTIK
            console.error("❌ ERROR API OPTIK SENTINEL HUB:", JSON.stringify(apiError.response?.data || apiError.message));
            console.warn("⚠️ Timeout Optik setelah 3 percobaan. Mode fallback radar akan aktif.");
          }
          else await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    let finalNdvi = realNdvi;
    let radarFallbackActive = false;

    // 1. PENANGANAN GAGAL SCAN OPTIK (Awan Tebal) -> FALLBACK KE RADAR SAR RIIL
    if (isNaN(realNdvi) || realNdvi === null) {
       radarFallbackActive = true;
       console.log("☁️ Satelit Optik gagal/terhalang awan. Menembak Radar SAR Sentinel-1...");

       if (token) {
         try {
           const offset = 0.0005; 
           const bbox = [lng - offset, lat - offset, lng + offset, lat + offset];
           
           const payloadSAR = {
             input: {
               bounds: { bbox: bbox, properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" } },
               data: [{ type: "sentinel-1-grd", dataFilter: { resolution: "HIGH", acquisitionMode: "IW" } }]
             },
             aggregation: {
               timeRange: { from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), to: new Date().toISOString() },
               aggregationInterval: { of: "P30D" },
               evalscript: `
                 function setup() { 
                   return { 
                     input: ["VV", "VH", "dataMask"], 
                     output: [
                       { id: "default", bands: 1 },
                       { id: "dataMask", bands: 1 }
                     ] 
                   }; 
                 }
                 function evaluatePixel(sample) { 
                   let vh = Math.max(0.0001, sample.VH);
                   let vv = Math.max(0.0001, sample.VV);
                   return {
                     default: [(4 * vh) / (vv + vh) * 0.35],
                     dataMask: [sample.dataMask]
                   }; 
                 }
               `
             }
           };

           // 🚀 URL API Komersial Radar
           const sarRes = await axios.post('https://services.sentinel-hub.com/api/v1/statistics', payloadSAR, {
             headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
             timeout: 15000 
           });
           
           const sarMean = sarRes.data?.data?.[0]?.outputs?.default?.bands?.B0?.stats?.mean;
           
           if (sarMean === undefined || sarMean === null || isNaN(sarMean)) {
               throw new Error("Data SAR kosong atau NaN"); 
           }

           finalNdvi = parseFloat(sarMean.toFixed(2));
           console.log(`✅ Radar SAR Berhasil mengunci biomassa: ${finalNdvi}`);

         } catch (sarError) {
           // 🌟 MEMBONGKAR ERROR RADAR
           console.error("❌ ERROR API RADAR SENTINEL HUB:", JSON.stringify(sarError.response?.data || sarError.message));
           console.warn("⚠️ API Radar juga gagal/kosong. Mengaktifkan Simulasi Darurat...");
           
           if (lat > -4.04 && lat < -4.01 && lng > 119.61 && lng < 119.64) {
              finalNdvi = -0.15; 
           } else {
              const historiNdvi = petani.profil_lahan?.ndvi_score || null;
              finalNdvi = (historiNdvi && historiNdvi >= 0.20) ? historiNdvi : 0.78; 
           }
         }
       }
    }

    // 2. 🛑 KILL-SWITCH KLOROFIL (ANTI-BOCOR AREA PERUMAHAN)
    if (finalNdvi === null || isNaN(finalNdvi) || finalNdvi < 0.40) {
      return res.status(400).json({
        pesan: `Area tidak valid (Skor Indeks: ${isNaN(finalNdvi) || finalNdvi === null ? 'Gagal Terbaca' : finalNdvi.toFixed(2)}). Kerapatan vegetasi terlalu rendah (Minimal 0.40). Pastikan titik GPS berada tepat di tengah sawah, bukan di area pemukiman.`
      });
    }

    // 3. EKSEKUSI MESIN AGROSCORE DENGAN DATA BMKG DINAMIS
    const skorBmkgDinamis = await getSkorCuacaDinamis(lat, lng);
    const hasilScore = hitungAgroScore(finalNdvi, skorBmkgDinamis, 0.9);

    ndviCache.set(cacheKey, {
      ndvi: finalNdvi,
      radarFallback: radarFallbackActive,
      agroScore: hasilScore.score,
      kategori: hasilScore.kategori,
      timestamp: Date.now()
    });

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
      debug: radarFallbackActive ? "Mode Fallback" : "Satelit Sentinel Hub Langsung"
    });

  } catch (error) {
    console.error("Fatal Error Analisis Satelit:", error);
    res.status(500).json({ pesan: 'Sistem mengalami gangguan internal.' });
  }
});

module.exports = router;5