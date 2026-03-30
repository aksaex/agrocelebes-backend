const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// --- IMPORT SECURITY LIBRARY ---
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// --- PASANG PERISAI KEAMANAN ---
app.use(helmet()); // Menyembunyikan identitas Express dari Hacker
app.use(cors());
app.use(express.json());

// Membatasi spam request (Anti-DDoS) - Maksimal 100 request per 15 menit per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: { pesan: 'Terlalu banyak aktivitas dari IP Anda. Harap tunggu 15 menit.' }
});
app.use('/api', limiter); // Berlakukan hanya untuk akses ke /api

// --- ROUTES ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/product'));
app.use('/api/chat', require('./routes/chatbot'));
app.use('/api/admin', require('./routes/admin'));

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Database MongoDB Berhasil Terhubung!');
    app.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));
  })
  .catch(err => console.error('❌ Gagal terhubung ke MongoDB:', err));

module.exports = app;