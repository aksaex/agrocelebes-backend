const express = require('express');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = mongoose.models.User || require('../models/User'); 
const { verifikasiToken } = require('../middleware/authMiddleware');
const sendEmail = require('../utils/sendEmail'); 
const { normalizeRole, isValidRole } = require('../utils/roles');

// --- 1. IMPORT RATE LIMITER ---
const rateLimit = require('express-rate-limit'); 

const router = express.Router();

// Cek apakah server berjalan di Vercel (Production) atau Localhost (Development)
const isProduction = process.env.NODE_ENV === 'production';
const cookieOptions = {
  httpOnly: true,
  // Jangan paksa secure=true saat localhost (http) karena cookie tidak akan tersimpan/terkirim.
  secure: isProduction && (process.env.COOKIE_SECURE === 'true'),
  // sameSite=none butuh secure; karena itu untuk localhost kita set lax.
  sameSite: isProduction ? (process.env.COOKIE_SECURE === 'true' ? 'none' : 'lax') : 'lax',
  path: '/'
};

// --- KEAMANAN TINGKAT DEPAN (FAIL-SAFE) ---
if (!process.env.JWT_SECRET) {
    console.error("FATAL ERROR 🔴: JWT_SECRET tidak ditemukan di file .env!");
    process.exit(1); 
}
// ------------------------------------------

