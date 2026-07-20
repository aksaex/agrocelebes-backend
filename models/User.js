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
  }
}, { timestamps: true });

// PEMBERSIHAN EKSPOR: Cek registry Mongoose terlebih dahulu untuk mencegah overwrite/circular dependency
module.exports = mongoose.models.User || mongoose.model('User', userSchema);