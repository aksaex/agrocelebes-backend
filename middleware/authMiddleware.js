const jwt = require('jsonwebtoken');
const { normalizeRole } = require('../utils/roles');

const ambilToken = (req) => {
  const cookieToken = req.cookies && req.cookies.token;
  if (cookieToken) return cookieToken;

  const authHeader = (req.headers && req.headers.authorization) || (req.header && req.header('Authorization'));
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return null;
};

const verifikasiToken = (req, res, next) => {
  const token = ambilToken(req);

  if (!token) return res.status(401).json({ pesan: 'Akses ditolak! Token tidak ditemukan.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { ...decoded, role: normalizeRole(decoded.role) }; // Berisi { id, role }
    next();
  } catch (error) {
    res.status(403).json({ pesan: 'Token tidak valid.' });
  }
};

// 👇 SATPAM JABATAN (Digunakan nanti di rute Admin/Petani)
const authorizeRoles = (...roles) => {
  const normalizedRoles = roles.map((role) => normalizeRole(role));
  return (req, res, next) => {
    if (!normalizedRoles.includes(normalizeRole(req.user.role))) {
      return res.status(403).json({ pesan: 'Akses ditolak! Role Anda tidak diizinkan.' });
    }
    next();
  };
};

module.exports = verifikasiToken;
module.exports.verifikasiToken = verifikasiToken;
module.exports.authorizeRoles = authorizeRoles;