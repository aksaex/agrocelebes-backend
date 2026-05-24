const jwt = require('jsonwebtoken');

const verifikasiToken = (req, res, next) => {
  const token = req.cookies.token; // Ambil dari HttpOnly Cookie

  if (!token) return res.status(401).json({ pesan: 'Akses ditolak! Token tidak ditemukan.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Berisi { id, role }
    next();
  } catch (error) {
    res.status(403).json({ pesan: 'Token tidak valid.' });
  }
};

// 👇 SATPAM JABATAN (Digunakan nanti di rute Admin/Petani)
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ pesan: 'Akses ditolak! Role Anda tidak diizinkan.' });
    }
    next();
  };
};

module.exports = { verifikasiToken, authorizeRoles };