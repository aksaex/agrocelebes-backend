const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const validateEnvironment = require('./utils/validateEnv');

// --- IMPORT SECURITY LIBRARY ---
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
validateEnvironment();

// =========================================================================
// 🌟 INITIALIZE MONGOOSE MODELS REGISTRY (PENCEGAH CIRCULAR DEPENDENCY BUG)
// =========================================================================
// Memaksa Node.js memuat skema ke memori global Mongoose saat aplikasi dinyalakan.
require('./models/User');
require('./models/Escrow');
require('./models/Lelang'); // Ditambahkan untuk inisialisasi model lelang
require('./models/AuditLog'); // Ditambahkan untuk inisialisasi model audit

// --- WAJIB UNTUK VERCEL: Agar rate limiter membaca IP asli user ---
app.set('trust proxy', 1); 

// --- PASANG PERISAI KEAMANAN ---
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

// --- KONFIGURASI CORS (Solusi Pasti untuk Vercel & Cookie) ---
const corsOptions = {
    origin: [
        'http://localhost:5173',
        'https://agrocelebes.vercel.app',
        'https://www.agrocelebes.web.id',
        'https://agrocelebes.web.id'
    ],
    credentials: true, // WAJIB TRUE untuk menerima HttpOnly Cookie
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
};

app.use(cors(corsOptions));

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
    }
};

app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// --- ROUTES ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user')); 
app.use('/api/chat', require('./routes/chatbot'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/weather', require('./routes/weather'));
app.use('/api/jurnal', require('./routes/jurnal'));
app.use('/api/escrow', require('./routes/escrow'));
app.use('/api/satellite', require('./routes/satellite'));
app.use('/api/bank', require('./routes/bank'));

// 🌟 RUTE BARU: BURSA LELANG B2B PABRIK
app.use('/api/lelang', require('./routes/lelang'));

// --- HANDLING UNTUK LOCAL DEVELOPMENT ---
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));
}

// --- WAJIB UNTUK VERCEL ---
module.exports = app;