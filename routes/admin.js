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

// DELETE: Lenyapkan Pengguna Nakal & Bersihkan Jejak
router.delete('/users/:id', verifikasiToken, khususAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ pesan: 'Pengguna tidak ditemukan' });
    if (user.role === 'admin') return res.status(400).json({ pesan: 'Tidak bisa menghapus sesama Admin!' });

    // 1. Ambil semua produk milik user ini untuk mendata foto yang akan dihapus
    const userProducts = await Product.find({ petani_id: req.params.id });
    
    // Kumpulkan semua Public ID dari foto-foto tersebut
    const publicIdsToDelete = userProducts
        .map(prod => getPublicIdFromUrl(prod.image_url))
        .filter(id => id !== null);

    // 2. HAPUS DI MONGODB TERLEBIH DAHULU (Prioritas Utama)
    // Gunakan Promise.all agar penghapusan User dan Product berjalan serentak & lebih cepat
    await Promise.all([
        Product.deleteMany({ petani_id: req.params.id }),
        User.findByIdAndDelete(req.params.id)
    ]);

    // Berikan respon sukses ke Frontend SEKARANG JUGA tanpa menunggu Cloudinary selesai
    // Ini membuat aplikasi terasa sangat cepat dan responsif bagi Admin
    res.json({ pesan: 'Pengguna dan seluruh produknya berhasil dilenyapkan dari database!' });

    // 3. HAPUS FOTO DI CLOUDINARY SEBAGAI BACKGROUND PROCESS (Asinkron)
    // Promise.allSettled memastikan jika 1 foto gagal dihapus, foto lain tetap dilanjutkan
    if (publicIdsToDelete.length > 0) {
        Promise.allSettled(
            publicIdsToDelete.map(publicId => cloudinary.uploader.destroy(publicId))
        ).then(results => {
            // Opsional: Melacak jika ada foto yang gagal dihapus dari Cloudinary di terminal server
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
    // Pastikan server tidak crash dan merespon dengan error 500 jika gagal di awal
    res.status(500).json({ pesan: 'Gagal menghapus pengguna.', error: error.message });
  }
});

module.exports = router;