const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // 👈 1. WAJIB TAMBAHKAN INI
const User = mongoose.models.User || require('../models/User'); 
const { verifikasiToken, authorizeRoles } = require('../middleware/authMiddleware');

// [GET] /api/user/profile -> Dipanggil saat refresh halaman untuk menarik data dari MongoDB
router.get('/profile', verifikasiToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ pesan: 'Data petani tidak ditemukan' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal mengambil data profil', error: error.message });
  }
});

// [POST] /api/user/geotag -> Menyimpan titik koordinat lahan dari dashboard petani ke MongoDB
router.post('/geotag', verifikasiToken, authorizeRoles('petani', 'admin'), async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ pesan: 'Koordinat latitude dan longitude wajib diisi' });
    }
    
    // Perbarui koordinat dan set status menjadi 'belum diverifikasi' untuk diaudit satelit KUD
    const userDiperbarui = await User.findByIdAndUpdate(
      req.user.id,
      {
        koordinat_lokasi: { lat, lng },
        'profil_lahan.status_lahan': 'belum diverifikasi'
      },
      { returnDocument: 'after' } // Mengembalikan data terbaru setelah di-update
    ).select('-password');

    res.json(userDiperbarui);
  } catch (error) {
    res.status(400).json({ pesan: 'Gagal memperbarui geotagging lahan', error: error.message });
  }
});

// ... kode router profile & geotag sebelumnya ...

// ==========================================
// 🌟 RUTE BARU: KUD MENGAMBIL DATA SEMUA PETANI
// ==========================================
router.get('/petani-list', verifikasiToken, authorizeRoles('kud', 'admin'), async (req, res) => {
  try {
    // Mengambil semua user dengan role petani (kecuali passwordnya)
    const paraPetani = await User.find({ role: 'petani' })
      .select('-password')
      .sort({ createdAt: -1 }); // Urutkan dari yang terbaru
      
    res.json(paraPetani);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal mengambil daftar petani', error: error.message });
  }
});

// ==========================================
// 🌟 RUTE BARU: KUD VERIFIKASI LAHAN PETANI
// ==========================================
router.put('/verifikasi-lahan/:id', verifikasiToken, authorizeRoles('kud', 'admin'), async (req, res) => {
  try {
    const petaniId = req.params.id;
    // Ubah status lahan menjadi terverifikasi
    const userDiperbarui = await User.findByIdAndUpdate(
      petaniId,
      { 'profil_lahan.status_lahan': 'terverifikasi' },
      { returnDocument: 'after' }
    ).select('-password');

    res.json({ pesan: 'Lahan berhasil diverifikasi satelit', user: userDiperbarui });
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal memverifikasi lahan', error: error.message });
  }
});

module.exports = router;