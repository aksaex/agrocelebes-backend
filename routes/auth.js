const express = require('express');
const bcrypt = require('bcryptjs'); // Aman untuk Windows
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User'); 
const verifikasiToken = require('../middleware/authMiddleware'); 

const router = express.Router();

// =========================================================================
// 1. ENDPOINT REGISTER (Mendaftar Akun Baru)
// =========================================================================
router.post('/register', async (req, res) => {
  try {
    const { nama, email, password, role, no_hp, alamat, nama_perusahaan, koordinat_lokasi } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ pesan: 'Email sudah digunakan!' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      nama, email, password: hashedPassword, role, no_hp, alamat, nama_perusahaan, koordinat_lokasi
    });

    await newUser.save();
    res.status(201).json({ pesan: 'Registrasi berhasil! Silakan login.' });
  } catch (error) {
    res.status(500).json({ pesan: 'Terjadi kesalahan pada server', error: error.message });
  }
});

// =========================================================================
// 2. ENDPOINT LOGIN (Masuk ke Sistem)
// =========================================================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ pesan: 'Pengguna tidak ditemukan!' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ pesan: 'Password salah!' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      pesan: 'Login berhasil!',
      token,
      user: {
        id: user._id, nama: user.nama, email: user.email, role: user.role, 
        no_hp: user.no_hp, alamat: user.alamat, nama_perusahaan: user.nama_perusahaan 
      }
    });
  } catch (error) {
    res.status(500).json({ pesan: 'Terjadi kesalahan pada server', error: error.message });
  }
});

// =========================================================================
// 3. ENDPOINT UPDATE PROFIL (Halaman Profil Saya)
// =========================================================================
router.put('/profile', verifikasiToken, async (req, res) => {
  try {
    const { nama, no_hp, alamat, nama_perusahaan } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { nama, no_hp, alamat, nama_perusahaan },
      { new: true } 
    ).select('-password'); 

    res.json({ pesan: 'Profil berhasil diperbarui!', user: updatedUser });
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal memperbarui profil.', error: error.message });
  }
});

// =========================================================================
// 4. ENDPOINT LUPA PASSWORD (Verifikasi via Nomor WhatsApp - BEBAS SMTP!)
// =========================================================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, no_hp } = req.body;

    // Cek apakah Email dan Nomor HP cocok (Keamanan Ganda)
    const user = await User.findOne({ email, no_hp });
    if (!user) {
      return res.status(404).json({ pesan: 'Kombinasi Email dan Nomor WhatsApp tidak cocok atau tidak terdaftar.' });
    }

    // Buat token rahasia
    const resetToken = crypto.randomBytes(20).toString('hex');
    
    // Enkripsi dan simpan ke database (berlaku 10 menit)
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    // Kirim token langsung ke Frontend agar bisa membuka halaman Reset Password detik itu juga!
    res.status(200).json({ 
      pesan: 'Verifikasi berhasil! Mengarahkan ke halaman sandi baru...',
      token: resetToken 
    });

  } catch (error) {
    res.status(500).json({ pesan: 'Terjadi kesalahan server.', error: error.message });
  }
});

// =========================================================================
// 5. ENDPOINT EKSEKUSI RESET PASSWORD (Menyimpan Password Baru)
// =========================================================================
router.put('/reset-password/:token', async (req, res) => {
  try {
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ pesan: 'Akses ditolak: Token tidak valid atau sudah kedaluwarsa.' });
    }

    // Hash password baru
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
    
    // Bersihkan token dari database (Hanya bisa dipakai 1 kali)
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ pesan: 'Password berhasil diperbarui! Silakan login dengan password baru.' });
  } catch (error) {
    res.status(500).json({ pesan: 'Terjadi kesalahan server.', error: error.message });
  }
});

module.exports = router;