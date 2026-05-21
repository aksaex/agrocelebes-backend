const express = require('express');
const router = express.Router();
const Jurnal = require('../models/Jurnal');

// PERBAIKAN: Mengubah pemanggilan file agar sesuai dengan nama file Anda (authMiddleware.js)
const auth = require('../middleware/authMiddleware'); 

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

module.exports = router;