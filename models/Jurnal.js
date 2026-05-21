const mongoose = require('mongoose');

const jurnalSchema = new mongoose.Schema({
    petani_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    tipe: { 
        type: String, 
        enum: ['kas', 'jadwal'], 
        required: true 
    },
    // INI YANG BARU: Membedakan Pemasukan dan Pengeluaran
    jenis_kas: {
        type: String,
        enum: ['pemasukan', 'pengeluaran'],
        default: 'pengeluaran' // Defaultnya pengeluaran agar data lama tidak error
    },
    tanggal: { 
        type: String, 
        required: true 
    },
    deskripsi: { 
        type: String, 
        required: true 
    },
    nominal: { 
        type: Number, 
        default: 0 
    },
    status_selesai: { 
        type: Boolean, 
        default: false 
    }
}, { timestamps: true });

module.exports = mongoose.model('Jurnal', jurnalSchema);