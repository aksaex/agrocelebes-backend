const express = require('express');
const crypto = require('crypto');
const Escrow = require('../models/Escrow');
const User = require('../models/User');
const Lelang = require('../models/Lelang');
const AuditLog = require('../models/AuditLog');
const { verifikasiToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

const withUsers = (query) => query
  .populate('petani_id', 'nama role koordinat_lokasi profil_lahan')
  .populate('kud_id', 'nama role nama_perusahaan')
  .populate('pabrik_id', 'nama role nama_perusahaan')
  .populate('kios_id', 'nama role nama_perusahaan');

// ==========================================
// 🛡️ FUNGSI HELPER: IMMUTABLE AUDIT TRAIL
// ==========================================
const catatAudit = async (aktorId, aksi, namaDokumen, idDokumen, oldData, newData) => {
  try {
    // 1. Bangun string data untuk di-hash
    const dataString = `${aktorId}-${aksi}-${idDokumen}-${JSON.stringify(newData)}-${Date.now()}`;
    
    // 2. Hasilkan SHA-256 secara manual di sini
    const signature = crypto.createHash('sha256').update(dataString).digest('hex');

    // 3. Simpan ke database beserta signature-nya
    await AuditLog.create({
      aktor_id: aktorId,
      aksi: aksi,
      dokumen_terkait: namaDokumen,
      id_dokumen: idDokumen,
      data_sebelum: oldData || {},
      data_sesudah: newData || {},
      signature_sha256: signature
    });
  } catch (err) {
    console.error('Gagal mencatat audit trail (SHA-256):', err.message);
  }
};

// ==========================================
// 🌟 RUTE: AMBIL KONTRAK AKTIF PETANI
// ==========================================
router.get('/petani-aktif', verifikasiToken, authorizeRoles('petani', 'admin'), async (req, res) => {
  try {
    const kontrak = await Escrow.findOne({ petani_id: req.user.id }).sort({ createdAt: -1 });
    res.json(kontrak);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal mengambil kontrak', error: error.message });
  }
});

// ==========================================
// 🌟 RUTE: AJUKAN PINJAMAN & AUTO-AGREGASI LELANG
// ==========================================
router.post('/ajukan-pinjaman', verifikasiToken, authorizeRoles('petani', 'admin'), async (req, res) => {
  try {
    const petani = await User.findById(req.user.id);
    const luas = petani.profil_lahan?.luas_lahan_ha || 1;
    const targetTonase = luas * 5; 
    const hargaPerTon = 7200000;  
    const totalNilaiKontrak = targetTonase * hargaPerTon;

    // 1. Buat Kontrak Escrow Petani
    const kontrakBaru = await Escrow.create({
      petani_id: req.user.id,
      komoditas: 'Gabah Premium Demo',
      tonase: targetTonase,
      nilai_kontrak: totalNilaiKontrak,
      status: 'pending',
      catatan: `Kontrak diajukan untuk lahan ${luas} Ha.`
    });

    // 2. 🤖 MESIN MATCHMAKING: AUTO-AGREGASI LELANG B2B
    const defaultKud = await User.findOne({ role: 'kud' }); 
    
    let lelangAktif = await Lelang.findOne({ status: 'open', komoditas: 'Gabah Premium Demo' });
    
    if (!lelangAktif && defaultKud) {
      lelangAktif = await Lelang.create({
        kud_id: defaultKud._id,
        komoditas: 'Gabah Premium Demo',
        tonase_target: 30, // Kuota minimum industri
        tonase_terkumpul: targetTonase,
        petani_tergabung: [req.user.id]
      });
    } else if (lelangAktif) {
      lelangAktif.tonase_terkumpul += targetTonase;
      if (!lelangAktif.petani_tergabung.includes(req.user.id)) {
        lelangAktif.petani_tergabung.push(req.user.id);
      }
      if (lelangAktif.tonase_terkumpul >= lelangAktif.tonase_target) {
        lelangAktif.status = 'closed'; // Siap di-bid oleh Pabrik
      }
      await lelangAktif.save();
    }

    // 3. Catat Audit Log Anti-Manipulasi
    await catatAudit(req.user.id, 'AJUKAN_PINJAMAN_DAN_AGREGASI', 'Escrow', kontrakBaru._id, null, kontrakBaru.toObject());

    res.status(201).json({ 
      kontrak: kontrakBaru, 
      lelang_info: lelangAktif ? `Tergabung dalam lelang. Terkumpul: ${lelangAktif.tonase_terkumpul}/${lelangAktif.tonase_target} Ton` : '' 
    });
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal memproses pengajuan', error: error.message });
  }
});

// ==========================================
// 🌟 RUTE: AMBIL DAFTAR ESCROW
// ==========================================
router.get('/', verifikasiToken, authorizeRoles('petani', 'kud', 'pabrik', 'kios', 'admin'), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'petani') query = { petani_id: req.user.id };
    else if (req.user.role === 'kud') query = { $or: [{ status: 'pending' }, { kud_id: req.user.id }] };
    else if (req.user.role === 'pabrik') query = { $or: [{ status: 'verifikasi_lahan' }, { pabrik_id: req.user.id }] };
    else if (req.user.role === 'kios') query = { $or: [{ status: 'dp_locked' }, { kios_id: req.user.id }] };

    const data = await withUsers(Escrow.find(query).sort({ createdAt: -1 }));
    res.json(data);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal mengambil data', error: error.message });
  }
});

