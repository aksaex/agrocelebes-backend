const express = require('express');
const Product = require('../models/Product');
const { verifikasiToken } = require('../middleware/authMiddleware');
const { upload, cloudinary } = require('../config/cloudinary');

const router = express.Router();

// Helper: Mengambil Public ID untuk Cloudinary (dibuat lebih aman)
const getPublicIdFromUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    const parts = url.split('/');
    const filename = parts[parts.length - 1].split('.')[0];
    const folder = parts[parts.length - 2];
    return `${folder}/${filename}`;
};

// 1. CREATE: Tambah Produk Baru
router.post('/', verifikasiToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'petani' && req.user.role !== 'admin')) {
            return res.status(403).json({ pesan: 'Akses ditolak!' });
        }

        const { nama_komoditas, kategori, harga_per_kg, stok_kg, deskripsi, lokasi_lahan } = req.body;

        // Validasi BVA (Boundary Value Analysis)
        if (!nama_komoditas || !kategori || !harga_per_kg || !stok_kg) {
            return res.status(400).json({ pesan: 'Data wajib harus diisi' });
        }
        if (Number(harga_per_kg) <= 0 || Number(stok_kg) <= 0) {
            return res.status(400).json({ pesan: 'Harga dan Stok harus lebih dari 0' });
        }

        const imageUrl = req.file ? req.file.path : null;

        const newProduct = new Product({
            petani_id: req.user.id,
            nama_komoditas, kategori, harga_per_kg, stok_kg, deskripsi, lokasi_lahan,
            image_url: imageUrl
        });

        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (error) {
        res.status(500).json({ pesan: 'Kesalahan Server', error: error.message });
    }
});

// 2. READ: Semua Produk
router.get('/', verifikasiToken, async (req, res) => {
    try {
        const products = await Product.find().populate('petani_id', 'nama alamat').limit(50);
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ pesan: 'Kesalahan Server', error: error.message });
    }
});

// 3. READ: Detail Produk
router.get('/:id', verifikasiToken, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ pesan: 'Format ID tidak valid' });
        }
        const product = await Product.findById(req.params.id).populate('petani_id', 'nama no_hp alamat');
        if (!product) return res.status(404).json({ pesan: 'Produk tidak ditemukan' });
        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ pesan: 'Kesalahan Server', error: error.message });
    }
});

// 4. UPDATE: Edit Produk
router.put('/:id', verifikasiToken, upload.single('image'), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ pesan: 'Format ID tidak valid' });
        }

        const productLama = await Product.findById(req.params.id);
        if (!productLama) return res.status(404).json({ pesan: 'Produk tidak ditemukan' });

        // Otorisasi
        if (productLama.petani_id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ pesan: 'Akses ditolak!' });
        }

        const updateData = { ...req.body };
        if (req.file) {
            updateData.image_url = req.file.path;
            const publicId = getPublicIdFromUrl(productLama.image_url);
            if (publicId) await cloudinary.uploader.destroy(publicId);
        }

        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.status(200).json(updatedProduct);
    } catch (error) {
        res.status(500).json({ pesan: 'Gagal memperbarui', error: error.message });
    }
});

// 5. DELETE: Hapus Produk
router.delete('/:id', verifikasiToken, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ pesan: 'Format ID tidak valid' });
        }
        
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ pesan: 'Produk tidak ditemukan' });

        if (product.petani_id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ pesan: 'Akses ditolak!' });
        }

        const publicId = getPublicIdFromUrl(product.image_url);
        if (publicId) await cloudinary.uploader.destroy(publicId);

        await Product.findByIdAndDelete(req.params.id);
        res.status(200).json({ pesan: 'Produk berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ pesan: 'Gagal menghapus', error: error.message });
    }
});

module.exports = router;