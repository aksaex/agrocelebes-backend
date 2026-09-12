const { ee, initGEE } = require('./geeService');

async function hitungNdviSatelit(lat, lng) {
    await initGEE();

    return new Promise((resolve, reject) => {
        try {
            const point = ee.Geometry.Point([lng, lat]);
            
            // Perbesar area buffer menjadi 150 meter agar cakupan lahan lebih luas
            const area = point.buffer(150);

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 60);

            const imageCollection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                .filterBounds(area)
                .filterDate(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0])
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30));

            imageCollection.size().evaluate(async (size) => {
                if (size === 0) {
                    return resolve({ ndvi: null, tersedia: false, pesan: "Tidak ada citra bebas awan dalam 60 hari terakhir." });
                }

                const bestImage = imageCollection.sort('system:time_start', false).first();

                // Visualisasi True Color (RGB: Red, Green, Blue)
                const visualImage = bestImage.visualize({
                    bands: ['B4', 'B3', 'B2'],
                    min: 0,
                    max: 3000,
                    gamma: 1.4
                });

                // Ambil URL Thumbnail dengan resolusi tinggi
                console.log("📸 Meminta URL gambar ke Google Earth Engine...");
                const imageUrl = await new Promise((resUrl) => {
                    visualImage.getThumbURL({
                        region: area, // Ambil batas area (bounding box)
                        dimensions: 600,       // Naikkan dimensi dari 400 ke 800px agar tidak pecah
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

                const ndviValue = ndviImage.reduceRegion({
                    reducer: ee.Reducer.mean(),
                    geometry: area,
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