const express = require('express');
const User = require('../models/User');
// const Product = require('../models/Product'); // Dimatikan sementara
const { verifikasiToken } = require('../middleware/authMiddleware');

// IMPORT Cloudinary
const { cloudinary } = require('../config/cloudinary');

const router = express.Router();

// Satpam Khusus Super Admin
const khususAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ pesan: 'Akses Ditolak! Anda bukan Super Admin.' });
  }
  next();
};

// =========================================================
// 1. ENDPOINT GET STATISTIK (Untuk 4 Kotak di Dashboard)
// =========================================================
router.get('/stats', verifikasiToken, khususAdmin, async (req, res) => {
  try {
    const totalPetani = await User.countDocuments({ role: 'petani' });
    const totalKud = await User.countDocuments({ role: 'kud' });
    const totalPabrik = await User.countDocuments({ role: 'pabrik' });
    const totalKios = await User.countDocuments({ role: 'kios' });
    
    // BYPASS PRODUK KE ANGKA 0 KARENA MODEL PRODUCT DIMATIKAN
    const totalKomoditas = 0;
    const produkBaru = 0;

    res.json({ totalPetani, totalKud, totalPabrik, totalKios, totalKomoditas, produkBaru });
  } catch (error) {
    console.error("Error Fetch Stats:", error);
    res.status(500).json({ pesan: 'Gagal mengambil statistik server.' });
  }
});

// =========================================================
// 2. ENDPOINT GET USERS 
// =========================================================
router.get('/users', verifikasiToken, khususAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ pesan: error.message });
  }
});

// =========================================================
// 3. ENDPOINT DELETE USER
// =========================================================
router.delete('/users/:id', verifikasiToken, khususAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ pesan: 'Pengguna tidak ditemukan' });
    if (user.role === 'admin') return res.status(400).json({ pesan: 'Tidak bisa menghapus sesama Admin!' });

    // Hapus di MongoDB (HANYA USER SAJA, PRODUK DIMATIKAN)
    await User.findByIdAndDelete(req.params.id);

    // Beri respon sukses instan ke Frontend
    res.json({ pesan: 'Pengguna berhasil dilenyapkan dari database!' });

  } catch (error) {
    console.error("Error Delete User:", error);
    res.status(500).json({ pesan: 'Gagal menghapus pengguna.', error: error.message });
  }
});

module.exports = router;