// --- 2. KONFIGURASI RATE LIMITER ---
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 50, // Maksimal 50x coba
    message: { pesan: 'Terlalu banyak percobaan login gagal. Silakan coba lagi setelah 15 menit.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 Jam
    max: 30, // Maksimal 30x request email
    message: { pesan: 'Terlalu banyak permintaan reset sandi. Silakan coba lagi dalam 1 jam ke depan.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 Jam
    max: 11, // Maksimal 5 akun baru per IP
    message: { pesan: 'Anda telah membuat terlalu banyak akun. Silakan coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// =========================================================================
// 1. ENDPOINT REGISTER (Mendaftar Akun Baru)
// =========================================================================
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { nama, email, password, role, no_hp, alamat, nama_perusahaan, koordinat_lokasi, profil_lahan } = req.body;
    const normalizedRole = normalizeRole(role);

    if (!isValidRole(normalizedRole) || normalizedRole === 'admin') {
      return res.status(400).json({ pesan: 'Role tidak valid untuk registrasi publik.' });
    }

    // VALIDASI EMAIL SEDERHANA TAPI KETAT
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ 
            pesan: 'Format email tidak valid! Contoh: nama@gmail.com, nama@yahoo.co.id' 
        });
    }

    // Validasi tambahan: cek domain yang umum digunakan
    const validEmailDomains = [
        'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
        'live.com', 'icloud.com', 'protonmail.com',
        'co.id', 'ac.id', 'sch.id', 'go.id'  // Domain Indonesia
    ];

    const emailDomain = email.split('@')[1];
    const isValidDomain = validEmailDomains.some(domain => 
        emailDomain === domain || emailDomain.endsWith('.' + domain)
    );

    if (!isValidDomain) {
        return res.status(400).json({ 
            pesan: 'Domain email tidak dikenal! Gunakan domain umum seperti gmail.com, yahoo.com, atau co.id.' 
        });
    }

    // VALIDASI SANDI
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

    // INTEGRASI: SATPAM PENGECEK DUPLIKAT NOMOR HP SAAT DAFTAR MANUAL
    if (no_hp) {
      const existingHp = await User.findOne({ no_hp: String(no_hp) });
      if (existingHp) {
        return res.status(400).json({ pesan: 'Nomor HP sudah digunakan oleh akun lain!' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      nama,
      email,
      password: hashedPassword,
      role: normalizedRole,
      no_hp,
      alamat,
      nama_perusahaan: normalizedRole === 'petani' ? '' : nama_perusahaan,
      koordinat_lokasi,
      profil_lahan
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

    // 👇 REVISI COOKIE CERDAS UNTUK LOCALHOST & VERCEL
    res.cookie('token', token, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 });

    res.json({
      pesan: 'Login berhasil!',
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
// 2B. SESSION CHECK (Untuk bootstrap frontend setelah refresh)
// =========================================================================
router.get('/me', verifikasiToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ pesan: 'Sesi tidak ditemukan.' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal membaca sesi pengguna.', error: error.message });
  }
});

// =========================================================================
// 3. ENDPOINT UPDATE PROFIL (Halaman Profil Saya)
// =========================================================================
router.put('/profile', verifikasiToken, async (req, res) => {
  try {
    const { nama, no_hp, alamat, nama_perusahaan, koordinat_lokasi, profil_lahan } = req.body;
    
    // Validasi Regex
    const waRegex = /^(\+62|62|0)[0-9]{8,13}$/;
    if (no_hp && !waRegex.test(no_hp)) {
      return res.status(400).json({ pesan: 'Format nomor WhatsApp tidak valid.' });
    }

    // 👇 INTEGRASI: SATPAM PENGECEK DUPLIKAT NOMOR HP SAAT EDIT PROFIL
    // Cari apakah ada user LAIN (id berbeda) yang pakai nomor HP ini
    if (no_hp) {
      const existingHp = await User.findOne({ no_hp: String(no_hp), _id: { $ne: req.user.id } });
      if (existingHp) {
        return res.status(400).json({ pesan: 'Gagal! Nomor HP ini sudah digunakan oleh akun lain.' });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { nama, no_hp, alamat, nama_perusahaan, koordinat_lokasi, profil_lahan },
      { returnDocument: 'after', runValidators: true } // Memastikan data terbaru kembali ke frontend
    ).select('-password');

    res.json({ pesan: 'Profil berhasil diperbarui!', user: updatedUser });
  } catch (error) {
    // 👇 PENCEGAT ERROR DUPLIKAT DARI MONGODB (KODE 11000) - Tetap dipertahankan sebagai fail-safe cadangan
    if (error.code === 11000) {
       return res.status(400).json({ pesan: 'Gagal! Nomor HP atau Email ini sudah digunakan oleh akun lain.' });
    }
    
    console.error("Error Update Profil:", error);
    res.status(500).json({ pesan: 'Gagal memperbarui profil.', error: error.message });
  }
});

// =========================================================================
// 4. LOGIN & REGISTER VIA GOOGLE 
// =========================================================================
router.post('/google', async (req, res) => {
    try {
        const { access_token, role, no_hp, alamat, nama_perusahaan, koordinat_lokasi, profil_lahan } = req.body; 

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

        const normalizedRole = normalizeRole(role);

        if (!user && role) {
            if (!isValidRole(normalizedRole) || normalizedRole === 'admin') {
                return res.status(400).json({ pesan: 'Role tidak valid untuk akun Google baru.' });
            }
            // 👇 SATPAM PENGECEK DUPLIKAT KHUSUS GOOGLE LOGIN (TAMBAHKAN INI)
            if (no_hp) {
                const existingHp = await User.findOne({ no_hp: String(no_hp) });
                if (existingHp) {
                    return res.status(400).json({ pesan: 'Gagal! Nomor HP ini sudah digunakan oleh akun lain.' });
                }
            }
            const randomPassword = Math.random().toString(36).slice(-8) + "Agro!23";
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(randomPassword, salt);

            // 👇 INTEGRASI: GENERATE NOMOR SEMENTARA ACAK UNTUK PENGGUNA BARU VIA GOOGLE
            const randomHp = `0800${Math.floor(10000000 + Math.random() * 90000000)}`;

            user = new User({
                nama: name,
                email: email,
                password: hashedPassword,
                role: normalizedRole,
                no_hp: no_hp || randomHp, // Menggunakan nomor acak unik jika tidak dikirim dari FE
                alamat: alamat || 'Belum diatur',
                nama_perusahaan: normalizedRole === 'petani' ? '' : (nama_perusahaan || ''),
                koordinat_lokasi: koordinat_lokasi || null,
                profil_lahan: profil_lahan || undefined
            });
            await user.save();
        }

        const jwtToken = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' } 
        );

        // 👇 REVISI COOKIE CERDAS UNTUK GOOGLE LOGIN
        res.cookie('token', jwtToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

        res.json({
            isNewUser: false,
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
// 5. LUKA SANDI (Request Link via Nodemailer) - PREMIUM UI WITH FIXED ONLINE LOGO
// =========================================================================
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        
        // Mengamankan dari NoSQL Injection
        const user = await User.findOne({ email: String(email) });
        if (!user) {
            return res.status(404).json({ pesan: 'Email tidak terdaftar.' });
        }

        const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
        const resetLink = `${process.env.FRONTEND_URL || 'https://www.agrocelebes.web.id'}/reset-password/${resetToken}`;
        const logoUrl = 'https://www.agrocelebes.web.id/logo.png';

        const message = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; padding: 40px 20px; margin: 0;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #eaeaea;">
                    
                    <div style="text-align: center; margin-bottom: 25px;">
                        <img src="${logoUrl}" alt="Logo AgroCelebes" style="max-height: 70px; width: auto; display: block; margin: 0 auto;" />
                    </div>

                    <h2 style="color: #2E7D32; text-align: center; font-size: 22px; margin-bottom: 20px; font-weight: 700;">Pemulihan Sandi Akun</h2>
                    
                    <p style="color: #333333; font-size: 15px; line-height: 1.6; margin-bottom: 10px;">Halo <strong>${user.nama}</strong>,</p>
                    <p style="color: #555555; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">Kami menerima permintaan untuk mengatur ulang kata sandi akun AgroCelebes Anda. Silakan klik tombol di bawah ini untuk melanjutkan proses pemulihan:</p>
                    
                    <div style="text-align: center; margin: 35px 0;">
                        <a href="${resetLink}" style="background-color: #2E7D32; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(46, 125, 50, 0.25);">Reset Kata Sandi</a>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
                    
                    <p style="color: #888888; font-size: 12.5px; text-align: center; line-height: 1.5; margin-bottom: 15px;">Tautan ini dibuat secara otomatis dan hanya berlaku selama <strong>15 menit</strong> demi keamanan akun Anda. Jika Anda tidak merasa membuat permintaan ini, abaikan dan hapus email ini dengan aman.</p>
                    <p style="color: #aaaaaa; font-size: 11.5px; text-align: center; margin-top: 20px; margin-bottom: 0;">&copy; ${new Date().getFullYear()} AgroCelebes. Hak Cipta Dilindungi.</p>
                </div>
            </div>
        `;

        await sendEmail({
            email: user.email,
            subject: '🔑 Instruksi Reset Sandi AgroCelebes',
            message
        });

        res.json({ pesan: 'Tautan pemulihan sandi telah dikirim ke email Anda!' });
    } catch (error) {
        console.error("Error Forgot Password:", error);
        res.status(500).json({ pesan: 'Terjadi kesalahan pada server backend saat mengirim email.' });
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
    // 👇 REVISI COOKIE CERDAS UNTUK LOGOUT
    res.clearCookie('token', {
        ...cookieOptions
    });
    res.json({ pesan: 'Berhasil logout' });
});

module.exports = router;