const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

// 1. Hubungkan ke akun Cloudinary kamu
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Atur penyimpanan (Storage)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'agrocelebes_komoditas', // Nama folder yang akan otomatis dibuat di Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'], // Format gambar yang diizinkan
    transformation: [{ width: 800, height: 800, crop: 'limit' }] // Kompresi otomatis
  }
});

// 3. Jadikan middleware menggunakan multer
const upload = multer({ storage: storage });

module.exports = { upload, cloudinary };