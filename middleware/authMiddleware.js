const jwt = require('jsonwebtoken');

const verifikasiToken = (req, res, next) => {
  // 1. Ambil token dari HttpOnly Cookie (Utama untuk Web/Frontend)
  // req.cookies baru bisa dibaca jika Anda sudah mengaktifkan 'cookie-parser' di server.js
  let token = req.cookies ? req.cookies.token : null;

  // 2. JIKA cookie kosong, coba ambil dari Header Authorization (Cadangan untuk Postman / Mobile App)
  if (!token) {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    }
  }

  // 3. Jika di cookie maupun di header tetap tidak ada token, tolak akses!
  if (!token) {
    return res.status(401).json({ pesan: 'Akses ditolak! Token tidak ditemukan.' });
  }

  try {
    // 4. Verifikasi token menggunakan JWT_SECRET yang murni dari .env
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 5. Simpan data hasil dekripsi (id & role) ke dalam objek req.user
    req.user = decoded; 
    
    // 6. Lanjutkan ke endpoint/middleware berikutnya
    next(); 
  } catch (error) {
    // Jika token kedaluwarsa atau dimanipulasi, kirim status 403 (Forbidden) atau 401
    return res.status(403).json({ pesan: 'Token tidak valid atau telah kedaluwarsa.' });
  }
};

module.exports = verifikasiToken;