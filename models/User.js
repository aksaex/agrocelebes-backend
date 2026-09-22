const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nama: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['petani', 'kud', 'pabrik', 'kios', 'admin'], // Sesuaikan dengan role Anda
    required: true,
  },
  no_hp: {
    type: String,
    default: null,
  },
  alamat: {
    type: String,
    default: 'Belum diatur',
  },
  nama_perusahaan: {
    type: String,
    default: '',
  },
  koordinat_lokasi: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  profil_lahan: {
    status_lahan: { type: String, default: 'belum diverifikasi' },
    luas_lahan_ha: { type: Number, default: 0 }
  },

  // =====================================================================
  // PORTOFOLIO PETANI (Menjawab kritik juri: rekam jejak & kredibilitas)
  // Penjelasan Juri: "Kami tidak hanya menilai lahan hari ini lewat satelit,
  // tapi juga pengalaman bertani dan riwayat panen sebagai bukti track record."
  // =====================================================================
  lama_berusaha_tani: {
    type: Number,
    default: 0 // Satuan: tahun
  },
  riwayat_panen: [{
    musim: { type: String, default: '' },       // Contoh: "2025/2026 - Musim Gadu"
    volume_ton: { type: Number, default: 0 },
    kualitas: { type: String, default: '' }     // Contoh: "Premium", "Medium"
  }],

  // =====================================================================
  // CATATAN KEUANGAN (Menjawab kritik juri: transparansi arus kas petani)
  // =====================================================================
  catatan_keuangan: [{
    tanggal: { type: Date, default: Date.now },
    jenis_transaksi: { type: String, default: '' }, // Contoh: "Pembelian Pupuk"
    nominal: { type: Number, default: 0 },
    status_lunas: { type: Boolean, default: false }
  }]
}, { timestamps: true });

// PEMBERSIHAN EKSPOR: Cek registry Mongoose terlebih dahulu untuk mencegah overwrite/circular dependency
module.exports = mongoose.models.User || mongoose.model('User', userSchema);