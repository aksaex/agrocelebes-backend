const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// --- IMPORT SECURITY LIBRARY ---
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// --- WAJIB UNTUK VERCEL: Agar rate limiter membaca IP asli user ---
app.set('trust proxy', 1); 

// --- PASANG PERISAI KEAMANAN ---
///app.use(helmet()); 
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

// --- KONFIGURASI CORS (Dioptimasi untuk Debugging) ---
const allowedOrigins = [
    'http://localhost:5173',
    'https://agrocelebes.vercel.app',
    'https://www.agrocelebes.web.id',
    'https://agrocelebes.web.id'
];

app.use(cors({
    origin: function (origin, callback) {
        // !origin memungkinkan request dari browser yang tidak mengirim origin (misal: Postman/Curl)
        // Jika ingin super ketat, hapus !origin
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error(`🚫 CORS Terblokir: ${origin}`);
            callback(new Error('Akses diblokir oleh CORS Policy'));
        }
    },
    credentials: true, // WAJIB untuk mengirim Cookie (HttpOnly)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'] 
    // Catatan: 'Cookie' tidak perlu dimasukkan di allowedHeaders secara manual, 
    // karena browser yang mengelola cookie secara otomatis via credentials: true
}));

app.use(express.json());
app.use(cookieParser()); 

// --- ANTI-SPAM (Rate Limiter) ---
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 150, 
    message: { pesan: 'Terlalu banyak aktivitas. Harap tunggu 15 menit.' }
});
app.use('/api', limiter);

// --- KONEKSI MONGODB (Optimasi Serverless) ---
// Kita simpan status koneksi agar tidak melakukan koneksi ulang setiap kali fungsi dipanggil
let isConnected = false;

const connectDB = async () => {
    if (isConnected) return;

    try {
        const db = await mongoose.connect(process.env.MONGO_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
        });
        isConnected = db.connections[0].readyState;
        console.log('✅ MongoDB Berhasil Terhubung');
    } catch (err) {
        console.error('❌ Gagal terhubung ke MongoDB:', err.message);
        // Jangan hentikan proses jika di serverless, biar request lain bisa mencoba lagi
    }
};

// Panggil koneksi sebelum route
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// --- ROUTES ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/product'));
app.use('/api/chat', require('./routes/chatbot'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/weather', require('./routes/weather'));
app.use('/api/jurnal', require('./routes/jurnal'));

// --- HANDLING UNTUK LOCAL DEVELOPMENT ---
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));
}

// --- WAJIB UNTUK VERCEL ---
module.exports = app;