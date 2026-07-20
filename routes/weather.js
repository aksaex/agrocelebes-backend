const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // UBAH DISINI: Default sekarang adalah Barru (73.11.04.1001)
    const adm4 = req.query.adm4 || '73.11.04.1001'; 
    
    console.log(`Mengambil cuaca untuk kode wilayah: ${adm4}`);
    const bmkgUrl = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${adm4}`;
    
    const response = await fetch(bmkgUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    });
    
    // Jika BMKG merespons dengan status error (seperti 404 atau 500)
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `Murni gagal mendapatkan data dari server BMKG. Status: ${response.status}. Kode wilayah '${adm4}' tidak ditemukan atau format API BMKG berubah.`
      });
    }
    
    // Kirimkan seluruh struktur data asli multi-hari (Array penuh) dari BMKG ke frontend
    const data = await response.json();
    return res.json(data);

  } catch (error) {
    console.error('Koneksi ke BMKG Terputus:', error.message);
    
    // Kirimkan error nyata, hentikan manipulasi data cadangan!
    return res.status(502).json({
      success: false,
      message: 'Gagal terhubung ke upstream server BMKG (Bad Gateway).',
      error: error.message
    });
  }
});

module.exports = router;