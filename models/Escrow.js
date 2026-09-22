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

  // =====================================================================
  // KEUANGAN KONTRAK (Menjawab kritik juri: revenue, biaya, & profitabilitas)
  // Penjelasan Juri: "Kontrak bukan hanya nilai transaksi, tapi kami bedah
  // gross revenue, biaya produksi, fee platform, sampai net income petani."
  // =====================================================================
  gross_revenue: { type: Number, default: 0 },
  biaya_produksi: { type: Number, default: 0 },
  platform_fee: { type: Number, default: 0 },
  net_income: { type: Number, default: 0 },

  // Mitigasi risiko gagal panen (asuransi Jasindo)
  status_asuransi_jasindo: { type: Boolean, default: false },
  
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