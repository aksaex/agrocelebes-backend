const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  petani_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nama_komoditas: { type: String, required: true }, // contoh: Biji Kopi Toraja
  kategori: { type: String, required: true }, // contoh: Kopi, Kakao, Rempah
  harga_per_kg: { type: Number, required: true },
  stok_kg: { type: Number, required: true },
  deskripsi: { type: String },
  image_url: { type: String } // Nanti diisi link dari Cloudinary
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);