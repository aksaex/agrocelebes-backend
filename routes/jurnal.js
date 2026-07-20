const express = require('express');
const router = express.Router();
const Jurnal = require('../models/Jurnal');
const User = require('../models/User');
const { verifikasiToken: auth } = require('../middleware/authMiddleware');
const { hitungAgroScore } = require('../utils/agroScore');
// 1. AMBIL SEMUA DATA JURNAL MILIK PETANI YANG LOGIN
router.get('/', auth, async (req, res) => {
    try {
        const data = await Jurnal.find({ petani_id: req.user.id }).sort({ tanggal: -1 });
        res.json(data);
    } catch (error) {
        res.status(500).json({ pesan: 'Gagal mengambil data jurnal' });
    }
});

// 2. TAMBAH CATATAN BARU (KAS / JADWAL)
router.post('/', auth, async (req, res) => {
    try {
        const newJurnal = new Jurnal({
            ...req.body,
            petani_id: req.user.id
        });
        await newJurnal.save();
        res.status(201).json(newJurnal);
    } catch (error) {
        res.status(500).json({ pesan: 'Gagal menyimpan catatan' });
    }
});

// 3. UPDATE STATUS JADWAL (Selesai / Belum)
router.put('/:id', auth, async (req, res) => {
    try {
        const updated = await Jurnal.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ pesan: 'Gagal mengupdate catatan' });
    }
});

// 4. HAPUS CATATAN
router.delete('/:id', auth, async (req, res) => {
    try {
        await Jurnal.findByIdAndDelete(req.params.id);
        res.json({ pesan: 'Catatan berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ pesan: 'Gagal menghapus catatan' });
    }
});

router.get('/agro-score/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('profil_lahan');
        if (!user) {
            return res.status(404).json({ pesan: 'Data pengguna tidak ditemukan.' });
        }

        const totalJurnal = await Jurnal.countDocuments({ petani_id: req.user.id });
        const jurnalSelesai = await Jurnal.countDocuments({ petani_id: req.user.id, status_selesai: true });
        const rasioJurnal = totalJurnal > 0 ? jurnalSelesai / totalJurnal : 0.3;

        const agroScore = hitungAgroScore({
            luasLahanHa: user.profil_lahan?.luas_lahan_ha || 0,
            cuacaScore: user.profil_lahan?.cuaca_score || 1,
            riwayatJurnalScore: rasioJurnal
        });

        res.json({
            agroScore,
            faktor: {
                luasLahanHa: user.profil_lahan?.luas_lahan_ha || 0,
                cuacaScore: user.profil_lahan?.cuaca_score || 1,
                riwayatJurnalScore: rasioJurnal
            }
        });
    } catch (error) {
        res.status(500).json({ pesan: 'Gagal menghitung AgroScore', error: error.message });
    }
});

module.exports = router;