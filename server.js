const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// --- IMPORT SECURITY LIBRARY ---
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// --- WAJIB UNTUK VERCEL: AGAR RATE LIMITER BACA IP ASLI USER, BUKAN IP VERCEL ---
app.set('trust proxy', 1); 
// -------------------------------------------------------------------------------

// --- PASANG PERISAI KEAMANAN ---
app.use(helmet()); // Menyembunyikan identitas Express dari Hacker

// --- KONFIGURASI CORS DENGAN COOKIE (HttpOnly) ---
app.use(cors({
    origin: function (origin, callback) {
        // Daftar domain pasti yang diizinkan (TAMBAHKAN DOMAIN CUSTOM DI SINI)
        const allowedOrigins = [
            'http://localhost:5173',
            'https://agrocelebes.vercel.app',
            'https://www.agrocelebes.web.id',  // Domain kustom Anda (dengan www)
            'https://agrocelebes.web.id'       // Domain kustom Anda (tanpa www)
        ];
        
        // Izinkan jika origin ada di daftar, ATAU jika origin adalah link Vercel Preview (.vercel.app), ATAU tidak ada origin (Postman)
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            callback(new Error('Akses diblokir oleh CORS Policy'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Mencegah Error OPTIONS (Preflight)
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'] // Mengizinkan pengiriman Cookie & Token
}));

app.use(express.json());
app.use(cookieParser()); // <-- AKTIFKAN MIDDLEWARE COOKIE PARSER

// Membatasi spam request (Anti-DDoS) - Maksimal 150 request per 15 menit per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 150, 
  message: { pesan: 'Terlalu banyak aktivitas dari IP Anda. Harap tunggu 15 menit.' }
});
app.use('/api', limiter); // Berlakukan hanya untuk akses ke /api

// --- ROUTES ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/product'));
app.use('/api/chat', require('./routes/chatbot'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/weather', require('./routes/weather'));
app.use('/api/jurnal', require('./routes/jurnal'));

const PORT = process.env.PORT || 5000;

// PASANG SISTEM ANTI-BADAI DATABASE DI SINI
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10, // Membatasi maksimal 10 jalur antrean agar MongoDB gratis tidak meledak
  serverSelectionTimeoutMS: 5000, // Jika server sibuk, tunggu 5 detik, jangan langsung error
  socketTimeoutMS: 45000, 
})
  .then(() => {
    console.log('✅ Database MongoDB Berhasil Terhubung (Dengan Sistem Anti-Badai)!');
    app.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));
  })
  .catch(err => console.error('❌ Gagal terhubung ke MongoDB:', err));

module.exports = app;