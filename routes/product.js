const express = require('express');
const Product = require('../models/Product');
const { verifikasiToken } = require('../middleware/authMiddleware');;

// IMPORT BARU: Ambil upload dan cloudinary
const { upload, cloudinary } = require('../config/cloudinary');

const router = express.Router();

// ========================================================
// FUNGSI PINTAR: Mengambil "Public ID" dari URL Cloudinary
// ========================================================
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  const splitUrl = url.split('/');
  // Ambil nama file tanpa ekstensi (.jpg/.png)
  const filename = splitUrl[splitUrl.length - 1].split('.')[0]; 
  // Ambil nama folder
  const folder = splitUrl[splitUrl.length - 2]; 
  return `${folder}/${filename}`; // Output: agrocelebes_komoditas/namafile
};

// 1. CREATE: Tambah Produk Baru
router.post('/', verifikasiToken, upload.single('image'), async (req, res) => {
  try {
    if (req.user.role !== 'petani' && req.user.role !== 'admin') {
      return res.status(403).json({ pesan: 'Hanya petani yang bisa menambah komoditas!' });
    }
    
    const { nama_komoditas, kategori, harga_per_kg, stok_kg, deskripsi, lokasi_lahan } = req.body;
    
    // --- TAMBAHKAN VALIDASI INI (Blokir Harga/Stok <= 0) ---
    if (harga_per_kg <= 0 || stok_kg <= 0) {
      return res.status(400).json({ pesan: 'Harga dan Stok tidak boleh kurang dari atau sama dengan 0!' });
    }
    // -------------------------------------------------------

    const imageUrl = req.file ? req.file.path : null;
    
    const newProduct = new Product({
      petani_id: req.user.id,
      nama_komoditas, kategori, harga_per_kg, stok_kg, deskripsi, lokasi_lahan,
      image_url: imageUrl
    });

    const savedProduct = await newProduct.save();
    res.status(201).json({ pesan: 'Produk berhasil ditambahkan!', data: savedProduct });
  } catch (error) {
    res.status(500).json({ pesan: 'Terjadi kesalahan server', error: error.message });
  }
});

// GET /api/products/stats/prices -> Mengambil rata-rata harga komoditas (Untuk Dashboard)
router.get('/stats/prices', async (req, res) => {
    try {
        const stats = await Product.aggregate([
            {
                $group: {
                    _id: "$kategori",
                    rataHarga: { $avg: "$harga_per_kg" },
                    jumlahProduk: { $sum: 1 }
                }
            },
            { $sort: { jumlahProduk: -1 } } // Urutkan dari kategori yang paling banyak dijual
        ]);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ pesan: 'Gagal mengambil statistik harga' });
    }
});

// GET /api/products/stats/me -> Mengambil total produk & stok khusus milik user yang login
router.get('/stats/me', verifikasiToken, async (req, res) => {
    try {
        // Cari semua produk yang petani_id-nya sama dengan user yang sedang login
        const myProducts = await Product.find({ petani_id: req.user.id });
        
        const totalProduk = myProducts.length;
        const totalStok = myProducts.reduce((acc, curr) => acc + curr.stok_kg, 0);
        
        res.json({ totalProduk, totalStok });
    } catch (error) {
        console.error(error);
        res.status(500).json({ pesan: 'Gagal mengambil statistik etalase' });
    }
});

// 2. READ: Lihat Semua Produk (Filter B2B)
router.get('/', verifikasiToken, async (req, res) => {
  try {
    const { search, kategori, minHarga, maxHarga } = req.query;
    let query = {};
    
    if (search) query.nama_komoditas = { $regex: search, $options: 'i' };
    if (kategori && kategori !== 'Semua') query.kategori = kategori;
    if (minHarga || maxHarga) {
      query.harga_per_kg = {};
      if (minHarga) query.harga_per_kg.$gte = Number(minHarga);
      if (maxHarga) query.harga_per_kg.$lte = Number(maxHarga);
    }

    // --- TAMBAHKAN LIMIT(50) DI SINI ---
    const products = await Product.find(query)
      .populate('petani_id', 'nama alamat')
      .sort({ createdAt: -1 })
      .limit(50); // Membatasi data maksimal 50 produk terbaru
    // -----------------------------------
    
    res.json(products);
  } catch (error) {
    res.status(500).json({ pesan: 'Terjadi kesalahan server', error: error.message });
  }
});

// 3. READ: Lihat Detail 1 Produk
router.get('/:id', verifikasiToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('petani_id', 'nama no_hp alamat isVerified koordinat_lokasi');
    if (!product) return res.status(404).json({ pesan: 'Produk tidak ditemukan' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ pesan: 'Terjadi kesalahan server', error: error.message });
  }
});

// 4. UPDATE: Edit Data & Ganti Foto
router.put('/:id', verifikasiToken, upload.single('image'), async (req, res) => {
  try {
    const productLama = await Product.findById(req.params.id);
    if (!productLama) return res.status(404).json({ pesan: 'Produk tidak ditemukan' });

    if (productLama.petani_id.toString() !== req.user.id && req.user.role !== 'admin') {
       return res.status(403).json({ pesan: 'Akses ditolak!' });
    }

    const updateData = { ...req.body };
    const { harga_per_kg, stok_kg } = req.body;

    // --- TAMBAHKAN VALIDASI INI (Blokir Harga/Stok <= 0 saat Edit) ---
    // Pengecekan hanya jika petani mencoba mengedit harga atau stok
    if ((harga_per_kg !== undefined && harga_per_kg <= 0) || (stok_kg !== undefined && stok_kg <= 0)) {
      return res.status(400).json({ pesan: 'Harga dan Stok tidak boleh kurang dari atau sama dengan 0!' });
    }
    // -----------------------------------------------------------------
    
    // Jika petani MENGUPLOAD FOTO BARU
    if (req.file) {
      updateData.image_url = req.file.path; // Simpan URL foto baru
      
      // ANTI-GHOST IMAGE: Hancurkan foto lamanya di Cloudinary!
      const publicId = getPublicIdFromUrl(productLama.image_url);
      if (publicId) await cloudinary.uploader.destroy(publicId);
    }

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { returnDocument: 'after' });
    res.json({ pesan: 'Produk berhasil diperbarui!', data: updatedProduct });
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal memperbarui produk', error: error.message });
  }
});

// 5. DELETE: Hapus Produk Permanen
router.delete('/:id', verifikasiToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ pesan: 'Produk tidak ditemukan' });

    if (product.petani_id.toString() !== req.user.id && req.user.role !== 'admin') {
       return res.status(403).json({ pesan: 'Akses ditolak!' });
    }

    // ANTI-GHOST IMAGE: Sebelum produk dihapus di Database, hancurkan dulu fotonya di Cloudinary!
    const publicId = getPublicIdFromUrl(product.image_url);
    if (publicId) await cloudinary.uploader.destroy(publicId);

    await Product.findByIdAndDelete(req.params.id);
    res.json({ pesan: 'Produk beserta fotonya berhasil dihapus permanen!' });
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal menghapus produk', error: error.message });
  }
});

module.exports = router;