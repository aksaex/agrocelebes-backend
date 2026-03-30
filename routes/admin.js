const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
const verifikasiToken = require('../middleware/authMiddleware');

// IMPORT Cloudinary
const { cloudinary } = require('../config/cloudinary');

const router = express.Router();

const khususAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ pesan: 'Akses Ditolak! Anda bukan Super Admin.' });
  }
  next();
};

// Fungsi pembantu ambil ID gambar
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  const splitUrl = url.split('/');
  const filename = splitUrl[splitUrl.length - 1].split('.')[0];
  const folder = splitUrl[splitUrl.length - 2];
  return `${folder}/${filename}`;
};

// GET: Ambil Semua Pengguna
router.get('/users', verifikasiToken, khususAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ pesan: error.message });
  }
});

// DELETE: Lenyapkan Pengguna Nakal
router.delete('/users/:id', verifikasiToken, khususAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ pesan: 'Pengguna tidak ditemukan' });
    if (user.role === 'admin') return res.status(400).json({ pesan: 'Tidak bisa menghapus sesama Admin!' });

    // 1. Cari semua produk milik user ini
    const userProducts = await Product.find({ petani_id: req.params.id });
    
    // 2. Hancurkan SEMUA gambar produknya di Cloudinary satu per satu
    for (const prod of userProducts) {
      const publicId = getPublicIdFromUrl(prod.image_url);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId); // Menembak mati foto di awan
      }
    }

    // 3. Hapus data produk dari MongoDB
    await Product.deleteMany({ petani_id: req.params.id });

    // 4. Terakhir, Hapus akun usernya dari MongoDB
    await User.findByIdAndDelete(req.params.id);

    res.json({ pesan: 'Pengguna beserta seluruh produk dan gambarnya berhasil dilenyapkan dari server!' });
  } catch (error) {
    res.status(500).json({ pesan: error.message });
  }
});

module.exports = router;