const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // --- DATA DASAR ---
  nama: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['petani', 'pembeli', 'admin'], required: true }, // Ditambah role 'admin'
  no_hp: { type: String, required: true },
  alamat: { type: String },
  
  // --- FITUR PROFESIONAL BARU ---
  nama_perusahaan: { type: String }, // Khusus untuk pembeli B2B
  
  koordinat_lokasi: {                // Untuk fitur anti-penipuan (Geolocation) saat daftar
    lat: { type: Number },
    lng: { type: Number }
  },
  
  isVerified: { type: Boolean, default: false }, // Mencegah akun bot/spam (Verifikasi Email)
  
  resetPasswordToken: { type: String },          // Token unik untuk fitur Lupa Password
  resetPasswordExpire: { type: Date }            // Batas waktu kadaluarsa token reset sandi (misal: 10 menit)
  
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);