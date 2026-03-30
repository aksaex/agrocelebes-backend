const jwt = require('jsonwebtoken');

const verifikasiToken = (req, res, next) => {
  // Ambil token dari header request
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ pesan: 'Akses ditolak! Token tidak ditemukan.' });
  }

  try {
    // Cek apakah token valid (buang kata "Bearer " di depannya)
    const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
    req.user = decoded; // Simpan data user (id & role) ke dalam request
    next(); // Lanjut ke proses berikutnya
  } catch (error) {
    res.status(400).json({ pesan: 'Token tidak valid!' });
  }
};

module.exports = verifikasiToken;