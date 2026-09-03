const mongoose = require('mongoose');

const lelangSchema = new mongoose.Schema({
  kud_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  komoditas: { 
    type: String, 
    default: 'Gabah Premium' 
  },
  tonase_target: { 
    type: Number, 
    required: true, 
    default: 30 // Kuota minimum industri
  },
  tonase_terkumpul: { 
    type: Number, 
    default: 0 
  },
  // Daftar petani gurem yang diagregasi ke dalam lelang ini
  petani_tergabung: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  // Daftar penawaran dari pabrik offtaker (Reverse Auction)
  bids: [{
    pabrik_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    harga_per_ton: Number,
    dp_disetor: Number,
    waktu_bid: { type: Date, default: Date.now }
  }],
  status: { 
    type: String, 
    enum: ['open', 'closed', 'executed'], 
    default: 'open' 
  },
  pemenang_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Lelang', lelangSchema);