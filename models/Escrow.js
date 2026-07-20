const mongoose = require('mongoose');

const escrowSchema = new mongoose.Schema({
  petani_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Dibuat required: false karena akan diisi saat kontrak berjalan (lifecycle)
  kud_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  pabrik_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  kios_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  
  komoditas: { type: String, required: true },
  tonase: { type: Number, required: true, min: 0.1 },
  nilai_kontrak: { type: Number, required: true, min: 1 },
  
  // Tambahan untuk Demo: Kode VA untuk simulasi bayar
  virtual_account: { type: String, default: () => "VA-" + Math.floor(Math.random() * 1000000) },
  
  status: {
    type: String,
    enum: ['pending', 'verifikasi_lahan', 'dp_locked', 'pupuk_diserahkan', 'selesai'],
    default: 'pending'
  },
  catatan: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Escrow', escrowSchema);