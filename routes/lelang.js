const express = require('express');
const Lelang = require('../models/Lelang');
const AuditLog = require('../models/AuditLog');
const { verifikasiToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// 1. AMBIL DAFTAR LELANG TERBUKA (UNTUK PABRIK)
router.get('/', verifikasiToken, authorizeRoles('pabrik', 'kud', 'admin'), async (req, res) => {
  try {
    const daftarLelang = await Lelang.find({ status: 'open' })
      .populate('kud_id', 'nama_perusahaan nama')
      .sort({ createdAt: -1 });
    res.json(daftarLelang);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal mengambil bursa lelang', error: error.message });
  }
});

// 2. PABRIK MENGAJUKAN PENAWARAN HARGA (BIDDING)
router.post('/:id/bid', verifikasiToken, authorizeRoles('pabrik', 'admin'), async (req, res) => {
  try {
    const lelang = await Lelang.findById(req.params.id);
    if (!lelang) return res.status(404).json({ pesan: 'Lelang tidak ditemukan atau sudah ditutup' });

    const { harga_per_ton } = req.body;
    
    // Perhitungan DP 30% dari total tonase yang terkumpul di kolam lelang
    const estimasiDp = harga_per_ton * lelang.tonase_terkumpul * 0.3;

    // Cek apakah pabrik ini sudah pernah bid, jika ya, update harganya
    const existingBidIndex = lelang.bids.findIndex(b => b.pabrik_id.toString() === req.user.id);
    if (existingBidIndex >= 0) {
      lelang.bids[existingBidIndex].harga_per_ton = harga_per_ton;
      lelang.bids[existingBidIndex].dp_disetor = estimasiDp;
      lelang.bids[existingBidIndex].waktu_bid = Date.now();
    } else {
      lelang.bids.push({
        pabrik_id: req.user.id,
        harga_per_ton: harga_per_ton,
        dp_disetor: estimasiDp
      });
    }

    await lelang.save();
    res.json({ pesan: 'Penawaran harga berhasil diajukan!', lelang });
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal mengirim penawaran', error: error.message });
  }
});

module.exports = router;