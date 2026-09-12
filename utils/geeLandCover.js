// utils/geeLandCover.js
const { ee, initGEE } = require('./geeService');

async function getLandCoverGEE(lat, lng) {
  await initGEE();
  
  return new Promise((resolve, reject) => {
    try {
      const point = ee.Geometry.Point([lng, lat]);
      
      // Menggunakan ESA WorldCover 10m v200 (Dataset Tutupan Lahan Global)
      const worldCover = ee.ImageCollection('ESA/WorldCover/v200').first();

      // Ambil sampel nilai tutupan lahan pada titik GPS
      const sample = worldCover.sample({
        region: point,
        scale: 10,
        geometries: false
      });

      sample.evaluate((result, err) => {
        if (err) return reject(err);
        
        if (!result || result.features.length === 0) {
          return resolve(null); // Gagal membaca titik
        }
        
        // Mengambil kode tutupan lahan
        const kode = result.features[0].properties.Map;
        resolve(kode);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function labelLandCover(kode) {
  const labels = {
    10: 'Hutan / Area Berpohon',
    20: 'Semak Belukar',
    30: 'Padang Rumput',
    40: 'Lahan Pertanian',
    50: 'Pemukiman / Bangunan', // Ini kode untuk Kos-kosan
    60: 'Tanah Gundul / Terbuka', // Ini bisa jadi sawah kering
    70: 'Salju / Es',
    80: 'Badan Air (Sungai/Danau)',
    90: 'Lahan Basah / Rawa',
    95: 'Mangrove',
    100: 'Lumut'
  };
  return labels[kode] || `Tidak dikenal (${kode})`;
}

module.exports = { getLandCoverGEE, labelLandCover };