router.get('/agregasi/tonase', verifikasiToken, authorizeRoles('kud', 'pabrik', 'admin'), async (req, res) => {
  try {
    const contracts = await Escrow.find();
    const totalPerKomoditas = contracts.reduce((acc, item) => {
      const key = item.komoditas || 'Tanpa Kategori';
      acc[key] = (acc[key] || 0) + item.tonase;
      return acc;
    }, {});
    res.json(totalPerKomoditas);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal menghitung agregasi', error: error.message });
  }
});

// ==========================================
// 🌟 RUTE ESTAFET: KUD VERIFIKASI + BPD SIMULASI
// ==========================================
router.put('/:id/verify-land', verifikasiToken, authorizeRoles('kud', 'admin'), async (req, res) => {
  try {
    const doc = await Escrow.findById(req.params.id);
    if (!doc) return res.status(404).json({ pesan: 'Data tidak ditemukan' });

    const oldData = doc.toObject();
    if (req.user.role === 'kud') doc.kud_id = req.user.id;
    
    // Status bergerak maju
    doc.status = 'verifikasi_lahan';
    
    // 🏦 TRIGGER SIMULASI BPD: Generate Virtual Account Otomatis
    // Menggunakan prefix 8888 (Simulasi BPD Sulselbar)
    doc.virtual_account = `8888${Math.floor(10000000 + Math.random() * 90000000)}`;
    doc.catatan = `Lahan diverifikasi. Menunggu DP Pabrik via VA BPD: ${doc.virtual_account}`;
    
    await doc.save();
    
    // Kunci aksi dengan SHA-256
    await catatAudit(req.user.id, 'VERIFIKASI_LAHAN_&_CREATE_VA', 'Escrow', doc._id, oldData, doc.toObject());
    
    res.json(doc);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal verifikasi lahan', error: error.message });
  }
});

// ==========================================
// 🌟 RUTE ESTAFET: PABRIK SETOR DP + LOGGING
// ==========================================
router.put('/:id/pay-dp', verifikasiToken, authorizeRoles('pabrik', 'admin'), async (req, res) => {
  try {
    const doc = await Escrow.findById(req.params.id);
    if (!doc) return res.status(404).json({ pesan: 'Data tidak ditemukan' });

    const oldData = doc.toObject();
    if (req.user.role === 'pabrik') doc.pabrik_id = req.user.id;
    doc.status = 'dp_locked';
    
    await doc.save();
    
    await catatAudit(req.user.id, 'PABRIK_SETOR_DP', 'Escrow', doc._id, oldData, doc.toObject());
    
    res.json(doc);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal memproses DP', error: error.message });
  }
});

// ==========================================
// 🌟 RUTE ESTAFET: KIOS SERAHKAN PUPUK
// ==========================================
router.put('/:id/deliver-fertilizer', verifikasiToken, authorizeRoles('kios', 'admin'), async (req, res) => {
  try {
    const doc = await Escrow.findById(req.params.id);
    if (!doc) return res.status(404).json({ pesan: 'Data tidak ditemukan' });

    const oldData = doc.toObject();
    if (req.user.role === 'kios') doc.kios_id = req.user.id;
    doc.status = 'pupuk_diserahkan';
    
    await doc.save();
    
    await catatAudit(req.user.id, 'KIOS_SERAHKAN_PUPUK', 'Escrow', doc._id, oldData, doc.toObject());
    
    res.json(doc);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal serah pupuk', error: error.message });
  }
});

// ==========================================
// 🌟 RUTE PENUTUPAN KONTRAK
// ==========================================
router.put('/:id/complete', verifikasiToken, authorizeRoles('petani', 'admin'), async (req, res) => {
  try {
    const doc = await Escrow.findById(req.params.id);
    if (!doc) return res.status(404).json({ pesan: 'Data tidak ditemukan' });

    const oldData = doc.toObject();
    doc.status = 'selesai';
    
    await doc.save();
    
    await catatAudit(req.user.id, 'KONTRAK_SELESAI', 'Escrow', doc._id, oldData, doc.toObject());
    
    res.json(doc);
  } catch (error) {
    res.status(500).json({ pesan: 'Gagal menutup kontrak', error: error.message });
  }
});

module.exports = router;