const express = require('express');
const Escrow = require('../models/Escrow');
const User = require('../models/User'); // <--- PENTING: Import model User untuk verifikasi lahan
const { verifikasiToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

const withUsers = (query) => query
  .populate('petani_id', 'nama role koordinat_lokasi profil_lahan')
  .populate('kud_id', 'nama role nama_perusahaan')
  .populate('pabrik_id', 'nama role nama_perusahaan')
  .populate('kios_id', 'nama role nama_perusahaan');

// ==========================================
// 🌟 RUTE BARU: AMBIL KONTRAK AKTIF PETANI (ANTI-HILANG REFRESH)
// ==========================================
router.get('/petani-aktif', verifikasiToken, authorizeRoles('petani', 'admin'), async (req, res) => {
  try {
    const kontrak = await Escrow.findOne({ petani_id: req.user.id }).sort({ createdAt: -1 });
    res.json(kontrak);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal mengambil kontrak escrow petani', error: error.message });
  }
});

// ==========================================
// 🌟 RUTE BARU: AJUKAN PINJAMAN BERDASARKAN LUAS LAHAN PROPOSAL
// ==========================================
router.post('/ajukan-pinjaman', verifikasiToken, authorizeRoles('petani', 'admin'), async (req, res) => {
  try {
    const petani = await User.findById(req.user.id);

    if (!petani || petani.profil_lahan.status_lahan !== 'terverifikasi') {
      return res.status(403).json({ pesan: 'Akses ditolak. Lahan Anda belum lolos sertifikasi satelit KUD!' });
    }

    const luas = petani.profil_lahan.luas_lahan_ha || 1;
    const targetTonase = luas * 5; // Estimasi proposal: 5 Ton per Hektar
    const hargaPerTon = 7200000;  // Rp 7.200.000 per Ton Gabah Premium
    const totalNilaiKontrak = targetTonase * hargaPerTon;

    const kontrakBaru = await Escrow.create({
      petani_id: req.user.id,
      komoditas: 'Gabah Premium Demo',
      tonase: targetTonase,
      nilai_kontrak: totalNilaiKontrak,
      status: 'pending',
      catatan: `Kontrak otomatis diajukan untuk lahan seluas ${luas} Ha.`
    });

    res.status(201).json(kontrakBaru);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal memproses pengajuan pinjaman awal', error: error.message });
  }
});

// --- RUTE BAWAAN ASLI ANDA (TIDAK BERUBAH) ---
router.get('/', verifikasiToken, authorizeRoles('petani', 'kud', 'pabrik', 'kios', 'admin'), async (req, res) => {
  try {
    const roleKeyByUserRole = {
      petani: 'petani_id',
      kud: 'kud_id',
      pabrik: 'pabrik_id',
      kios: 'kios_id'
    };

    const query = req.user.role === 'admin' ? {} : { [roleKeyByUserRole[req.user.role]]: req.user.id };
    const data = await withUsers(Escrow.find(query).sort({ createdAt: -1 }));
    res.json(data);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal mengambil data escrow', error: error.message });
  }
});

router.get('/agregasi/tonase', verifikasiToken, authorizeRoles('kud', 'pabrik', 'admin'), async (req, res) => {
  try {
    const contracts = await Escrow.find();
    const totalPerKomoditas = contracts.reduce((acc, item) => {
      const key = item.komoditas || 'Tanpa Kategori';
      acc[key] = (acc[key] || 0) + item.tonase;
      return acc;
    }, {});

    res.json(totalPerKomoditas);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal menghitung agregasi tonase', error: error.message });
  }
});

router.post('/', verifikasiToken, authorizeRoles('petani', 'admin'), async (req, res) => {
  try {
    const payload = {
      ...req.body,
      petani_id: req.user.role === 'admin' && req.body.petani_id ? req.body.petani_id : req.user.id
    };
    const doc = await Escrow.create(payload);
    res.status(201).json(doc);
  } catch (error) {
    res.status(400).json({ pesan: 'Gagal membuat transaksi escrow', error: error.message });
  }
});

router.put('/:id/verify-land', verifikasiToken, authorizeRoles('kud', 'admin'), async (req, res) => {
  try {
    const doc = await Escrow.findById(req.params.id);
    if (!doc) return res.status(404).json({ pesan: 'Data escrow tidak ditemukan' });

    if (req.user.role !== 'admin' && doc.kud_id.toString() !== req.user.id) {
      return res.status(403).json({ pesan: 'Akses ditolak untuk verifikasi lahan ini' });
    }

    doc.status = 'verifikasi_lahan';
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal verifikasi lahan', error: error.message });
  }
});

router.put('/:id/pay-dp', verifikasiToken, authorizeRoles('pabrik', 'admin'), async (req, res) => {
  try {
    const doc = await Escrow.findById(req.params.id);
    if (!doc) return res.status(404).json({ pesan: 'Data escrow tidak ditemukan' });

    if (req.user.role !== 'admin' && doc.pabrik_id.toString() !== req.user.id) {
      return res.status(403).json({ pesan: 'Akses ditolak untuk pembayaran DP ini' });
    }

    doc.status = 'dp_locked';
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal memproses DP', error: error.message });
  }
});

router.put('/:id/deliver-fertilizer', verifikasiToken, authorizeRoles('kios', 'admin'), async (req, res) => {
  try {
    const doc = await Escrow.findById(req.params.id);
    if (!doc) return res.status(404).json({ pesan: 'Data escrow tidak ditemukan' });

    if (req.user.role !== 'admin' && doc.kios_id.toString() !== req.user.id) {
      return res.status(403).json({ pesan: 'Akses ditolak untuk serah pupuk ini' });
    }

    doc.status = 'pupuk_diserahkan';
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal memperbarui status penyerahan pupuk', error: error.message });
  }
});

router.put('/:id/complete', verifikasiToken, authorizeRoles('petani', 'admin'), async (req, res) => {
  try {
    const doc = await Escrow.findById(req.params.id);
    if (!doc) return res.status(404).json({ pesan: 'Data escrow tidak ditemukan' });

    if (req.user.role !== 'admin' && doc.petani_id.toString() !== req.user.id) {
      return res.status(403).json({ pesan: 'Akses ditolak untuk menutup kontrak ini' });
    }

    doc.status = 'selesai';
    await doc.save();
    res.json(doc);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal menutup kontrak', error: error.message });
  }
});

module.exports = router;