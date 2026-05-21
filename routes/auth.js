const express = require('express');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const User = require('../models/User'); 
const verifikasiToken = require('../middleware/authMiddleware'); 

// --- 1. IMPORT RATE LIMITER ---
const rateLimit = require('express-rate-limit'); 

const router = express.Router();

// --- KEAMANAN TINGKAT DEPAN (FAIL-SAFE) ---
if (!process.env.JWT_SECRET) {
    console.error("FATAL ERROR 🔴: JWT_SECRET tidak ditemukan di file .env!");
    process.exit(1); 
}
// ------------------------------------------

// --- 2. KONFIGURASI RATE LIMITER ---
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 5, // Maksimal 5x coba
    message: { pesan: 'Terlalu banyak percobaan login gagal. Silakan coba lagi setelah 15 menit.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 Jam
    max: 3, // Maksimal 3x request email
    message: { pesan: 'Terlalu banyak permintaan reset sandi. Silakan coba lagi dalam 1 jam ke depan.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 Jam
    max: 5, // Maksimal 5 akun baru per IP
    message: { pesan: 'Anda telah membuat terlalu banyak akun. Silakan coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
});
// -----------------------------------

// =========================================================================
// 1. ENDPOINT REGISTER (Mendaftar Akun Baru)
// =========================================================================
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { nama, email, password, role, no_hp, alamat, nama_perusahaan, koordinat_lokasi } = req.body;

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ 
            pesan: 'Sandi terlalu lemah! Harus minimal 8 karakter, mengandung huruf besar, angka, dan simbol (@$!%*?&).' 
        });
    }

    // Mengamankan dari NoSQL Injection dengan String(email)
    const existingUser = await User.findOne({ email: String(email) });
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
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Mengamankan dari NoSQL Injection dengan String(email)
    const user = await User.findOne({ email: String(email) });
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

    res.cookie('token', token, {
        httpOnly: true, 
        secure: true, // Wajib true untuk sameSite none
        sameSite: 'none', // Diubah agar mendukung beda domain (web.id ke vercel.app)
        maxAge: 24 * 60 * 60 * 1000 
    });

    res.json({
      pesan: 'Login berhasil!',
      token: token, // MEMASTIKAN FRONTEND MENDAPATKAN TOKEN
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
    
    const waRegex = /^(\+62|62|0)8[1-9][0-9]{6,11}$/;
    if (!waRegex.test(no_hp)) {
      return res.status(400).json({ pesan: 'Format nomor WhatsApp tidak valid.' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { nama, no_hp, alamat, nama_perusahaan },
      { returnDocument: 'after' }
    ).select('-password'); 

    res.json({ pesan: 'Profil berhasil diperbarui!', user: updatedUser });
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal memperbarui profil.', error: error.message });
  }
});

// =========================================================================
// 4. LOGIN & REGISTER VIA GOOGLE 
// =========================================================================
router.post('/google', async (req, res) => {
    try {
        const { access_token, role, no_hp, alamat, nama_perusahaan, koordinat_lokasi } = req.body; 

        if (!access_token) {
            return res.status(400).json({ pesan: 'Access token tidak ditemukan dari Google' });
        }

        const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        
        if (!googleRes.ok) throw new Error('Gagal mengambil data dari Google');
        const payload = await googleRes.json();
        const { email, name, picture } = payload; 

        // Mengamankan dari NoSQL Injection dengan String(email)
        let user = await User.findOne({ email: String(email) });

        if (!user && !role) {
            return res.json({
                isNewUser: true,
                email,
                nama: name,
                foto: picture,
                pesan: 'Silakan tentukan peran dan lengkapi data profil Anda.'
            });
        }

        if (!user && role) {
            const randomPassword = Math.random().toString(36).slice(-8) + "Agro!23";
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(randomPassword, salt);

            user = new User({
                nama: name,
                email: email,
                password: hashedPassword,
                role, 
                no_hp: no_hp || '080000000000',
                alamat: alamat || 'Belum diatur',
                nama_perusahaan: role === 'pembeli' ? nama_perusahaan : '',
                koordinat_lokasi: koordinat_lokasi || null
            });
            await user.save();
        }

        const jwtToken = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' } 
        );

        res.cookie('token', jwtToken, {
            httpOnly: true,
            secure: true, // Wajib true untuk sameSite none
            sameSite: 'none', // Diubah agar mendukung beda domain
            maxAge: 7 * 24 * 60 * 60 * 1000 
        });

        res.json({
            isNewUser: false,
            token: jwtToken, // MEMASTIKAN FRONTEND MENDAPATKAN TOKEN VIA GOOGLE LOGIN
            user: {
                id: user._id, 
                nama: user.nama, 
                email: user.email, 
                role: user.role, 
                foto: picture, 
                no_hp: user.no_hp, 
                alamat: user.alamat,
                nama_perusahaan: user.nama_perusahaan 
            }
        });

    } catch (error) {
        console.error("Error Google Auth:", error);
        res.status(401).json({ pesan: 'Autentikasi Google Gagal, silakan coba lagi.' });
    }
});

// =========================================================================
// 5. LUPA PASSWORD
// =========================================================================
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        
        // Mengamankan dari NoSQL Injection dengan String(email)
        const user = await User.findOne({ email: String(email) });
        if (!user) {
            return res.status(404).json({ pesan: 'Email tidak ditemukan di sistem kami.' });
        }

        const resetToken = jwt.sign(
            { id: user._id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '15m' }
        );

        const resetLink = `http://localhost:5173/reset-password/${resetToken}`;

        console.log(`\n\n📧 ====== SIMULASI PENGIRIMAN EMAIL ======`);
        console.log(`Kepada : ${user.email}`);
        console.log(`Subjek : Pemulihan Sandi Akun AgroCelebes`);
        console.log(`Pesan  : Halo ${user.nama}, klik tautan rahasia di bawah ini untuk mereset sandi Anda:`);
        console.log(`Link   : ${resetLink}`);
        console.log(`==========================================\n\n`);

        res.json({ 
            pesan: 'Tautan pemulihan sandi telah dikirim ke email Anda! Silakan cek kotak masuk atau folder spam.'
        });

    } catch (error) {
        console.error("Error Forgot Password:", error);
        res.status(500).json({ pesan: 'Terjadi kesalahan pada server backend.' });
    }
});

// =========================================================================
// 6. EKSEKUSI RESET PASSWORD 
// =========================================================================
router.put('/reset-password/:token', async (req, res) => {
    try {
        const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user) return res.status(404).json({ pesan: 'Pengguna tidak ditemukan.' });

        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(req.body.password)) {
            return res.status(400).json({ 
                pesan: 'Sandi terlalu lemah! Harus minimal 8 karakter, mengandung huruf besar, angka, dan simbol (@$!%*?&).' 
            });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
        await user.save();

        res.json({ pesan: 'Password berhasil diperbarui!' });
    } catch (error) {
        res.status(400).json({ pesan: 'Token tidak valid atau kedaluwarsa.' });
    }
});

// =========================================================================
// 7. ENDPOINT LOGOUT (Menghapus Cookie)
// =========================================================================
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true, // Wajib true untuk sameSite none
        sameSite: 'none' // Diubah agar mendukung beda domain
    });
    res.json({ pesan: 'Berhasil logout' });
});

module.exports = router;