const mongoose = require('mongoose');

const jurnalTaniSchema = new mongoose.Schema({
  petani_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  escrow_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Escrow' 
  },
  jenis_aktivitas: { 
    type: String, 
    enum: ['Pemupukan', 'Pestisida', 'Pengairan', 'Penyiangan', 'Lainnya'],
    required: true 
  },
  detail_kegiatan: { 
    type: String, 
    required: true // Contoh: "Memberikan pupuk Urea 50kg (Organik)"
  },
  foto_bukti: { 
    type: String 
  },
  tanggal_kegiatan: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

module.exports = mongoose.model('JurnalTani', jurnalTaniSchema);