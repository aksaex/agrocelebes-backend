const mongoose = require('mongoose');
const crypto = require('crypto');

const bandingKudSchema = new mongoose.Schema({
  kud_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  petani_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  escrow_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Escrow' },
  jenis_sengketa: {
    type: String,
    enum: ['Koreksi_Satelit_NDVI', 'Gagal_Panen_Puso', 'Ketidaksesuaian_Tonase'],
    required: true
  },
  alasan_koreksi: { type: String, required: true },
  data_lama: { type: Object },
  data_baru_manual: { type: Object },
  status: { type: String, enum: ['diajukan', 'disetujui_sistem', 'ditolak'], default: 'diajukan' },
  signature_sha256: { type: String } // Sertifikat Append-Only
}, { timestamps: true });

// Kunci resolusi dengan SHA-256 agar KUD tidak bisa memanipulasi data secara sepihak tanpa jejak
bandingKudSchema.pre('save', function(next) {
  if (!this.signature_sha256) {
    const dataString = `${this.kud_id}-${this.jenis_sengketa}-${JSON.stringify(this.data_baru_manual)}-${Date.now()}`;
    this.signature_sha256 = crypto.createHash('sha256').update(dataString).digest('hex');
  }
  next();
});

module.exports = mongoose.model('BandingKud', bandingKudSchema);