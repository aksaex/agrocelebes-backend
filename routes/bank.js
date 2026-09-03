const express = require('express');
const crypto = require('crypto');
const Escrow = require('../models/Escrow');
const AuditLog = require('../models/AuditLog'); // Menggunakan sistem audit yang baru kita buat

const router = express.Router();

// 1. ENDPOINT SIMULASI (BPD SULSELBAR): Menerbitkan Virtual Account (VA)
router.post('/va/create', async (req, res) => {
  try {
    const { escrow_id, jumlah_tagihan } = req.body;
    
    // Format VA BPD Sulselbar (Kode Prefix Institusi 8888 + Random 8 Digit)
    const vaNumber = `8888${Math.floor(10000000 + Math.random() * 90000000)}`;
    
    // Update data kontrak dengan nomor VA
    const kontrak = await Escrow.findByIdAndUpdate(
      escrow_id, 
      { virtual_account: vaNumber }, 
      { new: true }
    );

    res.json({ 
      bank: 'BPD Sulselbar', 
      virtual_account: vaNumber, 
      nominal: jumlah_tagihan,
      status: 'AKTIF',
      expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Aktif 7 Hari
    });
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal menghubungi server BPD', error: error.message });
  }
});

// 2. ENDPOINT WEBHOOK (SIMULASI BI-FAST): Menerima Notifikasi Uang Masuk
// Dalam skenario asli, rute ini dipanggil oleh Server Bank BPD, bukan oleh aplikasi kita.
router.post('/webhook/dp-received', async (req, res) => {
  try {
    const { virtual_account, nominal_dibayar, signature } = req.body;

    // Cari kontrak berdasarkan VA
    const kontrak = await Escrow.findOne({ virtual_account: virtual_account });
    if (!kontrak) {
      return res.status(404).json({ error: 'Virtual Account tidak ditemukan di sistem' });
    }

    const oldData = kontrak.toObject();

    // Ubah status escrow karena uang DP sudah masuk ke bank (Credit Enhancer Aktif)
    kontrak.status = 'dp_locked';
    kontrak.catatan = `[SISTEM BPD] DP sebesar Rp ${nominal_dibayar.toLocaleString('id-ID')} telah dikonfirmasi masuk.`;
    await kontrak.save();

    // Kunci riwayat transaksi ini ke dalam Audit Trail SHA-256
    await AuditLog.create({
      aktor_id: kontrak.pabrik_id || kontrak.petani_id, // Fallback ID
      aksi: 'WEBHOOK_BPD_DP_DITERIMA',
      dokumen_terkait: 'Escrow',
      id_dokumen: kontrak._id,
      data_sebelum: oldData,
      data_sesudah: kontrak.toObject()
    });

    res.json({ 
      status: 'ok', 
      pesan: 'Notifikasi pembayaran berhasil diproses sistem escrow',
      trigger_saprotan: 'Kios Mitra sekarang dapat merilis pupuk (Closed-Loop)'
    });
  } catch (error) {
    res.status(500).json({ error: 'Webhook gagal diproses' });
  }
});

module.exports = router;