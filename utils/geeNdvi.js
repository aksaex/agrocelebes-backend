const { ee, initGEE } = require('./geeService');

async function hitungNdviSatelit(lat, lng) {
    await initGEE();

    return new Promise((resolve, reject) => {
        try {
            const point = ee.Geometry.Point([lng, lat]);
            
            // 🌟 1. AREA VISUAL (LUAS): Radius 1000 meter untuk foto agar tajam dan menangkap konteks sekitar
            const visualArea = point.buffer(1000); 

            // 🌟 2. AREA DATA (SEMPIT): Radius 30 meter untuk perhitungan NDVI agar akurat di lahan petani saja
            const ndviArea = point.buffer(30);

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 60);

            // Filter menggunakan visualArea agar gambar mencakup wilayah luas
            const imageCollection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                .filterBounds(visualArea)
                .filterDate(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0])
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30));

            imageCollection.size().evaluate(async (size) => {
                if (size === 0) {
                    return resolve({ ndvi: null, tersedia: false, pesan: "Tidak ada citra bebas awan dalam 60 hari terakhir." });
                }

                const bestImage = imageCollection.sort('system:time_start', false).first();

                // Visualisasi True Color
                const visualImage = bestImage.visualize({
                    bands: ['B4', 'B3', 'B2'],
                    min: 0,
                    max: 3000,
                    gamma: 1.4
                });

                console.log("📸 Meminta URL gambar ke Google Earth Engine...");
                const imageUrl = await new Promise((resUrl) => {
                    visualImage.getThumbURL({
                        region: visualArea, // Gunakan area luas untuk gambar
                        dimensions: 800,    
                        format: 'png'
                    }, (url, err) => {
                        if (err) {
                            console.error("❌ GAGAL MENDAPATKAN GAMBAR DARI GEE:", err);
                            resUrl(null);
                        } else {
                            console.log("✅ URL Gambar GEE Berhasil didapat:", url);
                            resUrl(url);
                        }
                    });
                });

                // Hitung NDVI: (NIR - RED) / (NIR + RED)
                const ndviImage = bestImage.normalizedDifference(['B8', 'B4']);

                // Tarik nilai rata-rata NDVI menggunakan area sempit (ndviArea)
                const ndviValue = ndviImage.reduceRegion({
                    reducer: ee.Reducer.mean(),
                    geometry: ndviArea, // Gunakan area sempit agar fokus pada sawah
                    scale: 10,
                    maxPixels: 1e9
                });

                ndviValue.evaluate((result) => {
                    if (result && result.nd !== undefined) {
                        resolve({ 
                            ndvi: parseFloat(result.nd.toFixed(2)), 
                            tersedia: true,
                            gambar_url: imageUrl 
                        });
                    } else {
                        resolve({ ndvi: null, tersedia: false, pesan: "Gagal mengkalkulasi NDVI." });
                    }
                });
            });
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { hitungNdviSatelit };