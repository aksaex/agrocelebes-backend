const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
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

// Fungsi pembantu ambil ID gambar Cloudinary
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  const splitUrl = url.split('/');
  const filename = splitUrl[splitUrl.length - 1].split('.')[0];
  const folder = splitUrl[splitUrl.length - 2];
  return `${folder}/${filename}`;
};

// =========================================================
// 1. ENDPOINT GET STATISTIK (Untuk 4 Kotak di Dashboard)
// =========================================================
router.get('/stats', verifikasiToken, khususAdmin, async (req, res) => {
  try {
    const totalPetani = await User.countDocuments({ role: 'petani' });
    const totalPembeli = await User.countDocuments({ role: 'pembeli' });
    const totalKomoditas = await Product.countDocuments();

    const kemarin = new Date(new Date().getTime() - (24 * 60 * 60 * 1000));
    const produkBaru = await Product.countDocuments({ createdAt: { $gte: kemarin } });

    res.json({ totalPetani, totalPembeli, totalKomoditas, produkBaru });
  } catch (error) {
    console.error("Error Fetch Stats:", error);
    res.status(500).json({ pesan: 'Gagal mengambil statistik server.' });
  }
});

// =========================================================
// 2. ENDPOINT GET USERS (YANG TADI SEMPAT TERHAPUS!)
// =========================================================
router.get('/users', verifikasiToken, khususAdmin, async (req, res) => {
  try {
    // Mengambil semua user kecuali password, diurutkan dari yang terbaru
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ pesan: error.message });
  }
});

// =========================================================
// 3. ENDPOINT DELETE USER (Hapus Akun & Produk)
// =========================================================
router.delete('/users/:id', verifikasiToken, khususAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ pesan: 'Pengguna tidak ditemukan' });
    if (user.role === 'admin') return res.status(400).json({ pesan: 'Tidak bisa menghapus sesama Admin!' });

    // Ambil semua produk milik user ini
    const userProducts = await Product.find({ petani_id: req.params.id });
    const publicIdsToDelete = userProducts
        .map(prod => getPublicIdFromUrl(prod.image_url))
        .filter(id => id !== null);

    // Hapus di MongoDB serentak
    await Promise.all([
        Product.deleteMany({ petani_id: req.params.id }),
        User.findByIdAndDelete(req.params.id)
    ]);

    // Beri respon sukses instan ke Frontend
    res.json({ pesan: 'Pengguna dan seluruh produknya berhasil dilenyapkan dari database!' });

    // Hapus foto di Cloudinary di background
    if (publicIdsToDelete.length > 0) {
        Promise.allSettled(
            publicIdsToDelete.map(publicId => cloudinary.uploader.destroy(publicId))
        ).then(results => {
            const failedDeletes = results.filter(r => r.status === 'rejected');
            if (failedDeletes.length > 0) {
                console.warn(`⚠️ Ada ${failedDeletes.length} foto gagal dihapus dari Cloudinary.`);
            } else {
                console.log(`✅ Berhasil membersihkan ${publicIdsToDelete.length} foto dari Cloudinary.`);
            }
        });
    }

  } catch (error) {
    console.error("Error Delete User:", error);
    res.status(500).json({ pesan: 'Gagal menghapus pengguna.', error: error.message });
  }
});

module.exports = router;