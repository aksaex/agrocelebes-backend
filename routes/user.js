const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // 👈 1. WAJIB TAMBAHKAN INI
const User = mongoose.models.User || require('../models/User'); 
const { verifikasiToken, authorizeRoles } = require('../middleware/authMiddleware');

// [GET] /api/user/profile -> Dipanggil saat refresh halaman untuk menarik data dari MongoDB
router.get('/profile', verifikasiToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ pesan: 'Data petani tidak ditemukan' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal mengambil data profil', error: error.message });
  }
});

// [POST] /api/user/geotag -> Menyimpan titik koordinat lahan dari dashboard petani ke MongoDB
router.post('/geotag', verifikasiToken, authorizeRoles('petani', 'admin'), async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ pesan: 'Koordinat latitude dan longitude wajib diisi' });
    }
    
    // Perbarui koordinat dan set status menjadi 'belum diverifikasi' untuk diaudit satelit KUD
    const userDiperbarui = await User.findByIdAndUpdate(
      req.user.id,
      {
        koordinat_lokasi: { lat, lng },
        'profil_lahan.status_lahan': 'belum diverifikasi'
      },
      { returnDocument: 'after' } // Mengembalikan data terbaru setelah di-update
    ).select('-password');

    res.json(userDiperbarui);
  } catch (error) {
    res.status(400).json({ pesan: 'Gagal memperbarui geotagging lahan', error: error.message });
  }
});

// ... kode router profile & geotag sebelumnya ...

// ==========================================
// 🌟 RUTE BARU: KUD MENGAMBIL DATA SEMUA PETANI
// ==========================================
router.get('/petani-list', verifikasiToken, authorizeRoles('kud', 'admin'), async (req, res) => {
  try {
    // Mengambil semua user dengan role petani (kecuali passwordnya)
    const paraPetani = await User.find({ role: 'petani' })
      .select('-password')
      .sort({ createdAt: -1 }); // Urutkan dari yang terbaru
      
    res.json(paraPetani);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal mengambil daftar petani', error: error.message });
  }
});

// ==========================================
// 🌟 RUTE BARU: KUD VERIFIKASI LAHAN PETANI
// ==========================================
router.put('/verifikasi-lahan/:id', verifikasiToken, authorizeRoles('kud', 'admin'), async (req, res) => {
  try {
    const petaniId = req.params.id;
    // Ubah status lahan menjadi terverifikasi
    const userDiperbarui = await User.findByIdAndUpdate(
      petaniId,
      { 'profil_lahan.status_lahan': 'terverifikasi' },
      { returnDocument: 'after' }
    ).select('-password');

    res.json({ pesan: 'Lahan berhasil diverifikasi satelit', user: userDiperbarui });
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal memverifikasi lahan', error: error.message });
  }
});

// ==========================================
// 🌟 RUTE BARU: DETAIL PORTOFOLIO PETANI
// Dipakai KUD untuk menilai risiko kredit lewat tombol "Lihat Portofolio Risiko".
// Mengembalikan profil, lama_berusaha_tani, riwayat_panen, dan catatan_keuangan.
// ==========================================
router.get('/petani/:id', verifikasiToken, authorizeRoles('kud', 'admin', 'pabrik', 'offtaker', 'pembeli'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ pesan: 'ID Petani tidak valid.' });
    }

    const petani = await User.findOne({ _id: id, role: 'petani' }).select('-password');
    if (!petani) {
      return res.status(404).json({ pesan: 'Data petani tidak ditemukan.' });
    }

    // Selalu kirim array agar UI aman (kalau data belum ada, tetap array kosong)
    const riwayatPanen = (petani.riwayat_panen || []).map((item) => ({
      musim: item.musim || 'Musim belum dicatat',
      volume_ton: Number(item.volume_ton) || 0,
      kualitas: item.kualitas || 'Belum dinilai'
    }));

    const catatanKeuangan = (petani.catatan_keuangan || []).map((item) => ({
      tanggal: item.tanggal || null,
      jenis_transaksi: item.jenis_transaksi || 'Transaksi tanpa keterangan',
      nominal: Number(item.nominal) || 0,
      status_lunas: Boolean(item.status_lunas)
    }));

    // Ringkasan turunan: menjawab kritik juri soal portofolio & risiko kredit
    const totalVolumeTon = riwayatPanen.reduce((total, item) => total + item.volume_ton, 0);
    const totalLunas = catatanKeuangan.filter((item) => item.status_lunas).reduce((total, item) => total + item.nominal, 0);
    const totalPiutang = catatanKeuangan.filter((item) => !item.status_lunas).reduce((total, item) => total + item.nominal, 0);

    res.json({
      petani: {
        _id: petani._id,
        nama: petani.nama,
        alamat: petani.alamat,
        no_hp: petani.no_hp,
        koordinat_lokasi: petani.koordinat_lokasi,
        profil_lahan: petani.profil_lahan,
        lama_berusaha_tani: Number(petani.lama_berusaha_tani) || 0,
        riwayat_panen: riwayatPanen,
        catatan_keuangan: catatanKeuangan
      },
      ringkasan: {
        lama_berusaha_tani: Number(petani.lama_berusaha_tani) || 0,
        total_musim_panen: riwayatPanen.length,
        total_volume_ton: Number(totalVolumeTon.toFixed(2)),
        total_transaksi: catatanKeuangan.length,
        total_lunas: totalLunas,
        total_piutang: totalPiutang
      }
    });
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal mengambil portofolio petani', error: error.message });
  }
});

module.exports = router;