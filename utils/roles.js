const LEGACY_ROLE_MAP = {
  pembeli: 'kud'
};

// 👇 PERBAIKAN: Tambahkan 'logistik' ke dalam array VALID_ROLES
const VALID_ROLES = ['petani', 'kud', 'pabrik', 'kios', 'admin', 'logistik'];

const normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return null;
  const normalized = role.toLowerCase().trim();
  return LEGACY_ROLE_MAP[normalized] || normalized;
};

const isValidRole = (role) => VALID_ROLES.includes(normalizeRole(role));

module.exports = {
  VALID_ROLES,
  normalizeRole,
  isValidRole
};