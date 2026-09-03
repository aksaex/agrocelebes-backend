const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  aktor_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  aksi: { 
    type: String, 
    required: true // Contoh: 'VERIFIKASI_SATELIT', 'SETOR_DP'
  },
  dokumen_terkait: { 
    type: String, 
    required: true // Contoh: 'Escrow', 'User', 'Lelang'
  },
  id_dokumen: { 
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  data_sebelum: { 
    type: Object 
  },
  data_sesudah: { 
    type: Object 
  },
  signature_sha256: { 
    type: String, 
    required: true 
  }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);